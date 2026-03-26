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
      <header className="navbar bg-base-200 px-4">
        <div className="flex-1">
          <a href="/" className="btn btn-ghost text-xl">Influe – Marki</a>
        </div>
        <div className="flex-none gap-2">
          <span className="text-base-content/60">Ładowanie…</span>
        </div>
      </header>
    );
  }

  return (
    <header className="navbar bg-base-200 px-4">
      <div className="flex-1">
        <a href="/" className="btn btn-ghost text-xl">Influe – Marki</a>
      </div>
      <div className="flex-none gap-2">
        {user ? (
          <>
            <span className="text-sm text-base-content/80 hidden sm:inline">{user.email}</span>
            <a href="/" className="btn btn-ghost btn-sm">{dashboardLabel}</a>
            <button type="button" className="btn btn-ghost btn-sm" onClick={handleLogout}>
              Wyloguj
            </button>
          </>
        ) : (
          <>
            <a href={loginHref} className="btn btn-ghost btn-sm">Zaloguj się</a>
            <a href={signupHref} className="btn btn-primary btn-sm">Zarejestruj markę</a>
          </>
        )}
      </div>
    </header>
  );
}
