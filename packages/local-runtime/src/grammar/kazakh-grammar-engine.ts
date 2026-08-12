import type { GrammarEngine, GrammarIssue, TextLanguage } from "./types.js";

export class KazakhGrammarEngine implements GrammarEngine {
  readonly name = "hunspell-kk+kazakh-rules";
  constructor(
    private readonly spelling: GrammarEngine | undefined,
    private readonly rules: GrammarEngine
  ) {}

  supports(language: TextLanguage): boolean { return language === "kk"; }

  async check(text: string, language: TextLanguage): Promise<GrammarIssue[]> {
    if (!this.supports(language)) throw new Error(`Қазақ грамматикасы '${language}' тілін қолдамайды.`);
    const results = await Promise.all([
      this.spelling?.check(text, language) ?? Promise.resolve([]),
      this.rules.check(text, language)
    ]);
    const unique = new Map<string, GrammarIssue>();
    for (const issue of results.flat()) {
      const key = `${issue.offset}:${issue.length}`;
      const existing = unique.get(key);
      if (!existing || issue.confidence > existing.confidence) unique.set(key, issue);
    }
    return [...unique.values()].sort((left, right) => left.offset - right.offset);
  }
}
