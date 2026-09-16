import assert from "node:assert/strict";
import test from "node:test";
import { DocumentOrchestrator } from "./orchestrator.js";

test("orchestrator processes chunks sequentially and recombines in source order", async () => {
  const calls: string[] = [];
  const service = new DocumentOrchestrator({ name: "test", async transform(_action, text) { calls.push(text); return text.toUpperCase(); } });
  const operation = await service.start("rewrite", "one\ntwo\nthree", {}, undefined, () => undefined);
  assert.deepEqual(calls, ["one\ntwo\nthree"]);
  assert.equal(service.result(operation), "ONE\nTWO\nTHREE");
});

test("failure is controlled and retry runs only the failed chunk", async () => {
  let failed = true; const calls: string[] = [];
  const service = new DocumentOrchestrator({ name: "test", async transform(_action, text) { calls.push(text); if (text.includes("bad") && failed) { failed = false; throw new Error("down"); } return text; } });
  const operation = await service.start("rewrite", `ok\n${"bad".repeat(5000)}\nend`);
  assert.notEqual(operation.failed, undefined); assert.equal(service.result(operation), undefined);
  await service.retry(operation);
  assert.equal(operation.failed, undefined); assert.equal(service.result(operation), operation.snapshot.text);
  assert.ok(calls.filter((item) => item.includes("bad")).length >= 2);
});

test("cancellation produces no applicable result and map-reduce summaries aggregate", async () => {
  const controller = new AbortController(); controller.abort();
  const service = new DocumentOrchestrator({ name: "test", async transform(_action, text) { return text.slice(0, 5); } });
  const cancelled = await service.start("rewrite", "text", {}, controller.signal);
  assert.equal(cancelled.cancelled, true); assert.equal(service.result(cancelled), undefined);
  const summary = await service.summarize(`${"first.\n".repeat(2000)}${"second.".repeat(2000)}`);
  assert.ok(summary.summary.length > 0);
});
