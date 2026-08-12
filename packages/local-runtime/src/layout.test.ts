import assert from "node:assert/strict";
import test from "node:test";
import { protectParagraphBreaks, restoreParagraphBreaks } from "./validators/layout.js";

test("paragraph breaks are protected and restored exactly", () => {
  const source = "Первый абзац.\rВторой абзац.\r\nТретий абзац.\nЧетвёртый абзац.";
  const protection = protectParagraphBreaks(source);

  assert.equal(/[\r\n]/u.test(protection.protectedText), false);
  assert.equal(protection.entries.length, 3);
  assert.equal(restoreParagraphBreaks(protection, protection.protectedText), source);
});

test("missing, duplicated and invented paragraph markers are rejected", () => {
  const protection = protectParagraphBreaks("Первый.\rВторой.");
  const marker = protection.entries[0]!.placeholder;

  assert.throws(() => restoreParagraphBreaks(protection, protection.protectedText.replace(marker, " ")));
  assert.throws(() => restoreParagraphBreaks(protection, `${protection.protectedText}${marker}`));
  assert.throws(() => restoreParagraphBreaks(protection, `${protection.protectedText}[[BANKAI:PAR:Z]]`));
});

test("horizontal whitespace added around a paragraph marker is discarded", () => {
  const protection = protectParagraphBreaks("Первый.\rВторой.");
  const marker = protection.entries[0]!.placeholder;
  const modelResult = protection.protectedText.replace(marker, `  ${marker}\t `);

  assert.equal(restoreParagraphBreaks(protection, modelResult), "Первый.\rВторой.");
});
