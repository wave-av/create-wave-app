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
  | { type: string; id: string; payload_url: string; signature_material?: unknown };

/**
 * Check the shape of a parsed body at runtime. A valid signature proves who sent
 * it, not that it is a delivery this code understands. Returns null otherwise.
 */
export function parseDelivery(value: unknown): WaveDelivery | null {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return null;
  const body = value as Record<string, unknown>;
  if (typeof body.event === 'string' && body.event && 'data' in body && typeof body.delivered_at === 'string') {
    return { event: body.event, data: body.data, delivered_at: body.delivered_at };
  }
  if (typeof body.type === 'string' && body.type && typeof body.id === 'string' && typeof body.payload_url === 'string') {
    return { type: body.type, id: body.id, payload_url: body.payload_url, signature_material: body.signature_material };
  }
  return null;
}

export function eventTypeOf(delivery: WaveDelivery): string {
  return 'event' in delivery ? delivery.event : delivery.type;
}
