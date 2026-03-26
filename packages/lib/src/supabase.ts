/**
 * Klient Supabase – tworzenie instancji dla frontendu
 * W aplikacjach używać przez @influeapp/hooks lub bezpośrednio
 */

import { createClient, type SupabaseClient } from '@supabase/supabase-js';

export type SupabaseBrowserClient = SupabaseClient;

export function createSupabaseClient(url: string, anonKey: string): SupabaseClient {
  return createClient(url, anonKey);
}
