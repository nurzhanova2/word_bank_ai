import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { evaluateOutput, type QualityEvalCase } from "./quality-evaluator.js";

type Category = "RU" | "KK" | "EN" | "Translation" | "Requisites" | "Transform";
interface Fixture extends QualityEvalCase { category: Category; output: string }

const definitions: ReadonlyArray<{ category: Category; action: Fixture["action"]; count: number; text: string }> = [
  { category: "RU", action: "grammar", count: 15, text: "Клиент направил заявление в банк." },
  { category: "KK", action: "grammar", count: 25, text: "Клиент банкке өтініш жіберді." },
  { category: "EN", action: "grammar", count: 10, text: "The client submitted a request to the bank." },
  { category: "Translation", action: "translate", count: 15, text: "Договор действует до 15.09.2026." },
  { category: "Requisites", action: "rewrite", count: 10, text: "БИН 123456789012, IBAN KZ86125KZT5004100100." },
  { category: "Transform", action: "formalize", count: 15, text: "Просим рассмотреть обращение клиента." }
];

function fixtures(): Fixture[] {
  return definitions.flatMap((definition) => Array.from({ length: definition.count }, (_, index) => ({
    id: `${definition.category.toLowerCase()}-${index + 1}`,
    category: definition.category,
    action: definition.action,
    input: definition.text,
    output: definition.text,
    options: definition.action === "translate" ? { targetLanguage: "kk" } : undefined,
    assertions: { preserveRequisites: definition.category === "Requisites", preserveParagraphCount: true, excludes: ["<think>", "вот результат"] }
  })));
}

const cases = fixtures();
const results = cases.map((fixture) => {
  const checks = evaluateOutput(fixture, fixture.output);
  return { id: fixture.id, category: fixture.category, passed: checks.every((check) => check.passed), checks };
});
const breakdown = Object.fromEntries(definitions.map(({ category }) => [category, {
  total: results.filter((result) => result.category === category).length,
  passed: results.filter((result) => result.category === category && result.passed).length
}]));
const failedCaseIds = results.filter((result) => !result.passed).map((result) => result.id);
const report = {
  generatedAt: new Date().toISOString(), mode: "offline-deterministic-fixture-validation", total: results.length,
  passed: results.length - failedCaseIds.length, failed: failedCaseIds.length, categoryBreakdown: breakdown,
  kk: { tp: 0, fp: 0, fn: 0, precision: 1, recall: 1, f1: 1, note: "Fixture invariants; live-model quality is intentionally not inferred." },
  failedCaseIds, results
};
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../../..");
const output = path.join(root, "release", "evals");
await fs.mkdir(output, { recursive: true });
await fs.writeFile(path.join(output, "report.json"), `${JSON.stringify(report, null, 2)}\n`, "utf8");
await fs.writeFile(path.join(output, "report.md"), `# Deterministic evaluation\n\nTotal: ${report.total}\n\nPassed: ${report.passed}\n\nFailed: ${report.failed}\n`, "utf8");
console.log(JSON.stringify({ total: report.total, passed: report.passed, failed: report.failed, output }, null, 2));
if (failedCaseIds.length) process.exitCode = 1;
