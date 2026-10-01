# WAVE + LiveKit voice agent

A [LiveKit Agents](https://docs.livekit.io/agents/) voice agent that can operate
WAVE through the [WAVE ADK](https://www.npmjs.com/package/@wave-av/adk).

## Setup

1. `npm install`
2. `cp .env.example .env`, then set:
   - `WAVE_AGENT_KEY`: your WAVE API key (`wave_live_...`)
   - `LIVEKIT_URL`, `LIVEKIT_API_KEY`, `LIVEKIT_API_SECRET`: your LiveKit project
3. `npm run dev`, then join a room in your LiveKit project (for example from
   the LiveKit Agents Playground) and talk to the agent.

For production, `npm run build` then `npm start`.

## What it does

- Joins LiveKit rooms as a voice agent. Speech-to-text (`deepgram/nova-3`),
  the LLM (`openai/gpt-4.1-mini`) and text-to-speech (`cartesia/sonic-3`) run
  through LiveKit Inference on your LiveKit project. Change them in
  `src/agent.ts`.
- Gives the LLM every WAVE ADK tool (`wave_monitor_stream`, `wave_create_clip`,
  `wave_switch_camera`, `wave_moderate_chat`, ...). Each tool validates its
  input before calling WAVE. When WAVE refuses a call, the LLM gets a tool error
  with the HTTP status, the error code and the request id, never a fake result.
