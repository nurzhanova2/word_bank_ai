import type { AiProvider } from "../providers/types.js";
import type { GrammarEngine, GrammarIssue, TextLanguage } from "./types.js";
import { diffArrays } from "diff";
import { parseQwenGrammarReview } from "./qwen-json-contract.js";

interface TextToken { value: string; start: number; end: number }
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

export class LlmGrammarEngine implements GrammarEngine {
  readonly name = "llm-review";
  constructor(private readonly provider: AiProvider) {}
  supports(_language: TextLanguage): boolean { return true; }

  async check(text: string, _language: TextLanguage): Promise<GrammarIssue[]> {
    if (this.provider.completeGrammarReview) {
      const response = await this.provider.completeGrammarReview(text, _language);
      return parseQwenGrammarReview(response, text);
    }
    const corrected = await this.provider.transform("grammar", text);
    return contextualIssues(text, corrected);
  }
}
