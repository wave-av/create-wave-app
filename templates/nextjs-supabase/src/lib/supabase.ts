import { type SupabaseClient, createClient } from '@supabase/supabase-js';

let client: SupabaseClient | null = null;

/**
 * The Supabase client for this app, or null until NEXT_PUBLIC_SUPABASE_URL and
 * NEXT_PUBLIC_SUPABASE_ANON_KEY are set. Both values are public by design; keep
 * your service-role key out of NEXT_PUBLIC_* variables.
 */
export function getSupabase(): SupabaseClient | null {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anonKey) return null;
  client ??= createClient(url, anonKey);
  return client;
}
