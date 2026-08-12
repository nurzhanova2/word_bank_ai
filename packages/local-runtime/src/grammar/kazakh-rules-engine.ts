import type { GrammarEngine, GrammarIssue, TextLanguage } from "./types.js";

const repeatedWord = /(?<!\p{L})([\p{L}]{2,})(\s+)\1(?!\p{L})/giu;
const spaceBeforePunctuation = /\s+([,.;:!?])/gu;
const wordPattern = /[\p{L}]+(?:['’\-][\p{L}]+)*/gu;
const latinLetter = /[a-z]/iu;
const cyrillicLetter = /[а-яёәғқңөұүһі]/iu;
const keyboardTypos = new Map([
  ["кужат", "құжат"],
  ["отиниш", "өтініш"],
  ["каржы", "қаржы"],
  ["келисим", "келісім"]
]);

function preserveCase(source: string, replacement: string): string {
  if (source === source.toLocaleUpperCase("kk-KZ")) return replacement.toLocaleUpperCase("kk-KZ");
  if (source[0] === source[0]?.toLocaleUpperCase("kk-KZ")) {
    return `${replacement[0]?.toLocaleUpperCase("kk-KZ")}${replacement.slice(1)}`;
  }
  return replacement;
}

export class KazakhRulesEngine implements GrammarEngine {
  readonly name = "kazakh-rules";
  supports(language: TextLanguage): boolean { return language === "kk"; }

  async check(text: string, language: TextLanguage): Promise<GrammarIssue[]> {
    if (!this.supports(language)) throw new Error(`Қазақ ережелері '${language}' тілін қолдамайды.`);
    const issues: GrammarIssue[] = [];

    for (const match of text.matchAll(repeatedWord)) {
      const replacement = match[1];
      if (!replacement) continue;
      issues.push({
        offset: match.index,
        length: match[0].length,
        original: match[0],
        message: "Сөз қатарынан екі рет қайталанған.",
        category: "style",
        replacements: [replacement],
        confidence: 0.98,
        source: this.name,
        ruleId: "KK_REPEATED_WORD"
      });
    }

    for (const match of text.matchAll(spaceBeforePunctuation)) {
      const replacement = match[1];
      if (!replacement) continue;
      issues.push({
        offset: match.index,
        length: match[0].length,
        original: match[0],
        message: "Тыныс белгісінің алдында бос орын қойылмайды.",
        category: "punctuation",
        replacements: [replacement],
        confidence: 0.99,
        source: this.name,
        ruleId: "KK_SPACE_BEFORE_PUNCTUATION"
      });
    }

    for (const match of text.matchAll(wordPattern)) {
      const keyboardReplacement = keyboardTypos.get(match[0].toLocaleLowerCase("kk-KZ"));
      if (keyboardReplacement) {
        issues.push({
          offset: match.index,
          length: match[0].length,
          original: match[0],
          message: "Қазақ әріптерімен дұрыс жазылуы ұсынылады.",
          category: "spelling",
          replacements: [preserveCase(match[0], keyboardReplacement)],
          confidence: 0.99,
          source: this.name,
          ruleId: "KK_KEYBOARD_TYPO"
        });
        continue;
      }
      if (!latinLetter.test(match[0]) || !cyrillicLetter.test(match[0])) continue;
      issues.push({
        offset: match.index,
        length: match[0].length,
        original: match[0],
        message: "Бір сөзде кирилл және латын әріптері аралас жазылған.",
        category: "spelling",
        replacements: [],
        confidence: 0.95,
        source: this.name,
        ruleId: "KK_MIXED_ALPHABET"
      });
    }

    return issues.sort((left, right) => left.offset - right.offset);
  }
}
