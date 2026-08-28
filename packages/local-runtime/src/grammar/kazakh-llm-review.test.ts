import assert from "node:assert/strict";
import test from "node:test";
import type { GrammarEngine, GrammarReviewer, HunspellCandidate, TextLanguage } from "./types.js";
import { grammarConfidenceConfig } from "./config.js";
import { GrammarService } from "./grammar-service.js";
import { LlmGrammarEngine } from "./llm-grammar-engine.js";
import { parseKazakhGrammarReview } from "./qwen-json-contract.js";
import { getKazakhGrammarPrompt, resolveKazakhGrammarPromptVersion } from "./prompts/kazakh-grammar/index.js";

const source = "Кеше мен достарыммен кітапханаға бардық.";
const candidate: HunspellCandidate = {
  word: "достарыммен",
  start: 9,
  end: 20,
  suggestions: ["достармен"]
};

test("offers independently versioned English, Kazakh and hybrid prompt variants", () => {
  assert.equal(resolveKazakhGrammarPromptVersion({ PROMPT_VARIANT: "english" }), "english_v1");
  assert.equal(resolveKazakhGrammarPromptVersion({ PROMPT_VARIANT: "kazakh" }), "kazakh_v1");
  assert.equal(resolveKazakhGrammarPromptVersion({ PROMPT_VARIANT: "hybrid" }), "hybrid_v1");
  assert.equal(resolveKazakhGrammarPromptVersion({ PROMPT_VARIANT: "kazakh", GRAMMAR_PROMPT_VERSION: "english_v1" }), "kazakh_v1");
  assert.equal(resolveKazakhGrammarPromptVersion({ GRAMMAR_PROMPT_VERSION: "hybrid_few_shot_v1" }), "hybrid_few_shot_v1");
  for (const version of ["english_v1", "kazakh_v1", "hybrid_v1", "hybrid_few_shot_v1"] as const) {
    const prompt = getKazakhGrammarPrompt(version);
    assert.match(prompt, /FULL CONTEXT|ТОЛЫҚ КОНТЕКСТ/u);
    assert.match(prompt, /Hunspell/u);
    assert.match(prompt, /ACCEPT[\s\S]*REJECT[\s\S]*UNCERTAIN/u);
    assert.match(prompt, /достарыммен/u);
    assert.match(prompt, /бардық[\s\S]*бардым/u);
  }
});

test("parses context-only errors and rejects a false-positive Hunspell candidate", () => {
  const raw = JSON.stringify({
    version: 2,
    errors: [{
      original: "бардық",
      correction: "бардым",
      start: 33,
      end: 39,
      type: "subject_verb_agreement",
      reason: "Бастауыш бірінші жақ жекеше түрде.",
      confidence: 0.98,
      source: "context"
    }],
    hunspell_validation: [{
      word: "достарыммен",
      decision: "REJECT",
      reason: "дос + тар + ым + мен — нормативтік сөз формасы.",
      confidence: 0.99
    }]
  });
  const result = parseKazakhGrammarReview(raw, source, [candidate], grammarConfidenceConfig({}));
  assert.deepEqual(result.issues.map(({ original, replacements, autoApply }) => ({ original, replacements, autoApply })), [
    { original: "бардық", replacements: ["бардым"], autoApply: true }
  ]);
  assert.equal(result.hunspellValidation[0]?.decision, "REJECT");
});

test("confidence thresholds are configurable and preserve uncertain originals", () => {
  const raw = JSON.stringify({
    version: 2,
    errors: [
      { original: "бардық", correction: "бардым", start: 33, end: 39, type: "person", reason: "Күмәнді.", confidence: 0.82, source: "context" },
      { original: "Кеше", correction: "Кешке", start: 0, end: 4, type: "lexical", reason: "Төмен сенім.", confidence: 0.55, source: "context" }
    ],
    hunspell_validation: [{ word: "достарыммен", decision: "UNCERTAIN", reason: "Қосымшаларды тексеру қажет.", confidence: 0.78 }]
  });
  const result = parseKazakhGrammarReview(raw, source, [candidate], grammarConfidenceConfig({
    GRAMMAR_CONFIDENCE_AUTO_APPLY: "0.90",
    GRAMMAR_CONFIDENCE_REVIEW: "0.70"
  }));
  assert.equal(result.issues.length, 1);
  assert.equal(result.issues[0]?.autoApply, false);
  assert.deepEqual(result.issues[0]?.replacements, []);
  assert.deepEqual(result.issues[0]?.suggestions, ["бардым"]);
});

test("requires one ordered validation decision for every Hunspell candidate", () => {
  const raw = JSON.stringify({ version: 2, errors: [], hunspell_validation: [] });
  assert.throws(
    () => parseKazakhGrammarReview(raw, source, [candidate], grammarConfidenceConfig({})),
    /каждого Hunspell-кандидата/u
  );
});

test("GrammarService sends complete text and Hunspell candidates to the independent reviewer", async () => {
  const hunspell: GrammarEngine = {
    name: "hunspell-kk",
    supports: (language: TextLanguage) => language === "kk",
    check: async () => [{
      offset: candidate.start,
      length: candidate.end - candidate.start,
      original: candidate.word,
      message: "Сөздік кандидаты",
      category: "spelling",
      replacements: [],
      suggestions: candidate.suggestions,
      autoApply: false,
      confidence: 0.55,
      source: "hunspell-kk",
      ruleId: "KK_HUNSPELL_UNKNOWN_WORD"
    }]
  };
  let capturedText = "";
  let capturedCandidates: readonly HunspellCandidate[] = [];
  const reviewer: GrammarReviewer = {
    name: "llm-review:hybrid_v1",
    review: async (text, language, candidates) => {
      capturedText = text;
      capturedCandidates = candidates;
      assert.equal(language, "kk");
      return {
        issues: [{
          offset: 33, length: 6, original: "бардық", message: "Жақ сәйкестігі", category: "grammar",
          replacements: ["бардым"], autoApply: true, confidence: 0.98, source: "qwen-kazakh:context", ruleId: "QWEN_KK_SUBJECT_VERB_AGREEMENT"
        }],
        hunspellValidation: [{ ...candidate, decision: "REJECT", reason: "Дұрыс тәуелдік форма.", confidence: 0.99 }],
        promptVersion: "hybrid_v1"
      };
    }
  };
  const result = await new GrammarService([hunspell], reviewer).check(source);
  assert.equal(capturedText, source);
  assert.deepEqual(capturedCandidates, [candidate]);
  assert.deepEqual(result.issues.map(({ original }) => original), ["бардық"]);
  assert.equal(result.correctedText, "Кеше мен достарыммен кітапханаға бардым.");
  assert.equal(result.promptVersion, "hybrid_v1");
  assert.equal(result.hunspellValidation[0]?.decision, "REJECT");
});

test("large Hunspell candidate lists are validated in bounded batches with full context", async () => {
  const words = Array.from({ length: 81 }, (_value, index) => `сөз${index}`);
  const text = words.join(" ");
  const candidates = words.map((word) => ({
    word,
    start: text.indexOf(word),
    end: text.indexOf(word) + word.length,
    suggestions: [`${word}а`]
  }));
  const batchSizes: number[] = [];
  const engine = new LlmGrammarEngine({
    name: "qwen-test",
    transform: async () => text,
    completeGrammarReview: async (request) => {
      batchSizes.push(request.hunspellCandidates.length);
      return JSON.stringify({
        version: 2,
        errors: [],
        hunspell_validation: request.hunspellCandidates.map(({ word }) => ({
          word, decision: "REJECT", reason: "Контексте дұрыс.", confidence: 0.99
        }))
      });
    }
  }, grammarConfidenceConfig({}), { GRAMMAR_PROMPT_VERSION: "hybrid_v1" });
  const result = await engine.review(text, "kk", candidates);
  assert.deepEqual(batchSizes, [0, 80, 1]);
  assert.equal(result.hunspellValidation.length, 81);
});

test("runs full-context discovery independently before validating Hunspell candidates", async () => {
  const calls: number[] = [];
  const engine = new LlmGrammarEngine({
    name: "qwen-test",
    transform: async () => source,
    completeGrammarReview: async (request) => {
      calls.push(request.hunspellCandidates.length);
      if (request.hunspellCandidates.length === 0) {
        return JSON.stringify({
          version: 2,
          errors: [{
            original: "бардық", correction: "бардым", start: 33, end: 39,
            type: "subject_verb_agreement", reason: "«Мен» бастауышымен жақ бойынша сәйкеспейді.",
            confidence: 0.98, source: "context"
          }],
          hunspell_validation: []
        });
      }
      return JSON.stringify({
        version: 2,
        errors: [],
        hunspell_validation: [{
          word: "достарыммен", decision: "REJECT", reason: "Контексте дұрыс сөз формасы.", confidence: 0.99
        }]
      });
    }
  }, grammarConfidenceConfig({}), { GRAMMAR_PROMPT_VERSION: "hybrid_v1" });

  const result = await engine.review(source, "kk", [candidate]);

  assert.deepEqual(calls, [0, 1]);
  assert.deepEqual(result.issues.map(({ original, replacements }) => ({ original, replacements })), [
    { original: "бардық", replacements: ["бардым"] }
  ]);
  assert.equal(result.hunspellValidation[0]?.decision, "REJECT");
});
