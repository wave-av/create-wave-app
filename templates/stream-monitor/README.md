# Stream monitor

A stream health monitor built on the [WAVE ADK](https://www.npmjs.com/package/@wave-av/adk).

## Setup

1. `npm install`
2. `cp .env.example .env`, then set:
   - `WAVE_AGENT_KEY`: your WAVE API key (`wave_live_...`)
   - `WAVE_STREAM_IDS`: the stream ids to watch, separated by commas
3. `npm run dev` (restarts on file changes)

For production, `npm run build` then `npm start` (runs `dist/agent.js`).

The agent exits with a message if `WAVE_AGENT_KEY` or `WAVE_STREAM_IDS` is
empty, instead of starting with nothing to do.

## What it does

- Every 30 seconds (`WAVE_POLL_INTERVAL_MS`, at least 1000 ms), calls
  `GET /v1/streams/{streamId}/status` for each stream and logs the status.
- When a stream drops from `live` to `idle` or `ended`, logs a quality-drop
  alert. With `WAVE_AUTO_REMEDIATE=1` it also calls
  `POST /v1/streams/{streamId}/start` to restart the stream. This is off by
  default because it changes the stream.
- Serves `GET /health` on `HEALTH_PORT` (default 8080) with uptime and call counts.
- Writes structured JSON logs to stdout. Set `WAVE_LOG_FORWARD_URL` to also
  POST them to your own collector.

When the WAVE API answers with an error (for example `404` for an unknown
stream id), the agent logs the HTTP status, the error code and the request id,
and keeps polling. Quote the request id when you contact WAVE support.

## Change it

Edit `src/agent.ts`. The ADK also ships `AgentToolkit` (tools for LLM agents)
and other agent templates; see the ADK README.
