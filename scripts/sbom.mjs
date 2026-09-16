import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

const output = path.join(process.cwd(), "release", "sbom.cdx.json");
fs.mkdirSync(path.dirname(output), { recursive: true });
const command = process.platform === "win32" ? process.env.ComSpec ?? "cmd.exe" : "npm";
const args = process.platform === "win32" ? ["/d", "/s", "/c", "npm sbom --sbom-format=cyclonedx"] : ["sbom", "--sbom-format=cyclonedx"];
const sbom = execFileSync(command, args, { encoding: "utf8" });
fs.writeFileSync(output, sbom, "utf8");
console.log(output);
