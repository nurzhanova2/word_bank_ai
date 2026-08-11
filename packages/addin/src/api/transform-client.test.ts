import assert from "node:assert/strict";
import test from "node:test";
import type { TransformRequest } from "@bank-ai/contracts";
import { TransformApiError, transformText } from "./transform-client.js";

const request: TransformRequest = { action: "rewrite", text: "Исходный текст" };

test("transform client returns a typed successful response", async () => {
  const fetcher: typeof fetch = async () => new Response(JSON.stringify({
    operationId: "op-1",
    result: "Результат",
    provider: "test",
    durationMs: 12
  }), { status: 200, headers: { "content-type": "application/json" } });

  assert.equal((await transformText(request, fetcher)).result, "Результат");
});

test("transform client preserves API error code and retryability", async () => {
  const fetcher: typeof fetch = async () => new Response(JSON.stringify({
    error: {
      code: "RESULT_VALIDATION_FAILED",
      message: "Не удалось проверить результат.",
      retryable: true,
      operationId: "op-2"
    }
  }), { status: 422, headers: { "content-type": "application/json" } });

  await assert.rejects(
    () => transformText(request, fetcher),
    (error: unknown) => error instanceof TransformApiError
      && error.code === "RESULT_VALIDATION_FAILED"
      && error.retryable
      && error.operationId === "op-2"
  );
});
