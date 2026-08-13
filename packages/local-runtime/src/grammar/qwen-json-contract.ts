import { z } from "zod";
import type { GrammarIssue } from "./types.js";

const correctionSchema = z.object({
  offset: z.number().int().nonnegative(),
  original: z.string().min(1),
  replacement: z.string(),
  message: z.string().min(1).max(300),
  category: z.enum(["spelling", "grammar", "punctuation", "style", "terminology"]),
  confidence: z.number().min(0).max(1)
}).strict();

const reviewSchema = z.object({
  version: z.literal(1),
  corrections: z.array(correctionSchema).max(100)
}).strict();

export const grammarReviewJsonSchema: Record<string, unknown> = {
  type: "object",
  additionalProperties: false,
  required: ["version", "corrections"],
  properties: {
    version: { type: "integer", const: 1 },
    corrections: {
      type: "array",
      maxItems: 100,
      items: {
        type: "object",
        additionalProperties: false,
        required: ["offset", "original", "replacement", "message", "category", "confidence"],
        properties: {
          offset: { type: "integer", minimum: 0 },
          original: { type: "string", minLength: 1 },
          replacement: { type: "string" },
          message: { type: "string", minLength: 1, maxLength: 300 },
          category: { type: "string", enum: ["spelling", "grammar", "punctuation", "style", "terminology"] },
          confidence: { type: "number", minimum: 0, maximum: 1 }
        }
      }
    }
  }
};

const protectedTerms = new Set(["реквизит", "реквизиты", "реквизиттер", "iban", "бин", "иин", "бик"]);

export function parseQwenGrammarReview(raw: string, sourceText: string): GrammarIssue[] {
  let value: unknown;
  try { value = JSON.parse(raw); }
  catch { throw new Error("Qwen вернул ответ не в формате JSON."); }
  const parsed = reviewSchema.safeParse(value);
  if (!parsed.success) throw new Error("JSON-ответ Qwen не соответствует контракту грамматической проверки.");

  const occupied: Array<{ start: number; end: number }> = [];
  const issues: GrammarIssue[] = [];
  parsed.data.corrections.forEach((correction, index) => {
    let offset = correction.offset;
    let end = offset + correction.original.length;
    if (sourceText.slice(offset, end) !== correction.original) {
      const first = sourceText.indexOf(correction.original);
      const unique = first >= 0 && sourceText.indexOf(correction.original, first + 1) < 0;
      if (!unique) return;
      offset = first;
      end = offset + correction.original.length;
    }
    if (occupied.some((range) => offset < range.end && end > range.start)) {
      return;
    }
    const normalized = correction.original.toLocaleLowerCase().trim();
    if (protectedTerms.has(normalized) || (!/\s/u.test(correction.original) && /\s/u.test(correction.replacement.trim()))) {
      return;
    }
    occupied.push({ start: offset, end });
    issues.push({
      offset,
      length: correction.original.length,
      original: correction.original,
      message: correction.message,
      category: correction.category,
      replacements: [correction.replacement],
      confidence: correction.confidence,
      source: "qwen-json",
      ruleId: `QWEN_JSON_${index + 1}`
    });
  });
  return issues.sort((left, right) => left.offset - right.offset);
}
