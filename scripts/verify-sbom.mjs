import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const file = path.join(root, "release", "sbom.cdx.json");
if (!fs.existsSync(file)) throw new Error("SBOM is missing: release/sbom.cdx.json");
const source = fs.readFileSync(file, "utf8");
const sbom = JSON.parse(source);
const failures = [];
if (sbom.bomFormat !== "CycloneDX" || typeof sbom.specVersion !== "string") failures.push("CycloneDX format/specVersion is missing");
if (!sbom.metadata?.component?.name || !sbom.metadata?.component?.version) failures.push("application metadata is missing");
if (!Array.isArray(sbom.components) || sbom.components.length === 0) failures.push("npm dependency components are missing");
if (/[A-Z]:\\Users\\|\/home\//iu.test(source)) failures.push("SBOM contains a local absolute user path");
if (/LLM_API_KEY|X-Bank-AI-Session|BEGIN (?:RSA |EC )?PRIVATE KEY/iu.test(source)) failures.push("SBOM contains a secret-like value");
if (failures.length) throw new Error(`SBOM verification failed:\n${failures.join("\n")}`);
console.log("SBOM verification passed.");
