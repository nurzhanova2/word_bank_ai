import assert from "node:assert/strict";
import test from "node:test";
import type { AiProvider } from "../providers/types.js";
import { LlmGrammarEngine } from "./llm-grammar-engine.js";

function provider(result: string): AiProvider {
  return { name: "test", transform: async () => result };
}

function structuredProvider(result: string): AiProvider {
  return {
    name: "qwen-test",
    transform: async () => "legacy output must not be used",
    completeGrammarReview: async () => result
  };
}

test("accepts Qwen corrections only through the strict JSON contract", async () => {
  const source = "Оплота приняты.";
  const result = JSON.stringify({ version: 1, corrections: [
    { offset: 0, original: "Оплота", replacement: "Оплата", message: "Опечатка", category: "spelling", confidence: 0.96 },
    { offset: 7, original: "приняты", replacement: "принята", message: "Согласование", category: "grammar", confidence: 0.91 }
  ] });
  const issues = await new LlmGrammarEngine(structuredProvider(result)).check(source, "ru");
  assert.deepEqual(issues.map(({ offset, original, replacements, source: engine }) => ({ offset, original, replacements, engine })), [
    { offset: 0, original: "Оплота", replacements: ["Оплата"], engine: "qwen-json" },
    { offset: 7, original: "приняты", replacements: ["принята"], engine: "qwen-json" }
  ]);
});

test("rejects malformed JSON and corrections whose source range does not match", async () => {
  const malformed = new LlmGrammarEngine(structuredProvider("Оплата принята."));
  await assert.rejects(() => malformed.check("Оплота приняты.", "ru"), /JSON/u);
  const mismatched = new LlmGrammarEngine(structuredProvider(JSON.stringify({ version: 1, corrections: [
    { offset: 0, original: "Выдумано", replacement: "Оплата", message: "Ошибка", category: "spelling", confidence: 0.9 }
  ] })));
  await assert.rejects(() => mismatched.check("Оплота приняты.", "ru"), /диапазон/u);
});

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
