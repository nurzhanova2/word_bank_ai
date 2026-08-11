import assert from "node:assert/strict";
import test from "node:test";
import { validateConnectionSettings } from "./config-service.js";

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
