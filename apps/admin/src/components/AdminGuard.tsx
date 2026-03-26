import { useEffect, useState } from 'react';
import { ADMIN_STORAGE_KEY, getSupabaseBrowserClient } from '@/lib/supabaseBrowser';
import { createClient } from '@supabase/supabase-js';

interface AdminGuardProps {
  supabaseUrl: string;
  supabaseAnonKey: string;
  children: React.ReactNode;
}

type GuardState = 'loading' | 'signed_out' | 'forbidden' | 'ok' | 'misconfigured';

export default function AdminGuard({ supabaseUrl, supabaseAnonKey, children }: AdminGuardProps) {
  const [state, setState] = useState<GuardState>('loading');
  const [detail, setDetail] = useState<string | null>(null);
  const [userInfo, setUserInfo] = useState<{ id: string; email: string | null } | null>(null);
  const [accountType, setAccountType] = useState<string | null>(null);

  useEffect(() => {
    const supabase = getSupabaseBrowserClient(supabaseUrl, supabaseAnonKey);
    if (!supabase) {
      setState('misconfigured');
      return;
    }

    const sb = supabase;
    let cancelled = false;

    async function withTimeout<T>(p: PromiseLike<T>, ms: number): Promise<T> {
      return await Promise.race([
        Promise.resolve(p),
        new Promise<T>((_resolve, reject) => setTimeout(() => reject(new Error('timeout')), ms)),
      ]);
    }

    async function check() {
      try {
        if (!cancelled) {
          setState('loading');
          setDetail(null);
          setUserInfo(null);
          setAccountType(null);
        }
        let user: { id: string; email?: string | null } | null = null;
        let accessToken: string | null = null;

        // Najpierw próbujemy bezlockowo: localStorage (nasz storageKey w adminie).
        // Dopiero jeśli nie ma sesji w storage, próbujemy auth.getSession() (który może timeoutować na Navigator Lock).
        try {
          const raw = localStorage.getItem(ADMIN_STORAGE_KEY);
          if (raw) {
            const parsed = JSON.parse(raw) as { access_token?: string; user?: { id: string; email?: string | null } };
            accessToken = parsed.access_token ?? null;
            user = parsed.user ?? null;
          }
        } catch {
          // ignore
        }

        if (!user || !accessToken) {
          try {
            const { data: sessionData } = await withTimeout(sb.auth.getSession(), 15000);
            user = sessionData.session?.user ?? null;
            accessToken = sessionData.session?.access_token ?? null;
          } catch (e) {
            console.warn('getSession error', e);
            const msg = e instanceof Error ? e.message : 'unknown';
            setDetail(msg === 'timeout' ? 'Timeout w auth.getSession() (Navigator Lock).' : msg);
          }
        }

        if (!user) {
          if (!cancelled) setState('signed_out');
          return;
        }
        if (!cancelled) setUserInfo({ id: user.id, email: user.email ?? null });
        // Jeśli mamy access token (z getSession albo fallback), użyj klienta DB z ręcznym Authorization.
        const db = accessToken
          ? createClient(supabaseUrl, supabaseAnonKey, {
              global: { headers: { Authorization: `Bearer ${accessToken}` } },
              auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
            })
          : sb;

        const { data, error } = await withTimeout(db.from('profiles').select('id,account_type').eq('id', user.id).maybeSingle(), 5000);
        if (cancelled) return;
        if (error) {
          setState('forbidden');
          setDetail(error.message);
          return;
        }
        const at = (data as { account_type?: string } | null)?.account_type ?? null;
        setAccountType(at);
        setState(at === 'admin' ? 'ok' : 'forbidden');
        if (at !== 'admin') setDetail(`profiles.account_type != admin (value: ${at ?? 'null'})`);
      } catch {
        if (!cancelled) {
          setState('forbidden');
          setDetail('Nie udało się zweryfikować sesji/roli (często Navigator Lock).');
        }
      }
    }

    check();
    const { data: sub } = sb.auth.onAuthStateChange(() => check());
    return () => {
      cancelled = true;
      sub.subscription.unsubscribe();
    };
  }, [supabaseUrl, supabaseAnonKey]);

  if (state === 'loading') return <div className="p-4 text-base-content/70">Sprawdzanie dostępu…</div>;
  if (state === 'misconfigured')
    return <div className="alert alert-error">Brak konfiguracji Supabase (PUBLIC_SUPABASE_URL / PUBLIC_SUPABASE_ANON_KEY).</div>;
  if (state === 'signed_out') {
    if (typeof window !== 'undefined') window.location.href = '/login';
    return <div className="p-4 text-base-content/70">Przekierowanie do logowania…</div>;
  }
  if (state === 'forbidden')
    return (
      <div className="alert alert-error">
        Brak dostępu. To konto nie ma roli administratora (`profiles.account_type != 'admin'`).
        {detail ? <div className="mt-2 text-xs opacity-70">Szczegóły: {detail}</div> : null}
        {userInfo ? (
          <div className="mt-2 text-xs opacity-70">
            Użytkownik: {userInfo.email ?? '—'} ({userInfo.id.slice(0, 8)}…), account_type: {accountType ?? '—'}
          </div>
        ) : null}
        <div className="mt-3 flex gap-2">
          <button type="button" className="btn btn-sm" onClick={() => window.location.reload()}>
            Odśwież
          </button>
        </div>
      </div>
    );

  return <>{children}</>;
}

