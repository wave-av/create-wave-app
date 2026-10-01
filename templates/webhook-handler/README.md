# WAVE webhook handler

A small [Hono](https://hono.dev) server that receives WAVE webhook deliveries,
checks their signature and handles each event once.

## Setup

1. `npm install`
2. Deploy it (or expose it with a tunnel) at a public `https://` URL. WAVE only
   delivers to `https` URLs on public hosts.
3. Create a subscription with your WAVE API key. The response holds the signing
   secret, and it is returned only once:

   ```bash
   curl -X POST https://api.wave.online/v1/webhook-subscriptions \
     -H "Authorization: Bearer $WAVE_API_KEY" \
     -H "Content-Type: application/json" \
     -d '{"url":"https://your-host.example.com/webhooks/wave","events":["incident.*"]}'
   ```

4. `cp .env.example .env` and set `WAVE_WEBHOOK_SECRET` to that secret.
5. `npm run dev` (or `npm run build && npm start`).

List your subscriptions with `GET /v1/webhook-subscriptions` (secrets are
redacted there).

## How a delivery is checked

Each delivery is a `POST` with these headers:

| Header | Value |
|--------|-------|
| `x-wave-signature` | `sha256=<hex HMAC-SHA256 of the raw body, keyed by the secret>` |
| `x-wave-event-type` | the event type, for example `incident.started` |
| `x-wave-delivery-id` | unique per delivery |

The handler verifies the signature over the raw body before it parses anything
and answers `401` when it does not match. WAVE delivers at least once and
retries anything but a `2xx`, so the handler skips a `x-wave-delivery-id` it has
already handled. The example keeps those ids in memory; keep them in your
database in production.

A full delivery body is `{ "event", "data", "delivered_at" }`. A subscription
created with `"mode": "thin"` gets `{ "type", "id", "payload_url" }` instead,
and the event body is fetched from the signed, expiring `payload_url`.

## Test

`npm test` checks the signature code against known-good and tampered inputs.
