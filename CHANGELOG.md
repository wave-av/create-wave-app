# Changelog

All notable changes to this project are documented here. The format is based on
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and this project adheres to
[Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

## [1.1.0]

The source of `@wave-av/create-app` now lives in this repository, with tests,
and every template installs, type-checks and builds.

### Fixed

- The help text told people to run `npx create-wave-app`, which is an
  unrelated package on npm. It now says `npx @wave-av/create-app`.
- `stream-monitor`: `npm start` ran `dist/agent.mjs`, but the build writes
  `dist/agent.js`. `@types/node` was missing, so `tsc` failed. An empty
  `WAVE_STREAM_IDS` started an agent that watched nothing; the agent now stops
  with a message when `WAVE_AGENT_KEY` or `WAVE_STREAM_IDS` is empty. The
  `deploy` script ran a CLI command that only printed a made-up id; it is gone.
  Auto-remediation (restarting a dropped stream) is now opt-in with
  `WAVE_AUTO_REMEDIATE=1`.
- `mastra-agent`: imported `@wave-av/adk/adapters/mastra`, which no ADK version
  exported, and pinned Mastra 0.10 (57 known vulnerabilities on install). It now
  targets Mastra 1.x, wraps the ADK tools with `createTool`, passes the API key
  to the MCP config, pins `@wave-av/adk` to `^1.1.0` instead of `latest`, and
  has a README.
- `livekit-agent`, `webhook-handler`, `nextjs-supabase`: the sources contained
  `\!` and did not parse. `livekit-agent` called methods and tools that do not
  exist; it is now a LiveKit Agents 1.x voice agent with the ADK tools.
  `webhook-handler` compared the signature as bare hex and so rejected every
  real delivery; it now verifies `x-wave-signature: sha256=<hex>`, dedupes on
  `x-wave-delivery-id`, and reads the real delivery body. `nextjs-supabase` now
  makes one read-only WAVE call on the server and builds without keys.
- Project names are validated (no path separators, no `..`), and inherited
  object keys such as `toString` are no longer accepted as template names.

### Changed

- Requires Node 20.12 or later (`mastra-agent` needs 22.13, as Mastra does).
- Templates ship `gitignore` and `env.example` and are renamed to
  `.gitignore` and `.env.example` on scaffold, so they survive `npm pack`.
- Published with npm provenance from this repository.
