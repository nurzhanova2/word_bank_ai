import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";

const root = process.cwd();

test("Windows dependency preparation pins versioned LanguageTool and JRE archives with SHA-256", () => {
  const script = fs.readFileSync(path.join(root, "packages/desktop-host/scripts/prepare-grammar.ps1"), "utf8");
  assert.match(script, /LANGUAGE_TOOL_VERSION = "6\.6"/u);
  assert.match(script, /LanguageTool-6\.6\.zip/u);
  assert.match(script, /53600506B399BB5FFE1E4C8DEC794FD378212F14AAF38CCEF9B6F89314D11631/u);
  assert.match(script, /JRE_VERSION = "17\.0\.16\+8"/u);
  assert.match(script, /D35B05F4832215D8877D0DBF15C6370C854D7D5B812F890A9C0DB8AD412A6BF2/u);
  assert.doesNotMatch(script, /LanguageTool-stable|assets\/latest\/17/u);
  assert.doesNotMatch(script, /Get-FileHash/u);
  assert.match(script, /Security\.Cryptography\.SHA256\]::Create/u);
});

test("release package scripts include deterministic SBOM and installer verification", () => {
  const manifest = JSON.parse(fs.readFileSync(path.join(root, "package.json"), "utf8"));
  assert.equal(manifest.scripts["verify:sbom"], "node scripts/verify-sbom.mjs");
  assert.equal(manifest.scripts["verify:installer"], "node scripts/verify-installer.mjs");
  assert.match(manifest.scripts["dist:win"], /write-installer-checksum/u);
  assert.match(manifest.scripts["release:check"], /verify:sbom/u);
});

test("SBOM tool is Windows-safe and deterministic eval writes within the repository", () => {
  const sbom = fs.readFileSync(path.join(root, "scripts/sbom.mjs"), "utf8");
  const evaluation = fs.readFileSync(path.join(root, "packages/local-runtime/src/evals/deterministic.ts"), "utf8");
  assert.match(sbom, /ComSpec/u);
  assert.match(evaluation, /"\.\.\/\.\.\/\.\.\/\.\."/u);
});

test("desktop certificate repair keeps the Office certificate script outside ASAR", () => {
  const manifest = JSON.parse(fs.readFileSync(path.join(root, "packages/desktop-host/package.json"), "utf8"));
  assert.equal(manifest.build.asar, false);
});
