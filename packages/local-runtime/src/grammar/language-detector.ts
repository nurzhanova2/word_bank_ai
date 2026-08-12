import type { DetectedLanguage, TextLanguage } from "./types.js";

export interface LanguageSegment {
  language: TextLanguage;
  text: string;
  offset: number;
}

const kazakhLetters = /[әғқңөұүһі]/iu;
const latinLetters = /[a-z]/iu;
const cyrillicLetters = /[а-яё]/iu;
const kazakhWords = new Set(["және", "үшін", "өтініш", "клиенттің", "қарастырды", "қабылданды", "банкке", "туралы", "бойынша", "құжат", "шарт"]);

export function detectTextLanguage(text: string): DetectedLanguage {
  const words = text.toLocaleLowerCase().match(/[\p{L}]+/gu) ?? [];
  if (words.length === 0) return "unknown";
  const latin = words.filter((word) => latinLetters.test(word)).length;
  const cyrillic = words.filter((word) => cyrillicLetters.test(word) || kazakhLetters.test(word)).length;
  if (latin > 0 && cyrillic > 0 && Math.min(latin, cyrillic) / words.length >= 0.2) return "mixed";
  if (latin > cyrillic) return "en";
  if (kazakhLetters.test(text) || words.some((word) => kazakhWords.has(word))) return "kk";
  return cyrillic > 0 ? "ru" : "unknown";
}

export function segmentByLanguage(text: string): LanguageSegment[] {
  const chunks = text.match(/[\s\S]*?(?:[.!?]+(?:\s+(?=\p{Lu}))|(?:\r\n|\r|\n)|$)/gu)?.filter(Boolean) ?? [text];
  const segments: LanguageSegment[] = [];
  let offset = 0;
  for (const chunk of chunks) {
    const detected = detectTextLanguage(chunk);
    const language: TextLanguage = detected === "en" || detected === "kk" ? detected : "ru";
    const previous = segments.at(-1);
    if (previous?.language === language) previous.text += chunk;
    else segments.push({ language, text: chunk, offset });
    offset += chunk.length;
  }
  return segments;
}
