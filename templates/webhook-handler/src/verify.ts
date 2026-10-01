import { createHmac, timingSafeEqual } from 'node:crypto';

/**
 * Check a WAVE webhook signature.
 *
 * WAVE signs every delivery with the subscription's secret:
 * `x-wave-signature: sha256=<hex HMAC-SHA256 of the raw request body>`.
 * Verify against the raw body bytes exactly as received, before parsing JSON.
 */
export function verifyWaveSignature(rawBody: string, header: string | undefined, secret: string): boolean {
  if (!header?.startsWith('sha256=')) return false;
  const received = header.slice('sha256='.length);
  if (!/^[0-9a-f]{64}$/i.test(received)) return false;
  const expected = createHmac('sha256', secret).update(rawBody, 'utf8').digest();
  return timingSafeEqual(Buffer.from(received, 'hex'), expected);
}

/** A delivery body. Full ("fat") deliveries carry the event; thin ones carry a signed URL to fetch it. */
export type WaveDelivery =
  | { event: string; data: unknown; delivered_at: string }
  | { type: string; id: string; payload_url: string };

export function eventTypeOf(delivery: WaveDelivery): string {
  return 'event' in delivery ? delivery.event : delivery.type;
}
