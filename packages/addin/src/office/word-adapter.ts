import { replaceParagraphTextInOoxml } from "./formatted-ooxml.js";

interface FontFormatting {
  name: string | null;
  size: number | null;
  bold: boolean | null;
  italic: boolean | null;
  color: string | null;
}

interface ParagraphFormatting {
  alignment: Word.Alignment | "Mixed" | "Unknown" | "Left" | "Centered" | "Right" | "Justified" | null;
  firstLineIndent: number | null;
  leftIndent: number | null;
  rightIndent: number | null;
  lineSpacing: number | null;
  spaceAfter: number | null;
  spaceBefore: number | null;
}

export function copyFontFormatting(source: FontFormatting, target: FontFormatting): void {
  if (source.name != null) target.name = source.name;
  if (source.size != null) target.size = source.size;
  if (source.bold != null) target.bold = source.bold;
  if (source.italic != null) target.italic = source.italic;
  if (source.color != null) target.color = source.color;
}

export function copyParagraphFormatting(source: ParagraphFormatting, target: ParagraphFormatting): void {
  if (source.alignment != null && source.alignment !== "Mixed" && source.alignment !== "Unknown") target.alignment = source.alignment;
  for (const key of ["firstLineIndent", "leftIndent", "rightIndent", "lineSpacing", "spaceAfter", "spaceBefore"] as const) {
    if (source[key] != null) target[key] = source[key];
  }
}

export interface WordAdapter {
  getSelectedContent(): Promise<{ text: string; ooxml: string }>;
  replaceSelection(text: string, sourceOoxml?: string): Promise<void>;
  appendAfterSelection(text: string, prefix?: string, sourceOoxml?: string): Promise<void>;
}

export class OfficeWordAdapter implements WordAdapter {
  async getSelectedContent(): Promise<{ text: string; ooxml: string }> {
    return Word.run(async (context) => {
      const range = context.document.getSelection();
      range.load("text");
      const ooxml = range.getOoxml();
      await context.sync();
      return { text: range.text.trim(), ooxml: ooxml.value };
    });
  }

  async replaceSelection(text: string, sourceOoxml?: string): Promise<void> {
    await Word.run(async (context) => {
      const range = context.document.getSelection();
      const formattedOoxml = sourceOoxml
        ? replaceParagraphTextInOoxml(sourceOoxml, text)
        : undefined;
      if (formattedOoxml) {
        const insertedRange = range.insertOoxml(formattedOoxml, Word.InsertLocation.replace);
        insertedRange.select();
        await context.sync();
        return;
      }

      const formatSource = range.getRange(Word.RangeLocation.end);
      const sourceParagraph = range.paragraphs.getLast();
      formatSource.font.load(["name", "size", "bold", "italic", "color"]);
      sourceParagraph.load(["style", "alignment", "firstLineIndent", "leftIndent", "rightIndent", "lineSpacing", "spaceAfter", "spaceBefore"]);
      await context.sync();
      const insertedRange = range.insertText(text, Word.InsertLocation.replace);
      copyFontFormatting(formatSource.font as FontFormatting, insertedRange.font as FontFormatting);
      const insertedParagraphs = insertedRange.paragraphs;
      insertedParagraphs.load("items");
      await context.sync();
      for (const paragraph of insertedParagraphs.items) {
        if (sourceParagraph.style) paragraph.style = sourceParagraph.style;
        copyParagraphFormatting(sourceParagraph as ParagraphFormatting, paragraph as ParagraphFormatting);
        copyFontFormatting(formatSource.font as FontFormatting, paragraph.font as FontFormatting);
      }
      insertedRange.select();
      await context.sync();
    });
  }

  async appendAfterSelection(text: string, prefix = "", _sourceOoxml?: string): Promise<void> {
    await Word.run(async (context) => {
      const range = context.document.getSelection();
      const formatSource = range.getRange(Word.RangeLocation.end);
      const sourceParagraph = range.paragraphs.getLast();
      formatSource.font.load(["name", "size", "bold", "italic", "color"]);
      sourceParagraph.load(["style", "alignment", "firstLineIndent", "leftIndent", "rightIndent", "lineSpacing", "spaceAfter", "spaceBefore"]);
      await context.sync();
      const appendText = `${prefix ? `${prefix} ` : ""}${text}`;
      const insertedRange = range.insertText(`\n\n${appendText}`, Word.InsertLocation.after);
      copyFontFormatting(formatSource.font as FontFormatting, insertedRange.font as FontFormatting);
      const insertedParagraphs = insertedRange.paragraphs;
      insertedParagraphs.load("items");
      await context.sync();
      for (const paragraph of insertedParagraphs.items) {
        if (sourceParagraph.style) paragraph.style = sourceParagraph.style;
        copyParagraphFormatting(sourceParagraph as ParagraphFormatting, paragraph as ParagraphFormatting);
        copyFontFormatting(formatSource.font as FontFormatting, paragraph.font as FontFormatting);
      }
      insertedRange.select();
      await context.sync();
    });
  }
}
