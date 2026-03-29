import { useEffect, useState } from 'react';
import { createClient } from '@supabase/supabase-js';

interface RequireAuthProps {
  supabaseUrl: string;
  supabaseAnonKey: string;
  loginHref?: string;
}

export default function RequireAuth({ supabaseUrl, supabaseAnonKey, loginHref = '/login' }: RequireAuthProps) {
  const [status, setStatus] = useState<'checking' | 'ok' | 'misconfigured'>('checking');

  useEffect(() => {
    if (!supabaseUrl?.trim() || !supabaseAnonKey?.trim()) {
      setStatus('misconfigured');
      return;
    }

    const supabase = createClient(supabaseUrl, supabaseAnonKey);
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!session) {
        window.location.replace(loginHref);
        return;
      }
      setStatus('ok');
    });
  }, [supabaseUrl, supabaseAnonKey, loginHref]);

  if (status === 'ok') return null;

  if (status === 'misconfigured') {
    return (
      <div className="brand-container relative z-50 mt-6">
        <div className="rounded-xl border border-rose-400/40 bg-rose-500/10 px-4 py-3 text-sm text-rose-200">
          Brak konfiguracji Supabase (`PUBLIC_SUPABASE_URL` / `PUBLIC_SUPABASE_ANON_KEY`).
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/90 px-6">
      <div className="brand-glass w-full max-w-sm p-5 text-center">
        <p className="text-sm text-slate-300">Sprawdzanie sesji...</p>
      </div>
    </div>
  );
}
