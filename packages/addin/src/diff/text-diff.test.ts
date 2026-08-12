import assert from "node:assert/strict";
import test from "node:test";
import { changedResultWordIndexes, comparisonParts, grammarComparisonParts } from "./text-diff.js";

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
