import assert from "node:assert/strict";
import test from "node:test";
import type { GrammarEngine } from "./types.js";
import { KazakhGrammarEngine } from "./kazakh-grammar-engine.js";

test("combines Hunspell and Kazakh rules and removes duplicate ranges", async () => {
  const spelling: GrammarEngine = {
    name: "hunspell-kk",
    supports: (language) => language === "kk",
    check: async () => [{ offset: 0, length: 5, original: "кужат", message: "Орфография", category: "spelling", replacements: ["құжат"], confidence: .86, source: "hunspell-kk", ruleId: "SPELL" }]
  };
  const rules: GrammarEngine = {
    name: "kazakh-rules",
    supports: (language) => language === "kk",
    check: async () => [
      { offset: 0, length: 5, original: "кужат", message: "Ереже", category: "spelling", replacements: ["құжат"], confidence: .95, source: "kazakh-rules", ruleId: "RULE" },
      { offset: 5, length: 2, original: " ,", message: "Пунктуация", category: "punctuation", replacements: [","], confidence: .99, source: "kazakh-rules", ruleId: "SPACE" }
    ]
  };

  const issues = await new KazakhGrammarEngine(spelling, rules).check("кужат ,", "kk");
  assert.deepEqual(issues.map((issue) => issue.ruleId), ["RULE", "SPACE"]);
});
