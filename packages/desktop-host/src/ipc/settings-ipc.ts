import { OpenAiProvider } from "@bank-ai/local-runtime/provider";
import type { IpcMain } from "electron";
import { ConfigService, validateConnectionSettings, type ConnectionSettings } from "../services/config-service.js";
import type { RuntimeManager } from "../services/runtime-manager.js";

export function registerSettingsIpc(options: {
  ipcMain: IpcMain;
  config: ConfigService;
  runtime: RuntimeManager;
  closeWindow: () => void;
}): void {
  options.ipcMain.handle("settings:load", () => {
    const settings = options.config.read();
    return { hasApiKey: settings.apiKey.length > 0, apiBase: settings.apiBase, model: settings.model };
  });

  options.ipcMain.handle("settings:save", async (_event, input: unknown) => {
    if (!input || typeof input !== "object") throw new Error("Некорректные настройки.");
    const values = input as Partial<ConnectionSettings>;
    const settings = validateConnectionSettings({
      apiKey: typeof values.apiKey === "string" ? values.apiKey : "",
      apiBase: typeof values.apiBase === "string" ? values.apiBase : "",
      model: typeof values.model === "string" ? values.model : ""
    }, options.config.read());

    try {
      await new OpenAiProvider({ apiKey: settings.apiKey, baseURL: settings.apiBase, model: settings.model })
        .transform("grammar", "Проверка подключения.");
    } catch {
      throw new Error("Не удалось подключиться. Проверьте API-ключ, адрес сервера и корпоративную сеть.");
    }
    options.config.write(settings);
    const state = await options.runtime.restart();
    if (state.status !== "работает" || state.provider.startsWith("mock")) {
      throw new Error("Настройки сохранены, но подключение не запустилось.");
    }
    return { provider: state.provider };
  });
  options.ipcMain.on("settings:close", options.closeWindow);
}
