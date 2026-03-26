import { createClient, type SupabaseClient } from '@supabase/supabase-js';

export const ADMIN_STORAGE_KEY = 'sb-crezioapp-admin-auth-token';

let client: SupabaseClient | null = null;
let lastUrl: string | null = null;
let lastKey: string | null = null;

export function getSupabaseBrowserClient(url: string, anonKey: string): SupabaseClient | null {
  if (typeof window === 'undefined') return null;
  if (!url?.trim() || !anonKey?.trim()) return null;

  if (client && lastUrl === url && lastKey === anonKey) return client;

  client = createClient(url, anonKey, {
    auth: {
      // Unikamy konfliktów Navigator Lock z innymi panelami (web/partner) na tym samym originie.
      // Domyślnie local Supabase używa "sb-127-auth-token", więc kilka aplikacji potrafi się blokować.
      storageKey: ADMIN_STORAGE_KEY,
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true,
    },
  });
  lastUrl = url;
  lastKey = anonKey;
  return client;
}

export function getAdminSessionFromStorage():
  | { access_token: string; user: { id: string; email?: string | null } }
  | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = localStorage.getItem(ADMIN_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as { access_token?: string; user?: { id: string; email?: string | null } };
    if (!parsed?.access_token || !parsed?.user?.id) return null;
    return { access_token: parsed.access_token, user: parsed.user };
  } catch {
    return null;
  }
}

/**
 * Klient do zapytań DB/Functions z ręcznie ustawionym Authorization.
 * Nie używa modułu auth do pobierania sesji → unika Navigator Lock.
 */
export function getAdminAuthedClient(url: string, anonKey: string): SupabaseClient | null {
  const session = getAdminSessionFromStorage();
  if (!session) return null;
  return createClient(url, anonKey, {
    global: { headers: { Authorization: `Bearer ${session.access_token}` } },
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });
}

