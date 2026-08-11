import assert from "node:assert/strict";
import test from "node:test";
import type { CompletionProvider, CompletionRequest } from "./providers/types.js";
import { TransformService } from "./services/transform-service.js";

function protectedSource(request: CompletionRequest): string {
  const match = request.user.match(/<source>\n([\s\S]*)\n<\/source>/u);
  assert.ok(match?.[1]);
  return match[1];
}

test("transform service sends masked requisites to the completion provider", async () => {
  let capturedRequest: CompletionRequest | undefined;
  const completionProvider: CompletionProvider = {
    name: "capture",
    async complete(request) {
      capturedRequest = request;
      return protectedSource(request);
    }
  };
  const source = "Договор № 417 от 10.08.2026: bank@example.kz";
  const result = await new TransformService(completionProvider).transform("grammar", source);

  assert.equal(result, source);
  assert.ok(capturedRequest);
  assert.equal(capturedRequest.user.includes("417"), false);
  assert.equal(capturedRequest.user.includes("10.08.2026"), false);
  assert.equal(capturedRequest.user.includes("bank@example.kz"), false);
});

test("transform service retries when a strict action loses a protected marker", async () => {
  let attempts = 0;
  const completionProvider: CompletionProvider = {
    name: "retry",
    async complete(request) {
      attempts += 1;
      const source = protectedSource(request);
      return attempts === 1 ? source.replace(/⟦BANKAI_[A-Z]+⟧/u, "") : source;
    }
  };
  const source = "Письмо № 88 направлено 11.08.2026.";
  assert.equal(await new TransformService(completionProvider).transform("rewrite", source), source);
  assert.equal(attempts, 2);
});
