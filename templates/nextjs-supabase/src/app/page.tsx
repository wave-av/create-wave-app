import { getSupabase } from '@/lib/supabase';
import { getWaveStatus } from '@/lib/wave';

// Render on each request: the WAVE status is live, and the build needs no keys.
export const dynamic = 'force-dynamic';

export default async function Home() {
  const wave = await getWaveStatus();
  const supabaseReady = getSupabase() !== null;

  return (
    <main style={{ maxWidth: 800, margin: '0 auto', padding: 40, fontFamily: 'system-ui' }}>
      <h1>WAVE + Next.js + Supabase</h1>
      <p>
        Edit <code>src/app/page.tsx</code> to get started.
      </p>

      <h2>WAVE</h2>
      {wave.state === 'not-configured' && (
        <p>
          Set <code>WAVE_API_KEY</code> in <code>.env.local</code> to connect.
        </p>
      )}
      {wave.state === 'connected' && <p>Connected to organization {wave.organizationId}.</p>}
      {wave.state === 'error' && (
        <p>
          WAVE answered {wave.status ?? 'with an error'} {wave.code ?? ''}: {wave.message}
          {wave.requestId ? ` (request id ${wave.requestId})` : ''}
        </p>
      )}

      <h2>Supabase</h2>
      <p>
        {supabaseReady
          ? 'Supabase client is configured (src/lib/supabase.ts).'
          : 'Set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY in .env.local to configure the Supabase client.'}
      </p>
    </main>
  );
}
