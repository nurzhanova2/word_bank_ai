import assert from "node:assert/strict";
import test from "node:test";
import { createProvider, isAcceptableResult, MockAiProvider } from "./provider.js";

test("mock provider supports every MVP action", async () => {
  const provider = new MockAiProvider();
  const cases = [
    ["rewrite", {}],
    ["shorten", {}],
    ["formalize", {}],
    ["grammar", {}],
    ["translate", { targetLanguage: "kk" }],
    ["expand", {}],
    ["tone", { targetTone: "polite" }],
    ["summary", {}]
  ] as const;

  for (const [action, options] of cases) {
    const result = await provider.transform(action, "Тестовый текст для документа", options);
    assert.ok(result.length > 0);
  }
});

test("LiteLLM provider reads the corporate LLM configuration", () => {
  const previous = {
    provider: process.env.BANK_AI_PROVIDER,
    apiKey: process.env.LLM_API_KEY,
    apiBase: process.env.LLM_API_BASE,
    model: process.env.LLM_MODEL
  };

  try {
    process.env.BANK_AI_PROVIDER = "litellm";
    process.env.LLM_API_KEY = "test-key";
    process.env.LLM_API_BASE = "https://prod-litellm.nationalbank.kz";
    process.env.LLM_MODEL = "Qwen/Qwen3.5-35B-A3B-FP8";

    assert.equal(createProvider().name, "llm:Qwen/Qwen3.5-35B-A3B-FP8");
  } finally {
    for (const [name, value] of Object.entries({
      BANK_AI_PROVIDER: previous.provider,
      LLM_API_KEY: previous.apiKey,
      LLM_API_BASE: previous.apiBase,
      LLM_MODEL: previous.model
    })) {
      if (value === undefined) delete process.env[name];
      else process.env[name] = value;
    }
  }
});

test("summary may omit secondary numbers but cannot alter or invent them", () => {
  const source = "Договор № 417 от 10.08.2026 на сумму 125 000 тенге. Приложение содержит 8 страниц.";
  assert.equal(
    isAcceptableResult("summary", source, "Договор № 417 от 10.08.2026 заключён на сумму 125 000 тенге."),
    true
  );
  assert.equal(isAcceptableResult("summary", source, "Договор № 999 заключён."), false);
  assert.equal(isAcceptableResult("rewrite", source, "Договор № 417 заключён."), false);
});
