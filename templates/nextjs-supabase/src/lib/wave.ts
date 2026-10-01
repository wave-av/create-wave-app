import 'server-only';
import { Wave, WaveError } from '@wave-av/sdk';

/** What the page shows about the WAVE connection. */
export type WaveStatus =
  | { state: 'not-configured' }
  | { state: 'connected'; organizationId: string; period: unknown }
  | { state: 'error'; message: string; code?: string; status?: number; requestId?: string };

interface UsageResponse {
  organizationId: string;
  period: unknown;
}

/**
 * Check the WAVE connection with a read-only call (GET /v1/billing/usage).
 * Runs on the server only: WAVE_API_KEY never reaches the browser.
 */
export async function getWaveStatus(): Promise<WaveStatus> {
  const apiKey = process.env.WAVE_API_KEY?.trim();
  if (!apiKey) return { state: 'not-configured' };

  try {
    const wave = new Wave({ apiKey });
    const usage = await wave.client.get<UsageResponse>('/v1/billing/usage');
    return { state: 'connected', organizationId: usage.organizationId, period: usage.period };
  } catch (error) {
    if (error instanceof WaveError) {
      return { state: 'error', message: error.message, code: error.code, status: error.statusCode, requestId: error.requestId };
    }
    return { state: 'error', message: error instanceof Error ? error.message : String(error) };
  }
}
