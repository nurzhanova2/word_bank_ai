import assert from "node:assert/strict";
import test from "node:test";
import type { GrammarEngine, GrammarIssue, TextLanguage } from "./types.js";
import { GrammarService, applyGrammarIssues } from "./grammar-service.js";

function engine(name: string, languages: TextLanguage[], issue: Omit<GrammarIssue, "source">): GrammarEngine {
  return {
    name,
    supports: (language) => languages.includes(language),
    check: async () => [{ ...issue, source: name }]
  };
}

test("routes RU and EN segments to LanguageTool and keeps global offsets", async () => {
  const lt = engine("languagetool", ["ru", "en"], {
    offset: 0, length: 4, original: "test", message: "Ошибка", category: "grammar",
    replacements: ["fixed"], confidence: 0.9, ruleId: "TEST"
  });
  const service = new GrammarService([lt]);
  const result = await service.check("Тест.\nTest.");
  assert.equal(result.language, "mixed");
  assert.deepEqual(result.issues.map((issue) => issue.offset), [0, 6]);
});

test("applies accepted issues from right to left without shifting offsets", () => {
  const text = "Оплата были получены и документы был принят.";
  const issues: GrammarIssue[] = [
    { offset: 7, length: 13, original: "были получены", message: "", category: "grammar", replacements: ["была получена"], confidence: .9, source: "test", ruleId: "1" },
    { offset: 33, length: 10, original: "был принят", message: "", category: "grammar", replacements: ["были приняты"], confidence: .9, source: "test", ruleId: "2" }
  ];
  assert.equal(applyGrammarIssues(text, issues), "Оплата была получена и документы были приняты.");
});

test("does not apply overlapping grammar suggestions twice", () => {
  const issues: GrammarIssue[] = [
    { offset: 0, length: 6, original: "Оплата", message: "", category: "grammar", replacements: ["Платёж"], confidence: .9, source: "test", ruleId: "wide" },
    { offset: 0, length: 3, original: "Опл", message: "", category: "spelling", replacements: ["Пла"], confidence: .8, source: "test", ruleId: "nested" }
  ];
  assert.equal(applyGrammarIssues("Оплата принята", issues), "Платёж принята");
});

test("falls back to the next compatible engine when LanguageTool is unavailable", async () => {
  const unavailable: GrammarEngine = {
    name: "languagetool",
    supports: () => true,
    check: async () => { throw new Error("offline"); }
  };
  const fallback = engine("llm", ["ru"], {
    offset: 0, length: 4, original: "Тест", message: "Исправлено", category: "grammar",
    replacements: ["Текст"], confidence: 0.7, ruleId: "LLM"
  });

  const result = await new GrammarService([unavailable, fallback]).check("Тест");
  assert.equal(result.correctedText, "Текст");
  assert.deepEqual(result.engines, ["llm"]);
});
