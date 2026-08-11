import assert from "node:assert/strict";
import { once } from "node:events";
import type { AddressInfo } from "node:net";
import test from "node:test";
import { actionDefinitions } from "@bank-ai/contracts";
import { createApp } from "./app.js";
import { MockAiProvider } from "./provider.js";

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
