import type { TargetLanguage } from "@bank-ai/contracts";

interface GlossaryEntry {
  terms: Record<TargetLanguage, string>;
}

const corporateGlossary: readonly GlossaryEntry[] = [
  { terms: { ru: "обращение", kk: "өтініш", en: "request" } },
  { terms: { ru: "договор", kk: "шарт", en: "agreement" } },
  { terms: { ru: "заёмщик", kk: "қарыз алушы", en: "borrower" } },
  { terms: { ru: "банковский счёт", kk: "банктік шот", en: "bank account" } },
  { terms: { ru: "процентная ставка", kk: "сыйақы мөлшерлемесі", en: "interest rate" } },
  { terms: { ru: "задолженность", kk: "берешек", en: "debt" } }
];

export function glossaryInstruction(targetLanguage: TargetLanguage | undefined): string {
  if (!targetLanguage) return "";
  const entries = corporateGlossary.map((entry) =>
    Object.values(entry.terms).map((source) => `${source} => ${entry.terms[targetLanguage]}`).join("; ")
  );
  return [
    `<glossary target_language="${targetLanguage}">`,
    "Используй следующие утверждённые эквиваленты, когда соответствующий термин присутствует в исходнике:",
    ...entries.map((entry) => `- ${entry}`),
    "</glossary>"
  ].join("\n");
}
