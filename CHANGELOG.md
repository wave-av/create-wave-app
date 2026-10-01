# Changelog

All notable changes to this project are documented here. The format is based on
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and this project adheres to
[Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

## [1.1.0]

The source of `@wave-av/create-app` now lives in this repository, with tests.
Every template installs and type-checks, and the compiled templates build and
start the file their build writes (`mastra-agent` runs from source with `tsx`).

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
- Published with npm provenance from this repository. A release tag must point
  at a commit on `main`, and the release runs the packed-tarball template check
  and fails when `@wave-av/adk` `^1.1.0` is not on npm. The build runs on
  `prepack`, so `npm pack` from a clean clone includes `dist/`.
- If scaffolding fails partway, the half-made project directory is removed.
- `webhook-handler`: refuses bodies over 256 KiB (`413`) while they stream in,
  checks the delivery shape after the signature (`400` otherwise), routes on
  the signed event type and refuses a disagreeing `x-wave-event-type`, and
  logs only event types and ids (never `data` or the signed `payload_url`).
  The README says thin payloads are not fetched and that duplicate detection
  is recent and in memory.
- `livekit-agent`: read-only WAVE tools by default, since anyone in the room
  can drive the agent with your key; `WAVE_AGENT_ALLOW_ACTIONS=1` adds the rest.
  Says that the default models need LiveKit Cloud.
- `nextjs-supabase`: the public page no longer shows the organization id, and
  the connection check is reused for a minute instead of running per visit.
- `stream-monitor`: `WAVE_POLL_INTERVAL_MS` must be a whole number of at least
  1000 ms.
- Templates stop with a message when `.env` exists but cannot be read, instead
  of silently running without it. `mastra-agent` disconnects MCP when its
  start-up fails.
