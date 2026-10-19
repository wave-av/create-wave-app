// scaffold.test.mjs — repo-level proof: scaffolding the electron template
// yields a sample app whose own contract tests pass. Zero deps.
import { test } from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { existsSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(HERE, "..");
const CLI = path.join(ROOT, "bin", "create-wave-app.mjs");

function scaffoldedApp() {
  const dir = mkdtempSync(path.join(tmpdir(), "cwa-electron-"));
  execFileSync(
    process.execPath,
    [CLI, "Sample Desk", "--app-id", "online.wave.sample-desk", "--feed-url", "https://updates.wave.online/sample-desk", "--port", "7727", "--dir", dir],
    { stdio: "pipe" }
  );
  return path.join(dir, "sample-desk");
}

test("cli scaffolds a complete electron app with no leftover tokens", () => {
  const app = scaffoldedApp();
  try {
    for (const f of ["package.json", "main.js", "preload.js", "updater.js", "rollout-guard.js", "entitlements.mac.plist", "README.md", "build/icon.icns", "build/icon.png", "scripts/smoke.sh", "scripts/cold-boot.sh", "scripts/brand-proof.sh", "scripts/scratch-server.mjs", "test/dist-slice.test.mjs", "test/rollout-guard.test.mjs"]) {
      assert.ok(existsSync(path.join(app, f)), `scaffolded file exists: ${f}`);
    }
    const pkg = JSON.parse(readFileSync(path.join(app, "package.json"), "utf8"));
    assert.equal(pkg.name, "sample-desk");
    assert.equal(pkg.build.productName, "Sample Desk");
    assert.equal(pkg.build.appId, "online.wave.sample-desk");
    assert.equal(pkg.build.publish.url, "https://updates.wave.online/sample-desk");
    for (const f of ["main.js", "preload.js", "updater.js", "README.md"]) {
      assert.doesNotMatch(readFileSync(path.join(app, f), "utf8"), /__[A-Z_]+__/, `${f} fully substituted`);
    }
  } finally {
    rmSync(path.dirname(app), { recursive: true, force: true });
  }
});

test("scaffolded sample app passes its own contract tests", () => {
  const app = scaffoldedApp();
  try {
    execFileSync(process.execPath, ["--test", "test/*.test.mjs"], { cwd: app, stdio: "pipe", timeout: 120000 });
  } finally {
    rmSync(path.dirname(app), { recursive: true, force: true });
  }
});

test("cli rejects bad params instead of scaffolding", () => {
  const dir = mkdtempSync(path.join(tmpdir(), "cwa-bad-"));
  try {
    for (const args of [
      ["x", "--app-id", "not-a-bundle-id"],
      ["x", "--feed-url", "http://insecure.example/feed"],
      ["x", "--port", "banana"],
    ]) {
      assert.throws(() => execFileSync(process.execPath, [CLI, ...args, "--dir", dir], { stdio: "pipe" }), /./, args.join(" "));
    }
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});
