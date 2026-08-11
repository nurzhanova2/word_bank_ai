export interface WordAdapter {
  getSelectedText(): Promise<string>;
  replaceSelection(text: string): Promise<void>;
  appendAfterSelection(text: string, prefix?: string): Promise<void>;
}

export class OfficeWordAdapter implements WordAdapter {
  async getSelectedText(): Promise<string> {
    return Word.run(async (context) => {
      const range = context.document.getSelection();
      range.load("text");
      await context.sync();
      return range.text.trim();
    });
  }

  async replaceSelection(text: string): Promise<void> {
    await Word.run(async (context) => {
      const range = context.document.getSelection();
      range.insertText(text, Word.InsertLocation.replace);
      range.select();
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
