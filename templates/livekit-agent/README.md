# WAVE + LiveKit voice agent

A [LiveKit Agents](https://docs.livekit.io/agents/) voice agent that can operate
WAVE through the [WAVE ADK](https://www.npmjs.com/package/@wave-av/adk).

## Setup

1. `npm install`
2. `cp .env.example .env`, then set:
   - `WAVE_AGENT_KEY`: your WAVE API key (`wave_live_...`)
   - `LIVEKIT_URL`, `LIVEKIT_API_KEY`, `LIVEKIT_API_SECRET`: your LiveKit
     Cloud project. The default models run on LiveKit Inference, which only
     LiveKit Cloud provides. On a self-hosted LiveKit server, replace them in
     `src/agent.ts` with provider plugins (for example `@livekit/agents-plugin-openai`)
     and those providers' keys.
3. `npm run dev`, then join a room in your LiveKit project (for example from
   the LiveKit Agents Playground) and talk to the agent.

For production, `npm run build` then `npm start`.

## What it does

- Joins LiveKit rooms as a voice agent. Speech-to-text (`deepgram/nova-3`),
  the LLM (`openai/gpt-4.1-mini`) and text-to-speech (`cartesia/sonic-3`) run
  through LiveKit Inference on your LiveKit Cloud project. Change them in
  `src/agent.ts`.
- Gives the LLM the read-only WAVE ADK tools (`wave_monitor_stream`,
  `wave_analyze_quality`). Each tool validates its input before calling WAVE.
  When WAVE refuses a call, the LLM gets a tool error with the HTTP status, the
  error code and the request id, never a fake result.

## Tools that change things

Every tool runs with your `WAVE_AGENT_KEY`, and anyone who can speak in the
room can ask the agent to use it. That is why the agent is read-only by
default. `WAVE_AGENT_ALLOW_ACTIONS=1` adds every other ADK tool
(`wave_create_stream`, `wave_create_clip`, `wave_switch_camera`,
`wave_show_graphic`, `wave_moderate_chat`, `wave_start_captions`,
`wave_mark_highlight`, `wave_control_camera`). Set it only for rooms where
everyone who can join may do those things, or check the participant's identity
in `src/agent.ts` before you add them.
