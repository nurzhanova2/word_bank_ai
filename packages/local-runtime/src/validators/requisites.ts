export interface ProtectedRequisite {
  placeholder: string;
  value: string;
}

export interface RequisiteProtection {
  protectedText: string;
  entries: ProtectedRequisite[];
}

export interface RestoreOptions {
  requireAll: boolean;
}

const placeholderPattern = /⟦BANKAI_[A-Z]+⟧/gu;
const emailPattern = /[\p{L}\p{N}._%+-]+@[\p{L}\p{N}.-]+\.[\p{L}]{2,}/giu;
const urlPattern = /https?:\/\/[^\s<>"']+/giu;
const numberPattern = /\d+(?:[.,:/-]\d+)*/gu;
const unprotectedNumberPattern = /\d+(?:[.,:/-]\d+)*/u;
const unprotectedEmailPattern = /[\p{L}\p{N}._%+-]+@[\p{L}\p{N}.-]+\.[\p{L}]{2,}/iu;
const unprotectedUrlPattern = /https?:\/\/[^\s<>"']+/iu;
const requisitePattern = new RegExp(
  `${urlPattern.source}|${emailPattern.source}|${numberPattern.source}`,
  "giu"
);

function alphabeticId(index: number): string {
  let value = index + 1;
  let result = "";
  while (value > 0) {
    value -= 1;
    result = String.fromCharCode(65 + (value % 26)) + result;
    value = Math.floor(value / 26);
  }
  return result;
}

export function protectRequisites(text: string): RequisiteProtection {
  const entries: ProtectedRequisite[] = [];
  const protectedText = text.replace(requisitePattern, (value) => {
    const placeholder = `⟦BANKAI_${alphabeticId(entries.length)}⟧`;
    entries.push({ placeholder, value });
    return placeholder;
  });
  return { protectedText, entries };
}

function countOccurrences(text: string, value: string): number {
  return text.split(value).length - 1;
}

function containsUnprotectedRequisite(text: string): boolean {
  const withoutPlaceholders = text.replace(placeholderPattern, "");
  return unprotectedNumberPattern.test(withoutPlaceholders)
    || unprotectedEmailPattern.test(withoutPlaceholders)
    || unprotectedUrlPattern.test(withoutPlaceholders);
}

export function restoreProtectedResult(
  protection: RequisiteProtection,
  result: string,
  options: RestoreOptions
): string {
  if (containsUnprotectedRequisite(result)) {
    throw new Error("LLM added an unprotected requisite.");
  }

  const known = new Map(protection.entries.map((entry) => [entry.placeholder, entry]));
  for (const placeholder of result.match(placeholderPattern) ?? []) {
    if (!known.has(placeholder)) throw new Error("LLM added an unknown requisite marker.");
  }

  let restored = result;
  for (const entry of protection.entries) {
    const occurrences = countOccurrences(result, entry.placeholder);
    if (occurrences > 1) throw new Error("LLM duplicated a protected requisite.");
    if (options.requireAll && occurrences !== 1) throw new Error("LLM removed a protected requisite.");
    if (occurrences === 1) restored = restored.replace(entry.placeholder, entry.value);
  }
  return restored;
}
