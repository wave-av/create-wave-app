/**
 * Receives WAVE webhook deliveries.
 *
 * Every delivery is a POST with:
 *   x-wave-signature:   sha256=<hex HMAC-SHA256 of the raw body, keyed by your subscription secret>
 *   x-wave-event-type:  the event type, for example incident.started
 *   x-wave-delivery-id: unique per delivery; WAVE delivers at least once, so dedupe on it
 * Answer 2xx quickly. Any other answer (or a timeout) is retried with backoff.
 */

import { serve } from '@hono/node-server';
import { Hono } from 'hono';
import { type WaveDelivery, eventTypeOf, verifyWaveSignature } from './verify';

// Load .env when it exists; otherwise use the process environment as is.
try {
  process.loadEnvFile();
} catch {
  // no .env file
}

const secret = process.env.WAVE_WEBHOOK_SECRET?.trim();
if (!secret) {
  console.error('webhook-handler: set WAVE_WEBHOOK_SECRET to the secret WAVE returned when you created the subscription. See .env.example.');
  process.exit(1);
}

// Deliveries already handled. In production keep this in your database so it
// survives restarts and works across instances.
const seen = new Set<string>();
const MAX_SEEN = 10_000;

const app = new Hono();

app.post('/webhooks/wave', async (c) => {
  const rawBody = await c.req.text();
  if (!verifyWaveSignature(rawBody, c.req.header('x-wave-signature'), secret)) {
    return c.json({ error: 'invalid signature' }, 401);
  }

  const deliveryId = c.req.header('x-wave-delivery-id') ?? '';
  if (deliveryId && seen.has(deliveryId)) return c.json({ received: true, duplicate: true });

  let delivery: WaveDelivery;
  try {
    delivery = JSON.parse(rawBody) as WaveDelivery;
  } catch {
    return c.json({ error: 'body is not JSON' }, 400);
  }

  const type = c.req.header('x-wave-event-type') ?? eventTypeOf(delivery);
  if ('payload_url' in delivery) {
    // Thin delivery: the event body is at a signed URL that expires. Fetch it
    // here (or queue the fetch) if you need more than the type and id.
    console.log(`thin ${type} ${delivery.id} (payload at ${delivery.payload_url})`);
  } else {
    switch (type) {
      case 'incident.started':
      case 'incident.acknowledged':
      case 'incident.resolved':
        console.log(`${type}`, JSON.stringify(delivery.data));
        break;
      default:
        console.log(`unhandled ${type}`);
    }
  }

  if (deliveryId) {
    seen.add(deliveryId);
    if (seen.size > MAX_SEEN) seen.delete(seen.values().next().value as string);
  }
  return c.json({ received: true });
});

app.get('/health', (c) => c.json({ status: 'ok' }));

const port = Number(process.env.PORT ?? 3001);
serve({ fetch: app.fetch, port }, (info) => {
  console.log(`Listening on http://localhost:${info.port}/webhooks/wave`);
});
