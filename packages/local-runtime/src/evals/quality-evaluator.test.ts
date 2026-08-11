import assert from "node:assert/strict";
import test from "node:test";
import type { AiProvider } from "../providers/types.js";
import { evaluateCases, type QualityEvalCase } from "./quality-evaluator.js";

const cases: QualityEvalCase[] = [
  {
    id: "shorten-contract",
    action: "shorten",
    input: "Первое важное условие договора. Второе повторяющееся пояснение к условию.",
    assertions: { maxLengthRatio: 0.8, preserveParagraphCount: true }
  },
  {
    id: "preserve-bank-details",
    action: "grammar",
    input: "ТОО «Банк Решений», БИН 123456789012\nИИК KZ86125KZT5004100100",
    assertions: { preserveRequisites: true, preserveParagraphCount: true }
  }
];

test("quality evaluator reports every failed invariant without hiding successful cases", async () => {
  const outputs = new Map([
    ["shorten-contract", "Важное условие договора.\nЛишний абзац."],
    ["preserve-bank-details", "ТОО «Другой Банк», БИН 999999999999\nИИК KZ000000000000000000"]
  ]);
  let index = 0;
  const provider: AiProvider = {
    name: "fixture",
    async transform() {
      return outputs.get(cases[index++]!.id)!;
    }
  };

  const report = await evaluateCases(provider, cases);

  assert.equal(report.total, 2);
  assert.equal(report.passed, 0);
  assert.equal(report.results[0]?.checks.some((check) => check.id === "paragraph-count" && !check.passed), true);
  assert.equal(report.results[1]?.checks.some((check) => check.id === "requisites" && !check.passed), true);
});

test("quality evaluator accepts outputs satisfying deterministic quality gates", async () => {
  const outputs = [
    "Важное условие договора.",
    "ТОО «Банк Решений», БИН 123456789012\nИИК KZ86125KZT5004100100"
  ];
  let index = 0;
  const provider: AiProvider = {
    name: "fixture",
    async transform() {
      return outputs[index++]!;
    }
  };

  const report = await evaluateCases(provider, cases);
  assert.equal(report.passed, 2);
  assert.equal(report.score, 1);
});
