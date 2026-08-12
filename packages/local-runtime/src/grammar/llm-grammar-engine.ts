import type { AiProvider } from "../providers/types.js";
import type { GrammarEngine, GrammarIssue, TextLanguage } from "./types.js";

function changedRange(source: string, result: string): { offset: number; sourceLength: number; replacement: string } | undefined {
  if (source === result) return undefined;
  let prefix = 0;
  while (prefix < source.length && prefix < result.length && source[prefix] === result[prefix]) prefix += 1;
  let suffix = 0;
  while (
    suffix < source.length - prefix && suffix < result.length - prefix
    && source[source.length - suffix - 1] === result[result.length - suffix - 1]
  ) suffix += 1;
  return {
    offset: prefix,
    sourceLength: source.length - prefix - suffix,
    replacement: result.slice(prefix, result.length - suffix)
  };
}

export class LlmGrammarEngine implements GrammarEngine {
  readonly name = "llm-fallback";
  constructor(private readonly provider: AiProvider) {}
  supports(_language: TextLanguage): boolean { return true; }

  async check(text: string): Promise<GrammarIssue[]> {
    const corrected = await this.provider.transform("grammar", text);
    const change = changedRange(text, corrected);
    if (!change) return [];
    return [{
      offset: change.offset,
      length: change.sourceLength,
      original: text.slice(change.offset, change.offset + change.sourceLength),
      message: "Контекстное исправление грамматики и пунктуации.",
      category: "grammar",
      replacements: [change.replacement],
      confidence: 0.7,
      source: this.name,
      ruleId: "LLM_CONTEXTUAL_CORRECTION"
    }];
  }
}
