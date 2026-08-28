export interface KazakhGrammarFewShot {
  input: { text: string; hunspell_candidates: Array<{ word: string; start: number; end: number; suggestions: string[] }> };
  expected: Record<string, unknown>;
}

export const kazakhGrammarFewShots: readonly KazakhGrammarFewShot[] = [
  {
    input: { text: "Мен университетте оқимын.", hunspell_candidates: [{ word: "оқимын", start: 18, end: 24, suggestions: ["оқамын", "оқимен", "оқимыз"] }] },
    expected: { errors: [], hunspell_validation: [{ word: "оқимын", decision: "REJECT", reason: "оқимын — бірінші жақ жекеше түрдегі дұрыс етістік.", confidence: 0.99 }] }
  },
  {
    input: { text: "Кеше мен достарыммен кітапханаға бардық.", hunspell_candidates: [{ word: "достарыммен", start: 9, end: 20, suggestions: ["достармен"] }] },
    expected: {
      errors: [{ original: "бардық", correction: "бардым", start: 33, end: 39, type: "subject_verb_agreement", reason: "«мен» бастауышы бірінші жақ жекеше баяндауышты талап етеді.", confidence: 0.98, source: "context" }],
      hunspell_validation: [{ word: "достарыммен", decision: "REJECT", reason: "дос + тар + ым + мен — дұрыс тәуелдік және көмектес септік формасы.", confidence: 0.99 }]
    }
  },
  {
    input: { text: "Мен музыка тындағанды жақсы көремін.", hunspell_candidates: [] },
    expected: { errors: [{ original: "тындағанды", correction: "тыңдағанды", start: 11, end: 21, type: "spelling", reason: "Сөз «ң» әрпімен жазылады.", confidence: 0.99, source: "context" }], hunspell_validation: [] }
  },
  {
    input: { text: "Университетте біз қызықты пәндер оқимыз.", hunspell_candidates: [] },
    expected: { errors: [{ original: "пәндер", correction: "пәндерді", start: 26, end: 32, type: "case", reason: "Тура толықтауыш табыс септігінде болуы керек.", confidence: 0.96, source: "context" }], hunspell_validation: [] }
  },
  {
    input: { text: "Бос уақытымда кітап оқимын.", hunspell_candidates: [{ word: "уақытымда", start: 4, end: 13, suggestions: ["уақытында"] }, { word: "оқимын", start: 20, end: 26, suggestions: ["оқамын"] }] },
    expected: { errors: [], hunspell_validation: [{ word: "уақытымда", decision: "REJECT", reason: "уақыт + ым + да — контексте дұрыс форма.", confidence: 0.99 }, { word: "оқимын", decision: "REJECT", reason: "Бірінші жақ жекеше дұрыс форма.", confidence: 0.99 }] }
  },
  {
    input: { text: "Мен достарыммен киноға бардым.", hunspell_candidates: [{ word: "достарыммен", start: 4, end: 15, suggestions: ["достармен"] }] },
    expected: { errors: [], hunspell_validation: [{ word: "достарыммен", decision: "REJECT", reason: "Тәуелдік мағынасы бар дұрыс сөз формасы.", confidence: 0.99 }] }
  }
];

export function renderFewShots(): string {
  return kazakhGrammarFewShots.map((example, index) => [
    `<example_${index + 1}>`,
    `INPUT ${JSON.stringify(example.input)}`,
    `EXPECTED ${JSON.stringify(example.expected)}`,
    `</example_${index + 1}>`
  ].join("\n")).join("\n\n");
}
