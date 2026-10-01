# create-wave-app

[![npm version](https://img.shields.io/npm/v/@wave-av/create-app.svg)](https://www.npmjs.com/package/@wave-av/create-app)
[![license](https://img.shields.io/npm/l/@wave-av/create-app.svg)](https://github.com/wave-av/create-wave-app/blob/main/LICENSE)

Scaffold a new WAVE agent or app.

## Usage

```bash
npx @wave-av/create-app my-stream-bot
```

With a specific template:

```bash
npx @wave-av/create-app my-agent --template mastra-agent
```

Always run the scoped package, `@wave-av/create-app`. The unscoped
`create-wave-app` package on npm is not published by WAVE.

## Templates

| Template | What it creates | Needs |
|----------|-----------------|-------|
| `stream-monitor` (default) | Agent that polls stream status with the WAVE ADK, logs drops and serves a health endpoint | Node 20.12+ |
| `mastra-agent` | [Mastra](https://mastra.ai) agent with every WAVE ADK tool, optionally the WAVE MCP server too | Node 22.13+, a model provider key |
| `livekit-agent` | [LiveKit Agents](https://docs.livekit.io/agents/) voice agent with the read-only WAVE ADK tools (all of them when you opt in) | Node 20.12+, a LiveKit Cloud project |
| `webhook-handler` | [Hono](https://hono.dev) server that verifies WAVE webhook signatures and deduplicates recent delivery IDs in memory | Node 20.12+ |
| `nextjs-supabase` | [Next.js](https://nextjs.org) app with the WAVE SDK on the server and a Supabase client | Node 20.12+ |

Every template reads its keys from the environment (or a `.env` file) and has
a README with setup steps. The agent and webhook templates stop with a message
when a required key is missing; the Next.js app renders a setup message
instead. None of them sends your WAVE key to the browser.

## After scaffolding

```bash
cd my-stream-bot
npm install
cp .env.example .env   # nextjs-supabase: cp .env.local.example .env.local
npm run dev
```

## Development

```bash
npm install
npm run type-check
npm test        # CLI tests and static checks on every template
npm run build
```

## Related packages

- [@wave-av/adk](https://www.npmjs.com/package/@wave-av/adk): Agent Developer Kit (used by the agent templates)
- [@wave-av/sdk](https://www.npmjs.com/package/@wave-av/sdk): TypeScript SDK
- [@wave-av/mcp-server](https://www.npmjs.com/package/@wave-av/mcp-server): MCP server for AI tools

## License

MIT
