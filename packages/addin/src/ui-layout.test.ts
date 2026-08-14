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

test("Hallmark Workbench layout removes the decorative hero and uses design tokens", () => {
  const html = readFileSync(new URL("../index.html", import.meta.url), "utf8");
  const styles = readFileSync(new URL("styles.css", import.meta.url), "utf8");
  assert.match(html, /data-layout="workbench"/u);
  assert.match(html, /class="workspace"/u);
  assert.doesNotMatch(html, /assistant-hero\.png|class="hero/u);
  assert.match(styles, /@import "\.\/tokens\.css"/u);
  assert.match(styles, /Hallmark · macrostructure: Workbench/u);
  assert.match(styles, /overflow-x:\s*clip/u);
  assert.match(styles, /@media \(prefers-reduced-motion: reduce\)/u);
});

test("narrow Word pane keeps actions and decisions touch accessible", () => {
  const styles = readFileSync(new URL("styles.css", import.meta.url), "utf8");
  assert.match(styles, /\.action-card[^}]*min-height:\s*48px/u);
  assert.match(styles, /\.decision-row button[^}]*min-height:\s*44px/u);
  assert.match(styles, /:focus-visible/u);
});
