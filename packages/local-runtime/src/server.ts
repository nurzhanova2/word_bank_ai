import https from "node:https";
import "dotenv/config";
import { getHttpsServerOptions } from "office-addin-dev-certs";
import { createApp } from "./app.js";
import { createProvider } from "./provider.js";

const port = Number(process.env.BANK_AI_PORT ?? 3847);
const host = "127.0.0.1";
const provider = createProvider();
const app = createApp(provider);
const httpsOptions = await getHttpsServerOptions();

https.createServer(httpsOptions, app).listen(port, host, () => {
  console.log(`Bank AI локально запущен: https://localhost:${port}`);
  console.log(`AI provider: ${provider.name}`);
});
