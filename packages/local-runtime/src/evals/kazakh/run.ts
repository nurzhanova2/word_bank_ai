import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { config as loadEnvironment } from "dotenv";
import { createProvider } from "../../provider.js";
import { grammarConfidenceConfig } from "../../grammar/config.js";
import { parseKazakhGrammarReview } from "../../grammar/qwen-json-contract.js";
import type { KazakhGrammarPromptVersion } from "../../grammar/prompts/kazakh-grammar/index.js";
import { kazakhEvalDataset } from "./dataset.js";
import { evaluateKazakhPredictions } from "./metrics.js";
import type { KazakhGoldError, KazakhPrediction } from "./types.js";

const currentDirectory = path.dirname(fileURLToPath(import.meta.url));
loadEnvironment({ path: path.resolve(currentDirectory, "../../../../../.env"), quiet: true });

const variants: readonly KazakhGrammarPromptVersion[] = [
  "baseline_v1",
  "english_v1",
  "kazakh_v1",
  "hybrid_v1",
  "hybrid_few_shot_v1"
];
const requestedLimit = Number(process.env.KAZAKH_EVAL_LIMIT ?? kazakhEvalDataset.length);
const cases = kazakhEvalDataset.slice(0, Number.isFinite(requestedLimit) ? Math.max(1, requestedLimit) : kazakhEvalDataset.length);
const provider = createProvider();
if (!provider.completeGrammarReview || provider.name === "mock") {
  throw new Error("Kazakh prompt evaluation requires a configured non-mock LLM provider.");
}

const reports = [];
for (const promptVersion of variants) {
  const predictions = new Map<string, KazakhPrediction>();
  const failures: Array<{ id: string; error: string }> = [];
  const startedAt = Date.now();
  for (const testCase of cases) {
    try {
      const raw = await provider.completeGrammarReview({
        text: testCase.text,
        language: "kk",
        hunspellCandidates: testCase.hunspellCandidates,
        promptVersion
      });
      const parsed = parseKazakhGrammarReview(raw, testCase.text, testCase.hunspellCandidates, grammarConfidenceConfig());
      const errors: KazakhGoldError[] = parsed.issues.flatMap((issue) => {
        const correction = issue.replacements[0] ?? issue.suggestions?.[0];
        if (!correction || !issue.errorType) return [];
        const source = issue.source.split(":")[1];
        return [{
          original: issue.original,
          correction,
          start: issue.offset,
          end: issue.offset + issue.length,
          type: issue.errorType,
          source: source === "hunspell" || source === "both" ? source : "context"
        }];
      });
      predictions.set(testCase.id, {
        errors,
        hunspellValidation: parsed.hunspellValidation.map(({ word, start, end, decision }) => ({ word, start, end, decision }))
      });
    } catch (error) {
      failures.push({ id: testCase.id, error: error instanceof Error ? error.message : String(error) });
    }
  }
  reports.push({
    promptVersion,
    model: provider.name,
    cases: cases.length,
    failures,
    durationMs: Date.now() - startedAt,
    metrics: evaluateKazakhPredictions(cases, predictions)
  });
}

const report = {
  generatedAt: new Date().toISOString(),
  datasetSize: kazakhEvalDataset.length,
  evaluatedCases: cases.length,
  priority: "Compare precision and F0.5 first; inspect false positives before choosing a prompt.",
  reports
};
const json = JSON.stringify(report, null, 2);
console.log(json);
const outputPath = process.env.KAZAKH_EVAL_REPORT_PATH?.trim();
if (outputPath) {
  await fs.mkdir(path.dirname(outputPath), { recursive: true });
  await fs.writeFile(outputPath, `${json}\n`, "utf8");
}
if (reports.some((item) => item.failures.length > 0)) process.exitCode = 1;
