import assert from "node:assert/strict";
import { once } from "node:events";
import type { AddressInfo } from "node:net";
import test from "node:test";
import { actionDefinitions } from "@bank-ai/contracts";
import { createApp } from "./app.js";
import { MockAiProvider } from "./provider.js";
import { ProviderAuthenticationError, ResultValidationError } from "./errors.js";

test("health exposes the current application version", async () => {
  const server = createApp(new MockAiProvider()).listen(0, "127.0.0.1");
  await once(server, "listening");
  try {
    const port = (server.address() as AddressInfo).port;
    const response = await fetch(`http://127.0.0.1:${port}/health`);
    const body = await response.json() as { version: string };
    assert.equal(body.version, "0.7.0");
  } finally {
    await new Promise<void>((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
  }
});

test("API accepts every action declared in the shared registry", async () => {
  const server = createApp(new MockAiProvider()).listen(0, "127.0.0.1");
  await once(server, "listening");
  const port = (server.address() as AddressInfo).port;

  try {
    for (const definition of actionDefinitions) {
      const payload: Record<string, string> = {
        action: definition.id,
        text: "Тестовый фрагмент документа"
      };
      if (definition.option) {
        payload[definition.option.requestField] = definition.option.choices[0]!.value;
      }
      const response = await fetch(`http://127.0.0.1:${port}/api/v1/transform`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(payload)
      });
      assert.equal(response.status, 200, `${definition.id} was rejected by API schema`);
    }
  } finally {
    await new Promise<void>((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
  }
});

test("API exposes typed safe provider errors with an operation ID", async () => {
  for (const [providerError, expectedStatus, expectedCode] of [
    [new ProviderAuthenticationError(), 401, "INVALID_API_KEY"],
    [new ResultValidationError(), 422, "RESULT_VALIDATION_FAILED"]
  ] as const) {
    const provider = {
      name: "failing",
      async transform() { throw providerError; }
    };
    const server = createApp(provider).listen(0, "127.0.0.1");
    await once(server, "listening");
    try {
      const port = (server.address() as AddressInfo).port;
      const response = await fetch(`http://127.0.0.1:${port}/api/v1/transform`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ action: "rewrite", text: "Текст" })
      });
      const body = await response.json() as { error: { code: string; operationId?: string } };
      assert.equal(response.status, expectedStatus);
      assert.equal(body.error.code, expectedCode);
      assert.ok(body.error.operationId);
    } finally {
      await new Promise<void>((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
    }
  }
});

test("grammar API returns detected language, individual issues and corrected text", async () => {
  const grammarService = {
    async check(text: string) {
      return {
        language: "ru" as const,
        correctedText: text.replace("были", "была"),
        engines: ["test"],
        hunspellValidation: [],
        issues: [{
          offset: 7, length: 4, original: "были", message: "Согласование", category: "grammar" as const,
          replacements: ["была"], confidence: .9, source: "test", ruleId: "AGREEMENT"
        }]
      };
    }
  };
  const server = createApp(new MockAiProvider(), undefined, grammarService).listen(0, "127.0.0.1");
  await once(server, "listening");
  try {
    const port = (server.address() as AddressInfo).port;
    const response = await fetch(`http://127.0.0.1:${port}/api/v1/grammar/check`, {
      method: "POST", headers: { "content-type": "application/json" },
      body: JSON.stringify({ text: "Оплата были получена." })
    });
    const body = await response.json() as { language: string; correctedText: string; issues: unknown[] };
    assert.equal(response.status, 200);
    assert.equal(body.language, "ru");
    assert.equal(body.correctedText, "Оплата была получена.");
    assert.equal(body.issues.length, 1);
  } finally {
    await new Promise<void>((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
  }
});

test("protected API requires the runtime session and rejects an untrusted origin", async () => {
  const server = createApp(new MockAiProvider(), undefined, undefined, { sessionToken: "test-session" }).listen(0, "127.0.0.1");
  await once(server, "listening");
  try {
    const port = (server.address() as AddressInfo).port;
    const url = `http://127.0.0.1:${port}/api/v1/transform`;
    const payload = JSON.stringify({ action: "rewrite", text: "Текст" });
    const missing = await fetch(url, { method: "POST", headers: { "content-type": "application/json" }, body: payload });
    assert.equal(missing.status, 401);
    const wrongOrigin = await fetch(url, { method: "POST", headers: { "content-type": "application/json", origin: "https://example.test", "x-bank-ai-session": "test-session" }, body: payload });
    assert.equal(wrongOrigin.status, 403);
    const accepted = await fetch(url, { method: "POST", headers: { "content-type": "application/json", "x-bank-ai-session": "test-session" }, body: payload });
    assert.equal(accepted.status, 200);
  } finally { await new Promise<void>((resolve, reject) => server.close((error) => error ? reject(error) : resolve())); }
});

test("diagnostics omit session credentials and unknown API GET is JSON 404", async () => {
  const server = createApp(new MockAiProvider(), undefined, undefined, { sessionToken: "secret-session", diagnostics: { languageTool: { status: "unavailable" } } }).listen(0, "127.0.0.1");
  await once(server, "listening");
  try {
    const port = (server.address() as AddressInfo).port;
    const diagnostics = await (await fetch(`http://127.0.0.1:${port}/api/v1/diagnostics`, { headers: { "x-bank-ai-session": "secret-session" } })).text();
    assert.doesNotMatch(diagnostics, /secret-session/u);
    const response = await fetch(`http://127.0.0.1:${port}/api/v1/missing`, { headers: { "x-bank-ai-session": "secret-session" } });
    assert.equal(response.status, 404);
    assert.equal((await response.json() as { error: { code: string } }).error.code, "NOT_FOUND");
  } finally { await new Promise<void>((resolve, reject) => server.close((error) => error ? reject(error) : resolve())); }
});
