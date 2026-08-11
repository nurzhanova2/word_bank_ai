import assert from "node:assert/strict";
import test from "node:test";
import { replaceParagraphTextInOoxml } from "./formatted-ooxml.js";

const sample = `<w:document xmlns:w="word"><w:body>
<w:p><w:pPr><w:pStyle w:val="Heading1"/></w:pPr><w:r><w:rPr><w:b/></w:rPr><w:t>Старый</w:t></w:r></w:p>
<w:p><w:pPr><w:numPr><w:ilvl w:val="0"/></w:numPr></w:pPr><w:r><w:t>Пункт</w:t></w:r></w:p>
</w:body></w:document>`;

test("OOXML replacement changes text but keeps paragraph, heading and list formatting", () => {
  const result = replaceParagraphTextInOoxml(sample, "Новый & точный\nОбновлённый пункт");

  assert.ok(result);
  assert.match(result, /<w:pStyle w:val="Heading1"\/>/u);
  assert.match(result, /<w:b\/>/u);
  assert.match(result, /<w:numPr>/u);
  assert.match(result, /Новый &amp; точный/u);
  assert.match(result, /Обновлённый пункт/u);
  assert.doesNotMatch(result, />Старый</u);
  assert.doesNotMatch(result, />Пункт</u);
});

test("OOXML replacement safely falls back when paragraph structure changed", () => {
  assert.equal(replaceParagraphTextInOoxml(sample, "Один абзац"), undefined);
  assert.equal(replaceParagraphTextInOoxml(sample, "Один\nДва\nТри"), undefined);
});
