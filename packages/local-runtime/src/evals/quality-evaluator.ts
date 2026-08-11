import type { TransformAction, TransformOptions } from "@bank-ai/contracts";
import type { AiProvider } from "../providers/types.js";
import { protectRequisites } from "../validators/requisites.js";

export interface QualityAssertions {
  preserveRequisites?: boolean;
  preserveParagraphCount?: boolean;
  minLengthRatio?: number;
  maxLengthRatio?: number;
  includes?: readonly string[];
}

export interface QualityEvalCase {
  id: string;
  action: TransformAction;
  input: string;
  options?: TransformOptions;
  assertions: QualityAssertions;
}

export interface QualityCheck {
  id: string;
  passed: boolean;
  details?: string;
}

export interface QualityEvalResult {
  id: string;
  passed: boolean;
  durationMs: number;
  checks: QualityCheck[];
  error?: string;
}

export interface QualityEvalReport {
  provider: string;
  total: number;
  passed: number;
  score: number;
  results: QualityEvalResult[];
}

function paragraphCount(text: string): number {
  return text.trim().split(/\r?\n/u).filter((line) => line.trim().length > 0).length;
}

function normalizedRequisites(text: string): string[] {
  return protectRequisites(text).entries
    .map((entry) => `${entry.kind}:${entry.value}`)
    .sort((left, right) => left.localeCompare(right));
}

function ratio(result: string, input: string): number {
  return result.trim().length / Math.max(1, input.trim().length);
}

export function evaluateOutput(testCase: QualityEvalCase, output: string): QualityCheck[] {
  const checks: QualityCheck[] = [
    { id: "non-empty", passed: output.trim().length > 0 }
  ];
  const assertions = testCase.assertions;
  if (assertions.preserveRequisites) {
    const before = normalizedRequisites(testCase.input);
    const after = normalizedRequisites(output);
    checks.push({
      id: "requisites",
      passed: JSON.stringify(before) === JSON.stringify(after),
      details: `before=${before.length}; after=${after.length}`
    });
  }
  if (assertions.preserveParagraphCount) {
    const before = paragraphCount(testCase.input);
    const after = paragraphCount(output);
    checks.push({ id: "paragraph-count", passed: before === after, details: `before=${before}; after=${after}` });
  }
  const lengthRatio = ratio(output, testCase.input);
  if (assertions.minLengthRatio !== undefined) {
    checks.push({ id: "min-length-ratio", passed: lengthRatio >= assertions.minLengthRatio, details: lengthRatio.toFixed(2) });
  }
  if (assertions.maxLengthRatio !== undefined) {
    checks.push({ id: "max-length-ratio", passed: lengthRatio <= assertions.maxLengthRatio, details: lengthRatio.toFixed(2) });
  }
  for (const expected of assertions.includes ?? []) {
    checks.push({ id: `includes:${expected}`, passed: output.toLocaleLowerCase().includes(expected.toLocaleLowerCase()) });
  }
  return checks;
}

export async function evaluateCases(provider: AiProvider, cases: readonly QualityEvalCase[]): Promise<QualityEvalReport> {
  const results: QualityEvalResult[] = [];
  for (const testCase of cases) {
    const startedAt = Date.now();
    try {
      const output = await provider.transform(testCase.action, testCase.input, testCase.options);
      const checks = evaluateOutput(testCase, output);
      results.push({
        id: testCase.id,
        passed: checks.every((check) => check.passed),
        durationMs: Date.now() - startedAt,
        checks
      });
    } catch (error) {
      results.push({
        id: testCase.id,
        passed: false,
        durationMs: Date.now() - startedAt,
        checks: [],
        error: error instanceof Error ? error.message : String(error)
      });
    }
  }
  const passed = results.filter((result) => result.passed).length;
  return {
    provider: provider.name,
    total: results.length,
    passed,
    score: results.length === 0 ? 1 : passed / results.length,
    results
  };
}
