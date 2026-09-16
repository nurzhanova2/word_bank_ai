import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const version = JSON.parse(fs.readFileSync(path.join(root, "package.json"), "utf8")).version;
const release = path.join(root, "packages", "desktop-host", "release");
const name = `BankAI-Setup-${version}.exe`;
const installer = path.join(release, name);
if (!fs.existsSync(installer)) throw new Error(`Installer is missing: ${name}`);
const hash = crypto.createHash("sha256").update(fs.readFileSync(installer)).digest("hex");
fs.writeFileSync(`${installer}.sha256`, `${hash}  ${name}\n`, "utf8");
console.log(`${installer}.sha256`);
