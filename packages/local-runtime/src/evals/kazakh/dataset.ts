import type { HunspellDecision, KazakhGrammarErrorType } from "@bank-ai/contracts";
import type { KazakhEvalCase, KazakhGoldCandidate, KazakhGoldError } from "./types.js";

interface ErrorSpec {
  original: string;
  correction: string;
  type: KazakhGrammarErrorType;
  source?: KazakhGoldError["source"];
}

interface CandidateSpec {
  word: string;
  suggestions: string[];
  expectedDecision: HunspellDecision;
}

function occurrence(text: string, value: string): { start: number; end: number } {
  const start = text.indexOf(value);
  if (start < 0) throw new Error(`Dataset fragment '${value}' not found in '${text}'.`);
  return { start, end: start + value.length };
}

function evalCase(id: string, text: string, errors: ErrorSpec[], candidates: CandidateSpec[], tags: string[]): KazakhEvalCase {
  return {
    id,
    text,
    errors: errors.map((error) => ({ ...error, ...occurrence(text, error.original), source: error.source ?? "context" })),
    hunspellCandidates: candidates.map((candidate): KazakhGoldCandidate => ({
      ...candidate,
      ...occurrence(text, candidate.word)
    })),
    tags
  };
}

const variants = [
  ["киноға", "Университетте", "музыка", "кино"],
  ["театрға", "Колледжде", "ән", "театр"],
  ["мұражайға", "Мектепте", "дәріс", "мұражай"],
  ["саябаққа", "Курста", "әңгіме", "саябақ"],
  ["көрмеге", "Сабақта", "подкаст", "көрме"],
  ["концертке", "Аудиторияда", "хабар", "концерт"],
  ["кітапханаға", "Орталықта", "сұхбат", "кітапхана"],
  ["жиналысқа", "Кеңседе", "есеп", "жиналыс"],
  ["дәріске", "Факультетте", "баяндама", "дәріс"],
  ["сабаққа", "Лицейде", "өлең", "сабақ"],
  ["семинарға", "Академияда", "жаңалық", "семинар"],
  ["форумға", "Институтта", "талқылау", "форум"],
  ["байқауға", "Гимназияда", "аудиокітап", "байқау"],
  ["жаттығуға", "Орталықта", "түсіндірме", "жаттығу"],
  ["кездесуге", "Бөлімде", "ескерту", "кездесу"],
  ["кеңеске", "Басқармада", "нұсқаулық", "кеңес"],
  ["сапарға", "Департаментте", "ақпарат", "сапар"],
  ["зертханаға", "Зертханада", "жазба", "зертхана"],
  ["емтиханға", "Мектепте", "аудиожазба", "емтихан"],
  ["тренингке", "Компанияда", "пікір", "тренинг"]
] as const;

export const kazakhEvalDataset: readonly KazakhEvalCase[] = variants.flatMap((variant, index) => {
  const [destination, institution, audioObject, bareDestination] = variant;
  const number = index + 1;
  return [
    evalCase(`correct-possessive-${number}`, `Мен достарыммен ${destination} бардым.`, [], [
      { word: "достарыммен", suggestions: ["достармен"], expectedDecision: "REJECT" }
    ], ["correct", "oov", "possessive"]),
    evalCase(`correct-oov-${number}`, `Бос уақытымда кітап оқимын.`, [], [
      { word: "уақытымда", suggestions: ["уақытында"], expectedDecision: "REJECT" },
      { word: "оқимын", suggestions: ["оқамын"], expectedDecision: "REJECT" }
    ], ["correct", "oov", "person"]),
    evalCase(`subject-verb-${number}`, `Кеше мен достарыммен ${destination} бардық.`, [
      { original: "бардық", correction: "бардым", type: "subject_verb_agreement" }
    ], [{ word: "достарыммен", suggestions: ["достармен"], expectedDecision: "REJECT" }], ["subject_verb_agreement", "context-only"]),
    evalCase(`case-${number}`, `${institution} біз қызықты пәндер оқимыз.`, [
      { original: "пәндер", correction: "пәндерді", type: "case" }
    ], [], ["case", "context-only"]),
    evalCase(`spelling-listen-${number}`, `Мен ${audioObject} тындағанды жақсы көремін.`, [
      { original: "тындағанды", correction: "тыңдағанды", type: "spelling", source: "both" }
    ], [{ word: "тындағанды", suggestions: ["тыңдағанды"], expectedDecision: "ACCEPT" }], ["spelling", "hunspell"]),
    evalCase(`spelling-morning-${number}`, `Мен таңертен ерте тұрамын да, ${destination} барамын.`, [
      { original: "таңертен", correction: "таңертең", type: "spelling", source: "both" }
    ], [{ word: "таңертен", suggestions: ["таңертең"], expectedDecision: "ACCEPT" }], ["spelling", "hunspell"]),
    index % 5 === 0
      ? evalCase(`person-${number}`, `Сен бүгін ${destination} барамын.`, [
          { original: "барамын", correction: "барасың", type: "person" }
        ], [], ["person", "context-only"])
      : index % 5 === 1
        ? evalCase(`possessive-${number}`, "Менің кітаб үстелде жатыр.", [
            { original: "кітаб", correction: "кітабым", type: "possessive" }
          ], [], ["possessive", "context-only"])
        : index % 5 === 2
          ? evalCase(`morphology-${number}`, `Мен достарымдармен ${destination} бардым.`, [
              { original: "достарымдармен", correction: "достарыммен", type: "morphology" }
            ], [], ["morphology", "extra-affix-sequence", "context-only"])
          : index % 5 === 3
            ? evalCase(`extra-affix-${number}`, `Мен ${bareDestination}кеге бардым.`, [
                { original: `${bareDestination}кеге`, correction: destination, type: "extra_affix" }
              ], [], ["extra_affix", "case", "context-only"])
            : evalCase(`word-order-${number}`, `Мен ${destination} кеше бардым.`, [
                { original: `${destination} кеше`, correction: `кеше ${destination}`, type: "word_order" }
              ], [], ["word_order", "context-only", "requires-expert-review"]),
    index % 4 === 0
      ? evalCase(`lexical-${number}`, "Ол музыканы оқыды.", [
          { original: "оқыды", correction: "тыңдады", type: "lexical" }
        ], [], ["lexical", "context-only"])
      : evalCase(`number-${number}`, "Үстелде екі кітаптар жатыр.", [
          { original: "кітаптар", correction: "кітап", type: "number" }
        ], [], ["number", "context-only"]),
    evalCase(`missing-affix-${number}`, `Мен ${bareDestination} бардым.`, [
      { original: bareDestination, correction: destination, type: "missing_affix" }
    ], [], ["missing_affix", "case", "context-only"]),
    evalCase(`multiple-${number}`, `${institution} біз қызықты пәндер оқиды.`, [
      { original: "пәндер", correction: "пәндерді", type: "case" },
      { original: "оқиды", correction: "оқимыз", type: "subject_verb_agreement" }
    ], [], ["multiple", "case", "subject_verb_agreement", "context-only"])
  ];
});

if (kazakhEvalDataset.length < 200 || kazakhEvalDataset.length > 500) {
  throw new Error(`Kazakh eval dataset must contain 200–500 cases, received ${kazakhEvalDataset.length}.`);
}
