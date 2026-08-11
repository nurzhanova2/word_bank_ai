import assert from "node:assert/strict";
import test from "node:test";
import {
  protectRequisites,
  restoreProtectedResult
} from "./validators/requisites.js";

test("requisites are removed before LLM processing and restored byte-for-byte", () => {
  const source = "Договор № 417 от 10.08.2026 на 125 000 тенге: bank@example.kz, https://bank.kz/doc/417";
  const protection = protectRequisites(source);

  for (const secret of ["417", "10.08.2026", "125", "000", "bank@example.kz", "https://bank.kz/doc/417"]) {
    assert.equal(protection.protectedText.includes(secret), false, `Unmasked requisite: ${secret}`);
  }
  assert.equal(restoreProtectedResult(protection, protection.protectedText, { requireAll: true }), source);
});

test("strict actions reject missing, duplicated and invented requisites", () => {
  const protection = protectRequisites("Договор № 417 от 10.08.2026");
  const [firstPlaceholder] = protection.entries;
  assert.ok(firstPlaceholder);

  assert.throws(() => restoreProtectedResult(protection, "Документ подготовлен.", { requireAll: true }));
  assert.throws(() => restoreProtectedResult(
    protection,
    `${protection.protectedText} ${firstPlaceholder.placeholder}`,
    { requireAll: true }
  ));
  assert.throws(() => restoreProtectedResult(
    protection,
    `${protection.protectedText} и документ № 999`,
    { requireAll: true }
  ));
});

test("summary may omit secondary requisites but cannot invent new ones", () => {
  const protection = protectRequisites("Договор № 417 содержит 8 страниц и действует до 15.08.2026.");
  const keyFactOnly = protection.protectedText.replace(/ содержит .* и действует/u, " действует");

  assert.match(restoreProtectedResult(protection, keyFactOnly, { requireAll: false }), /417/u);
  assert.throws(() => restoreProtectedResult(protection, `${keyFactOnly} Код 999.`, { requireAll: false }));
});
