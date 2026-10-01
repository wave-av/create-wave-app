import 'server-only';
import { Wave, WaveError } from '@wave-av/sdk';

/** What the page shows about the WAVE connection. No account data: the page is public. */
export type WaveStatus =
  | { state: 'not-configured' }
  | { state: 'connected' }
  | { state: 'error'; message: string; code?: string; status?: number; requestId?: string };

/** How long one connection check is reused, so page views do not each call WAVE. */
const STATUS_TTL_MS = 60_000;
let cached: { at: number; status: Promise<WaveStatus> } | null = null;

/**
 * Check the WAVE connection with a read-only call (GET /v1/billing/usage).
 * Runs on the server only: WAVE_API_KEY never reaches the browser. The result
 * is reused for a minute per server instance, and only whether the call
 * worked is returned, never the account it belongs to.
 */
export function getWaveStatus(): Promise<WaveStatus> {
  const now = Date.now();
  if (!cached || now - cached.at > STATUS_TTL_MS) {
    cached = { at: now, status: checkWave() };
  }
  return cached.status;
}

async function checkWave(): Promise<WaveStatus> {
  const apiKey = process.env.WAVE_API_KEY?.trim();
  if (!apiKey) return { state: 'not-configured' };

  try {
    const wave = new Wave({ apiKey });
    await wave.client.get('/v1/billing/usage');
    return { state: 'connected' };
  } catch (error) {
    if (error instanceof WaveError) {
      return { state: 'error', message: error.message, code: error.code, status: error.statusCode, requestId: error.requestId };
    }
    return { state: 'error', message: error instanceof Error ? error.message : String(error) };
  }
}
