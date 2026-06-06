# create-wave-app

Scaffold a new WAVE agent or streaming app in seconds.

## Usage

```bash
npx @wave-av/create-app my-stream-bot
```

With a specific template:

```bash
npx @wave-av/create-app my-agent --template mastra-agent
```

## Templates

| Template | What it creates |
|----------|----------------|
| `stream-monitor` | Real-time stream quality monitoring agent (default) |
| `mastra-agent` | Mastra framework agent with WAVE ADK tools |

## What you get

Each template scaffolds a working project with:

- TypeScript configuration
- `@wave-av/adk` pre-installed
- Working agent code you can run immediately
- Environment variable setup for `WAVE_AGENT_KEY`

## After scaffolding

```bash
cd my-stream-bot
npm install
npm run dev
```

## Links

- [WAVE ADK documentation](https://docs.wave.online/adk)
- [WAVE SDK](https://www.npmjs.com/package/@wave-av/sdk)
- [npm package](https://www.npmjs.com/package/@wave-av/create-app)

## License

MIT

---

<!-- wave-standard-footer -->
<sub><b><a href="https://wave.online">wave.online</a></b> &nbsp;·&nbsp; <a href="https://docs.wave.online">Docs</a> &nbsp;·&nbsp; <a href="https://dev.wave.online">Developers</a> &nbsp;·&nbsp; <a href="https://agents.wave.online">For agents</a></sub>
