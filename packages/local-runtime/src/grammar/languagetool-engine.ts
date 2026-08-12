import type { GrammarCategory, GrammarEngine, GrammarIssue, TextLanguage } from "./types.js";

interface LanguageToolMatch {
  message: string;
  shortMessage?: string;
  offset: number;
  length: number;
  replacements?: { value: string }[];
  rule: { id: string; issueType?: string; category?: { id?: string } };
}

interface LanguageToolResponse { matches?: LanguageToolMatch[] }

const languageCodes: Partial<Record<TextLanguage, string>> = { ru: "ru-RU", en: "en-US" };

function categoryOf(match: LanguageToolMatch): GrammarCategory {
  const value = `${match.rule.issueType ?? ""} ${match.rule.category?.id ?? ""}`.toLocaleLowerCase();
  if (value.includes("misspell") || value.includes("typo")) return "spelling";
  if (value.includes("punct")) return "punctuation";
  if (value.includes("style")) return "style";
  return "grammar";
}

export class LanguageToolEngine implements GrammarEngine {
  readonly name = "languagetool";

  constructor(
    private readonly endpoint = "http://127.0.0.1:8081/v2/check",
    private readonly fetcher: typeof fetch = fetch
  ) {}

  supports(language: TextLanguage): boolean { return language in languageCodes; }

  async check(text: string, language: TextLanguage): Promise<GrammarIssue[]> {
    const languageCode = languageCodes[language];
    if (!languageCode) throw new Error(`LanguageTool не поддерживает язык '${language}'.`);
    const body = new URLSearchParams({ text, language: languageCode, enabledOnly: "false" });
    const response = await this.fetcher(this.endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body,
      signal: AbortSignal.timeout(15_000)
    });
    if (!response.ok) throw new Error(`LanguageTool недоступен: HTTP ${response.status}.`);
    const payload = await response.json() as LanguageToolResponse;
    return (payload.matches ?? []).map((match) => ({
      offset: match.offset,
      length: match.length,
      original: text.slice(match.offset, match.offset + match.length),
      message: match.message,
      category: categoryOf(match),
      replacements: (match.replacements ?? []).slice(0, 5).map(({ value }) => value),
      confidence: match.replacements?.length ? 0.9 : 0.65,
      source: this.name,
      ruleId: match.rule.id
    }));
  }
}
