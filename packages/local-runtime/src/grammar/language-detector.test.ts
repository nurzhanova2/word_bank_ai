import assert from "node:assert/strict";
import test from "node:test";
import { detectTextLanguage, segmentByLanguage } from "./language-detector.js";

test("detects Russian, Kazakh and English without confusing shared Cyrillic", () => {
  assert.equal(detectTextLanguage("Банк рассмотрел обращение клиента."), "ru");
  assert.equal(detectTextLanguage("Банк клиенттің өтінішін қарастырды."), "kk");
  assert.equal(detectTextLanguage("The bank reviewed the customer request."), "en");
});

test("segments a mixed document and preserves exact offsets", () => {
  const text = "Банк рассмотрел заявление.\nThe request were approved.\nӨтініш қабылданды.";
  const segments = segmentByLanguage(text);
  assert.deepEqual(segments.map(({ language, text }) => ({ language, text })), [
    { language: "ru", text: "Банк рассмотрел заявление.\n" },
    { language: "en", text: "The request were approved.\n" },
    { language: "kk", text: "Өтініш қабылданды." }
  ]);
  assert.equal(segments.map((segment) => text.slice(segment.offset, segment.offset + segment.text.length)).join(""), text);
});

test("segments different languages inside the same paragraph", () => {
  const text = "Банк ответил. The client agreed. Өтініш қабылданды.";
  const segments = segmentByLanguage(text);
  assert.deepEqual(segments.map((segment) => segment.language), ["ru", "en", "kk"]);
  assert.equal(segments.map((segment) => segment.text).join(""), text);
});
