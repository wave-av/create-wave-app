/**
 * A LiveKit voice agent that can operate WAVE.
 *
 * Joins LiveKit rooms as a voice agent (speech-to-text, LLM, text-to-speech
 * through LiveKit Inference) and gives the LLM every WAVE ADK tool. A refused
 * WAVE call is returned to the LLM as a tool error with the request id.
 *
 *   npm run dev     # connect to LIVEKIT_URL and wait for rooms
 */

import { fileURLToPath } from 'node:url';
import { type JobContext, ServerOptions, cli, defineAgent, llm, voice } from '@livekit/agents';
import { AgentToolkit, WaveToolError } from '@wave-av/adk';

// Load .env when it exists; otherwise use the process environment as is.
try {
  process.loadEnvFile();
} catch {
  // no .env file
}

const required = ['WAVE_AGENT_KEY', 'LIVEKIT_URL', 'LIVEKIT_API_KEY', 'LIVEKIT_API_SECRET'];
const missing = required.filter((name) => !process.env[name]?.trim());
if (missing.length > 0) {
  console.error(`livekit-agent: set ${missing.join(', ')}. See .env.example.`);
  process.exit(1);
}

/** Every WAVE ADK tool as a LiveKit function tool. */
function waveTools(apiKey: string) {
  const toolkit = new AgentToolkit({ apiKey });
  return Object.fromEntries(
    toolkit.getTools().map((tool) => [
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
        instructions: `You are a live video operator for WAVE. Use the WAVE tools to check
streams, create clips, switch sources and moderate chat when asked. Keep spoken
answers short. When a tool fails, say what failed and give the request id.`,
        tools: waveTools(process.env.WAVE_AGENT_KEY as string),
      }),
    });

    session.generateReply({ instructions: 'Greet the user and ask which stream to look at.' });
  },
});

cli.runApp(new ServerOptions({ agent: fileURLToPath(import.meta.url) }));
