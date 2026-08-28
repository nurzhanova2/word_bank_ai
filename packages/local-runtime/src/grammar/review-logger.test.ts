import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { JsonlGrammarReviewLogger } from "./review-logger.js";

test("grammar diagnostics omit source text unless retention is explicitly enabled", async () => {
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), "bank-ai-grammar-log-"));
  const file = path.join(directory, "review.jsonl");
  try {
    await new JsonlGrammarReviewLogger(file).log({
      text: "Сезімтал банк мәтіні.",
      language: "kk",
      hunspellCandidates: [],
      promptVersion: "hybrid_few_shot_v1",
      model: "qwen-test",
      llmErrors: [],
      hunspellValidation: [],
      latencyMs: 12
    });
    const payload = JSON.parse((await fs.readFile(file, "utf8")).trim()) as Record<string, unknown>;
    assert.equal(payload.text, undefined);
    assert.equal(payload.text_length, "Сезімтал банк мәтіні.".length);
    assert.match(String(payload.text_sha256), /^[a-f0-9]{64}$/u);
    assert.equal(payload.prompt_version, "hybrid_few_shot_v1");
  } finally {
    await fs.rm(directory, { recursive: true, force: true });
  }
});
