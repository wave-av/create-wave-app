/**
 * A LiveKit voice agent that can operate WAVE.
 *
 * Joins LiveKit rooms as a voice agent (speech-to-text, LLM, text-to-speech
 * through LiveKit Inference, which needs a LiveKit Cloud project) and gives the
 * LLM WAVE ADK tools. A refused WAVE call is returned to the LLM as a tool error
 * with the request id.
 *
 * Every tool runs with WAVE_AGENT_KEY, and anyone who can talk in the room can
 * ask the LLM to use it. So by default the agent gets read-only tools only.
 * WAVE_AGENT_ALLOW_ACTIONS=1 adds the tools that change things (create streams
 * and clips, switch sources, show graphics, control cameras, ...): set it only
 * when everyone who can join the room may do those things.
 *
 *   npm run dev     # connect to LIVEKIT_URL and wait for rooms
 */

import { fileURLToPath } from 'node:url';
import { type JobContext, ServerOptions, cli, defineAgent, llm, voice } from '@livekit/agents';
import { AgentToolkit, WaveToolError } from '@wave-av/adk';

// Load .env when it exists; otherwise use the process environment as is.
try {
  process.loadEnvFile();
} catch (error) {
  if ((error as NodeJS.ErrnoException).code !== 'ENOENT') {
    console.error(`livekit-agent: could not read .env: ${(error as Error).message}`);
    process.exit(1);
  }
}

const required = ['WAVE_AGENT_KEY', 'LIVEKIT_URL', 'LIVEKIT_API_KEY', 'LIVEKIT_API_SECRET'];
const missing = required.filter((name) => !process.env[name]?.trim());
if (missing.length > 0) {
  console.error(`livekit-agent: set ${missing.join(', ')}. See .env.example.`);
  process.exit(1);
}

/** Tools that only read (GET). Everything else changes something on WAVE. */
const READ_ONLY_TOOLS: ReadonlySet<string> = new Set(['wave_monitor_stream', 'wave_analyze_quality']);
const allowActions = process.env.WAVE_AGENT_ALLOW_ACTIONS === '1';

/** WAVE ADK tools as LiveKit function tools: read-only ones unless actions are allowed. */
function waveTools(apiKey: string) {
  const toolkit = new AgentToolkit({ apiKey });
  return Object.fromEntries(
    toolkit
      .getTools()
      .filter((tool) => allowActions || READ_ONLY_TOOLS.has(tool.name))
      .map((tool) => [
        tool.name,
        llm.tool({
          description: tool.description,
          parameters: tool.schema,
          execute: async (args) => {
            try {
              return JSON.stringify(await tool.handler(args as Record<string, unknown>));
            } catch (error) {
              if (error instanceof WaveToolError) {
                throw new llm.ToolError(
                  `WAVE refused ${tool.name}: ${error.status ?? ''} ${error.gatewayCode ?? error.code} (request id ${error.requestId ?? 'none'})`,
                );
              }
              throw error;
            }
          },
        }),
      ]),
  );
}

const instructions = allowActions
  ? `You are a live video operator for WAVE. Use the WAVE tools to check streams,
create clips, switch sources and moderate chat when asked. Keep spoken answers
short. When a tool fails, say what failed and give the request id.`
  : `You are a live video assistant for WAVE. Use the WAVE tools to check stream
status and quality when asked. You cannot change anything on WAVE; say so if
asked. Keep spoken answers short. When a tool fails, say what failed and give
the request id.`;

export default defineAgent({
  entry: async (ctx: JobContext) => {
    await ctx.connect();

    const session = new voice.AgentSession({
      stt: 'deepgram/nova-3',
      llm: 'openai/gpt-4.1-mini',
      tts: 'cartesia/sonic-3',
    });

    await session.start({
      room: ctx.room,
      agent: new voice.Agent({
        instructions,
        tools: waveTools(process.env.WAVE_AGENT_KEY as string),
      }),
    });

    session.generateReply({ instructions: 'Greet the user and ask which stream to look at.' });
  },
});

cli.runApp(new ServerOptions({ agent: fileURLToPath(import.meta.url) }));
