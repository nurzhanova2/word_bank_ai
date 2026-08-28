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
  ["келисим", "келісім"],
  ["таңертен", "таңертең"],
  ["оқыймыз", "оқимыз"],
  ["тындағанды", "тыңдағанды"],
  ["тындадым", "тыңдадым"]
]);

interface ContextRule {
  pattern: RegExp;
  original(match: RegExpMatchArray): string;
  replacement(match: RegExpMatchArray): string;
  category: GrammarIssue["category"];
  message: string;
  ruleId: string;
}

const contextRules: readonly ContextRule[] = [
  {
    pattern: /(?<!\p{L})(пәндер)(?=\s+оқ(?:ы?й|и)мыз(?!\p{L}))/giu,
    original: (match) => match[1]!, replacement: () => "пәндерді", category: "grammar",
    message: "Тура толықтауыш табыс септігінде қолданылуы керек.", ruleId: "KK_OBJECT_ACCUSATIVE"
  },
  {
    pattern: /(?<!\p{L})маған\s+ең\s+қатты\s+([\p{L}-]+)\s+ұнайды(?!\p{L})/giu,
    original: (match) => match[0], replacement: (match) => `маған ${match[1]} ең қатты ұнайды`, category: "grammar",
    message: "Мағыналық екпін үшін бастауыштық атау күшейткіш тіркестің алдында тұрады.", ruleId: "KK_WORD_ORDER_PREFERENCE"
  },
  {
    pattern: /(?<!\p{L})(бірнеше\s+)(тапсырмаларды)(?!\p{L})/giu,
    original: (match) => match[2]!, replacement: () => "тапсырманы", category: "grammar",
    message: "«Бірнеше» сан-мөлшер сөзінен кейін зат есім көптік жалғауынсыз қолданылады.", ruleId: "KK_QUANTIFIER_NUMBER"
  },
  {
    pattern: /(?<!\p{L})бірнеше\s+([\p{L}]+?)(?:лар|лер|дар|дер|тар|тер)(?!\p{L})/giu,
    original: (match) => match[0].slice("бірнеше ".length), replacement: (match) => match[1]!, category: "grammar",
    message: "«Бірнеше» сөзінен кейін зат есім жекеше түрде қолданылады.", ruleId: "KK_QUANTIFIER_PLURAL"
  },
  {
    pattern: /(?<!\p{L})(деректерін)(?=\s+қауіпсіздігіне(?!\p{L}))/giu,
    original: (match) => match[1]!, replacement: () => "деректерінің", category: "grammar",
    message: "Меншіктілік қатынаста анықтауыш ілік септігінде тұруы керек.", ruleId: "KK_POSSESSIVE_GENITIVE"
  },
  {
    pattern: /(?<!\p{L})біз[^.!?\r\n]{0,160}?(назар\s+аудару)(?=\s+керек(?!\p{L}))/giu,
    original: (match) => match[1]!, replacement: () => "назар аударуымыз", category: "grammar",
    message: "«Біз» бастауышымен тұйық етістік бірінші жақ көпше тәуелдік тұлғасында беріледі.", ruleId: "KK_NECESSITY_POSSESSIVE"
  },
  {
    pattern: /(?<!\p{L})жақсы\s+(көрем)(?!\p{L})/giu,
    original: (match) => match[1]!, replacement: () => "көремін", category: "grammar",
    message: "Бірінші жақ жекеше баяндауыш жіктік жалғауымен беріледі.", ruleId: "KK_FIRST_PERSON_ENDING"
  },
  {
    pattern: /(?<!\p{L})жұмыс\s+жасағым\s+келеді(?!\p{L})/giu,
    original: (match) => match[0], replacement: () => "жұмыс істегім келеді", category: "terminology",
    message: "Бұл контексте нормативті тіркес — «жұмыс істегім келеді».", ruleId: "KK_LEXICAL_COLLOCATION"
  },
  {
    pattern: /(?<!\p{L})жұмыс\s+жасап\s+жатыр(?!\p{L})/giu,
    original: (match) => match[0], replacement: () => "жұмыс істеп жатыр", category: "terminology",
    message: "Бұл контексте нормативті тіркес — «жұмыс істеп жатыр».", ruleId: "KK_LEXICAL_WORK_COLLOCATION"
  }
];

function singularPastReplacement(word: string): string | undefined {
  const endings = new Map([["дық", "дым"], ["дік", "дім"], ["тық", "тым"], ["тік", "тім"]]);
  for (const [ending, replacement] of endings) {
    if (word.toLocaleLowerCase("kk-KZ").endsWith(ending)) return `${word.slice(0, -ending.length)}${replacement}`;
  }
  return undefined;
}

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

    for (const rule of contextRules) {
      for (const match of text.matchAll(rule.pattern)) {
        const original = rule.original(match);
        const relativeOffset = match[0].indexOf(original);
        issues.push({
          offset: match.index + Math.max(0, relativeOffset),
          length: original.length,
          original,
          message: rule.message,
          category: rule.category,
          replacements: [rule.replacement(match)],
          confidence: 0.96,
          source: this.name,
          ruleId: rule.ruleId
        });
      }
    }

    for (const sentence of text.matchAll(/[^.!?\r\n]+[.!?]?/gu)) {
      const hasFirstPersonSubject = /(?<!\p{L})мен(?!\p{L})/iu.test(sentence[0]);
      const hasInstrumentalCompanion = /(?<!\p{L})[\p{L}]+(?:ыммен|іммен|ммен)(?!\p{L})/iu.test(sentence[0]);
      if (hasFirstPersonSubject && hasInstrumentalCompanion) {
        for (const verb of sentence[0].matchAll(/(?<!\p{L})[\p{L}]+(?:дық|дік|тық|тік)(?!\p{L})/giu)) {
          const replacement = singularPastReplacement(verb[0]);
          if (!replacement) continue;
          issues.push({
            offset: sentence.index + verb.index,
            length: verb[0].length,
            original: verb[0],
            message: "«Мен» бастауышы бірінші жақ жекеше баяндауышты талап етеді.",
            category: "grammar",
            replacements: [replacement],
            confidence: 0.98,
            source: this.name,
            ruleId: "KK_SUBJECT_VERB_PERSON"
          });
        }
      }
      if (!/(?<!\p{L})біз(?!\p{L})/iu.test(sentence[0])) continue;
      for (const verb of sentence[0].matchAll(/(?<!\p{L})(?:зерттеді)(?!\p{L})/giu)) {
        issues.push({
          offset: sentence.index + verb.index,
          length: verb[0].length,
          original: verb[0],
          message: "«Біз» бастауышы бірінші жақ көпше баяндауышты талап етеді.",
          category: "grammar",
          replacements: [preserveCase(verb[0], "зерттедік")],
          confidence: 0.98,
          source: this.name,
          ruleId: "KK_SUBJECT_VERB_PLURAL"
        });
      }
    }

    const unique = new Map<string, GrammarIssue>();
    for (const issue of issues) {
      const key = `${issue.offset}:${issue.length}`;
      const current = unique.get(key);
      if (!current || issue.confidence > current.confidence) unique.set(key, issue);
    }
    return [...unique.values()].sort((left, right) => left.offset - right.offset);
  }
}
