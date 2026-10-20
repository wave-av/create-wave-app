// cli.test.mjs — help text, argument handling, template-name validation,
// and scaffold failure cleanup. Zero deps.
import { test } from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { DEFAULT_TEMPLATE, RUN_COMMAND, helpText, listTemplates, scaffold } from "../bin/create-wave-app.mjs";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(HERE, "..");
const CLI = path.join(ROOT, "bin", "create-wave-app.mjs");

function runCli(args) {
  try {
    const stdout = execFileSync(process.execPath, [CLI, ...args], { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] });
    return { status: 0, stdout, stderr: "" };
  } catch (err) {
    return { status: err.status ?? 1, stdout: err.stdout ?? "", stderr: err.stderr ?? "" };
  }
}

test("help text names the scoped package, never the unscoped create-wave-app", () => {
  assert.equal(RUN_COMMAND, "npx @wave-av/create-app");
  const text = helpText();
  assert.match(text, /npx @wave-av\/create-app <name>/);
  assert.doesNotMatch(text, /npx create-wave-app/);
});

test("help text lists every template and every flag", () => {
  const text = helpText();
  for (const { name } of listTemplates()) assert.ok(text.includes(name), `help lists template: ${name}`);
  for (const flag of ["--template", "--app-name", "--app-id", "--app-version", "--feed-url", "--port", "--server-entry", "--dir", "--help"]) {
    assert.ok(text.includes(flag), `help documents flag: ${flag}`);
  }
  assert.ok(text.includes(`${DEFAULT_TEMPLATE} `) || text.includes(DEFAULT_TEMPLATE), "help names the default template");
});

test("--help and -h print help and exit 0; no arguments exits 1", () => {
  for (const flag of ["--help", "-h"]) {
    const r = runCli([flag]);
    assert.equal(r.status, 0, `${flag} exits 0`);
    assert.ok(r.stdout.includes(RUN_COMMAND), `${flag} prints the run command`);
  }
  const none = runCli([]);
  assert.equal(none.status, 1);
  assert.match(none.stderr, /Missing <name>/);
});

test("more than one positional is rejected", () => {
  const r = runCli(["a", "b"]);
  assert.equal(r.status, 1);
  assert.match(r.stderr, /Expected one <name>/);
});

test("unknown and traversal template names are rejected", () => {
  const dir = mkdtempSync(path.join(tmpdir(), "cwa-tpl-"));
  try {
    for (const template of ["no-such-template", "..", "../electron", "electron/../electron", "electron/../../.."]) {
      const r = runCli(["x", "--template", template, "--dir", dir]);
      assert.equal(r.status, 1, `rejected: ${template}`);
      assert.match(r.stderr, /unknown template/, `unknown-template error: ${template}`);
    }
    assert.deepEqual(runCli(["x", "--template", "nope", "--dir", dir]).stderr.match(/available: ([^)]*)/)?.[1]?.split(", ").filter(Boolean) ?? [], listTemplates().map((t) => t.name));
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("-t is a short flag for --template", () => {
  const dir = mkdtempSync(path.join(tmpdir(), "cwa-t-"));
  try {
    const r = runCli(["T App", "-t", "electron", "--dir", dir]);
    assert.equal(r.status, 0, r.stderr);
    assert.ok(existsSync(path.join(dir, "t-app", "package.json")));
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("failed scaffold removes the half-made directory", () => {
  const root = mkdtempSync(path.join(tmpdir(), "cwa-fail-"));
  try {
    // A fixture template whose second file is a dangling symlink: the copy
    // loop writes ok.txt, then throws, so cleanup must remove the whole dir.
    const tpl = path.join(root, "templates-root", "broken");
    mkdirSync(path.join(tpl, "files"), { recursive: true });
    writeFileSync(path.join(tpl, "template.json"), JSON.stringify({ name: "broken", description: "fixture" }));
    writeFileSync(path.join(tpl, "files", "ok.txt"), "app __APP_SLUG__");
    symlinkSync(path.join(tpl, "files", "missing-target"), path.join(tpl, "files", "bad.txt"));
    assert.throws(
      () => scaffold({ name: "half-made", template: "broken", destDir: root, templatesRoot: path.join(root, "templates-root") }),
      /nothing was left behind/
    );
    assert.ok(!existsSync(path.join(root, "half-made")), "half-made directory was removed");
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("scaffolded app gets .gitignore from the shipped gitignore", () => {
  const dir = mkdtempSync(path.join(tmpdir(), "cwa-dot-"));
  try {
    const r = runCli(["Dot App", "--dir", dir]);
    assert.equal(r.status, 0, r.stderr);
    const app = path.join(dir, "dot-app");
    assert.ok(existsSync(path.join(app, ".gitignore")), "scaffolded .gitignore exists");
    assert.ok(!existsSync(path.join(app, "gitignore")), "no shipped-name leftover");
    assert.match(readFileSync(path.join(app, ".gitignore"), "utf8"), /node_modules\//);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("packed tarball ships the dotfile source (npm strips .gitignore)", (t) => {
  let out;
  try {
    out = execFileSync("npm", ["pack", "--dry-run", "--json"], { cwd: ROOT, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] });
  } catch (err) {
    if (err.code === "ENOENT") {
      t.skip("npm not on PATH");
      return;
    }
    throw err;
  }
  const paths = JSON.parse(out)[0].files.map((f) => f.path);
  assert.ok(paths.includes("templates/electron/files/gitignore"), "tarball ships templates/electron/files/gitignore");
  assert.ok(!paths.some((p) => p.endsWith("/.gitignore")), "tarball has no literal .gitignore (npm strips those)");
});
