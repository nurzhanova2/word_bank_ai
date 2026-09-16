export const DOCUMENT_CHUNK_TARGET = 10_000;

export interface TextChunk { index: number; start: number; end: number; text: string }
export interface ParagraphSlice { paragraphIndex: number; startOffset: number; endOffset: number }
export interface MappedDocumentChunk extends TextChunk { slices: ParagraphSlice[]; paragraphText?: string }

/** Uses the existing safe chunker and records UTF-16 paragraph slices for reassembly. */
export function planParagraphChunks(paragraphs: readonly { index: number; text: string }[], target = DOCUMENT_CHUNK_TARGET): MappedDocumentChunk[] {
  const chunks: MappedDocumentChunk[] = [];
  for (const paragraph of paragraphs) {
    if (!paragraph.text) { chunks.push({ index: chunks.length, start: 0, end: 0, text: "", slices: [{ paragraphIndex: paragraph.index, startOffset: 0, endOffset: 0 }] }); continue; }
    for (const chunk of chunkDocument(paragraph.text, target)) chunks.push({ ...chunk, index: chunks.length, slices: [{ paragraphIndex: paragraph.index, startOffset: chunk.start, endOffset: chunk.end }], paragraphText: paragraph.text });
  }
  return chunks;
}

function safeEnd(text: string, end: number): number {
  if (end > 0 && end < text.length && /[\uD800-\uDBFF]/u.test(text[end - 1]!) && /[\uDC00-\uDFFF]/u.test(text[end]!)) return end - 1;
  return end;
}

function splitLongPart(text: string, offset: number, target: number): TextChunk[] {
  const chunks: TextChunk[] = [];
  let cursor = 0;
  while (cursor < text.length) {
    let end = Math.min(text.length, cursor + target);
    if (end < text.length) {
      const candidate = text.slice(cursor, end);
      const sentence = Math.max(candidate.lastIndexOf(". "), candidate.lastIndexOf("! "), candidate.lastIndexOf("? "));
      if (sentence >= Math.floor(target * .4)) end = cursor + sentence + 2;
      end = safeEnd(text, end);
    }
    chunks.push({ index: chunks.length, start: offset + cursor, end: offset + end, text: text.slice(cursor, end) });
    cursor = end;
  }
  return chunks;
}

/** Preserves every UTF-16 code unit and prefers paragraph, then sentence boundaries. */
export function chunkDocument(text: string, target = DOCUMENT_CHUNK_TARGET): TextChunk[] {
  if (!text || !text.trim()) return [];
  if (target < 1) throw new Error("Chunk target must be positive.");
  const parts = text.match(/[\s\S]*?(?:\r\n|\r|\n|$)/gu)?.filter((part) => part.length > 0) ?? [text];
  const chunks: TextChunk[] = [];
  let current = "";
  let currentStart = 0;
  let offset = 0;
  const flush = () => {
    if (current) chunks.push({ index: chunks.length, start: currentStart, end: currentStart + current.length, text: current });
    current = "";
  };
  for (const part of parts) {
    if (part.length > target) {
      flush();
      for (const chunk of splitLongPart(part, offset, target)) chunks.push({ ...chunk, index: chunks.length });
    } else if (current && current.length + part.length > target) {
      flush(); currentStart = offset; current = part;
    } else {
      if (!current) currentStart = offset;
      current += part;
    }
    offset += part.length;
  }
  flush();
  return chunks;
}
