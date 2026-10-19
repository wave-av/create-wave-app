#!/usr/bin/env node
// create-wave-app — scaffold a new WAVE app from a template.
//
//   create-wave-app <name> --template electron [options]
//
// Options:
//   --template <name>     template dir under templates/ (default: electron)
//   --app-name <name>      product name (default: Title Case of <name>)
//   --app-id <id>          bundle id (default: online.wave.<slug>)
//   --app-version <v>      initial version (default: 0.1.0)
//   --feed-url <url>       update feed base URL, https (default: https://updates.wave.online/<slug>)
//   --port <n>             live desk-service port (default: 7727)
//   --server-entry <path>  server entry relative to $HOME, "" to disable auto-boot
//                          (default: .config/<slug>/server.mjs)
//   --dir <path>           parent dir for the new app (default: cwd)
import { chmodSync, cpSync, existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const TEMPLATES = path.join(HERE, "..", "templates");

const slugify = (s) =>
  s.toLowerCase().trim().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
const titleCase = (slug) =>
  slug.split("-").map((w) => w.charAt(0).toUpperCase() + w.slice(1)).join(" ");
const camelCase = (slug) =>
  slug.split("-").map((w, i) => (i === 0 ? w : w.charAt(0).toUpperCase() + w.slice(1))).join("");
const upperSnake = (slug) => slug.toUpperCase().replace(/-/g, "_");

function usage(exit = 0) {
  const names = existsSync(TEMPLATES) ? readdirSync(TEMPLATES).join(", ") : "(none)";
  console.log(`usage: create-wave-app <name> --template <t> [options]\n\ntemplates: ${names}\n\nrun with --help for flags.`);
  process.exit(exit);
}

function parse(argv) {
  const out = { positional: [], flags: {} };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--help" || a === "-h") usage(0);
    else if (a.startsWith("--")) {
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

export function scaffold({ name, template = "electron", opts = {}, destDir = process.cwd() }) {
  const slug = slugify(name);
  if (!slug) throw new Error("app name must contain at least one letter or digit");
  const manifestPath = path.join(TEMPLATES, template, "template.json");
  if (!existsSync(manifestPath)) throw new Error(`unknown template "${template}" (see templates/)`);
  const manifest = JSON.parse(readFileSync(manifestPath, "utf8"));
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

  const srcRoot = path.join(TEMPLATES, template, "files");
  const destRoot = path.join(destDir, slug);
  if (existsSync(destRoot)) throw new Error(`destination already exists: ${destRoot}`);
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
  return { destRoot, params };
}

const isMain = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMain) {
  try {
    const { positional, flags } = parse(process.argv.slice(2));
    if (positional.length !== 1) usage(1);
    const { destRoot, params } = scaffold({
      name: positional[0],
      template: flags.template || "electron",
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
