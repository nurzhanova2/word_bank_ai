import type { HunspellDecision } from "@bank-ai/contracts";
import type { KazakhEvalCase, KazakhGoldError, KazakhPrediction } from "./types.js";

export interface KazakhEvalMetrics {
  tp: number;
  fp: number;
  fn: number;
  precision: number;
  recall: number;
  f1: number;
  f05: number;
  falsePositiveRate: number;
  hunspellFalsePositiveRejectionRate: number;
  contextOnlyRecall: number;
}

function sameError(left: KazakhGoldError, right: KazakhGoldError): boolean {
  return left.start === right.start
    && left.end === right.end
    && left.correction === right.correction
    && left.type === right.type;
}

function ratio(numerator: number, denominator: number, emptyValue = 0): number {
  return denominator === 0 ? emptyValue : numerator / denominator;
}

function fBeta(precision: number, recall: number, beta: number): number {
  const betaSquared = beta * beta;
  const denominator = betaSquared * precision + recall;
  return denominator === 0 ? 0 : (1 + betaSquared) * precision * recall / denominator;
}

export function evaluateKazakhPredictions(
  cases: readonly KazakhEvalCase[],
  predictions: ReadonlyMap<string, KazakhPrediction>
): KazakhEvalMetrics {
  let tp = 0;
  let fp = 0;
  let fn = 0;
  let correctFragments = 0;
  let falseCorrectionsOnCorrect = 0;
  let hunspellFalsePositives = 0;
  let rejectedHunspellFalsePositives = 0;
  let contextOnly = 0;
  let foundContextOnly = 0;

  for (const testCase of cases) {
    const prediction = predictions.get(testCase.id) ?? { errors: [], hunspellValidation: [] };
    const matchedPredictions = new Set<number>();
    for (const expected of testCase.errors) {
      const predictionIndex = prediction.errors.findIndex((actual, index) => !matchedPredictions.has(index) && sameError(expected, actual));
      if (predictionIndex >= 0) {
        tp += 1;
        matchedPredictions.add(predictionIndex);
        if (expected.source === "context") foundContextOnly += 1;
      } else fn += 1;
      if (expected.source === "context") contextOnly += 1;
    }
    fp += prediction.errors.length - matchedPredictions.size;
    if (testCase.errors.length === 0) {
      correctFragments += 1;
      if (prediction.errors.length > 0) falseCorrectionsOnCorrect += 1;
    }
    testCase.hunspellCandidates.forEach((candidate, index) => {
      if (candidate.expectedDecision !== "REJECT") return;
      hunspellFalsePositives += 1;
      const actual = prediction.hunspellValidation[index];
      if (actual?.word === candidate.word && actual.decision === ("REJECT" satisfies HunspellDecision)) {
        rejectedHunspellFalsePositives += 1;
      }
    });
  }

  const precision = ratio(tp, tp + fp, 1);
  const recall = ratio(tp, tp + fn, 1);
  return {
    tp, fp, fn, precision, recall,
    f1: fBeta(precision, recall, 1),
    f05: fBeta(precision, recall, 0.5),
    falsePositiveRate: ratio(falseCorrectionsOnCorrect, correctFragments),
    hunspellFalsePositiveRejectionRate: ratio(rejectedHunspellFalsePositives, hunspellFalsePositives, 1),
    contextOnlyRecall: ratio(foundContextOnly, contextOnly, 1)
  };
}
