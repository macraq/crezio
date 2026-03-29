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
      <header className="sticky top-0 z-40 border-b border-white/10 bg-slate-950/70 backdrop-blur">
        <div className="brand-container flex min-h-16 items-center justify-between gap-4">
          <a href="/" className="brand-heading text-lg font-semibold text-white sm:text-xl">
            crezio.app <span className="text-slate-300">/ Panel Marki</span>
          </a>
          <span className="text-sm text-slate-400">Ładowanie...</span>
        </div>
      </header>
    );
  }

  return (
    <header className="sticky top-0 z-40 border-b border-white/10 bg-slate-950/70 backdrop-blur">
      <div className="brand-container flex min-h-16 items-center justify-between gap-4">
        <a href="/" className="brand-heading text-lg font-semibold text-white sm:text-xl">
          crezio.app <span className="text-slate-300">/ Panel Marki</span>
        </a>
        {user ? (
          <div className="flex items-center gap-2 sm:gap-3">
            <span className="hidden max-w-44 truncate text-sm text-slate-300 sm:inline">{user.email}</span>
            <a href="/dashboard" className="brand-cta-outline px-3 py-2 text-xs sm:text-sm">{dashboardLabel}</a>
            <button type="button" className="brand-cta-outline px-3 py-2 text-xs sm:text-sm" onClick={handleLogout}>
              Wyloguj
            </button>
          </div>
        ) : (
          <div className="flex items-center gap-2 sm:gap-3">
            <a href={loginHref} className="brand-cta-outline px-3 py-2 text-xs sm:text-sm">Zaloguj się</a>
            <a href={signupHref} className="brand-cta px-3 py-2 text-xs sm:text-sm">Zarejestruj markę</a>
          </div>
        )}
      </div>
    </header>
  );
}
