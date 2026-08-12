import assert from "node:assert/strict";
import test from "node:test";
import { copyFontFormatting, copyParagraphFormatting } from "./word-adapter.js";

test("copies computed font properties and ignores mixed unavailable values", () => {
  const target = { name: "Calibri", size: 11, bold: false, italic: false, color: "#000000" };
  copyFontFormatting({ name: "Arial", size: 14, bold: null, italic: true, color: "#245522" }, target);
  assert.deepEqual(target, { name: "Arial", size: 14, bold: false, italic: true, color: "#245522" });
});

test("copies computed paragraph formatting while ignoring mixed alignment", () => {
  const target = { alignment: "Left" as const, firstLineIndent: 0, leftIndent: 0, rightIndent: 0, lineSpacing: 12, spaceAfter: 0, spaceBefore: 0 };
  copyParagraphFormatting({ alignment: "Mixed", firstLineIndent: 18, leftIndent: 10, rightIndent: 5, lineSpacing: 16, spaceAfter: 8, spaceBefore: 4 }, target);
  assert.deepEqual(target, { alignment: "Left", firstLineIndent: 18, leftIndent: 10, rightIndent: 5, lineSpacing: 16, spaceAfter: 8, spaceBefore: 4 });
});
