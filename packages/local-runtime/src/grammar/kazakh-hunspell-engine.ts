import { createRequire } from "node:module";
import { readFileSync } from "node:fs";
import path from "node:path";
import type { GrammarEngine, GrammarIssue, TextLanguage } from "./types.js";

export interface HunspellDictionary {
  correct(word: string): boolean;
  suggest(word: string): string[];
  add?(word: string): void;
}

const require = createRequire(import.meta.url);
const createNspell = require("nspell") as (aff: Buffer | string, dic: Buffer | string) => HunspellDictionary;
const wordPattern = /[\p{L}]+(?:['’\-][\p{L}]+)*/gu;
const latinOnly = /^[a-z]+(?:['’\-][a-z]+)*$/iu;
const upperCase = /^\p{Lu}{2,}$/u;
const protectedPattern = /https?:\/\/\S+|\b[\w.+-]+@[\w.-]+\.\w+\b|\b(?=[\p{L}\d-]*\d)[\p{L}\d-]{4,}\b/giu;

const defaultWhitelist = [
  "Bank AI", "BankAI", "QazBank", "банкомат", "банкинг", "финтех", "онлайн", "офлайн",
  "реквизит", "реквизиттер"
];

function protectedRanges(text: string): Array<{ start: number; end: number }> {
  return [...text.matchAll(protectedPattern)].map((match) => ({
    start: match.index,
    end: match.index + match[0].length
  }));
}

function isProtected(offset: number, ranges: readonly { start: number; end: number }[]): boolean {
  return ranges.some((range) => offset >= range.start && offset < range.end);
}

export class KazakhHunspellEngine implements GrammarEngine {
  readonly name = "hunspell-kk";
  private readonly whitelist: Set<string>;

  constructor(private readonly dictionary: HunspellDictionary, approvedWords: readonly string[] = []) {
    this.whitelist = new Set([...defaultWhitelist, ...approvedWords]
      .flatMap((entry) => entry.match(wordPattern) ?? [])
      .map((word) => word.toLocaleLowerCase("kk-KZ")));
  }

  static fromDirectory(directory: string, approvedWords: readonly string[] = []): KazakhHunspellEngine {
    const aff = readFileSync(path.join(directory, "kk_KZ.aff"));
    const dic = readFileSync(path.join(directory, "kk_KZ.dic"));
    return new KazakhHunspellEngine(createNspell(aff, dic), approvedWords);
  }

  supports(language: TextLanguage): boolean { return language === "kk"; }

  async check(text: string, language: TextLanguage): Promise<GrammarIssue[]> {
    if (!this.supports(language)) throw new Error(`Hunspell қазақ тілі '${language}' тілін қолдамайды.`);
    const protectedTextRanges = protectedRanges(text);
    const issues: GrammarIssue[] = [];
    for (const match of text.matchAll(wordPattern)) {
      const original = match[0];
      const offset = match.index;
      const normalized = original.toLocaleLowerCase("kk-KZ");
      if (
        isProtected(offset, protectedTextRanges)
        || latinOnly.test(original)
        || upperCase.test(original)
        || this.whitelist.has(normalized)
        || this.dictionary.correct(original)
        || this.dictionary.correct(normalized)
      ) continue;
      const suggestions = this.dictionary.suggest(original)
        .filter((suggestion) => !/\s/u.test(suggestion))
        .slice(0, 5);
      issues.push({
        offset,
        length: original.length,
        original,
        message: "Қазақ сөздігінде мұндай сөз табылмады. Автоматты ауыстыру өшірілген: сөз контексте дұрыс болуы мүмкін.",
        category: "spelling",
        replacements: [],
        suggestions,
        autoApply: false,
        confidence: 0.55,
        source: this.name,
        ruleId: "KK_HUNSPELL_UNKNOWN_WORD"
      });
    }
    return issues;
  }
}
