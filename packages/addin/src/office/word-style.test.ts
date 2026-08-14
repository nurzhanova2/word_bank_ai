import assert from "node:assert/strict";
import test from "node:test";
import { copyResolvedParagraphStyle } from "./word-adapter.js";

test("copies inherited Word style, common font and paragraph settings without flattening mixed bold", () => {
  const target = {
    style: "Normal",
    font: { name: "Calibri", size: 11, bold: false, italic: false, color: "#000000" },
    alignment: "Left" as const,
    firstLineIndent: 0, leftIndent: 0, rightIndent: 0, lineSpacing: 12, spaceAfter: 0, spaceBefore: 0
  };
  copyResolvedParagraphStyle({
    style: "Body Text",
    font: { name: "Times New Roman", size: 12, bold: null, italic: null, color: "#000000" },
    alignment: "Justified",
    firstLineIndent: 18, leftIndent: 0, rightIndent: 0, lineSpacing: 18, spaceAfter: 6, spaceBefore: 0
  }, target);
  assert.equal(target.style, "Body Text");
  assert.equal(target.font.name, "Times New Roman");
  assert.equal(target.font.size, 12);
  assert.equal(target.font.bold, false);
  assert.equal(target.alignment, "Justified");
  assert.equal(target.firstLineIndent, 18);
});
