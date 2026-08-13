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
  assert.match(source, /Варианты словаря/u);
  const handler = source.match(/async function applyOneGrammarIssue[\s\S]*?\n\}\n/u)?.[0] ?? "";
  assert.doesNotMatch(handler, /resetPreview/u);
  assert.match(handler, /appliedGrammarIssueIndexes/u);
});

test("narrow Word pane uses compact dimensions", () => {
  const styles = readFileSync(new URL("styles.css", import.meta.url), "utf8");
  assert.match(styles, /\.app-bar[^}]*height:44px/u);
  assert.match(styles, /\.hero[^}]*min-height:112px/u);
  assert.match(styles, /\.action-card[^}]*min-height:64px/u);
  assert.match(styles, /\.comparison-card[^}]*max-height:280px/u);
});
