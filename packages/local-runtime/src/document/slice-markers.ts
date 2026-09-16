export const SLICE_CONTEXT_LIMIT = 600;

export interface SliceMarkerContract {
  startMarker: string;
  endMarker: string;
  contextBefore: string;
  contextAfter: string;
  prompt: string;
}

const markerPattern = /\[\[BANKAI:[A-Z]+\]\]/gu;

function alphabeticId(value: number): string {
  let index = value + 1;
  let result = "";
  while (index > 0) {
    index -= 1;
    result = String.fromCharCode(65 + (index % 26)) + result;
    index = Math.floor(index / 26);
  }
  return result;
}

function boundedBefore(text: string, offset: number): string {
  let start = Math.max(0, offset - SLICE_CONTEXT_LIMIT);
  if (start > 0 && /[\uDC00-\uDFFF]/u.test(text[start]!)) start += 1;
  return text.slice(start, offset);
}

function boundedAfter(text: string, offset: number): string {
  let end = Math.min(text.length, offset + SLICE_CONTEXT_LIMIT);
  if (end < text.length && /[\uD800-\uDBFF]/u.test(text[end - 1]!)) end -= 1;
  return text.slice(offset, end);
}

function count(text: string, marker: string): number {
  return text.split(marker).length - 1;
}

/** Creates existing BANKAI-format markers around the only region a model may edit. */
export function createSliceMarkerContract(paragraph: string, start: number, end: number, sliceIndex: number): SliceMarkerContract {
  let id = alphabeticId(sliceIndex);
  let startMarker = `[[BANKAI:SLICESTART${id}]]`;
  let endMarker = `[[BANKAI:SLICEEND${id}]]`;
  while (paragraph.includes(startMarker) || paragraph.includes(endMarker)) {
    id += "X";
    startMarker = `[[BANKAI:SLICESTART${id}]]`;
    endMarker = `[[BANKAI:SLICEEND${id}]]`;
  }
  const contextBefore = boundedBefore(paragraph, start);
  const contextAfter = boundedAfter(paragraph, end);
  const prompt = [
    "READ-ONLY CONTEXT BEFORE",
    contextBefore,
    "",
    `${startMarker}${paragraph.slice(start, end)}${endMarker}`,
    "",
    "READ-ONLY CONTEXT AFTER",
    contextAfter
  ].join("\n");
  return { startMarker, endMarker, contextBefore, contextAfter, prompt };
}

/** Validates marker integrity and returns only the editable target, never context or markers. */
export function extractSliceResult(contract: SliceMarkerContract, result: string): string {
  const expected = new Set([contract.startMarker, contract.endMarker]);
  for (const marker of result.match(markerPattern) ?? []) {
    if (!expected.has(marker)) throw new Error("LLM added an unknown slice marker.");
  }
  if (count(result, contract.startMarker) !== 1 || count(result, contract.endMarker) !== 1) {
    throw new Error("LLM changed a slice marker.");
  }
  const start = result.indexOf(contract.startMarker);
  const end = result.indexOf(contract.endMarker);
  if (start > end) throw new Error("LLM reversed slice markers.");
  return result.slice(start + contract.startMarker.length, end);
}

export function sliceMarkers(text: string): readonly string[] {
  return text.match(markerPattern) ?? [];
}
