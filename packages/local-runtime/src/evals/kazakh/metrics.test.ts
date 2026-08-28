import assert from "node:assert/strict";
import test from "node:test";
import { kazakhEvalDataset } from "./dataset.js";
import { evaluateKazakhPredictions } from "./metrics.js";

test("Kazakh evaluation dataset contains 200 annotated cases and required categories", () => {
  assert.equal(kazakhEvalDataset.length, 200);
  const tags = new Set(kazakhEvalDataset.flatMap((item) => item.tags));
  for (const tag of ["correct", "oov", "spelling", "case", "person", "number", "possessive", "morphology", "extra_affix", "word_order", "lexical", "missing_affix", "subject_verb_agreement", "multiple", "context-only"]) {
    assert.equal(tags.has(tag), true, `missing tag ${tag}`);
  }
});

test("Kazakh evaluator calculates precision-weighted and diagnostic metrics", () => {
  const [first, second] = kazakhEvalDataset;
  assert.ok(first && second);
  const metrics = evaluateKazakhPredictions([first, second], new Map([
    [first.id, { errors: [], hunspellValidation: first.hunspellCandidates.map((candidate) => ({ ...candidate, decision: "REJECT" as const })) }],
    [second.id, { errors: [{ original: "Бос", correction: "Боссы", start: 0, end: 3, type: "other_grammar", source: "context" }], hunspellValidation: [] }]
  ]));
  assert.equal(metrics.tp, 0);
  assert.equal(metrics.fp, 1);
  assert.equal(metrics.falsePositiveRate, 0.5);
  assert.ok(metrics.f05 <= metrics.precision);
  assert.ok(metrics.hunspellFalsePositiveRejectionRate > 0);
});
