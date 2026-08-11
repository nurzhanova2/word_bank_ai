import fs from "node:fs";
import https from "node:https";
import path from "node:path";
import { execFile, spawn } from "node:child_process";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";
import { createApp } from "@bank-ai/local-runtime/app";
import { getLocalHttpsOptions } from "@bank-ai/local-runtime/https-options";
import { createProvider, MockAiProvider, OpenAiProvider } from "@bank-ai/local-runtime/provider";
import { config as loadEnvironment, parse as parseEnvironment } from "dotenv";
import {
  app,
  BrowserWindow,
  clipboard,
  dialog,
  ipcMain,
  Menu,
  nativeImage,
  shell,
  Tray
} from "electron";
import { settingsPage } from "./settings-page.js";

const PORT = 3847;
const HOST = "127.0.0.1";
const ADD_IN_ID = "f5212ec9-4a1a-4ca7-a195-6fbcd8f7822e";
const OFFICE_DEVELOPER_KEY = "HKCU\\SOFTWARE\\Microsoft\\Office\\16.0\\Wef\\Developer";
const execFileAsync = promisify(execFile);

let tray: Tray | undefined;
let server: https.Server | undefined;
let settingsWindow: BrowserWindow | undefined;
let runtimeStatus = "Запускается…";
let providerStatus = "не определён";

function addinPath(): string {
  return app.isPackaged
    ? path.join(process.resourcesPath, "addin")
    : path.resolve(app.getAppPath(), "../addin/dist");
}

function manifestPath(): string {
  return app.isPackaged
    ? path.join(process.resourcesPath, "manifest.xml")
    : path.resolve(app.getAppPath(), "../addin/manifest.xml");
}

function iconPath(): string {
  return app.isPackaged
    ? path.join(process.resourcesPath, "icon.png")
    : path.resolve(app.getAppPath(), "assets/icon.png");
}

function settingsPreloadPath(): string {
  return app.isPackaged
    ? path.join(process.resourcesPath, "settings-preload.cjs")
    : path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../assets/settings-preload.cjs");
}

function configPath(): string {
  return app.isPackaged
    ? path.join(app.getPath("userData"), ".env")
    : path.resolve(app.getAppPath(), "../../.env");
}

function ensureConfigFile(): void {
  const target = configPath();
  if (fs.existsSync(target)) return;

  fs.mkdirSync(path.dirname(target), { recursive: true });
  fs.writeFileSync(
    target,
    [
      "BANK_AI_PROVIDER=litellm",
      "LLM_API_KEY=",
      "LLM_API_BASE=https://prod-litellm.nationalbank.kz",
      "LLM_MODEL=Qwen/Qwen3.5-35B-A3B-FP8",
      ""
    ].join("\n"),
    { encoding: "utf8", mode: 0o600 }
  );
}

function loadConfig(): void {
  ensureConfigFile();
  loadEnvironment({ path: configPath(), override: true, quiet: true });
}

function readSettings(): { apiKey: string; apiBase: string; model: string } {
  ensureConfigFile();
  const values = parseEnvironment(fs.readFileSync(configPath(), "utf8"));
  return {
    apiKey: values.LLM_API_KEY?.trim() ?? "",
    apiBase: values.LLM_API_BASE?.trim() || "https://prod-litellm.nationalbank.kz",
    model: values.LLM_MODEL?.trim() || "Qwen/Qwen3.5-35B-A3B-FP8"
  };
}

function quoteEnvironmentValue(value: string): string {
  return JSON.stringify(value);
}

function writeSettings(settings: { apiKey: string; apiBase: string; model: string }): void {
  fs.writeFileSync(
    configPath(),
    [
      "BANK_AI_PORT=3847",
      "BANK_AI_PROVIDER=litellm",
      `LLM_API_KEY=${quoteEnvironmentValue(settings.apiKey)}`,
      `LLM_API_BASE=${quoteEnvironmentValue(settings.apiBase)}`,
      `LLM_MODEL=${quoteEnvironmentValue(settings.model)}`,
      ""
    ].join("\n"),
    { encoding: "utf8", mode: 0o600 }
  );
}

async function openConfig(): Promise<void> {
  if (settingsWindow && !settingsWindow.isDestroyed()) {
    settingsWindow.show();
    settingsWindow.focus();
    return;
  }

  settingsWindow = new BrowserWindow({
    width: 520,
    height: 650,
    minWidth: 460,
    minHeight: 590,
    title: "Настройки Bank AI",
    icon: iconPath(),
    autoHideMenuBar: true,
    backgroundColor: "#f7faf8",
    webPreferences: {
      preload: settingsPreloadPath(),
      contextIsolation: true,
      nodeIntegration: false
    }
  });
  settingsWindow.webContents.setWindowOpenHandler(() => ({ action: "deny" }));
  settingsWindow.webContents.on("will-navigate", (event) => event.preventDefault());
  settingsWindow.on("closed", () => (settingsWindow = undefined));
  await settingsWindow.loadURL(`data:text/html;charset=UTF-8,${encodeURIComponent(settingsPage)}`);
}

function updateTrayMenu(): void {
  if (!tray) return;

  tray.setToolTip(`Bank AI for Word — ${runtimeStatus}`);
  tray.setContextMenu(
    Menu.buildFromTemplate([
      { label: `Статус: ${runtimeStatus}`, enabled: false },
      { label: `AI: ${providerStatus}`, enabled: false },
      { type: "separator" },
      {
        label: "Установить дополнение в Word",
        click: () => void installWordAddIn()
      },
      {
        label: "Удалить дополнение из Word",
        click: () => void removeWordAddIn()
      },
      {
        label: "Открыть настройки",
        click: () => void openConfig()
      },
      {
        label: "Открыть диагностику",
        enabled: runtimeStatus === "работает",
        click: () => void shell.openExternal(`https://localhost:${PORT}/health`)
      },
      {
        label: "Скопировать путь к manifest.xml",
        click: () => clipboard.writeText(manifestPath())
      },
      { type: "separator" },
      {
        label: "Перезапустить Bank AI",
        click: () => {
          app.relaunch();
          app.exit(0);
        }
      },
      { label: "Выход", click: () => app.quit() }
    ])
  );
}

async function installWordAddIn(): Promise<void> {
  if (process.platform !== "win32") {
    await dialog.showMessageBox({
      type: "info",
      title: "Bank AI for Word",
      message: "Автоматическая установка предназначена для Windows.",
      detail: `Manifest: ${manifestPath()}`
    });
    return;
  }

  try {
    await execFileAsync("reg.exe", [
      "add",
      OFFICE_DEVELOPER_KEY,
      "/v",
      ADD_IN_ID,
      "/t",
      "REG_SZ",
      "/d",
      manifestPath(),
      "/f"
    ]);

    try {
      spawn("winword.exe", [], { detached: true, stdio: "ignore" }).unref();
    } catch {
      // Регистрация уже выполнена; пользователь сможет открыть Word вручную.
    }

    await dialog.showMessageBox({
      type: "info",
      title: "Bank AI установлен",
      message: "Дополнение зарегистрировано. Word должен открыться автоматически.",
      detail: "Если панель не появилась, откройте Главная → Дополнения → Bank AI."
    });
  } catch (error) {
    await dialog.showMessageBox({
      type: "error",
      title: "Не удалось установить дополнение",
      message: error instanceof Error ? error.message : "Неизвестная ошибка.",
      detail: "Попробуйте закрыть Word, запустить Bank AI от имени администратора или передать manifest IT-администратору."
    });
  }
}

async function removeWordAddIn(): Promise<void> {
  if (process.platform !== "win32") return;

  try {
    await execFileAsync("reg.exe", [
      "delete",
      OFFICE_DEVELOPER_KEY,
      "/v",
      ADD_IN_ID,
      "/f"
    ]);
    await dialog.showMessageBox({
      type: "info",
      title: "Bank AI удалён из Word",
      message: "Регистрация дополнения удалена.",
      detail: "Полностью закройте и повторно откройте Word."
    });
  } catch (error) {
    await dialog.showMessageBox({
      type: "warning",
      title: "Не удалось удалить регистрацию",
      message: error instanceof Error ? error.message : "Неизвестная ошибка."
    });
  }
}

async function startRuntime(): Promise<void> {
  runtimeStatus = "запускается…";
  updateTrayMenu();

  loadConfig();

  let provider;
  try {
    provider = createProvider();
    providerStatus = provider.name;
  } catch (error) {
    provider = new MockAiProvider();
    providerStatus = "mock — заполните LLM_API_KEY";
    await dialog.showMessageBox({
      type: "warning",
      title: "Нужно настроить LLM API",
      message: error instanceof Error ? error.message : "Проверьте настройки AI.",
      detail: `Откройте настройки из меню Bank AI. Пока включён демонстрационный mock-режим.\n\n${configPath()}`
    });
    await openConfig();
  }

  try {
    const options = await getLocalHttpsOptions();
    server = https.createServer(options, createApp(provider, addinPath()));
    await new Promise<void>((resolve, reject) => {
      server!.once("error", reject);
      server!.listen(PORT, HOST, resolve);
    });
    runtimeStatus = "работает";
  } catch (error) {
    runtimeStatus = "ошибка запуска";
    await dialog.showMessageBox({
      type: "error",
      title: "Bank AI не запустился",
      message: error instanceof Error ? error.message : "Неизвестная ошибка.",
      detail: "Разрешите установку локального HTTPS-сертификата и перезапустите приложение."
    });
  }

  updateTrayMenu();
}

async function restartRuntime(): Promise<void> {
  if (server?.listening) {
    await new Promise<void>((resolve) => server!.close(() => resolve()));
  }
  server = undefined;
  await startRuntime();
}

function registerSettingsHandlers(): void {
  ipcMain.handle("settings:load", () => {
    const settings = readSettings();
    return {
      hasApiKey: settings.apiKey.length > 0,
      apiBase: settings.apiBase,
      model: settings.model
    };
  });

  ipcMain.handle("settings:save", async (_event, input: unknown) => {
    if (!input || typeof input !== "object") throw new Error("Некорректные настройки.");
    const values = input as Record<string, unknown>;
    const current = readSettings();
    const apiKey = typeof values.apiKey === "string" && values.apiKey.trim()
      ? values.apiKey.trim()
      : current.apiKey;
    const apiBase = typeof values.apiBase === "string" ? values.apiBase.trim().replace(/\/$/, "") : "";
    const model = typeof values.model === "string" ? values.model.trim() : "";

    if (!apiKey) throw new Error("Введите API-ключ.");
    if (!model) throw new Error("Укажите модель.");
    let parsedUrl: URL;
    try {
      parsedUrl = new URL(apiBase);
    } catch {
      throw new Error("Укажите корректный адрес LiteLLM.");
    }
    if (parsedUrl.protocol !== "https:") throw new Error("Адрес LiteLLM должен начинаться с https://.");

    const candidateProvider = new OpenAiProvider({ apiKey, baseURL: apiBase, model });
    try {
      await candidateProvider.transform("grammar", "Проверка подключения.");
    } catch {
      throw new Error("Не удалось подключиться. Проверьте API-ключ, адрес сервера и доступ к корпоративной сети.");
    }

    writeSettings({ apiKey, apiBase, model });
    await restartRuntime();
    if (runtimeStatus !== "работает" || providerStatus.startsWith("mock")) {
      throw new Error("Настройки сохранены, но подключение не запустилось. Проверьте введённые значения.");
    }
    return { provider: providerStatus };
  });

  ipcMain.on("settings:close", () => settingsWindow?.close());
}

async function bootstrap(): Promise<void> {
  const icon = nativeImage.createFromPath(iconPath());
  tray = new Tray(icon.resize({ width: 20, height: 20 }));
  tray.on("double-click", () => void shell.openExternal(`https://localhost:${PORT}/health`));
  updateTrayMenu();

  app.setLoginItemSettings({
    openAtLogin: true,
    openAsHidden: true
  });

  await startRuntime();
}

const hasLock = app.requestSingleInstanceLock();
if (!hasLock) {
  app.quit();
} else {
  registerSettingsHandlers();
  app.on("second-instance", () => {
    dialog.showMessageBox({
      type: "info",
      title: "Bank AI for Word",
      message: `Приложение уже запущено. Статус: ${runtimeStatus}.`
    }).catch(() => undefined);
  });

  app.whenReady().then(bootstrap).catch((error) => {
    dialog.showErrorBox("Bank AI", error instanceof Error ? error.message : String(error));
    app.quit();
  });
}

app.on("window-all-closed", () => undefined);
app.on("before-quit", () => server?.close());
