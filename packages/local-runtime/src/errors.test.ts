import assert from "node:assert/strict";
import test from "node:test";
import {
  ProviderAuthenticationError,
  ProviderTimeoutError,
  ResultValidationError,
  toApiFailure
} from "./errors.js";

test("runtime errors map to stable safe API failures", () => {
  assert.deepEqual(toApiFailure(new ProviderAuthenticationError(), "op-auth"), {
    status: 401,
    body: { error: { code: "INVALID_API_KEY", message: "API-ключ отклонён AI-сервисом.", retryable: false, operationId: "op-auth" } }
  });
  assert.equal(toApiFailure(new ProviderTimeoutError(), "op-timeout").status, 504);
  assert.equal(toApiFailure(new ResultValidationError(), "op-validation").status, 422);
});

test("unknown provider failures remain safe and retryable", () => {
  const failure = toApiFailure(new Error("secret upstream details"), "op-unknown");
  assert.equal(failure.status, 502);
  assert.equal(failure.body.error.code, "PROVIDER_ERROR");
  assert.equal(failure.body.error.retryable, true);
  assert.equal(failure.body.error.message.includes("secret"), false);
});
