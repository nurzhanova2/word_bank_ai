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

test("banking and personal requisites are masked with their semantic kind", () => {
  const source = [
    "ТОО «Банк Решений», БИН 123456789012,",
    "ИИК KZ86125KZT5004100100, БИК NBRKKZKX,",
    "счёт 40702810900000001234, телефон +7 (777) 123-45-67,",
    "ФИО: Нуржанова Шынар Бакытовна."
  ].join(" ");
  const protection = protectRequisites(source);

  for (const secret of [
    "ТОО «Банк Решений»",
    "123456789012",
    "KZ86125KZT5004100100",
    "NBRKKZKX",
    "40702810900000001234",
    "+7 (777) 123-45-67",
    "Нуржанова Шынар Бакытовна"
  ]) assert.equal(protection.protectedText.includes(secret), false, `Unmasked requisite: ${secret}`);

  assert.deepEqual(
    new Set(protection.entries.map((entry) => entry.kind)),
    new Set(["organization", "business-id", "iban", "bic", "account", "phone", "person-name"])
  );
  assert.equal(restoreProtectedResult(protection, protection.protectedText, { requireAll: true }), source);
});

test("ordinary uppercase words and unlabeled names are not over-masked", () => {
  const source = "Сегодня Комитет рассмотрел проект, а Иван Петров подготовил письмо.";
  const protection = protectRequisites(source);

  assert.equal(protection.protectedText, source);
  assert.equal(protection.entries.length, 0);
});
