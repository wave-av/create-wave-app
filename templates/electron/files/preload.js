// __APP_NAME__ preload — the ONLY bridge between the desk page and Electron.
//
// Zero node exposure: the page gets exactly the `window.__BRIDGE__` object
// below. No process, require, Buffer, or raw ipcRenderer ever crosses the
// boundary; every method is async request/response over a validated ipc
// channel whose handler lives in main.js / updater.js.
const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("__BRIDGE__", {
  // Host app version (about dialogs, bug reports).
  getVersion: () => ipcRenderer.invoke("__IPC__:version"),
  // Open a URL in the user's browser. main.js only honors parseable
  // https: URLs and rejects everything else.
  openExternal: (url) => ipcRenderer.invoke("__IPC__:open-external", String(url)),
  // Update status snapshot {state, version, error, feed}. States: idle,
  // checking, up-to-date, available, deferred (rollout gate), ready, error.
  getUpdateStatus: () => ipcRenderer.invoke("__IPC__:update-status"),
  // Ask the main process to check the feed now (still rollout-gated).
  checkForUpdates: () => ipcRenderer.invoke("__IPC__:check-for-updates"),
});
