// __APP_NAME__ — native Electron shell for the __APP_NAME__ desk service.
// The desk service (live on :__PORT__) stays the single server; this app is
// the window. If the service is down the app boots it from the deployed
// server entry and waits for health before painting.
//
// Frameless: no Apple traffic lights — window drag comes from the header's
// -webkit-app-region and window ops from the menu + shortcuts (Cmd+W/M/Q).
// The Edit menu exists so Cmd+X/V work in palette/reply inputs.
const { app, BrowserWindow, Menu, ipcMain, shell } = require("electron");
const { spawn } = require("node:child_process");
const path = require("node:path");
const updater = require("./updater");

const PORT = Number(process.env.__PORT_ENV__) || __PORT__;
const URL = `http://127.0.0.1:${PORT}/`;
const SERVER_ENTRY = "__SERVER_ENTRY__";
// --smoke-test: dist-proof mode. Loads URL, prints one SMOKE_OK JSON line
// (url + document title) on first paint, then quits. Nonzero exit on
// timeout or load failure. See scripts/smoke.sh and scripts/cold-boot.sh.
const SMOKE = process.argv.includes("--smoke-test");
let serverProc = null;

async function alive() {
  try {
    const r = await fetch(URL + "api/state");
    return r.ok;
  } catch {
    return false;
  }
}

async function ensureServer() {
  if (await alive()) return;
  if (!SERVER_ENTRY) {
    throw new Error(`desk server is not running on ${URL} — start it or set __PORT_ENV__`);
  }
  const entry = path.join(app.getPath("home"), SERVER_ENTRY);
  // process.execPath is the Electron binary: without ELECTRON_RUN_AS_NODE it
  // would relaunch the app instead of running the server entry as plain node.
  serverProc = spawn(process.execPath, [entry], {
    stdio: "ignore",
    detached: true,
    env: { ...process.env, ELECTRON_RUN_AS_NODE: "1" },
  });
  serverProc.unref();
  for (let i = 0; i < 75; i++) {
    await new Promise((r) => setTimeout(r, 200));
    if (await alive()) return;
  }
  throw new Error("desk server did not answer on " + URL);
}

function buildMenu() {
  Menu.setApplicationMenu(Menu.buildFromTemplate([
    { role: "appMenu" },
    { role: "editMenu" },
    {
      label: "Window",
      submenu: [{ role: "minimize" }, { role: "zoom" }, { role: "close" }, { type: "separator" }, { role: "front" }],
    },
  ]));
}

function registerPreloadChannels() {
  ipcMain.handle("__IPC__:version", () => app.getVersion());
  ipcMain.handle("__IPC__:open-external", (_event, url) => {
    let parsed;
    try {
      parsed = new URL(String(url));
    } catch {
      throw new Error("__IPC__:open-external refused: not a URL");
    }
    if (parsed.protocol !== "https:") throw new Error("__IPC__:open-external refused: https only");
    return shell.openExternal(parsed.toString());
  });
  updater.initIpc(app);
}

function createWindow() {
  const win = new BrowserWindow({
    width: 1440,
    height: 900,
    minWidth: 1100,
    minHeight: 700,
    title: "__APP_NAME__",
    frame: false,
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: true,
    },
  });
  console.log(JSON.stringify({ event: "desk-boot", url: URL, port: PORT, smoke: SMOKE }));
  if (SMOKE) {
    const fail = (reason) => {
      console.error(JSON.stringify({ event: "SMOKE_FAIL", url: URL, reason }));
      app.exit(1);
    };
    const timer = setTimeout(() => fail("timeout waiting for first paint"), 45000);
    win.webContents.on("did-fail-load", (_e, code, desc) => fail(`did-fail-load ${code} ${desc}`));
    win.webContents.on("did-finish-load", async () => {
      try {
        const title = await win.webContents.executeJavaScript("document.title", true);
        const api = await win.webContents.executeJavaScript(
          "({ hasBridge: typeof window.__BRIDGE__ !== 'undefined', nodeLeak: typeof window.require !== 'undefined' || typeof window.process !== 'undefined' })",
          true
        );
        clearTimeout(timer);
        console.log(JSON.stringify({ event: "SMOKE_OK", url: URL, port: PORT, title, ...api }));
        app.exit(api.hasBridge && !api.nodeLeak ? 0 : 1);
      } catch (err) {
        fail(String((err && err.message) || err));
      }
    });
  }
  win.loadURL(URL);
}

app.whenReady().then(async () => {
  registerPreloadChannels();
  buildMenu();
  await ensureServer();
  // Packaged + interactive only: dev (`npm start`) and smoke runs never hit
  // the update feed, so local work stays hermetic.
  if (app.isPackaged && !SMOKE) updater.startBackgroundChecks(app);
  createWindow();
  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});
