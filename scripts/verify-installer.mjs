import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const version = JSON.parse(fs.readFileSync(path.join(root, "package.json"), "utf8")).version;
const release = path.join(root, "packages", "desktop-host", "release");
const name = `BankAI-Setup-${version}.exe`;
const installer = path.join(release, name);
const checksum = `${installer}.sha256`;
const failures = [];
if (!fs.existsSync(installer)) failures.push(`missing installer ${name}`);
else if (fs.statSync(installer).size < 1_000_000) failures.push("installer is implausibly small");
if (!fs.existsSync(checksum)) failures.push("missing installer checksum");
if (fs.existsSync(installer) && fs.existsSync(checksum)) {
  const actual = crypto.createHash("sha256").update(fs.readFileSync(installer)).digest("hex");
  const expected = fs.readFileSync(checksum, "utf8").trim();
  if (expected !== `${actual}  ${name}`) failures.push("installer checksum mismatch");
}
if (!fs.existsSync(path.join(root, "release", "sbom.cdx.json"))) failures.push("missing SBOM");
const unpacked = path.join(release, "win-unpacked", "resources");
for (const resource of ["manifest.xml", "addin", "grammar", "grammar/languagetool/languagetool-server.jar", "grammar/jre/bin/java.exe"]) {
  if (fs.existsSync(path.join(release, "win-unpacked")) && !fs.existsSync(path.join(unpacked, resource))) failures.push(`missing packaged resource ${resource}`);
}
if (failures.length) throw new Error(`Installer verification failed:\n${failures.join("\n")}`);
console.log("Installer verification passed.");
