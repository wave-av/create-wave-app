# WAVE webhook handler

A small [Hono](https://hono.dev) server that receives WAVE webhook deliveries,
checks their signature and skips recent duplicates. It logs each event's type
and id; you add the handling.

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

The handler refuses a body over 256 KiB (`413`) while it is still arriving,
then verifies the signature over the raw body before it parses anything and
answers `401` when it does not match. It answers `400` when the signed body is
not a delivery it recognizes, or when `x-wave-event-type` (which the signature
does not cover) disagrees with the type in the body; it routes on the body.

WAVE delivers at least once and retries anything but a `2xx`, so the handler
skips a `x-wave-delivery-id` it handled recently. Those ids live in memory: a
restart, a second instance, or 10,000 newer deliveries forgets one, and a retry
is then handled again. In production, claim the id in your database (a unique
key) before any side effect. WAVE does not retry a delivery you answered `2xx`,
so finish or durably queue your work first.

A full delivery body is `{ "event", "data", "delivered_at" }`. A subscription
created with `"mode": "thin"` gets `{ "type", "id", "payload_url",
"signature_material" }` instead. The event body is at `payload_url`, a signed
URL that expires. **This template does not fetch it**: it logs the type and id
and answers `2xx`. Add the fetch (or a durable queue for it) where `server.ts`
says so before you rely on thin deliveries.

The handler logs event types and ids only. It never logs `data` (it can hold
customer information) or `payload_url` (anyone holding it can read the event
until it expires).

## Test

`npm test` checks the signature code against known-good and tampered inputs,
and the delivery parser against malformed bodies.
