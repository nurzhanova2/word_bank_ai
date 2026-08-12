import assert from "node:assert/strict";
import test from "node:test";
import type { AiProvider } from "../providers/types.js";
import { LlmGrammarEngine } from "./llm-grammar-engine.js";

function provider(result: string): AiProvider {
  return { name: "test", transform: async () => result };
}

test("turns multiple contextual LLM corrections into separate exact issues", async () => {
  const source = "Оплота приняты. Документы были заполнено.";
  const result = "Оплата принята. Документы были заполнены.";
  const issues = await new LlmGrammarEngine(provider(result)).check(source, "ru");
  assert.deepEqual(issues.map(({ original, replacements }) => ({ original, replacements })), [
    { original: "Оплота", replacements: ["Оплата"] },
    { original: "приняты", replacements: ["принята"] },
    { original: "заполнено", replacements: ["заполнены"] }
  ]);
});

test("does not let an LLM replace an approved correct Kazakh banking term", async () => {
  const source = "Реквизиттер өзгерген жоқ.";
  const result = "Реквизит тер өзгерген жоқ.";
  assert.deepEqual(await new LlmGrammarEngine(provider(result)).check(source, "kk"), []);
});
