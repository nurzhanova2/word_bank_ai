import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { ConfigService, validateConnectionSettings } from "./config-service.js";

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

test("saving connection settings preserves experimental grammar configuration", () => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), "bank-ai-config-"));
  const file = path.join(directory, ".env");
  try {
    fs.writeFileSync(file, "PROMPT_VARIANT=kazakh\nGRAMMAR_CONFIDENCE_AUTO_APPLY=0.95\n", "utf8");
    const service = new ConfigService(file);
    service.write({ apiKey: "secret", apiBase: "https://example.test", model: "model" });
    const content = fs.readFileSync(file, "utf8");
    assert.match(content, /PROMPT_VARIANT="kazakh"/u);
    assert.match(content, /GRAMMAR_CONFIDENCE_AUTO_APPLY="0.95"/u);
  } finally {
    fs.rmSync(directory, { recursive: true, force: true });
  }
});
