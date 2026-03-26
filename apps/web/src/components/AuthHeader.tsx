import { useEffect, useState } from 'react';
import { createClient } from '@supabase/supabase-js';
import type { User } from '@supabase/supabase-js';

interface AuthHeaderProps {
  supabaseUrl: string;
  supabaseAnonKey: string;
  loginHref: string;
  signupHref: string;
  dashboardLabel?: string;
}

export default function AuthHeader({
  supabaseUrl,
  supabaseAnonKey,
  loginHref,
  signupHref,
  dashboardLabel = 'Panel',
}: AuthHeaderProps) {
  const [user, setUser] = useState<User | null>(null);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    if (!supabaseUrl?.trim() || !supabaseAnonKey?.trim()) {
      setLoaded(true);
      return;
    }
    const supabase = createClient(supabaseUrl, supabaseAnonKey);
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null);
      setLoaded(true);
    });
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
    });
    return () => subscription.unsubscribe();
  }, [supabaseUrl, supabaseAnonKey]);

  async function handleLogout() {
    if (!supabaseUrl?.trim() || !supabaseAnonKey?.trim()) return;
    const supabase = createClient(supabaseUrl, supabaseAnonKey);
    await supabase.auth.signOut();
    setUser(null);
    window.location.href = '/';
  }

  if (!loaded) {
    return (
      <header className="navbar bg-transparent px-4 backdrop-blur supports-[backdrop-filter]:bg-base-100/10">
        <div className="flex-1">
          <a href="/" className="btn btn-ghost text-xl normal-case gap-2">
            <span
              className="inline-flex h-8 w-8 items-center justify-center rounded-xl text-white bg-gradient-to-br from-primary to-secondary shadow-sm"
              aria-hidden="true"
            >
              C
            </span>
            <span className="font-semibold tracking-tight">crezio.app</span>
          </a>
        </div>
        <div className="flex-none gap-2">
          <span className="text-base-content/60">Ładowanie…</span>
        </div>
      </header>
    );
  }

  return (
    <header className="navbar bg-transparent px-4 backdrop-blur supports-[backdrop-filter]:bg-base-100/10">
      <div className="flex-1">
        <a href="/" className="btn btn-ghost text-xl normal-case gap-2">
          <span
            className="inline-flex h-8 w-8 items-center justify-center rounded-xl text-white bg-gradient-to-br from-primary to-secondary shadow-sm"
            aria-hidden="true"
          >
            C
          </span>
          <span className="font-semibold tracking-tight">crezio.app</span>
        </a>
      </div>
      <div className="flex-none gap-2">
        {user ? (
          <>
            <span className="text-sm text-base-content/80 hidden sm:inline">{user.email}</span>
            <a href="/" className="btn btn-ghost btn-sm">{dashboardLabel}</a>
            <a href="/settings" className="btn btn-ghost btn-sm">Ustawienia</a>
            <button type="button" className="btn btn-ghost btn-sm" onClick={handleLogout}>
              Wyloguj
            </button>
          </>
        ) : (
          <>
            <a href={loginHref} className="btn btn-outline btn-sm border-base-content/40 hover:border-base-content/70">
              Zaloguj się
            </a>
            <a href={signupHref} className="btn-crezio-gradient btn-sm">
              Wypróbuj za darmo
            </a>
          </>
        )}
      </div>
    </header>
  );
}
