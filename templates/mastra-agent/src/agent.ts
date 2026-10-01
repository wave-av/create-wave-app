/**
 * A Mastra agent that operates WAVE through the WAVE ADK.
 *
 * Two ways to give the agent WAVE tools:
 *   1. In process (default): every AgentToolkit tool becomes a Mastra tool. The
 *      toolkit validates input with its own schema and throws a WaveToolError
 *      (HTTP status, error code, request id) when the WAVE API refuses a call.
 *   2. Over MCP (WAVE_USE_MCP=1): also connect the WAVE MCP server
 *      (@wave-av/mcp-server) and add its tools.
 */

import { Agent } from '@mastra/core/agent';
import { createTool } from '@mastra/core/tools';
import { MCPClient } from '@mastra/mcp';
import { AgentToolkit, createWaveMCPConfig } from '@wave-av/adk';

// Load .env when it exists; otherwise use the process environment as is.
try {
  process.loadEnvFile();
} catch (error) {
  if ((error as NodeJS.ErrnoException).code !== 'ENOENT') {
    console.error(`mastra-agent: could not read .env: ${(error as Error).message}`);
    process.exit(1);
  }
}

function requireEnv(name: string, hint: string): string {
  const value = process.env[name]?.trim();
  if (!value) {
    console.error(`mastra-agent: set ${name} (${hint}). See .env.example.`);
    process.exit(1);
  }
  return value;
}

const waveKey = requireEnv('WAVE_AGENT_KEY', 'your WAVE API key, wave_live_...');
// Mastra reads the model provider key from the environment for 'anthropic/...' models.
requireEnv('ANTHROPIC_API_KEY', 'used by the anthropic/claude-sonnet-4-6 model');

// ─── 1. WAVE ADK tools as Mastra tools ───────────────────────────────────────

const toolkit = new AgentToolkit({ apiKey: waveKey });
const waveTools = Object.fromEntries(
  toolkit.getTools().map((tool) => [
    tool.name,
    createTool({
      id: tool.name,
      description: tool.description,
      inputSchema: tool.schema,
      execute: async (input) => tool.handler(input as Record<string, unknown>),
    }),
  ]),
);

// ─── 2. Optional: the WAVE MCP server ────────────────────────────────────────

const mcp = process.env.WAVE_USE_MCP === '1' ? new MCPClient(createWaveMCPConfig({ apiKey: waveKey })) : null;

const streamId = process.env.WAVE_STREAM_ID?.trim();
const prompt = streamId
  ? `Check the status of stream ${streamId} and tell me whether it needs attention.`
  : 'List the WAVE tools you can use and what each one does.';

// Everything after the MCP client exists runs inside try, so a failed MCP
// start-up still disconnects it.
try {
  const mcpTools = mcp ? await mcp.listTools() : {};

  const agent = new Agent({
    id: 'wave-stream-agent',
    name: 'WAVE stream agent',
    instructions: `You operate live video on WAVE with the tools you are given.
Check a stream's status before you act on it. When a tool fails, report the
error code and request id it returned instead of guessing.`,
    model: 'anthropic/claude-sonnet-4-6',
    tools: { ...waveTools, ...mcpTools },
  });

  console.log(`Tools: ${Object.keys(waveTools).length} from the ADK, ${Object.keys(mcpTools).length} from MCP`);
  const result = await agent.generate(prompt);
  console.log(result.text);
} finally {
  await mcp?.disconnect();
}
