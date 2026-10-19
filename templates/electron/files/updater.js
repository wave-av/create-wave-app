// updater.js — auto-update wiring for __APP_NAME__.
//
// Feed: generic provider at __FEED_URL__ (package.json `publish` config is
// baked into app-update.yml at dist time). electron-updater checks; nothing
// downloads until rollout-guard.js admits this machine to the cohort.
// Downloads never auto-install: state flips to `ready` and the page (via
// the preload bridge) tells the user to restart.
const { ipcMain } = require("electron");
const { autoUpdater } = require("electron-updater");
const { rolloutAllows, defaultMachineId } = require("./rollout-guard");

const FEED_URL = "__FEED_URL__";

let status = { state: "idle", version: null, error: null };
const snapshot = () => ({ ...status, feed: FEED_URL });

function initIpc(app) {
  ipcMain.handle("__IPC__:update-status", () => snapshot());
  ipcMain.handle("__IPC__:check-for-updates", async () => {
    await check(app);
    return snapshot();
  });
}

async function check(app) {
  status = { state: "checking", version: app.getVersion(), error: null };
  try {
    autoUpdater.autoDownload = false;
    autoUpdater.autoInstallOnAppQuit = false;
    const res = await autoUpdater.checkForUpdates();
    const available = res && res.updateInfo ? String(res.updateInfo.version) : "";
    if (!available) {
      status = { state: "up-to-date", version: app.getVersion(), error: null };
      return snapshot();
    }
    const gate = await rolloutAllows({ feedUrl: FEED_URL, version: available, machineId: defaultMachineId() });
    if (!gate.allowed) {
      status = { state: "deferred", version: available, error: gate.reason };
      return snapshot();
    }
    status = { state: "available", version: available, error: null };
    return snapshot();
  } catch (err) {
    status = { state: "error", version: app.getVersion(), error: String((err && err.message) || err) };
    return snapshot();
  }
}

function startBackgroundChecks(app) {
  autoUpdater.autoDownload = false;
  autoUpdater.autoInstallOnAppQuit = false;
  autoUpdater.on("update-downloaded", (info) => {
    status = { state: "ready", version: String((info && info.version) || status.version), error: null };
  });
  autoUpdater.on("error", (err) => {
    if (status.state === "checking") {
      status = { state: "error", version: app.getVersion(), error: String((err && err.message) || err) };
    }
  });
  setTimeout(() => check(app).catch(() => {}), 30_000);
}

module.exports = { FEED_URL, initIpc, check, startBackgroundChecks, snapshot };
