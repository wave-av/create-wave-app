#!/usr/bin/env node
// create-wave-app — scaffold a new WAVE app from a template.
//
//   npx @wave-av/create-app <name> --template electron [options]
//
// Run with --help for the full usage text. The unscoped `create-wave-app`
// package on npm is not published by WAVE; always run the scoped package.
import { chmodSync, cpSync, existsSync, mkdirSync, readdirSync, readFileSync, renameSync, rmSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const TEMPLATES = path.join(HERE, "..", "templates");

/** The only command customers should run. The unscoped `create-wave-app` on npm is not WAVE's. */
export const RUN_COMMAND = "npx @wave-av/create-app";
export const DEFAULT_TEMPLATE = "electron";

/** Files a template ships without their leading dot, and the name each gets in the new project. */
export const DOTFILES = {
  gitignore: ".gitignore",
  "env.example": ".env.example",
  "env.local.example": ".env.local.example",
};

const slugify = (s) =>
  s.toLowerCase().trim().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
const titleCase = (slug) =>
  slug.split("-").map((w) => w.charAt(0).toUpperCase() + w.slice(1)).join(" ");
const camelCase = (slug) =>
  slug.split("-").map((w, i) => (i === 0 ? w : w.charAt(0).toUpperCase() + w.slice(1))).join("");
const upperSnake = (slug) => slug.toUpperCase().replace(/-/g, "_");

/** Templates shipped in `templates/<name>`: every directory with a template.json manifest. */
export function listTemplates(templatesRoot = TEMPLATES) {
  if (!existsSync(templatesRoot)) return [];
  return readdirSync(templatesRoot, { withFileTypes: true })
    .filter((e) => e.isDirectory() && existsSync(path.join(templatesRoot, e.name, "template.json")))
    .map((e) => {
      let description = "";
      try {
        description = JSON.parse(readFileSync(path.join(templatesRoot, e.name, "template.json"), "utf8")).description || "";
      } catch {
        description = "";
      }
      return { name: e.name, description };
    })
    .sort((a, b) => (a.name < b.name ? -1 : 1));
}

export function helpText() {
  const templates = listTemplates();
  const width = Math.max(DEFAULT_TEMPLATE.length, ...templates.map((t) => t.name.length));
  const rows = templates
    .map((t) => `    ${t.name.padEnd(width)}  ${t.description}${t.name === DEFAULT_TEMPLATE ? " (default)" : ""}`)
    .join("\n");
  return `
  create-wave-app: scaffold a new WAVE app

  Usage:
    ${RUN_COMMAND} <name> [--template <name>] [options]

  Templates:
${rows}

  Options:
    --template <name>     template dir under templates/ (default: ${DEFAULT_TEMPLATE})
    --app-name <name>      product name (default: Title Case of <name>)
    --app-id <id>          bundle id (default: online.wave.<slug>)
    --app-version <v>      initial version (default: 0.1.0)
    --feed-url <url>       update feed base URL, https (default: https://updates.wave.online/<slug>)
    --port <n>             live desk-service port (default: 7727)
    --server-entry <path>  server entry relative to $HOME, "" to disable auto-boot
                           (default: .config/<slug>/server.mjs)
    --dir <path>           parent dir for the new app (default: cwd)
    --help, -h             print this help

  Examples:
    ${RUN_COMMAND} "Sample Desk"
    ${RUN_COMMAND} my-agent --template ${DEFAULT_TEMPLATE} --port 7727
`;
}

function parse(argv) {
  const out = { positional: [], flags: {} };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--help" || a === "-h") {
      console.log(helpText());
      process.exit(0);
    } else if (a === "-t") {
      out.flags.template = argv[i + 1] && !argv[i + 1].startsWith("-") ? argv[++i] : "true";
    } else if (a.startsWith("--")) {
      const key = a.slice(2);
      const val = argv[i + 1] && !argv[i + 1].startsWith("--") ? argv[++i] : "true";
      out.flags[key] = val;
    } else out.positional.push(a);
  }
  return out;
}

function walk(dir) {
  const files = [];
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) files.push(...walk(p));
    else files.push(p);
  }
  return files;
}

export function scaffold({ name, template = DEFAULT_TEMPLATE, opts = {}, destDir = process.cwd(), templatesRoot = TEMPLATES }) {
  const slug = slugify(name);
  if (!slug) throw new Error("app name must contain at least one letter or digit");
  // The name must match a shipped template directory exactly: anything else,
  // including ".." or names with separators, is rejected before any path is built.
  const available = listTemplates(templatesRoot).map((t) => t.name);
  if (!available.includes(template)) {
    throw new Error(`unknown template "${template}" (available: ${available.join(", ") || "(none)"})`);
  }
  const manifest = JSON.parse(readFileSync(path.join(templatesRoot, template, "template.json"), "utf8"));
  const params = {
    __APP_SLUG__: slug,
    __APP_NAME__: opts["app-name"] || titleCase(slug),
    __APP_ID__: opts["app-id"] || `online.wave.${slug}`,
    __APP_VERSION__: opts["app-version"] || "0.1.0",
    __FEED_URL__: opts["feed-url"] || `https://updates.wave.online/${slug}`,
    __PORT__: opts.port || "7727",
    __PORT_ENV__: `${upperSnake(slug)}_PORT`,
    __BRIDGE__: camelCase(slug),
    __IPC__: slug,
    __SERVER_ENTRY__: opts["server-entry"] ?? `.config/${slug}/server.mjs`,
  };
  if (!/^[a-z][a-z0-9]*(\.[a-z0-9-]+)+$/i.test(params.__APP_ID__)) {
    throw new Error(`--app-id must be reverse-dns (got ${params.__APP_ID__})`);
  }
  if (!/^https:\/\/.+\..+/.test(params.__FEED_URL__)) {
    throw new Error(`--feed-url must be an https URL (got ${params.__FEED_URL__})`);
  }
  if (!/^\d{2,5}$/.test(params.__PORT__)) throw new Error(`--port must be numeric (got ${params.__PORT__})`);
  if (!/^\d+\.\d+\.\d+/.test(params.__APP_VERSION__)) {
    throw new Error(`--app-version must be semver (got ${params.__APP_VERSION__})`);
  }

  const srcRoot = path.join(templatesRoot, template, "files");
  const destRoot = path.join(destDir, slug);
  if (existsSync(destRoot)) throw new Error(`destination already exists: ${destRoot}`);
  mkdirSync(destDir, { recursive: true });
  // mkdir without `recursive` claims the directory: it fails if anything created
  // it since the check above, so the cleanup below only ever removes our own.
  mkdirSync(destRoot);
  try {
    const binaries = new Set(manifest.binary || []);
    for (const src of walk(srcRoot)) {
      const rel = path.relative(srcRoot, src);
      const dest = path.join(destRoot, rel);
      mkdirSync(path.dirname(dest), { recursive: true });
      if (binaries.has(rel)) {
        cpSync(src, dest);
      } else {
        let text = readFileSync(src, "utf8");
        for (const [token, value] of Object.entries(params)) text = text.split(token).join(value);
        writeFileSync(dest, text);
        if (src.endsWith(".sh")) chmodSync(dest, 0o755);
      }
    }

    // npm never packs a file named .gitignore, so templates ship their dotfiles
    // without the dot and get their real names here.
    for (const [shipped, real] of Object.entries(DOTFILES)) {
      const from = path.join(destRoot, shipped);
      if (existsSync(from)) renameSync(from, path.join(destRoot, real));
    }
  } catch (err) {
    rmSync(destRoot, { recursive: true, force: true });
    throw new Error(`could not scaffold ${slug}: ${err.message} (nothing was left behind)`);
  }
  return { destRoot, params };
}

const isMain = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMain) {
  try {
    const { positional, flags } = parse(process.argv.slice(2));
    if (positional.length === 0) {
      console.error(`Missing <name>.\n${helpText()}`);
      process.exit(1);
    }
    if (positional.length > 1) {
      console.error(`Expected one <name>, got ${positional.length}: ${positional.join(" ")}`);
      process.exit(1);
    }
    const { destRoot, params } = scaffold({
      name: positional[0],
      template: flags.template || DEFAULT_TEMPLATE,
      opts: flags,
      destDir: flags.dir ? path.resolve(flags.dir) : process.cwd(),
    });
    console.log(`scaffolded ${params.__APP_NAME__} -> ${destRoot}`);
    console.log(`\nnext:\n  cd ${destRoot}\n  npm install\n  npm test\n  npm run smoke\n`);
  } catch (err) {
    console.error(`create-wave-app: ${err.message}`);
    process.exit(1);
  }
}
