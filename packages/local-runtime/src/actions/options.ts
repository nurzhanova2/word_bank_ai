import type { TargetLanguage, TargetTone, TransformAction, TransformOptions } from "@bank-ai/contracts";

const languageNames: Record<TargetLanguage, string> = {
  ru: "русский",
  kk: "казахский",
  en: "английский"
};

const toneInstructions: Record<TargetTone, string> = {
  neutral: "Используй спокойный нейтральный тон без эмоциональной окраски.",
  polite: "Используй вежливый и уважительный тон, не ослабляя смысл, срочность, просьбы и требования.",
  strict: "Используй строгий, прямой и однозначный тон без грубости, угроз и лишней эмоциональности.",
  diplomatic: "Используй дипломатичный, тактичный и конструктивный тон, сохраняя ясность позиции, срочность и обязательность требования."
};

export function optionInstruction(action: TransformAction, options: TransformOptions): string {
  if (action === "translate" && options.targetLanguage) {
    return `Язык результата: ${languageNames[options.targetLanguage]}.`;
  }
  if (action === "tone" && options.targetTone) return toneInstructions[options.targetTone];
  return "";
}
