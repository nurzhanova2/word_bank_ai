import assert from "node:assert/strict";
import test from "node:test";
import { KazakhHunspellEngine, type HunspellDictionary } from "./kazakh-hunspell-engine.js";

function dictionary(correctWords: string[], suggestions: Record<string, string[]> = {}): HunspellDictionary {
  const words = new Set(correctWords.map((word) => word.toLocaleLowerCase("kk-KZ")));
  return {
    correct: (word) => words.has(word.toLocaleLowerCase("kk-KZ")),
    suggest: (word) => suggestions[word.toLocaleLowerCase("kk-KZ")] ?? []
  };
}

test("reports a Kazakh misspelling with exact offsets and Hunspell suggestions", async () => {
  const engine = new KazakhHunspellEngine(dictionary(
    ["бұл", "дайын"],
    { кужат: ["құжат", "құжаты"] }
  ));

  const issues = await engine.check("Бұл кужат дайын.", "kk");

  assert.deepEqual(issues, [{
    offset: 4,
    length: 5,
    original: "кужат",
    message: "Қазақ сөздігінде мұндай сөз табылмады.",
    category: "spelling",
    replacements: ["құжат", "құжаты"],
    confidence: 0.86,
    source: "hunspell-kk",
    ruleId: "KK_HUNSPELL_UNKNOWN_WORD"
  }]);
});

test("ignores approved bank terms, abbreviations, links and requisites", async () => {
  const engine = new KazakhHunspellEngine(dictionary([]), ["БанкКлиент"]);
  const issues = await engine.check(
    "БанкКлиент АҚ https://bank.kz support@bank.kz IBAN KZ86125KZT1004100100",
    "kk"
  );
  assert.deepEqual(issues, []);
});

test("rejects non-Kazakh calls so the common engine can select a fallback", async () => {
  const engine = new KazakhHunspellEngine(dictionary([]));
  assert.equal(engine.supports("kk"), true);
  assert.equal(engine.supports("ru"), false);
  await assert.rejects(() => engine.check("текст", "ru"), /қолдамайды/u);
});

test("accepts the correct banking plural Реквизиттер and rejects split-word suggestions", async () => {
  const engine = new KazakhHunspellEngine(dictionary(["өзгерген", "жоқ"], { белгісіз: ["белгі сіз", "белгісіздік"] }));
  assert.deepEqual(await engine.check("Реквизиттер өзгерген жоқ.", "kk"), []);
  const [issue] = await engine.check("белгісіз", "kk");
  assert.deepEqual(issue?.replacements, ["белгісіздік"]);
});
