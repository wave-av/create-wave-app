# WAVE + Next.js + Supabase

A [Next.js](https://nextjs.org) app with the
[WAVE SDK](https://www.npmjs.com/package/@wave-av/sdk) on the server and a
[Supabase](https://supabase.com) client ready to use.

## Setup

1. `npm install`
2. `cp .env.local.example .env.local`, then set:
   - `WAVE_API_KEY`: your WAVE API key (`wave_live_...`). Server-side only;
     never put it in a `NEXT_PUBLIC_*` variable.
   - `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY`: your
     Supabase project
3. `npm run dev` and open http://localhost:3000

## What you get

- `src/lib/wave.ts`: checks the WAVE connection on the server with a read-only
  call (`GET /v1/billing/usage`). The home page shows the organization it
  reached, or the HTTP status, error code and request id when WAVE refuses.
- `src/lib/supabase.ts`: a Supabase client built from your public URL and anon
  key. Sign-in is not wired up; add it with Supabase Auth when you need it.
- `npm run build` needs no keys: the home page renders on each request.
