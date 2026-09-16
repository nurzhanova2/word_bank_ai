import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { ConfigService, validateConnectionSettings } from "./config-service.js";
import { createSafeStorageSecretStore } from "./secret-store.js";

function testSecrets() {
  const values = new Map<string, Buffer>();
  return createSafeStorageSecretStore({ isEncryptionAvailable: () => true, encryptString: (value) => Buffer.from(`encrypted:${value}`), decryptString: (value) => value.toString().replace("encrypted:", "") }, values);
}

test("settings validation preserves an existing key when the form is blank", () => {
  assert.deepEqual(validateConnectionSettings(
    { apiKey: "", apiBase: "https://prod-litellm.nationalbank.kz/", model: " Qwen/model " },
    { apiKey: "saved-key", apiBase: "https://old", model: "old" }
  ), {
    apiKey: "saved-key",
    apiBase: "https://prod-litellm.nationalbank.kz",
    model: "Qwen/model"
  });
});

test("settings validation rejects insecure endpoints", () => {
  assert.throws(() => validateConnectionSettings(
    { apiKey: "key", apiBase: "http://example.test", model: "model" },
    { apiKey: "", apiBase: "", model: "" }
  ), /https:\/\//u);
});

test("saving connection settings preserves experimental grammar configuration without writing the key", async () => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), "bank-ai-config-"));
  const file = path.join(directory, ".env");
  try {
    fs.writeFileSync(file, "PROMPT_VARIANT=kazakh\nGRAMMAR_CONFIDENCE_AUTO_APPLY=0.95\n", "utf8");
    const service = new ConfigService(file, testSecrets());
    await service.write({ apiKey: "secret", apiBase: "https://example.test", model: "model" });
    const content = fs.readFileSync(file, "utf8");
    assert.match(content, /PROMPT_VARIANT="kazakh"/u);
    assert.match(content, /GRAMMAR_CONFIDENCE_AUTO_APPLY="0.95"/u);
    assert.doesNotMatch(content, /secret|LLM_API_KEY/u);
  } finally {
    fs.rmSync(directory, { recursive: true, force: true });
  }
});

test("secret storage supports save, overwrite and delete", async () => {
  const store = testSecrets();
  assert.equal(await store.getApiKey(), null);
  await store.setApiKey("first");
  await store.setApiKey("second");
  assert.equal(await store.getApiKey(), "second");
  await store.deleteApiKey();
  assert.equal(await store.getApiKey(), null);
});

test("legacy plaintext key migrates once and is removed from config", async () => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), "bank-ai-config-"));
  const file = path.join(directory, ".env");
  try {
    fs.writeFileSync(file, "LLM_API_KEY=legacy\nLLM_API_BASE=https://example.test\nLLM_MODEL=model\n", "utf8");
    const store = testSecrets();
    const service = new ConfigService(file, store);
    assert.equal(await service.migrateLegacyApiKey(), true);
    assert.equal(await service.migrateLegacyApiKey(), false);
    assert.equal(await store.getApiKey(), "legacy");
    assert.doesNotMatch(fs.readFileSync(file, "utf8"), /LLM_API_KEY|legacy/u);
  } finally { fs.rmSync(directory, { recursive: true, force: true }); }
});
