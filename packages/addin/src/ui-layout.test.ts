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
  const handler = source.match(/async function applyOneGrammarIssue[\s\S]*?\r?\n\}\r?\n/u)?.[0] ?? "";
  assert.doesNotMatch(handler, /resetPreview/u);
  assert.match(handler, /appliedGrammarIssueIndexes/u);
});

test("dark task-pane layout keeps the compact selection/document workbench", () => {
  const html = readFileSync(new URL("../index.html", import.meta.url), "utf8");
  const styles = readFileSync(new URL("styles.css", import.meta.url), "utf8");
  assert.match(html, /data-layout="document-tools"/u);
  assert.match(html, /class="scope-tabs"/u);
  assert.match(html, /data-document-scope="selection"/u);
  assert.match(html, /data-document-scope="document"/u);
  assert.match(html, /class="style-sample"/u);
  assert.match(html, /Загрузите DOCX или PDF образец/u);
  assert.match(html, /class="workspace"/u);
  assert.doesNotMatch(html, /assistant-hero\.png|class="hero/u);
  assert.match(styles, /@import "\.\/tokens\.css"/u);
  assert.match(styles, /Hallmark · macrostructure: Component Playground/u);
  assert.match(styles, /\.scope-tabs/u);
  assert.match(styles, /\.style-sample/u);
  assert.match(styles, /overflow-x:\s*clip/u);
  assert.match(styles, /@media \(prefers-reduced-motion: reduce\)/u);
});

test("narrow Word pane keeps actions and decisions touch accessible", () => {
  const styles = readFileSync(new URL("styles.css", import.meta.url), "utf8");
  assert.match(styles, /\.action-card[^}]*min-height:\s*48px/u);
  assert.match(styles, /\.decision-row button[^}]*min-height:\s*44px/u);
  assert.match(styles, /:focus-visible/u);
});

test("document scope UI defaults to selection and keeps unsupported section honest", () => {
  const html = readFileSync(new URL("../index.html", import.meta.url), "utf8");
  assert.match(html, /id="document-scope"/u);
  assert.match(html, /value="selection"/u);
  assert.match(html, /Текущий раздел — недоступно/u);
  assert.match(html, /id="scope-warning"/u);
});
