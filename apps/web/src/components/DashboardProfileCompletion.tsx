import { useCallback, useEffect, useState } from 'react';
import { createClient } from '@supabase/supabase-js';
import type { SupabaseClient } from '@supabase/supabase-js';

interface DashboardProfileCompletionProps {
  supabaseUrl: string;
  supabaseAnonKey: string;
}

export default function DashboardProfileCompletion({ supabaseUrl, supabaseAnonKey }: DashboardProfileCompletionProps) {
  const [loading, setLoading] = useState(true);
  const [completionPct, setCompletionPct] = useState(0);
  const [loggedIn, setLoggedIn] = useState(false);

  const loadCompletion = useCallback(
    async (client: SupabaseClient, options?: { showLoading?: boolean }) => {
      if (options?.showLoading !== false) setLoading(true);
      const {
        data: { session },
      } = await client.auth.getSession();
      if (!session?.user) {
        setLoggedIn(false);
        setCompletionPct(0);
        setLoading(false);
        return;
      }
      setLoggedIn(true);
      const { data, error } = await client
        .from('influencer_profiles')
        .select('profile_completion_pct')
        .eq('profile_id', session.user.id)
        .maybeSingle();
      if (error) {
        setCompletionPct(0);
      } else {
        const raw = data?.profile_completion_pct;
        const n = typeof raw === 'number' ? raw : 0;
        setCompletionPct(Math.min(100, Math.max(0, n)));
      }
      setLoading(false);
    },
    []
  );

  useEffect(() => {
    if (!supabaseUrl?.trim() || !supabaseAnonKey?.trim()) {
      setLoading(false);
      return;
    }
    const supabase = createClient(supabaseUrl, supabaseAnonKey);
    loadCompletion(supabase, { showLoading: true });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(() => {
      loadCompletion(supabase, { showLoading: true });
    });

    return () => subscription.unsubscribe();
  }, [supabaseUrl, supabaseAnonKey, loadCompletion]);

  useEffect(() => {
    if (!supabaseUrl?.trim() || !supabaseAnonKey?.trim()) return;

    function onVisible() {
      if (document.visibilityState !== 'visible') return;
      const supabase = createClient(supabaseUrl, supabaseAnonKey);
      loadCompletion(supabase, { showLoading: false });
    }

    document.addEventListener('visibilitychange', onVisible);
    return () => document.removeEventListener('visibilitychange', onVisible);
  }, [supabaseUrl, supabaseAnonKey, loadCompletion]);

  return (
    <section className="rounded-2xl border border-base-content/10 bg-base-100/35 p-5">
      <h2 className="text-lg font-semibold">Wypełnienie profilu</h2>
      <p className="mt-2 text-sm text-base-content/70">
        Pełny profil zwiększa szanse na wybór do kampanii i widoczność w rankingach marek.
      </p>
      {!loggedIn && !loading ? (
        <p className="mt-4 text-sm text-base-content/65">
          <a href="/login" className="link link-primary">
            Zaloguj się
          </a>
          , aby zobaczyć swój wskaźnik zapisany w profilu.
        </p>
      ) : null}
      <div className={`mt-4 ${loading ? 'opacity-80' : ''}`}>
        <progress
          className="progress progress-primary w-full"
          value={loading ? 0 : completionPct}
          max={100}
        />
        {loading ? (
          <p className="mt-2 text-sm text-base-content/60">
            <span className="loading loading-spinner loading-sm mr-2 align-middle" />
            Wczytywanie…
          </p>
        ) : (
          <p className="mt-2 text-sm font-medium">{completionPct}% kompletne</p>
        )}
      </div>
      <a href="/settings" className="btn btn-sm btn-outline mt-4 w-full border-base-content/25">
        Przejdź do ustawień
      </a>
    </section>
  );
}
