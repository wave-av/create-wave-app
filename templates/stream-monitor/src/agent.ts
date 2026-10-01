/**
 * Stream monitor built on the WAVE ADK.
 *
 * Polls GET /v1/streams/{streamId}/status for every stream in WAVE_STREAM_IDS,
 * logs status changes and quality drops, and serves a health endpoint.
 */

import { AgentRuntime, StreamMonitorAgent, WaveToolError } from '@wave-av/adk';

// Load .env when it exists; otherwise use the process environment as is.
try {
  process.loadEnvFile();
} catch {
  // no .env file
}

function fail(message: string): never {
  console.error(`stream-monitor: ${message}`);
  process.exit(1);
}

const apiKey = process.env.WAVE_AGENT_KEY?.trim();
if (!apiKey) fail('set WAVE_AGENT_KEY to your WAVE API key (wave_live_...). See .env.example.');

const streamIds = (process.env.WAVE_STREAM_IDS ?? '')
  .split(',')
  .map((id) => id.trim())
  .filter(Boolean);
if (streamIds.length === 0) fail('set WAVE_STREAM_IDS to one or more stream ids, separated by commas.');

const agent = new StreamMonitorAgent({
  apiKey,
  agentName: 'my-stream-monitor',
  streamIds,
  pollingIntervalMs: Number(process.env.WAVE_POLL_INTERVAL_MS ?? 30_000),
  // When a live stream goes idle or ends, call POST /v1/streams/{id}/start.
  // Off unless you opt in: it changes the stream.
  autoRemediate: process.env.WAVE_AUTO_REMEDIATE === '1',

  onQualityDrop: async (alert) => {
    runtime.getLogger().warn('Quality drop detected', {
      streamId: alert.streamId,
      metric: alert.metric,
      severity: alert.severity,
      status: alert.status,
    });
  },

  // Every WAVE API error arrives here as a WaveToolError with the HTTP status,
  // the gateway's error code and the request id to quote to support.
  onError: (error) => {
    runtime.getLogger().error('WAVE API error', {
      message: error.message,
      ...(error instanceof WaveToolError
        ? { status: error.status, code: error.gatewayCode, requestId: error.requestId }
        : {}),
    });
  },
});

agent.on('stream.status', async (event) => {
  runtime.getLogger().info('Stream status', { streamId: event.streamId, status: event.status });
});

const runtime = new AgentRuntime(agent, {
  healthPort: Number(process.env.HEALTH_PORT ?? 8080),
  logLevel: 'info',
  // Optional: your own log collector. Empty disables forwarding.
  logForwardUrl: process.env.WAVE_LOG_FORWARD_URL ?? '',
  onShutdown: async () => {
    const stats = agent.getUsageStats();
    runtime.getLogger().info('Final stats', { totalCalls: stats.totalCalls, totalDurationMs: stats.totalDurationMs });
  },
});

runtime.start().catch((error: unknown) => {
  console.error('stream-monitor: failed to start', error);
  process.exit(1);
});
