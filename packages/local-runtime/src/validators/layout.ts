export interface ParagraphBreakEntry {
  placeholder: string;
  value: string;
}

export interface ParagraphBreakProtection {
  protectedText: string;
  entries: ParagraphBreakEntry[];
}

const paragraphMarkerPattern = /\[\[BANKAI:PAR:[A-Z]+\]\]/gu;

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

export function protectParagraphBreaks(text: string): ParagraphBreakProtection {
  const entries: ParagraphBreakEntry[] = [];
  const protectedText = text.replace(/\r\n|\r|\n/gu, (value) => {
    const placeholder = `[[BANKAI:PAR:${alphabeticId(entries.length)}]]`;
    entries.push({ placeholder, value });
    return placeholder;
  });
  return { protectedText, entries };
}

function countOccurrences(text: string, value: string): number {
  return text.split(value).length - 1;
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/gu, "\\$&");
}

export function restoreParagraphBreaks(protection: ParagraphBreakProtection, result: string): string {
  const known = new Set(protection.entries.map((entry) => entry.placeholder));
  for (const placeholder of result.match(paragraphMarkerPattern) ?? []) {
    if (!known.has(placeholder)) throw new Error("LLM added an unknown paragraph marker.");
  }

  let restored = result;
  for (const entry of protection.entries) {
    if (countOccurrences(result, entry.placeholder) !== 1) {
      throw new Error("LLM changed a paragraph boundary.");
    }
    restored = restored.replace(
      new RegExp(`[\\t ]*${escapeRegExp(entry.placeholder)}[\\t ]*`, "u"),
      entry.value
    );
  }
  return restored;
}
