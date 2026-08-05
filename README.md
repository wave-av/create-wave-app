<div align="center">

# create-wave-app

**Scaffold a new WAVE agent or streaming app from one of 5 starter templates — published as the `@wave-av/create-app` npm package.**

![kind](https://img.shields.io/badge/kind-cli--scaffolder-555?style=flat-square) ![domain](https://img.shields.io/badge/domain-developer--tools-0a7?style=flat-square) ![lang](https://img.shields.io/badge/lang-TypeScript-3178c6?style=flat-square) ![visibility](https://img.shields.io/badge/visibility-public-brightgreen?style=flat-square) ![license](https://img.shields.io/badge/license-MIT-blue?style=flat-square)

[npm](https://www.npmjs.com/package/@wave-av/create-app) · [wave.online](https://wave.online) · [github](https://github.com/wave-av/create-wave-app) · [Docs](https://docs.wave.online)

</div>

---

## Quick start

```bash
npx @wave-av/create-app my-stream-bot
```

With a specific template:

```bash
npx @wave-av/create-app my-agent --template mastra-agent
```

Then:

```bash
cd my-stream-bot
npm install
npm run dev
```

## Templates

The CLI ships 5 templates:

| Template | What it creates |
| --- | --- |
| `stream-monitor` | Real-time stream quality monitoring agent (default) |
| `mastra-agent` | Mastra framework agent with WAVE ADK tools |
| `livekit-agent` | Real-time AI agent built on LiveKit + WAVE ADK |
| `nextjs-supabase` | Next.js app with Supabase auth and the WAVE SDK |
| `webhook-handler` | Webhook server with signature verification |

## What you get

Each template scaffolds a working, runnable project: TypeScript config, the relevant WAVE package
pre-wired, and an `.env.example` for the credentials it needs (most agent templates need
`WAVE_AGENT_KEY`).

## About this repo

`create-wave-app` (npm: `@wave-av/create-app`, CLI binary: `create-wave-app`) is published from WAVE's
internal monorepo. This public repo carries the project's governance surface — `CHANGELOG.md`,
`SECURITY.md`, `AGENTS.md`, and `capabilities.json` (currently `beta`, v0.2.0) — as the canonical public
record for the package; it does not itself hold a checked-in copy of the CLI source.

## Related packages

| Package | Description |
| --- | --- |
| [@wave-av/adk](https://www.npmjs.com/package/@wave-av/adk) | Agent Developer Kit (pre-installed in agent templates) |
| [@wave-av/sdk](https://www.npmjs.com/package/@wave-av/sdk) | TypeScript SDK (34 API modules) |
| [@wave-av/mcp-server](https://www.npmjs.com/package/@wave-av/mcp-server) | MCP server for AI tools |
| [@wave-av/cli](https://www.npmjs.com/package/@wave-av/cli) | Command-line interface |

## License

MIT — see [LICENSE](LICENSE) and [NOTICE](NOTICE).

---

<!-- wave-standard-footer -->
<sub><b><a href="https://wave.online">wave.online</a></b> &nbsp;·&nbsp; <a href="https://docs.wave.online">Docs</a> &nbsp;·&nbsp; <a href="https://developer.wave.online">Developers</a></sub>
