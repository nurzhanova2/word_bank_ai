export type RequisiteKind =
  | "url"
  | "email"
  | "organization"
  | "person-name"
  | "business-id"
  | "iban"
  | "bic"
  | "account"
  | "phone"
  | "number";

export interface ProtectedRequisite {
  placeholder: string;
  value: string;
  kind: RequisiteKind;
}

export interface RequisiteProtection {
  protectedText: string;
  entries: ProtectedRequisite[];
}

export interface RestoreOptions {
  requireAll: boolean;
}

interface RequisiteMatch {
  start: number;
  end: number;
  value: string;
  kind: RequisiteKind;
  priority: number;
}

const placeholderPattern = /\[\[BANKAI:[A-Z]+\]\]/gu;

const directPatterns: readonly { kind: RequisiteKind; pattern: RegExp; priority: number }[] = [
  { kind: "url", pattern: /https?:\/\/[^\s<>"']+/giu, priority: 100 },
  { kind: "email", pattern: /[\p{L}\p{N}._%+-]+@[\p{L}\p{N}.-]+\.[\p{L}]{2,}/giu, priority: 100 },
  { kind: "organization", pattern: /(?:ТОО|АО|ОАО|ЗАО|ИП)\s+(?:[«"][^»"\r\n]{1,120}[»"]|[\p{Lu}][\p{L}-]*(?:\s+[\p{Lu}][\p{L}-]*){0,4})/gu, priority: 95 },
  { kind: "iban", pattern: /\bKZ\d{2}[A-Z0-9]{16}\b/giu, priority: 90 },
  { kind: "phone", pattern: /(?<!\d)(?:\+7|8)[\s-]*\(?\d{3}\)?[\s-]*\d{3}[\s-]*\d{2}[\s-]*\d{2}(?!\d)/gu, priority: 90 }
];

const labeledPatterns: readonly { kind: RequisiteKind; pattern: RegExp; priority: number }[] = [
  { kind: "person-name", pattern: /(?:ФИО|Ф\.\s*И\.\s*О\.)\s*:\s*(?<value>[\p{Lu}][\p{Ll}-]+(?:\s+[\p{Lu}][\p{Ll}-]+){1,2})/gu, priority: 90 },
  { kind: "business-id", pattern: /(?:ИИН|БИН)\s*[:№]?\s*(?<value>\d{12})\b/giu, priority: 90 },
  { kind: "bic", pattern: /БИК\s*[:№]?\s*(?<value>[A-Z]{8}(?:[A-Z0-9]{3})?)\b/giu, priority: 90 },
  { kind: "account", pattern: /(?:ИИК|сч[её]т|р\/с)\s*[:№]?\s*(?<value>(?!KZ)[A-Z0-9]{10,34})\b/giu, priority: 85 }
];

const numberPattern = /\d+(?:[.,:/-]\d+)*/gu;

function collectMatches(text: string): RequisiteMatch[] {
  const candidates: RequisiteMatch[] = [];
  for (const definition of directPatterns) {
    for (const match of text.matchAll(definition.pattern)) {
      if (match.index === undefined) continue;
      candidates.push({
        start: match.index,
        end: match.index + match[0].length,
        value: match[0],
        kind: definition.kind,
        priority: definition.priority
      });
    }
  }
  for (const definition of labeledPatterns) {
    for (const match of text.matchAll(definition.pattern)) {
      const value = match.groups?.value;
      if (match.index === undefined || !value) continue;
      const offset = match[0].lastIndexOf(value);
      const start = match.index + offset;
      candidates.push({ start, end: start + value.length, value, kind: definition.kind, priority: definition.priority });
    }
  }
  for (const match of text.matchAll(numberPattern)) {
    if (match.index === undefined) continue;
    candidates.push({
      start: match.index,
      end: match.index + match[0].length,
      value: match[0],
      kind: "number",
      priority: 1
    });
  }

  candidates.sort((left, right) => left.start - right.start || right.priority - left.priority || right.end - left.end);
  const accepted: RequisiteMatch[] = [];
  for (const candidate of candidates) {
    if (accepted.some((item) => candidate.start < item.end && candidate.end > item.start)) continue;
    accepted.push(candidate);
  }
  return accepted.sort((left, right) => left.start - right.start);
}

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
  let cursor = 0;
  let protectedText = "";
  for (const match of collectMatches(text)) {
    const placeholder = `[[BANKAI:${alphabeticId(entries.length)}]]`;
    protectedText += text.slice(cursor, match.start) + placeholder;
    entries.push({ placeholder, value: match.value, kind: match.kind });
    cursor = match.end;
  }
  protectedText += text.slice(cursor);
  return { protectedText, entries };
}

function countOccurrences(text: string, value: string): number {
  return text.split(value).length - 1;
}

function containsUnprotectedRequisite(text: string): boolean {
  return collectMatches(text.replace(placeholderPattern, "")).length > 0;
}

export function restoreProtectedResult(
  protection: RequisiteProtection,
  result: string,
  options: RestoreOptions
): string {
  if (containsUnprotectedRequisite(result)) throw new Error("LLM added an unprotected requisite.");

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
