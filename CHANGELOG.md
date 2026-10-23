# Changelog

All notable changes to this project are documented here. The format is based on
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and this project adheres to
[Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]
### Fixed

- `--help` now prints full usage for the scoped `npx @wave-av/create-app`
  command, including every template and flag; the unscoped
  `create-wave-app` name is never suggested. <!-- # guard:allow public template own-name self-reference (hyphen-boundary FP; see WAVE-27328) -->
- Template names must match a shipped template, so `--template ../...`
  can no longer escape the templates directory.
- A failed scaffold removes the half-made project directory instead of
  leaving it behind.
- The `electron` template's ignore file now survives `npm pack` (shipped
  as `gitignore`, renamed to `.gitignore` on scaffold), so scaffolded
  apps ignore `node_modules/` out of the box.

### Added

- `electron` template: hardened Electron shell from the proven Lighthouse
  path (preload zero-node, dmg+zip arm64, hardened runtime, icon slots,
  signing/notarize config, updater + rollout-guard wiring, smoke/cold-boot/
  brand proof scripts, dist-slice contract tests), parameterized per app.
- `bin/create-wave-app.mjs` scaffolder CLI (`@wave-av/create-app` 0.3.0). <!-- # guard:allow public template own-name self-reference (hyphen-boundary FP; see WAVE-27328) -->

### Documentation

- **README rewrite** — refreshed the top-level README to document all 6 starter
  templates (`stream-monitor`, `mastra-agent`, `livekit-agent`, `nextjs-supabase`,
  `webhook-handler`, `electron`) and fixed the follow-up scaffolding snippet, which always said
  `cd my-stream-bot` even for other templates; it now uses a generic `<project-name>` placeholder.
