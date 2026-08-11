const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("bankAiSettings", {
  load: () => ipcRenderer.invoke("settings:load"),
  save: (settings) => ipcRenderer.invoke("settings:save", settings),
  close: () => ipcRenderer.send("settings:close")
});
