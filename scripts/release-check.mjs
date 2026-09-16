import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const packages = ["packages/contracts", "packages/addin", "packages/local-runtime", "packages/desktop-host"];
const version = JSON.parse(fs.readFileSync(path.join(root, "package.json"), "utf8")).version;
const appVersion = fs.readFileSync(path.join(root, "packages/contracts/src/index.ts"), "utf8").match(/APP_VERSION = "([^"]+)"/u)?.[1];
const failures = [];
for (const directory of packages) {
  const manifest = JSON.parse(fs.readFileSync(path.join(root, directory, "package.json"), "utf8"));
  if (manifest.version !== version) failures.push(`${directory}: version ${manifest.version} != ${version}`);
  for (const [name, dependencyVersion] of Object.entries(manifest.dependencies ?? {})) {
    if (name.startsWith("@bank-ai/") && dependencyVersion !== version) failures.push(`${directory}: ${name} dependency drift`);
  }
}
if (appVersion !== version) failures.push(`APP_VERSION ${appVersion} != ${version}`);
const manifest = fs.readFileSync(path.join(root, "packages/addin/manifest.xml"), "utf8");
if (!manifest.includes("https://localhost:3847/")) failures.push("Add-in manifest must use HTTPS localhost:3847");
const example = fs.readFileSync(path.join(root, ".env.example"), "utf8");
const exampleKey = example.match(/^LLM_API_KEY[ \t]*=[ \t]*(.*)$/mu)?.[1]?.trim().replace(/^"|"$/gu, "") ?? "";
if (exampleKey && !/^(YOUR_|<)/u.test(exampleKey)) failures.push(".env.example contains a non-placeholder API key");
const dependencyPreparation = fs.readFileSync(path.join(root, "packages/desktop-host/scripts/prepare-grammar.ps1"), "utf8");
if (!/LANGUAGE_TOOL_VERSION = "6\.6"/u.test(dependencyPreparation) || !/LANGUAGE_TOOL_SHA256 = "[A-F0-9]{64}"/u.test(dependencyPreparation)) failures.push("LanguageTool pin is missing");
if (!/JRE_VERSION = "17\.0\.16\+8"/u.test(dependencyPreparation) || !/JRE_SHA256 = "[A-F0-9]{64}"/u.test(dependencyPreparation)) failures.push("JRE pin is missing");
if (/LanguageTool-stable|assets\/latest\/17/u.test(dependencyPreparation)) failures.push("mutable LanguageTool or JRE selector remains");
if (failures.length) throw new Error(`Release checks failed:\n${failures.join("\n")}`);
console.log(`Release metadata checks passed for ${version}.`);
