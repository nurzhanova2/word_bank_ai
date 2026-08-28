import { z } from "zod";
import { kazakhGrammarErrorTypes, type HunspellValidation, type KazakhGrammarErrorType } from "@bank-ai/contracts";
import type { GrammarConfidenceConfig } from "./config.js";
import type { GrammarIssue, HunspellCandidate } from "./types.js";

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

const kazakhErrorSchema = z.object({
  original: z.string().min(1),
  correction: z.string(),
  start: z.number().int().nonnegative(),
  end: z.number().int().positive(),
  type: z.enum(kazakhGrammarErrorTypes),
  reason: z.string().min(1).max(500),
  confidence: z.number().min(0).max(1),
  source: z.enum(["hunspell", "context", "both"])
}).strict();

const hunspellValidationSchema = z.object({
  word: z.string().min(1),
  decision: z.enum(["ACCEPT", "REJECT", "UNCERTAIN"]),
  reason: z.string().min(1).max(500),
  confidence: z.number().min(0).max(1)
}).strict();

const kazakhReviewSchema = z.object({
  version: z.literal(2),
  errors: z.array(kazakhErrorSchema).max(100),
  hunspell_validation: z.array(hunspellValidationSchema).max(100)
}).strict();

export const kazakhGrammarReviewJsonSchema: Record<string, unknown> = {
  type: "object",
  additionalProperties: false,
  required: ["version", "errors", "hunspell_validation"],
  properties: {
    version: { type: "integer", const: 2 },
    errors: {
      type: "array",
      maxItems: 100,
      items: {
        type: "object",
        additionalProperties: false,
        required: ["original", "correction", "start", "end", "type", "reason", "confidence", "source"],
        properties: {
          original: { type: "string", minLength: 1 },
          correction: { type: "string" },
          start: { type: "integer", minimum: 0 },
          end: { type: "integer", minimum: 1 },
          type: { type: "string", enum: kazakhGrammarErrorTypes },
          reason: { type: "string", minLength: 1, maxLength: 500 },
          confidence: { type: "number", minimum: 0, maximum: 1 },
          source: { type: "string", enum: ["hunspell", "context", "both"] }
        }
      }
    },
    hunspell_validation: {
      type: "array",
      maxItems: 100,
      items: {
        type: "object",
        additionalProperties: false,
        required: ["word", "decision", "reason", "confidence"],
        properties: {
          word: { type: "string", minLength: 1 },
          decision: { type: "string", enum: ["ACCEPT", "REJECT", "UNCERTAIN"] },
          reason: { type: "string", minLength: 1, maxLength: 500 },
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

const categoryByType: Record<KazakhGrammarErrorType, GrammarIssue["category"]> = {
  spelling: "spelling",
  morphology: "grammar",
  case: "grammar",
  possessive: "grammar",
  person: "grammar",
  number: "grammar",
  subject_verb_agreement: "grammar",
  word_order: "style",
  lexical: "terminology",
  missing_affix: "grammar",
  extra_affix: "grammar",
  other_grammar: "grammar"
};

export interface ParsedKazakhGrammarReview {
  issues: GrammarIssue[];
  hunspellValidation: HunspellValidation[];
}

function resolveRange(sourceText: string, original: string, requestedStart: number, requestedEnd: number): { start: number; end: number } | undefined {
  if (requestedEnd - requestedStart === original.length && sourceText.slice(requestedStart, requestedEnd) === original) {
    return { start: requestedStart, end: requestedEnd };
  }
  const first = sourceText.indexOf(original);
  if (first < 0 || sourceText.indexOf(original, first + 1) >= 0) return undefined;
  return { start: first, end: first + original.length };
}

export function parseKazakhGrammarReview(
  raw: string,
  sourceText: string,
  candidates: readonly HunspellCandidate[],
  confidence: GrammarConfidenceConfig
): ParsedKazakhGrammarReview {
  let value: unknown;
  try { value = JSON.parse(raw); }
  catch { throw new Error("Qwen вернул ответ не в формате JSON."); }
  const parsed = kazakhReviewSchema.safeParse(value);
  if (!parsed.success) throw new Error("JSON-ответ Qwen не соответствует контракту казахской грамматической проверки v2.");
  if (parsed.data.hunspell_validation.length !== candidates.length) {
    throw new Error("Qwen не вернул решение для каждого Hunspell-кандидата.");
  }

  const hunspellValidation: HunspellValidation[] = parsed.data.hunspell_validation.map((validation, index) => {
    const candidate = candidates[index];
    if (!candidate || validation.word !== candidate.word) {
      throw new Error("Порядок Hunspell validation не совпадает с входными кандидатами.");
    }
    const decision = validation.confidence < confidence.autoApply
      ? "UNCERTAIN" as const
      : validation.decision;
    return {
      ...candidate,
      decision,
      reason: validation.reason,
      confidence: validation.confidence
    };
  });

  const occupied: Array<{ start: number; end: number }> = [];
  const issues: GrammarIssue[] = [];
  parsed.data.errors.forEach((error, index) => {
    if (error.confidence < confidence.review || error.original === error.correction) return;
    const range = resolveRange(sourceText, error.original, error.start, error.end);
    if (!range || occupied.some((item) => range.start < item.end && range.end > item.start)) return;
    const candidateValidation = hunspellValidation.find((item) => range.start < item.end && range.end > item.start);
    if (candidateValidation?.decision === "REJECT") return;
    if ((error.source === "hunspell" || error.source === "both") && candidateValidation?.decision !== "ACCEPT") return;
    const normalized = error.original.toLocaleLowerCase().trim();
    if (protectedTerms.has(normalized) || (!/\s/u.test(error.original) && /\s/u.test(error.correction.trim()))) return;
    occupied.push(range);
    const actionable = error.confidence >= confidence.autoApply && candidateValidation?.decision !== "UNCERTAIN";
    issues.push({
      offset: range.start,
      length: range.end - range.start,
      original: error.original,
      message: error.reason,
      category: categoryByType[error.type]!,
      replacements: actionable ? [error.correction] : [],
      suggestions: actionable ? undefined : [error.correction],
      autoApply: actionable,
      confidence: error.confidence,
      source: `qwen-kazakh:${error.source}`,
      ruleId: `QWEN_KK_${error.type.toLocaleUpperCase()}_${index + 1}`,
      errorType: error.type
    });
  });
  return { issues: issues.sort((left, right) => left.offset - right.offset), hunspellValidation };
}
