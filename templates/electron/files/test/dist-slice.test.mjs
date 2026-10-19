// dist-slice.test.mjs — static contract tests for the __APP_NAME__
// Electron dist-ready slice. Zero deps; `npm test`.
import { test } from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { existsSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(HERE, "..");
const read = (p) => readFileSync(path.join(ROOT, p), "utf8");
const pkg = JSON.parse(read("package.json"));

test("main, preload, updater, rollout-guard parse as CommonJS", () => {
  for (const f of ["main.js", "preload.js", "updater.js", "rollout-guard.js"]) {
    execFileSync(process.execPath, ["--check", path.join(ROOT, f)], { stdio: "pipe" });
  }
});

test("preload exposes exactly one minimal bridge, zero node", () => {
  const src = read("preload.js");
  assert.equal((src.match(/exposeInMainWorld/g) || []).length, 1, "single exposeInMainWorld call");
  assert.match(src, /exposeInMainWorld\("__BRIDGE__"/);
  for (const method of ["getVersion", "openExternal", "getUpdateStatus", "checkForUpdates"]) {
    assert.match(src, new RegExp(method), `bridge exposes ${method}`);
  }
  const code = src.replace(/\/\/.*$/gm, ""); // comments name the forbidden APIs; scan code only
  for (const leak of ["process.", 'require("node', "require('node", "Buffer", "BrowserWindow", "nodeIntegration"]) {
    assert.doesNotMatch(code, new RegExp(leak.replace(/[()."]/g, "\\$&")), `preload must not contain ${leak}`);
  }
});

test("main.js wires preload with hardened webPreferences", () => {
  const src = read("main.js");
  assert.match(src, /preload:\s*path\.join\(__dirname,\s*"preload\.js"\)/);
  assert.match(src, /nodeIntegration:\s*false/);
  assert.match(src, /contextIsolation:\s*true/);
  assert.match(src, /sandbox:\s*true/);
  assert.match(src, /__PORT_ENV__/);
  assert.match(src, /--smoke-test/);
  assert.match(src, /__IPC__:version/);
  assert.match(src, /__IPC__:open-external/);
  assert.match(src, /https:/, "openExternal must be https-gated");
});

test("main.js gates background update checks to packaged interactive runs", () => {
  const src = read("main.js");
  assert.match(src, /require\("\.\/updater"\)/, "main requires ./updater");
  assert.match(src, /updater\.initIpc\(app\)/, "ipc channels registered on every boot");
  assert.match(src, /app\.isPackaged && !SMOKE/, "background checks only when packaged and not smoking");
});

test("electron-builder config targets dmg+zip arm64", () => {
  const mac = pkg.build.mac;
  const targets = mac.target.map((t) => `${t.target}:${(t.arch || []).join(",")}`).sort();
  assert.deepEqual(targets, ["dmg:arm64", "zip:arm64"]);
  assert.deepEqual(pkg.build.files, ["main.js", "preload.js", "updater.js", "rollout-guard.js", "package.json"]);
});

test("hardened-runtime signing config present", () => {
  const mac = pkg.build.mac;
  assert.equal(mac.hardenedRuntime, true);
  assert.ok(existsSync(path.join(ROOT, mac.entitlements)), "entitlements file exists");
  assert.ok(existsSync(path.join(ROOT, mac.entitlementsInherit)), "entitlementsInherit file exists");
  const plist = read(mac.entitlements);
  for (const key of [
    "com.apple.security.cs.allow-jit",
    "com.apple.security.cs.allow-unsigned-executable-memory",
    "com.apple.security.cs.disable-library-validation",
  ]) {
    assert.match(plist, new RegExp(key), `entitlements must contain ${key}`);
  }
  assert.doesNotMatch(plist, /com\.apple\.security\.app-sandbox/, "no app-sandbox entitlement");
});

test("notarize is configured for release (env-driven credentials)", () => {
  assert.ok(pkg.build.mac.notarize, "mac.notarize must be truthy; APPLE_ID/APPLE_APP_SPECIFIC_PASSWORD/APPLE_TEAM_ID supply credentials");
});

test("update feed is a parameterized https generic publish target", () => {
  assert.equal(pkg.build.publish.provider, "generic");
  assert.equal(pkg.build.publish.url, "__FEED_URL__");
  assert.match(pkg.build.publish.url, /^https:\/\//, "feed must be https");
  assert.doesNotMatch(pkg.build.publish.url, /__/, "feed URL must be fully parameterized (no tokens left)");
  const updaterSrc = read("updater.js");
  assert.match(updaterSrc, /require\("electron-updater"\)/);
  assert.match(updaterSrc, /require\("\.\/rollout-guard"\)/, "updater gates downloads on rollout-guard");
  assert.ok(updaterSrc.includes(pkg.build.publish.url), "updater.js embeds the same feed URL as publish config");
  assert.match(updaterSrc, /autoDownload = false/, "no silent auto-download");
  assert.match(updaterSrc, /__IPC__:update-status/);
  assert.match(updaterSrc, /__IPC__:check-for-updates/);
});

test("app identity is fully parameterized", () => {
  assert.equal(pkg.name, "__APP_SLUG__");
  assert.equal(pkg.version, "__APP_VERSION__");
  assert.equal(pkg.build.appId, "__APP_ID__");
  assert.equal(pkg.build.productName, "__APP_NAME__");
  assert.equal(pkg.build.dmg.title, "__APP_NAME__");
  for (const f of ["package.json", "main.js", "preload.js", "updater.js", "rollout-guard.js", "entitlements.mac.plist", "README.md", "scripts/smoke.sh", "scripts/cold-boot.sh", "scripts/brand-proof.sh", "scripts/scratch-server.mjs"]) {
    assert.doesNotMatch(read(f), /__[A-Z_]+__/, `${f} must contain no unsubstituted tokens`);
  }
});

test("app icon exists and is a real icns", () => {
  const iconPath = path.join(ROOT, pkg.build.mac.icon);
  assert.ok(existsSync(iconPath), "icon file exists");
  assert.ok(statSync(iconPath).size > 10000, "icon is non-trivially sized");
  const magic = readFileSync(iconPath).subarray(0, 4).toString("latin1");
  assert.equal(magic, "icns", "icon has icns magic");
  assert.ok(existsSync(path.join(ROOT, "build", "icon.png")), "icon.png master exists");
});
