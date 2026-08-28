import type { AiProvider } from "../providers/types.js";
import type { GrammarEngine, GrammarIssue, GrammarReviewer, GrammarReviewResult, HunspellCandidate, TextLanguage } from "./types.js";
import { diffArrays } from "diff";
import { parseKazakhGrammarReview, parseQwenGrammarReview } from "./qwen-json-contract.js";
import { grammarConfidenceConfig, type GrammarConfidenceConfig } from "./config.js";
import { resolveKazakhGrammarPromptVersion } from "./prompts/kazakh-grammar/index.js";
import { grammarReviewLoggerFromEnvironment, type GrammarReviewLogger } from "./review-logger.js";

interface TextToken { value: string; start: number; end: number }
const HUNSPELL_CANDIDATE_BATCH_SIZE = 80;
const LONG_KAZAKH_REVIEW_THRESHOLD = 600;
const protectedTerms = new Set(["реквизит", "реквизиты", "реквизиттер", "iban", "бин", "иин", "бик"]);

function tokens(text: string): TextToken[] {
  return [...text.matchAll(/[\p{L}\p{N}]+|[^\p{L}\p{N}]/gu)].map((match) => ({
    value: match[0], start: match.index, end: match.index + match[0].length
  }));
}

function contextualIssues(source: string, result: string): GrammarIssue[] {
  const sourceTokens = tokens(source);
  const resultTokens = tokens(result);
  const changes = diffArrays(sourceTokens.map(({ value }) => value), resultTokens.map(({ value }) => value));
  const issues: GrammarIssue[] = [];
  let sourceIndex = 0;
  for (let index = 0; index < changes.length; index += 1) {
    const change = changes[index]!;
    if (!change.added && !change.removed) { sourceIndex += change.value.length; continue; }
    if (change.added) continue;
    const removed = change.value;
    const next = changes[index + 1];
    const added = next?.added ? next.value : [];
    const first = sourceTokens[sourceIndex];
    const last = sourceTokens[sourceIndex + removed.length - 1];
    sourceIndex += removed.length;
    if (!first || !last) continue;
    const original = source.slice(first.start, last.end);
    const replacement = added.join("");
    const normalized = original.toLocaleLowerCase().trim();
    if (protectedTerms.has(normalized) || (!/\s/u.test(original) && /\s/u.test(replacement.trim()))) continue;
    issues.push({
      offset: first.start,
      length: last.end - first.start,
      original,
      message: "Контекстное исправление, найденное AI после локальной проверки.",
      category: "grammar",
      replacements: [replacement],
      confidence: 0.72,
      source: "llm-review",
      ruleId: "LLM_CONTEXTUAL_CORRECTION"
    });
    if (next?.added) index += 1;
  }
  return issues;
}

function paragraphReviewChunks(text: string): Array<{ text: string; offset: number }> {
  return [...text.matchAll(/[^\r\n]+/gu)]
    .filter((match) => !/^\s*$/u.test(match[0]))
    .map((match) => ({ text: match[0], offset: match.index }));
}

export class LlmGrammarEngine implements GrammarEngine, GrammarReviewer {
  readonly name = "llm-review";
  constructor(
    private readonly provider: AiProvider,
    private readonly confidence: GrammarConfidenceConfig = grammarConfidenceConfig(),
    private readonly environment: Readonly<Record<string, string | undefined>> = process.env,
    private readonly logger: GrammarReviewLogger | undefined = grammarReviewLoggerFromEnvironment(environment)
  ) {}
  supports(_language: TextLanguage): boolean { return true; }

  private async log(record: Parameters<GrammarReviewLogger["log"]>[0]): Promise<void> {
    try { await this.logger?.log(record); }
    catch { /* Grammar checking must not fail because optional diagnostics are unavailable. */ }
  }

  async review(text: string, language: TextLanguage, hunspellCandidates: readonly HunspellCandidate[]): Promise<GrammarReviewResult> {
    const startedAt = performance.now();
    const promptVersion = language === "kk"
      ? resolveKazakhGrammarPromptVersion(this.environment)
      : "generic_v1";
    if (this.provider.completeGrammarReview) {
      try {
        let result: GrammarReviewResult;
        if (language === "kk") {
          // Context discovery and dictionary validation are deliberately separate. A long
          // candidate list otherwise makes the model focus on Hunspell and miss syntax.
          const contextResponse = await this.provider.completeGrammarReview({
            text, language, hunspellCandidates: [], promptVersion
          });
          const contextReview = parseKazakhGrammarReview(contextResponse, text, [], this.confidence);
          const reviews = [contextReview];
          const sentenceCount = (text.match(/[.!?](?=\s|$)/gu) ?? []).length;
          const minimumExpectedCoverage = Math.max(2, Math.floor(sentenceCount / 3));
          if (text.length >= LONG_KAZAKH_REVIEW_THRESHOLD && contextReview.issues.length < minimumExpectedCoverage) {
            for (const chunk of paragraphReviewChunks(text)) {
              if (chunk.text === text) continue;
              const response = await this.provider.completeGrammarReview({
                text: chunk.text, language, hunspellCandidates: [], promptVersion
              });
              const review = parseKazakhGrammarReview(response, chunk.text, [], this.confidence);
              reviews.push({
                ...review,
                issues: review.issues.map((issue) => ({ ...issue, offset: issue.offset + chunk.offset }))
              });
            }
          }
          const batches = Array.from(
            { length: Math.ceil(hunspellCandidates.length / HUNSPELL_CANDIDATE_BATCH_SIZE) },
            (_value, index) => hunspellCandidates.slice(
              index * HUNSPELL_CANDIDATE_BATCH_SIZE,
              (index + 1) * HUNSPELL_CANDIDATE_BATCH_SIZE
            )
          );
          for (const batch of batches) {
            const response = await this.provider.completeGrammarReview({ text, language, hunspellCandidates: batch, promptVersion });
            reviews.push(parseKazakhGrammarReview(response, text, batch, this.confidence));
          }
          const uniqueIssues = new Map<string, GrammarIssue>();
          for (const issue of reviews.flatMap((review) => review.issues)) {
            const key = `${issue.offset}:${issue.length}:${issue.original}:${issue.replacements[0] ?? issue.suggestions?.[0] ?? ""}`;
            const current = uniqueIssues.get(key);
            if (!current || issue.confidence > current.confidence) uniqueIssues.set(key, issue);
          }
          result = {
            issues: [...uniqueIssues.values()].sort((left, right) => left.offset - right.offset),
            hunspellValidation: reviews.flatMap((review) => review.hunspellValidation),
            promptVersion
          };
        } else {
          const response = await this.provider.completeGrammarReview({ text, language, hunspellCandidates, promptVersion });
          result = { issues: parseQwenGrammarReview(response, text), hunspellValidation: [], promptVersion };
        }
        await this.log({
          text, language, hunspellCandidates, promptVersion, model: this.provider.name,
          llmErrors: result.issues, hunspellValidation: result.hunspellValidation,
          latencyMs: Math.round(performance.now() - startedAt)
        });
        return result;
      } catch (error) {
        await this.log({
          text, language, hunspellCandidates, promptVersion, model: this.provider.name,
          llmErrors: [], hunspellValidation: [], latencyMs: Math.round(performance.now() - startedAt),
          error: error instanceof Error ? error.message : String(error)
        });
        throw error;
      }
    }
    const corrected = await this.provider.transform("grammar", text);
    return { issues: contextualIssues(text, corrected), hunspellValidation: [], promptVersion: "legacy_diff" };
  }

  async check(text: string, language: TextLanguage): Promise<GrammarIssue[]> {
    return (await this.review(text, language, [])).issues;
  }
}
