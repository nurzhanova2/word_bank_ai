import assert from "node:assert/strict";
import test from "node:test";
import { KazakhRulesEngine } from "./kazakh-rules-engine.js";

test("finds an accidentally repeated adjacent Kazakh word", async () => {
  const issues = await new KazakhRulesEngine().check("Өтініш өтініш қабылданды.", "kk");
  assert.equal(issues[0]?.original, "Өтініш өтініш");
  assert.deepEqual(issues[0]?.replacements, ["Өтініш"]);
  assert.equal(issues[0]?.ruleId, "KK_REPEATED_WORD");
});

test("removes a space before Kazakh punctuation without touching decimal numbers", async () => {
  const issues = await new KazakhRulesEngine().check("Сома 10,5 теңге , төленді.", "kk");
  assert.deepEqual(issues.map(({ original, replacements, ruleId }) => ({ original, replacements, ruleId })), [{
    original: " ,",
    replacements: [","],
    ruleId: "KK_SPACE_BEFORE_PUNCTUATION"
  }]);
});

test("detects mixed Latin and Cyrillic letters inside a Kazakh word", async () => {
  const issues = await new KazakhRulesEngine().check("Құжaт қабылданды.", "kk");
  assert.equal(issues[0]?.original, "Құжaт");
  assert.equal(issues[0]?.category, "spelling");
  assert.equal(issues[0]?.ruleId, "KK_MIXED_ALPHABET");
});

test("offers a deterministic correction for frequent Russian-keyboard Kazakh typos", async () => {
  const issues = await new KazakhRulesEngine().check("Кужат пен отиниш дайын.", "kk");
  assert.deepEqual(issues.map(({ original, replacements, ruleId }) => ({ original, replacements, ruleId })), [
    { original: "Кужат", replacements: ["Құжат"], ruleId: "KK_KEYBOARD_TYPO" },
    { original: "отиниш", replacements: ["өтініш"], ruleId: "KK_KEYBOARD_TYPO" }
  ]);
});

test("finds frequent objective errors in a multi-paragraph Kazakh sample", async () => {
  const text = [
    "Күнде таңертен тұрамын. Университетте біз пәндер оқыймыз, бірақ маған ең қатты бағдарламалау ұнайды.",
    "Кеше мен достарыммен кітапханаға бардық және бірнеше тапсырмаларды орындадық.",
    "Мен музыка тындағанды жақсы көрем. Болашақта компанияда жұмыс жасағым келеді."
  ].join("\n\n");
  const issues = await new KazakhRulesEngine().check(text, "kk");
  assert.deepEqual(issues.map(({ original, replacements }) => ({ original, replacement: replacements[0] })), [
    { original: "таңертен", replacement: "таңертең" },
    { original: "пәндер", replacement: "пәндерді" },
    { original: "оқыймыз", replacement: "оқимыз" },
    { original: "маған ең қатты бағдарламалау ұнайды", replacement: "маған бағдарламалау ең қатты ұнайды" },
    { original: "бардық", replacement: "бардым" },
    { original: "тапсырмаларды", replacement: "тапсырманы" },
    { original: "тындағанды", replacement: "тыңдағанды" },
    { original: "көрем", replacement: "көремін" },
    { original: "жұмыс жасағым келеді", replacement: "жұмыс істегім келеді" }
  ]);
});

test("does not report rules for a valid sentence or another language", async () => {
  const engine = new KazakhRulesEngine();
  assert.deepEqual(await engine.check("Өтініш қабылданды.", "kk"), []);
  await assert.rejects(() => engine.check("Заявление принято.", "ru"), /қолдамайды/u);
});
