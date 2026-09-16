import assert from "node:assert/strict";
import test from "node:test";
import type { AiProvider } from "../providers/types.js";
import { DocumentOperationStore } from "./operation-store.js";

test("long paragraph slices use marker targets and reassemble one marker-free paragraph", async () => {
  const source = `${"Русский Қазақша Исходный фрагмент. 😀 ".repeat(12)}${"x".repeat(48)}`;
  const provider: AiProvider = {
    name: "marker-test",
    async transform(_action, text) { return text.replaceAll("Исходный", "Изменённый"); }
  };
  const store = new DocumentOperationStore(40);
  const operation = store.create("owner", "rewrite", [{ id: "p0", index: 0, text: source }], {});
  assert.ok(operation.totalChunks >= 5);
  for (let index = 0; index < operation.totalChunks; index += 1) await store.execute("owner", operation.operationId, index, provider);
  const result = await store.finalize("owner", operation.operationId, provider);

  assert.equal(result.kind, "paragraphs");
  assert.equal(result.paragraphs.length, 1);
  assert.equal(result.paragraphs[0]!.result, source.replaceAll("Исходный", "Изменённый"));
  assert.doesNotMatch(result.paragraphs[0]!.result, /\[\[BANKAI:/u);
});

test("invalid slice markers fail the chunk so the existing retry endpoint can retry it", async () => {
  const provider: AiProvider = {
    name: "invalid-marker",
    async transform(_action, text) { return text.replace(/\[\[BANKAI:SLICESTART[A-Z]+\]\]/u, ""); }
  };
  const store = new DocumentOperationStore(40);
  const operation = store.create("owner", "rewrite", [{ id: "p0", index: 0, text: "Текст. ".repeat(8) }], {});
  await assert.rejects(store.execute("owner", operation.operationId, 0, provider));
  await assert.rejects(store.finalize("owner", operation.operationId, provider));
});
