# Changelog

All notable changes to this project are documented here. The format is based on
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and this project adheres to
[Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]
### Added

- `electron` template: hardened Electron shell from the proven Lighthouse
  path (preload zero-node, dmg+zip arm64, hardened runtime, icon slots,
  signing/notarize config, updater + rollout-guard wiring, smoke/cold-boot/
  brand proof scripts, dist-slice contract tests), parameterized per app.
- `bin/create-wave-app.mjs` scaffolder CLI (`@wave-av/create-app` 0.3.0).

### Documentation

- **README rewrite** — refreshed the top-level README to document all 6 starter
  templates (`stream-monitor`, `mastra-agent`, `livekit-agent`, `nextjs-supabase`,
  `webhook-handler`, `electron`) and fixed the follow-up scaffolding snippet, which always said
  `cd my-stream-bot` even for other templates; it now uses a generic `<project-name>` placeholder.
