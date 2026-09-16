import assert from "node:assert/strict";
import test from "node:test";
import { ReadinessService } from "./readiness.js";

const provider = (name: string, status: "ok" | "unavailable" | "timeout" | "unknown" = "ok") => ({ name, async transform() { return ""; }, async probeReadiness() { return status; } });

test("readiness reports healthy components and caches concurrent probes", async () => {
  let calls = 0;
  const service = new ReadinessService(provider("litellm"), "http://lt", async () => { calls += 1; return new Response(null, { status: 405 }); });
  const [one, two] = await Promise.all([service.check(), service.check()]);
  assert.equal(one.status, "ok"); assert.equal(two.languageTool.status, "ok"); assert.equal(calls, 1);
  await service.check(); assert.equal(calls, 1);
});
test("readiness degrades without configured provider or LanguageTool", async () => {
  const service = new ReadinessService(provider("mock"), "http://lt", async () => new Response(null, { status: 503 }));
  const result = await service.check();
  assert.equal(result.status, "degraded"); assert.equal(result.provider.status, "not_configured"); assert.equal(result.languageTool.status, "unavailable");
});

test("provider readiness distinguishes unavailable and timeout, with expiry and force refresh", async () => {
  let calls = 0;
  const service = new ReadinessService(provider("litellm", "unavailable"), "http://lt", async () => { calls += 1; return new Response(null, { status: 204 }); }, 1);
  assert.equal((await service.check()).provider.status, "unavailable");
  await service.check(); assert.equal(calls, 1);
  await new Promise((resolve) => setTimeout(resolve, 2)); await service.check(); assert.equal(calls, 2);
  await service.check(true); assert.equal(calls, 3);
  const timeout = new ReadinessService(provider("litellm", "timeout"), "http://lt", async () => new Response(null, { status: 204 }));
  assert.equal((await timeout.check()).provider.status, "timeout");
});
