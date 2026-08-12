import path from "node:path";
import { execFile } from "node:child_process";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";
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
import { registerSettingsIpc } from "./ipc/settings-ipc.js";
import { ConfigService } from "./services/config-service.js";
import { RuntimeManager, type RuntimeState } from "./services/runtime-manager.js";
import { LanguageToolManager } from "./services/language-tool-manager.js";
import { WordAddInInstaller } from "./services/word-addin-installer.js";
import { settingsPage } from "./settings-page.js";

const PORT = 3847;
const ADD_IN_ID = "f5212ec9-4a1a-4ca7-a195-6fbcd8f7822e";
const execFileAsync = promisify(execFile);

let tray: Tray | undefined;
let settingsWindow: BrowserWindow | undefined;
let runtime: RuntimeManager | undefined;
let wordInstaller: WordAddInInstaller | undefined;
let languageTool: LanguageToolManager | undefined;

function resourcePath(packagedName: string, developmentPath: string): string {
  return app.isPackaged ? path.join(process.resourcesPath, packagedName) : path.resolve(app.getAppPath(), developmentPath);
}
function addinPath(): string { return resourcePath("addin", "../addin/dist"); }
function manifestPath(): string { return resourcePath("manifest.xml", "../addin/manifest.xml"); }
function iconPath(): string { return resourcePath("icon.png", "assets/icon.png"); }
function settingsPreloadPath(): string {
  return app.isPackaged
    ? path.join(process.resourcesPath, "settings-preload.cjs")
    : path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../assets/settings-preload.cjs");
}
function configPath(): string {
  return app.isPackaged ? path.join(app.getPath("userData"), ".env") : path.resolve(app.getAppPath(), "../../.env");
}

async function openSettings(): Promise<void> {
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
    webPreferences: { preload: settingsPreloadPath(), contextIsolation: true, nodeIntegration: false }
  });
  settingsWindow.webContents.setWindowOpenHandler(() => ({ action: "deny" }));
  settingsWindow.webContents.on("will-navigate", (event) => event.preventDefault());
  settingsWindow.on("closed", () => (settingsWindow = undefined));
  await settingsWindow.loadURL(`data:text/html;charset=UTF-8,${encodeURIComponent(settingsPage)}`);
}

function updateTrayMenu(state: RuntimeState = runtime?.state ?? { status: "остановлен", provider: "не определён" }): void {
  if (!tray) return;
  tray.setToolTip(`Bank AI for Word — ${state.status}`);
  tray.setContextMenu(Menu.buildFromTemplate([
    { label: `Статус: ${state.status}`, enabled: false },
    { label: `AI: ${state.provider}`, enabled: false },
    { type: "separator" },
    { label: "Установить дополнение в Word", click: () => void installWordAddIn() },
    { label: "Удалить дополнение из Word", click: () => void removeWordAddIn() },
    { label: "Открыть настройки", click: () => void openSettings() },
    {
      label: "Открыть диагностику",
      enabled: state.status === "работает",
      click: () => void shell.openExternal(`https://localhost:${PORT}/health`)
    },
    { label: "Скопировать путь к manifest.xml", click: () => clipboard.writeText(manifestPath()) },
    { type: "separator" },
    { label: "Перезапустить Bank AI", click: () => { app.relaunch(); app.exit(0); } },
    { label: "Выход", click: () => app.quit() }
  ]));
}

async function installWordAddIn(): Promise<void> {
  if (process.platform !== "win32" || !wordInstaller) return;
  try {
    const { wordOpened } = await wordInstaller.install(manifestPath(), ADD_IN_ID);
    await dialog.showMessageBox({
      type: "info",
      title: "Bank AI установлен",
      message: wordOpened ? "Дополнение зарегистрировано. Word открыт автоматически." : "Дополнение зарегистрировано. Откройте Word вручную.",
      detail: "В Word откройте Главная → Дополнения → Bank AI."
    });
  } catch (error) {
    await dialog.showMessageBox({
      type: "error",
      title: "Не удалось установить дополнение",
      message: error instanceof Error ? error.message : "Неизвестная ошибка.",
      detail: "Закройте Word или обратитесь к IT-администратору."
    });
  }
}

async function removeWordAddIn(): Promise<void> {
  if (process.platform !== "win32" || !wordInstaller) return;
  try {
    await wordInstaller.remove(ADD_IN_ID);
    await dialog.showMessageBox({ type: "info", title: "Bank AI удалён из Word", message: "Регистрация дополнения удалена." });
  } catch (error) {
    await dialog.showMessageBox({ type: "warning", title: "Не удалось удалить регистрацию", message: error instanceof Error ? error.message : "Неизвестная ошибка." });
  }
}

async function showStartupProblems(state: RuntimeState): Promise<void> {
  if (state.configurationError) {
    await dialog.showMessageBox({
      type: "warning",
      title: "Нужно настроить LLM API",
      message: state.configurationError.message,
      detail: "Пока включён демонстрационный mock-режим."
    });
    await openSettings();
  }
  if (state.runtimeError) {
    await dialog.showMessageBox({
      type: "error",
      title: "Bank AI не запустился",
      message: state.runtimeError.message,
      detail: "Разрешите установку локального HTTPS-сертификата и перезапустите приложение."
    });
  }
}

async function bootstrap(): Promise<void> {
  tray = new Tray(nativeImage.createFromPath(iconPath()).resize({ width: 20, height: 20 }));
  tray.on("double-click", () => void shell.openExternal(`https://localhost:${PORT}/health`));
  const config = new ConfigService(configPath());
  const grammarPath = resourcePath("grammar", "vendor/grammar");
  process.env.KAZAKH_HUNSPELL_PATH = path.join(grammarPath, "hunspell-kk");
  languageTool = new LanguageToolManager(grammarPath);
  await languageTool.start();
  runtime = new RuntimeManager(config, addinPath(), PORT, "127.0.0.1", updateTrayMenu);
  wordInstaller = new WordAddInInstaller(
    async (file, args) => {
      const result = await execFileAsync(file, args);
      return { stdout: String(result.stdout) };
    },
    (target) => shell.openPath(target)
  );
  registerSettingsIpc({ ipcMain, config, runtime, closeWindow: () => settingsWindow?.close() });
  updateTrayMenu();
  app.setLoginItemSettings({ openAtLogin: true, openAsHidden: true });
  await showStartupProblems(await runtime.start());
}

const hasLock = app.requestSingleInstanceLock();
if (!hasLock) app.quit();
else {
  app.on("second-instance", () => {
    dialog.showMessageBox({ type: "info", title: "Bank AI for Word", message: `Версия ${app.getVersion()} уже запущена. Статус: ${runtime?.state.status ?? "запускается"}.` }).catch(() => undefined);
  });
  app.whenReady().then(bootstrap).catch((error) => {
    dialog.showErrorBox("Bank AI", error instanceof Error ? error.message : String(error));
    app.quit();
  });
}

app.on("window-all-closed", () => undefined);
app.on("before-quit", () => { languageTool?.stop(); void runtime?.stop(); });
