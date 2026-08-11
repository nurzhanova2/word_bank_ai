import path from "node:path";
import { fileURLToPath } from "node:url";
import { config as loadEnvironment } from "dotenv";
import { createProvider } from "../provider.js";
import { defaultQualityCases } from "./cases.js";
import { evaluateCases } from "./quality-evaluator.js";

const currentDirectory = path.dirname(fileURLToPath(import.meta.url));
loadEnvironment({ path: path.resolve(currentDirectory, "../../../../.env"), quiet: true });

const report = await evaluateCases(createProvider(), defaultQualityCases);
console.log(JSON.stringify(report, null, 2));
if (report.score < 1) process.exitCode = 1;
