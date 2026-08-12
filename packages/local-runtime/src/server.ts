import https from "node:https";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { config as loadEnvironment } from "dotenv";
import { createApp } from "./app.js";
import { getLocalHttpsOptions } from "./https-options.js";
import { createProvider } from "./provider.js";

const currentDirectory = path.dirname(fileURLToPath(import.meta.url));
loadEnvironment({ path: path.resolve(currentDirectory, "../../../.env"), quiet: true });
process.env.KAZAKH_HUNSPELL_PATH ??= path.resolve(currentDirectory, "../../desktop-host/vendor/grammar/hunspell-kk");

const port = Number(process.env.BANK_AI_PORT ?? 3847);
const host = "127.0.0.1";
const provider = createProvider();
const app = createApp(provider);
const httpsOptions = await getLocalHttpsOptions();

https.createServer(httpsOptions, app).listen(port, host, () => {
  console.log(`Bank AI локально запущен: https://localhost:${port}`);
  console.log(`AI provider: ${provider.name}`);
});
