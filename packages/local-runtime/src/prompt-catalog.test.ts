import assert from "node:assert/strict";
import { readdir } from "node:fs/promises";
import test from "node:test";
import { transformActions } from "@bank-ai/contracts";
import { actionPrompts } from "./actions/prompts.js";

const requiredSections = [
  "role",
  "priority",
  "input_contract",
  "task",
  "allowed_changes",
  "must_preserve",
  "output_contract",
  "examples",
  "final_check"
] as const;

test("every action prompt has a structured contract in the same section order", () => {
  for (const action of transformActions) {
    const prompt = actionPrompts[action];
    let previousIndex = -1;
    for (const section of requiredSections) {
      const open = `<${section}>`;
      const close = `</${section}>`;
      const index = prompt.indexOf(open);
      assert.ok(index > previousIndex, `${action}: missing or unordered ${open}`);
      assert.ok(prompt.includes(close), `${action}: missing ${close}`);
      previousIndex = index;
    }
    assert.match(prompt, /\n/u, `${action}: prompt was flattened into one line`);
    assert.doesNotMatch(prompt, /[⟦⟧]/u, `${action}: obsolete marker syntax`);
  }
});

test("every action prompt lives in its own module and contains two examples", async () => {
  const files = new Set(await readdir(new URL("./actions/prompts/", import.meta.url)));
  for (const action of transformActions) {
    assert.equal(files.has(`${action}.ts`), true, `missing prompts/${action}.ts`);
    const examples = actionPrompts[action].match(/<example(?:\s[^>]*)?>/gu) ?? [];
    assert.equal(examples.length, 2, `${action}: expected one change and one preservation example`);
  }
});

test("grammar prompt enforces minimal edits and demonstrates a no-op", () => {
  const prompt = actionPrompts.grammar;
  assert.match(prompt, /минимально необходим/u);
  assert.match(prompt, /несколько правильных вариантов/u);
  assert.match(prompt, /<input>Банк вправе запросить документы\.<\/input>[\s\S]*<output>Банк вправе запросить документы\.<\/output>/u);
});

test("translation prompt protects legal meaning and Kazakh terminology", () => {
  const prompt = actionPrompts.translate;
  for (const requirement of ["официальный казахский", "юридическую модальность", "не транслитерируй", "утверждённого эквивалента"]) {
    assert.ok(prompt.toLocaleLowerCase("ru").includes(requirement), requirement);
  }
  assert.match(prompt, /\[\[BANKAI:A\]\]/u);
});

test("summary prompt has deterministic size bands and keeps actor-action links", () => {
  const prompt = actionPrompts.summary;
  assert.match(prompt, /до 100 слов/u);
  assert.match(prompt, /100–500 слов/u);
  assert.match(prompt, /более 500 слов/u);
  assert.match(prompt, /исполнител/u);
  assert.match(prompt, /не объединяй/iu);
});
