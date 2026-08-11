import type { TransformAction } from "@bank-ai/contracts";

function criticalTokens(text: string): string[] {
  return text.match(/\d+(?:[.,:/-]\d+)*/gu)?.sort() ?? [];
}

function hasSameCriticalTokens(source: string, result: string): boolean {
  return JSON.stringify(criticalTokens(source)) === JSON.stringify(criticalTokens(result));
}

function hasOnlySourceCriticalTokens(source: string, result: string): boolean {
  const available = new Map<string, number>();
  for (const token of criticalTokens(source)) available.set(token, (available.get(token) ?? 0) + 1);
  for (const token of criticalTokens(result)) {
    const remaining = available.get(token) ?? 0;
    if (remaining === 0) return false;
    available.set(token, remaining - 1);
  }
  return true;
}

export function isAcceptableResult(action: TransformAction, source: string, result: string): boolean {
  if (!result) return false;
  if (action === "summary") {
    if (!hasOnlySourceCriticalTokens(source, result)) return false;
  } else if (!hasSameCriticalTokens(source, result)) return false;
  if (result.length > Math.max(source.length * 3, source.length + 500)) return false;
  if (action === "shorten" && source.length > 120 && result.length > source.length) return false;
  if (action === "summary" && source.length > 300 && result.length >= source.length * 0.75) return false;
  if (action === "expand" && source.length > 40 && result.length <= source.length) return false;
  if (action === "expand" && result.length > source.length * 2 + 40) return false;
  return !/(?:<think>|Thinking Process:|^Вот (?:результат|исправленный|переработанный) текст)/iu.test(result);
}
