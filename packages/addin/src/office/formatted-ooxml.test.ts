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

test("OOXML replacement recognizes Word carriage returns as paragraph boundaries", () => {
  const result = replaceParagraphTextInOoxml(sample, "Первый абзац\rВторой абзац");

  assert.ok(result);
  assert.match(result, /Первый абзац/u);
  assert.match(result, /Второй абзац/u);
  assert.equal((result.match(/<w:p(?:\s[^>]*)?>/gu) ?? []).length, 2);
});

test("mixed run formatting stays scoped to the corresponding words", () => {
  const mixed = `<w:document xmlns:w="word"><w:body><w:p>
    <w:r><w:rPr><w:b/></w:rPr><w:t xml:space="preserve">Первое </w:t></w:r>
    <w:r><w:t>слово было обычным</w:t></w:r>
  </w:p></w:body></w:document>`;

  const result = replaceParagraphTextInOoxml(mixed, "Новое предложение осталось обычным");

  assert.ok(result);
  assert.match(result, /<w:r><w:rPr><w:b\/><\/w:rPr><w:t[^>]*>Новое <\/w:t><\/w:r>/u);
  assert.match(result, /<w:r><w:t[^>]*>предложение осталось обычным<\/w:t><\/w:r>/u);
  const runs = result.match(/<w:r(?:\s[^>]*)?>[\s\S]*?<\/w:r>/gu) ?? [];
  assert.equal(runs.length, 2);
  assert.match(runs[0]!, /<w:b\/>/u);
  assert.doesNotMatch(runs[0]!, /предложение/u);
  assert.doesNotMatch(runs[1]!, /<w:b\/>/u);
});

test("empty paragraphs are retained instead of being consumed", () => {
  const withEmptyParagraph = `<w:document xmlns:w="word"><w:body>
    <w:p><w:r><w:t>Один</w:t></w:r></w:p>
    <w:p><w:r><w:t></w:t></w:r></w:p>
    <w:p><w:r><w:t>Три</w:t></w:r></w:p>
  </w:body></w:document>`;

  const result = replaceParagraphTextInOoxml(withEmptyParagraph, "Первый\r\rТретий");

  assert.ok(result);
  assert.equal((result.match(/<w:p(?:\s[^>]*)?>/gu) ?? []).length, 3);
  assert.match(result, /Первый/u);
  assert.match(result, /Третий/u);
});
