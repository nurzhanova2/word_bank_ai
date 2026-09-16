import assert from "node:assert/strict";
import test from "node:test";
import { chunkDocument } from "./chunker.js";
import { planParagraphChunks } from "./chunker.js";

test("chunker preserves paragraphs, blanks, CRLF, Unicode and every source character", () => {
  const text = "Қазақша 😀\r\n\r\nSecond paragraph. Third sentence.\nРеквизит 12345";
  const chunks = chunkDocument(text, 24);
  assert.equal(chunks.map((chunk) => chunk.text).join(""), text);
  assert.ok(chunks.every((chunk) => chunk.text.length <= 24));
  assert.ok(chunks.every((chunk) => !(/[\uD800-\uDBFF]$/u.test(chunk.text))));
});

test("mapped planner reassembles long duplicate paragraphs without dropping UTF-16 text", () => {
  const paragraphs = [{ index: 0, text: "same" }, { index: 1, text: `${"Қ".repeat(30)}😀${"x".repeat(30)}` }, { index: 2, text: "same" }];
  const plan = planParagraphChunks(paragraphs, 20);
  for (const paragraph of paragraphs) assert.equal(plan.filter((chunk) => chunk.slices[0]!.paragraphIndex === paragraph.index).map((chunk) => chunk.text).join(""), paragraph.text);
});

test("chunker safely splits a long sentence without duplication or trimming", () => {
  const text = ` ${"а".repeat(25)}😀${"б".repeat(25)} `;
  const chunks = chunkDocument(text, 20);
  assert.equal(chunks.map((chunk) => chunk.text).join(""), text);
  assert.equal(chunks[0]!.text.startsWith(" "), true);
  assert.equal(chunks.at(-1)!.text.endsWith(" "), true);
});
