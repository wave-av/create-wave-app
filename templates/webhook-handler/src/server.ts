/**
 * Receives WAVE webhook deliveries.
 *
 * Every delivery is a POST with:
 *   x-wave-signature:   sha256=<hex HMAC-SHA256 of the raw body, keyed by your subscription secret>
 *   x-wave-event-type:  the event type, for example incident.started (also in the signed body)
 *   x-wave-delivery-id: unique per delivery; WAVE delivers at least once, so dedupe on it
 * Answer 2xx quickly. Any other answer (or a timeout) is retried with backoff.
 * WAVE does not retry a delivery you answered 2xx, so finish (or durably queue)
 * your work before you answer.
 */

import { serve } from '@hono/node-server';
import { Hono } from 'hono';
import { bodyLimit } from 'hono/body-limit';
import { eventTypeOf, parseDelivery, verifyWaveSignature } from './verify';

// Load .env when it exists; otherwise use the process environment as is.
try {
  process.loadEnvFile();
} catch (error) {
  if ((error as NodeJS.ErrnoException).code !== 'ENOENT') {
    console.error(`webhook-handler: could not read .env: ${(error as Error).message}`);
    process.exit(1);
  }
}

const secret = process.env.WAVE_WEBHOOK_SECRET?.trim();
if (!secret) {
  console.error('webhook-handler: set WAVE_WEBHOOK_SECRET to the secret WAVE returned when you created the subscription. See .env.example.');
  process.exit(1);
}

/**
 * WAVE delivery bodies are small JSON documents (the event payload is capped at
 * 16 KiB). A larger body is refused while it streams in, before it is buffered
 * or verified, so an unauthenticated caller cannot exhaust memory.
 */
const MAX_BODY_BYTES = 256 * 1024;

// Recent deliveries already handled, in memory only: a restart, a second
// instance, or more than MAX_SEEN newer deliveries forgets an id, and a retry
// is then handled again. In production, claim the id in your database (a
// unique key) before any side effect.
const seen = new Set<string>();
const MAX_SEEN = 10_000;

const app = new Hono();

app.post(
  '/webhooks/wave',
  bodyLimit({ maxSize: MAX_BODY_BYTES, onError: (c) => c.json({ error: 'body too large' }, 413) }),
  async (c) => {
    const rawBody = await c.req.text();
    if (!verifyWaveSignature(rawBody, c.req.header('x-wave-signature'), secret)) {
      return c.json({ error: 'invalid signature' }, 401);
    }

    const deliveryId = c.req.header('x-wave-delivery-id') ?? '';
    if (deliveryId && seen.has(deliveryId)) return c.json({ received: true, duplicate: true });

    let parsed: unknown;
    try {
      parsed = JSON.parse(rawBody);
    } catch {
      return c.json({ error: 'body is not JSON' }, 400);
    }
    const delivery = parseDelivery(parsed);
    if (!delivery) return c.json({ error: 'body is not a WAVE delivery' }, 400);

    // Route on the signed body. The header is not covered by the signature.
    const type = eventTypeOf(delivery);
    const headerType = c.req.header('x-wave-event-type');
    if (headerType !== undefined && headerType !== type) {
      return c.json({ error: 'x-wave-event-type does not match the signed body' }, 400);
    }

    // Log identifiers only: event data can hold customer information, and a thin
    // delivery's payload_url is a credential until it expires.
    if ('payload_url' in delivery) {
      // Thin delivery: only the type and id. The event body is at
      // delivery.payload_url, a signed URL that expires. This template does not
      // fetch it. Fetch it here, or queue the fetch durably, before answering.
      console.log(`thin ${type} ${delivery.id}`);
    } else {
      switch (type) {
        case 'incident.started':
        case 'incident.acknowledged':
        case 'incident.resolved':
          // delivery.data is the event payload. Handle it here.
          console.log(`${type} ${deliveryId || '(no delivery id)'}`);
          break;
        default:
          console.log(`unhandled ${type} ${deliveryId || '(no delivery id)'}`);
      }
    }

    if (deliveryId) {
      seen.add(deliveryId);
      if (seen.size > MAX_SEEN) seen.delete(seen.values().next().value as string);
    }
    return c.json({ received: true });
  },
);

app.get('/health', (c) => c.json({ status: 'ok' }));

const port = Number(process.env.PORT ?? 3001);
serve({ fetch: app.fetch, port }, (info) => {
  console.log(`Listening on http://localhost:${info.port}/webhooks/wave`);
});
