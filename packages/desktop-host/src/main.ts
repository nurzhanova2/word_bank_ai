import fs from "node:fs";
import https from "node:https";
import path from "node:path";
import { execFile, spawn } from "node:child_process";
import { promisify } from "node:util";
import { createApp } from "@bank-ai/local-runtime/app";
import { getLocalHttpsOptions } from "@bank-ai/local-runtime/https-options";
import { createProvider, MockAiProvider } from "@bank-ai/local-runtime/provider";
import { config as loadEnvironment } from "dotenv";
import {
  app,
  clipboard,
  dialog,
  Menu,
  nativeImage,
  shell,
  Tray
} from "electron";

const PORT = 3847;
const HOST = "127.0.0.1";
const ADD_IN_ID = "f5212ec9-4a1a-4ca7-a195-6fbcd8f7822e";
const OFFICE_DEVELOPER_KEY = "HKCU\\SOFTWARE\\Microsoft\\Office\\16.0\\Wef\\Developer";
const execFileAsync = promisify(execFile);

let tray: Tray | undefined;
let server: https.Server | undefined;
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

async function openConfig(): Promise<void> {
  if (process.platform === "win32") {
    spawn("notepad.exe", [configPath()], { detached: true, stdio: "ignore" }).unref();
    return;
  }

  await shell.openPath(configPath());
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
