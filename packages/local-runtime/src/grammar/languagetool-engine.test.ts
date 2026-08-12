import assert from "node:assert/strict";
import test from "node:test";
import { LanguageToolEngine } from "./languagetool-engine.js";

test("maps LanguageTool matches to the common GrammarIssue contract", async () => {
  const fetcher: typeof fetch = async (_url, init) => {
    assert.match(String(init?.body), /language=ru-RU/u);
    return new Response(JSON.stringify({
      matches: [{
        message: "Согласуйте сказуемое с подлежащим.",
        shortMessage: "Согласование",
        offset: 7,
        length: 13,
        replacements: [{ value: "была получена" }],
        rule: { id: "RU_AGREEMENT", issueType: "grammar", category: { id: "GRAMMAR" } }
      }]
    }), { status: 200, headers: { "Content-Type": "application/json" } });
  };
  const engine = new LanguageToolEngine("http://127.0.0.1:8081/v2/check", fetcher);
  const issues = await engine.check("Оплата были получены.", "ru");

  assert.deepEqual(issues, [{
    offset: 7,
    length: 13,
    original: "были получены",
    message: "Согласуйте сказуемое с подлежащим.",
    category: "grammar",
    replacements: ["была получена"],
    confidence: 0.9,
    source: "languagetool",
    ruleId: "RU_AGREEMENT"
  }]);
});

test("LanguageTool supports Russian and English but deliberately rejects Kazakh", async () => {
  const engine = new LanguageToolEngine("http://127.0.0.1:8081/v2/check", async () => new Response("{}"));
  assert.equal(engine.supports("ru"), true);
  assert.equal(engine.supports("en"), true);
  assert.equal(engine.supports("kk"), false);
  await assert.rejects(() => engine.check("Қате", "kk"), /не поддерживает/u);
});

test("prefers deletion for an accidental repeated word over LanguageTool's comma suggestion", async () => {
  const fetcher: typeof fetch = async () => new Response(JSON.stringify({ matches: [{
    message: "Глаголы — однородные члены предложения.", offset: 7, length: 17,
    replacements: [{ value: "отправил, отправил" }],
    rule: { id: "RU_VERB_REPEAT", issueType: "style", category: { id: "STYLE" } }
  }] }), { status: 200, headers: { "Content-Type": "application/json" } });
  const [issue] = await new LanguageToolEngine("http://local", fetcher).check("Клиент отправил отправил договор.", "ru");
  assert.deepEqual(issue?.replacements, ["отправил"]);
});
