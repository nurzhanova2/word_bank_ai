import assert from "node:assert/strict";
import test from "node:test";
import { applySelectedGrammarIssues, changedResultWordIndexes, comparisonParts, grammarComparisonParts } from "./text-diff.js";

test("diff marks only inserted and replaced result words", () => {
  assert.deepEqual([...changedResultWordIndexes("Банк рассмотрел документ", "Банк быстро проверил документ")], [1, 2]);
});

test("diff keeps repeated unchanged words stable", () => {
  assert.deepEqual([...changedResultWordIndexes("очень важный документ", "очень важный и точный документ")], [2, 3]);
});

test("grammar comparison renders exact punctuation edits instead of duplicating whole texts", () => {
  const parts = grammarComparisonParts("Документы , готовы.", [{
    offset: 9, length: 2, original: " ,", message: "Пробел", category: "punctuation",
    replacements: [","], confidence: .9, source: "test", ruleId: "SPACE"
  }]);
  assert.deepEqual(parts, [
    { kind: "plain", text: "Документы" },
    { kind: "removed", text: " ," },
    { kind: "added", text: "," },
    { kind: "plain", text: " готовы." }
  ]);
});

test("grammar comparison visibly marks unresolved findings without changing text", () => {
  const parts = grammarComparisonParts("Заявление были заполнено.", [{
    offset: 10, length: 14, original: "были заполнено", message: "Согласование", category: "grammar",
    replacements: [], confidence: .65, source: "test", ruleId: "AGREEMENT"
  }]);
  assert.deepEqual(parts, [
    { kind: "plain", text: "Заявление " },
    { kind: "review", text: "были заполнено" },
    { kind: "plain", text: "." }
  ]);
});

test("transformation comparison is a single inline diff instead of two complete texts", () => {
  assert.deepEqual(comparisonParts("Банк рассмотрел документ.", "Банк быстро проверил документ."), [
    { kind: "plain", text: "Банк " },
    { kind: "removed", text: "рассмотрел" },
    { kind: "added", text: "быстро проверил " },
    { kind: "plain", text: "документ." }
  ]);
});

test("applies one selected correction without applying neighboring findings", () => {
  const source = "Оплота приняты.";
  const issues = [
    { offset: 0, length: 6, original: "Оплота", message: "", category: "spelling" as const, replacements: ["Оплата"], confidence: .9, source: "qwen-json", ruleId: "1" },
    { offset: 7, length: 7, original: "приняты", message: "", category: "grammar" as const, replacements: ["принята"], confidence: .9, source: "qwen-json", ruleId: "2" }
  ];
  assert.equal(applySelectedGrammarIssues(source, [issues[1]!]), "Оплота принята.");
  assert.equal(applySelectedGrammarIssues(source, issues), "Оплата принята.");
});
