import { useEffect, useState } from 'react';
import type { User } from '@supabase/supabase-js';
import { getSupabaseBrowserClient } from '@/lib/supabaseBrowser';

interface AdminHeaderProps {
  supabaseUrl: string;
  supabaseAnonKey: string;
}

type AdminState =
  | { status: 'loading' }
  | { status: 'signed_out' }
  | { status: 'signed_in'; user: User };

export default function AdminHeader({ supabaseUrl, supabaseAnonKey }: AdminHeaderProps) {
  const [state, setState] = useState<AdminState>({ status: 'loading' });

  useEffect(() => {
    const supabase = getSupabaseBrowserClient(supabaseUrl, supabaseAnonKey);
    if (!supabase) {
      setState({ status: 'signed_out' });
      return;
    }
    const sb = supabase;

    async function withTimeout<T>(p: PromiseLike<T>, ms: number): Promise<T> {
      return await Promise.race([
        Promise.resolve(p),
        new Promise<T>((_resolve, reject) => setTimeout(() => reject(new Error('timeout')), ms)),
      ]);
    }

    async function load() {
      // Preferujemy odczyt sesji z localStorage (bez Navigator Lock).
      try {
        const raw = localStorage.getItem('sb-influeapp-admin-auth-token');
        if (raw) {
          const parsed = JSON.parse(raw) as { user?: User | null };
          const user = parsed.user ?? null;
          if (user) {
            setState({ status: 'signed_in', user });
            return;
          }
        }
      } catch {
        // ignore
      }

      let user: User | null = null;
      try {
        const { data } = await withTimeout(sb.auth.getSession(), 15000);
        user = data.session?.user ?? null;
      } catch {
        // jeśli auth.getSession timeoutuje, zostawiamy signed_out (UI da link do logowania)
        user = null;
      }

      if (!user) {
        setState({ status: 'signed_out' });
        return;
      }
      setState({ status: 'signed_in', user });
    }

    load();
    const { data: sub } = sb.auth.onAuthStateChange(() => load());
    return () => sub.subscription.unsubscribe();
  }, [supabaseUrl, supabaseAnonKey]);

  async function handleLogout() {
    const supabase = getSupabaseBrowserClient(supabaseUrl, supabaseAnonKey);
    if (!supabase) return;
    await supabase.auth.signOut();
    window.location.href = '/login';
  }

  return (
    <header className="navbar bg-base-200 px-4">
      <div className="flex-1">
        <a href="/" className="btn btn-ghost text-xl">
          Influe – Admin
        </a>
      </div>
      <div className="flex-none gap-2">
        {state.status === 'loading' && <span className="text-base-content/60">Ładowanie…</span>}
        {state.status === 'signed_out' && (
          <a href="/login" className="btn btn-primary btn-sm">
            Zaloguj się
          </a>
        )}
        {state.status === 'signed_in' && (
          <>
            <span className="text-sm text-base-content/80 hidden sm:inline">{state.user.email}</span>
            <button type="button" className="btn btn-ghost btn-sm" onClick={handleLogout}>
              Wyloguj
            </button>
          </>
        )}
      </div>
    </header>
  );
}

