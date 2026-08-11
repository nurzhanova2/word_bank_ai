import fs from "node:fs";
import path from "node:path";
import { config as loadEnvironment, parse as parseEnvironment } from "dotenv";

export interface ConnectionSettings {
  apiKey: string;
  apiBase: string;
  model: string;
}

export const defaultSettings: ConnectionSettings = {
  apiKey: "",
  apiBase: "https://prod-litellm.nationalbank.kz",
  model: "Qwen/Qwen3.5-35B-A3B-FP8"
};

export function validateConnectionSettings(input: ConnectionSettings, current: ConnectionSettings): ConnectionSettings {
  const apiKey = input.apiKey.trim() || current.apiKey;
  const apiBase = input.apiBase.trim().replace(/\/$/, "");
  const model = input.model.trim();
  if (!apiKey) throw new Error("Введите API-ключ.");
  if (!model) throw new Error("Укажите модель.");
  let parsedUrl: URL;
  try { parsedUrl = new URL(apiBase); } catch { throw new Error("Укажите корректный адрес LiteLLM."); }
  if (parsedUrl.protocol !== "https:") throw new Error("Адрес LiteLLM должен начинаться с https://.");
  return { apiKey, apiBase, model };
}

export class ConfigService {
  constructor(readonly filePath: string) {}

  ensure(): void {
    if (fs.existsSync(this.filePath)) return;
    fs.mkdirSync(path.dirname(this.filePath), { recursive: true });
    this.write(defaultSettings);
  }

  loadEnvironment(): void {
    this.ensure();
    loadEnvironment({ path: this.filePath, override: true, quiet: true });
  }

  read(): ConnectionSettings {
    this.ensure();
    const values = parseEnvironment(fs.readFileSync(this.filePath, "utf8"));
    return {
      apiKey: values.LLM_API_KEY?.trim() ?? "",
      apiBase: values.LLM_API_BASE?.trim() || defaultSettings.apiBase,
      model: values.LLM_MODEL?.trim() || defaultSettings.model
    };
  }

  write(settings: ConnectionSettings): void {
    const quote = (value: string) => JSON.stringify(value);
    fs.writeFileSync(this.filePath, [
      "BANK_AI_PORT=3847",
      "BANK_AI_PROVIDER=litellm",
      `LLM_API_KEY=${quote(settings.apiKey)}`,
      `LLM_API_BASE=${quote(settings.apiBase)}`,
      `LLM_MODEL=${quote(settings.model)}`,
      ""
    ].join("\n"), { encoding: "utf8", mode: 0o600 });
  }
}
