import type { SupabaseClient } from '@supabase/supabase-js';
import { createSupabaseClient } from '@influeapp/lib';

let client: SupabaseClient | null = null;

/**
 * Singleton Supabase client dla przeglądarki.
 * W aplikacjach Astro przekazuj url i anonKey z import.meta.env.
 */
export function useSupabase(url?: string, anonKey?: string): SupabaseClient {
  if (typeof window === 'undefined') {
    if (url && anonKey) return createSupabaseClient(url, anonKey);
    throw new Error('useSupabase: url and anonKey required on server');
  }
  if (!client) {
    const u = url ?? (import.meta as unknown as { env: { PUBLIC_SUPABASE_URL?: string } }).env?.PUBLIC_SUPABASE_URL;
    const k = anonKey ?? (import.meta as unknown as { env: { PUBLIC_SUPABASE_ANON_KEY?: string } }).env?.PUBLIC_SUPABASE_ANON_KEY;
    if (!u || !k) throw new Error('useSupabase: PUBLIC_SUPABASE_URL and PUBLIC_SUPABASE_ANON_KEY required');
    client = createSupabaseClient(u, k);
  }
  return client;
}
