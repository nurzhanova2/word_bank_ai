import { replaceParagraphTextInOoxml } from "./formatted-ooxml.js";

export interface WordAdapter {
  getSelectedContent(): Promise<{ text: string; ooxml: string }>;
  replaceSelection(text: string, sourceOoxml?: string): Promise<void>;
  appendAfterSelection(text: string, prefix?: string): Promise<void>;
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
      const insertedRange = formattedOoxml
        ? range.insertOoxml(formattedOoxml, Word.InsertLocation.replace)
        : range.insertText(text, Word.InsertLocation.replace);
      insertedRange.select();
      await context.sync();
    });
  }

  async appendAfterSelection(text: string, prefix = ""): Promise<void> {
    await Word.run(async (context) => {
      const range = context.document.getSelection();
      const insertedRange = range.insertText(`\n\n${prefix ? `${prefix} ` : ""}${text}`, Word.InsertLocation.after);
      insertedRange.select();
      await context.sync();
    });
  }
}
