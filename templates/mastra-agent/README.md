# WAVE + Mastra agent

A [Mastra](https://mastra.ai) agent that operates WAVE through the
[WAVE ADK](https://www.npmjs.com/package/@wave-av/adk). Needs Node 22.13 or later.

## Setup

1. `npm install`
2. `cp .env.example .env`, then set:
   - `WAVE_AGENT_KEY`: your WAVE API key (`wave_live_...`)
   - `ANTHROPIC_API_KEY`: the model provider key for `anthropic/claude-sonnet-4-6`
3. `npm start`

Set `WAVE_STREAM_ID` to have the agent check one stream. Without it, the agent
describes the WAVE tools it has.

## How the tools are wired

- **In process (default).** Each `AgentToolkit` tool (`wave_monitor_stream`,
  `wave_create_clip`, `wave_moderate_chat`, ...) becomes a Mastra tool with
  `createTool`. The tool's own schema validates input before any request, and a
  refused call throws a `WaveToolError` carrying the HTTP status, the error code
  and the request id, so the agent sees the failure instead of a fake result.
- **Over MCP (optional).** With `WAVE_USE_MCP=1`, the agent also connects the
  WAVE MCP server (`@wave-av/mcp-server`, installed with this project) through
  `MCPClient` and adds its tools.

To use another model, change `model` in `src/agent.ts` (for example
`openai/gpt-5-mini` with `OPENAI_API_KEY`). See the Mastra docs for model strings.
