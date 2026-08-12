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
      return attempts === 1 ? source.replace(/\[\[BANKAI:[A-Z]+\]\]/u, "") : source;
    }
  };
  const source = "Письмо № 88 направлено 11.08.2026.";
  assert.equal(await new TransformService(completionProvider).transform("rewrite", source), source);
  assert.equal(attempts, 2);
});

test("transform service retries when the model removes a paragraph boundary", async () => {
  let attempts = 0;
  const completionProvider: CompletionProvider = {
    name: "layout-retry",
    async complete(request) {
      attempts += 1;
      const source = protectedSource(request);
      return attempts === 1 ? source.replace(/\[\[BANKAI:PAR:[A-Z]+\]\]/u, " ") : source;
    }
  };
  const source = "Первый абзац.\rВторой абзац.";

  assert.equal(await new TransformService(completionProvider).transform("rewrite", source), source);
  assert.equal(attempts, 2);
});

test("translation uses tokenizer-stable ASCII markers for requisites and paragraphs", async () => {
  let protectedInput = "";
  const completionProvider: CompletionProvider = {
    name: "ascii-markers",
    async complete(request) {
      protectedInput = protectedSource(request);
      return protectedInput;
    }
  };
  const source = "Договор № 417.\rСрок: 20.08.2026.";

  assert.equal(
    await new TransformService(completionProvider).transform("translate", source, { targetLanguage: "kk" }),
    source
  );
  assert.match(protectedInput, /\[\[BANKAI:[A-Z]+\]\]/u);
  assert.match(protectedInput, /\[\[BANKAI:PAR:[A-Z]+\]\]/u);
  assert.doesNotMatch(protectedInput, /[⟦⟧]/u);
});

test("translation gets a third recovery attempt after two invalid model responses", async () => {
  let attempts = 0;
  const completionProvider: CompletionProvider = {
    name: "translation-recovery",
    async complete(request) {
      attempts += 1;
      const source = protectedSource(request);
      return attempts < 3 ? source.replace(/\[\[BANKAI:[A-Z]+\]\]/u, "") : source;
    }
  };
  const source = "Договор № 417 действует.";

  assert.equal(
    await new TransformService(completionProvider).transform("translate", source, { targetLanguage: "kk" }),
    source
  );
  assert.equal(attempts, 3);
});
