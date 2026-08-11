import assert from "node:assert/strict";
import test from "node:test";
import { MockAiProvider } from "./provider.js";

test("mock provider supports every MVP action", async () => {
  const provider = new MockAiProvider();
  for (const action of ["rewrite", "shorten", "formalize"] as const) {
    const result = await provider.transform(action, "Тестовый текст для документа");
    assert.ok(result.length > 0);
  }
});
