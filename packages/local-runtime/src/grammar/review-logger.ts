import crypto from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import type { GrammarIssue, HunspellCandidate } from "./types.js";
import type { HunspellValidation, TextLanguage } from "@bank-ai/contracts";

export interface GrammarReviewLogRecord {
  text: string;
  language: TextLanguage;
  hunspellCandidates: readonly HunspellCandidate[];
  promptVersion: string;
  model: string;
  llmErrors: readonly GrammarIssue[];
  hunspellValidation: readonly HunspellValidation[];
  latencyMs: number;
  error?: string;
}

export interface GrammarReviewLogger {
  log(record: GrammarReviewLogRecord): Promise<void>;
}

export class JsonlGrammarReviewLogger implements GrammarReviewLogger {
  constructor(private readonly filePath: string, private readonly includeText = false) {}

  async log(record: GrammarReviewLogRecord): Promise<void> {
    await fs.mkdir(path.dirname(this.filePath), { recursive: true });
    const textHash = crypto.createHash("sha256").update(record.text).digest("hex");
    const payload = {
      timestamp: new Date().toISOString(),
      ...(this.includeText ? { text: record.text } : {}),
      text_sha256: textHash,
      text_length: record.text.length,
      language: record.language,
      hunspell_candidates: record.hunspellCandidates,
      prompt_version: record.promptVersion,
      model: record.model,
      llm_errors: record.llmErrors,
      hunspell_validation: record.hunspellValidation,
      latency_ms: record.latencyMs,
      ...(record.error ? { error: record.error } : {})
    };
    await fs.appendFile(this.filePath, `${JSON.stringify(payload)}\n`, "utf8");
  }
}

export function grammarReviewLoggerFromEnvironment(
  environment: Readonly<Record<string, string | undefined>> = process.env
): GrammarReviewLogger | undefined {
  const filePath = environment.GRAMMAR_REVIEW_LOG_PATH?.trim();
  if (!filePath) return undefined;
  return new JsonlGrammarReviewLogger(filePath, environment.GRAMMAR_LOG_INCLUDE_TEXT === "true");
}
