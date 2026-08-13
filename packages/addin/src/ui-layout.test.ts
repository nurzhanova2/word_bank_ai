import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

test("comparison UI has one Changes view without redundant Before and After tabs", () => {
  const html = readFileSync(new URL("../index.html", import.meta.url), "utf8");
  assert.match(html, /id="changes"/u);
  assert.doesNotMatch(html, /data-tab=/u);
  assert.doesNotMatch(html, /id="original"|id="result"/u);
});

test("grammar UI exposes individual correction controls and Fix all", () => {
  const source = readFileSync(new URL("main.ts", import.meta.url), "utf8");
  assert.match(source, /Исправить всё/u);
  assert.match(source, /Исправить эту ошибку/u);
});
