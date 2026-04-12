import { useCallback, useEffect, useState } from 'react';
import { createClient } from '@supabase/supabase-js';
import type { SupabaseClient } from '@supabase/supabase-js';

interface DashboardNotificationsProps {
  supabaseUrl: string;
  supabaseAnonKey: string;
}

type Row = {
  sort_ts: string;
  message: string;
  campaign_id: string;
};

function formatPlRelative(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  const diffSec = (Date.now() - d.getTime()) / 1000;
  try {
    const rtf = new Intl.RelativeTimeFormat('pl', { numeric: 'auto' });
    if (diffSec < 60) return rtf.format(-Math.max(1, Math.round(diffSec)), 'second');
    if (diffSec < 3600) return rtf.format(-Math.round(diffSec / 60), 'minute');
    if (diffSec < 86400) return rtf.format(-Math.round(diffSec / 3600), 'hour');
    if (diffSec < 7 * 86400) return rtf.format(-Math.round(diffSec / 86400), 'day');
  } catch {
    /* older engines */
  }
  return d.toLocaleDateString('pl-PL', { day: 'numeric', month: 'short' });
}

export default function DashboardNotifications({ supabaseUrl, supabaseAnonKey }: DashboardNotificationsProps) {
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [loggedIn, setLoggedIn] = useState(false);

  const load = useCallback(async (client: SupabaseClient) => {
    const {
      data: { session },
    } = await client.auth.getSession();
    if (!session?.user) {
      setLoggedIn(false);
      setRows([]);
      setLoading(false);
      return;
    }
    setLoggedIn(true);
    const { data, error } = await client.rpc('influencer_dashboard_notifications', { p_limit: 3 });
    if (error) {
      setRows([]);
      setLoading(false);
      return;
    }
    const list = (data ?? []) as Row[];
    setRows(Array.isArray(list) ? list : []);
    setLoading(false);
  }, []);

  useEffect(() => {
    if (!supabaseUrl?.trim() || !supabaseAnonKey?.trim()) {
      setLoading(false);
      return;
    }
    const client = createClient(supabaseUrl, supabaseAnonKey);
    load(client);
    const {
      data: { subscription },
    } = client.auth.onAuthStateChange(() => {
      setLoading(true);
      load(client);
    });
    return () => subscription.unsubscribe();
  }, [supabaseUrl, supabaseAnonKey, load]);

  if (!supabaseUrl?.trim() || !supabaseAnonKey?.trim()) {
    return (
      <section className="rounded-2xl border border-base-content/10 bg-base-100/35 p-5">
        <h2 className="text-lg font-semibold">Powiadomienia</h2>
        <p className="mt-2 text-sm text-base-content/65">Brak konfiguracji Supabase.</p>
      </section>
    );
  }

  return (
    <section className="rounded-2xl border border-base-content/10 bg-base-100/35 p-5">
      <h2 className="text-lg font-semibold">Powiadomienia</h2>
      {!loggedIn && !loading ? (
        <p className="mt-3 text-sm text-base-content/70">
          <a href="/login" className="link link-primary">
            Zaloguj się
          </a>
          , aby zobaczyć spersonalizowane powiadomienia.
        </p>
      ) : null}
      {loading ? (
        <div className="mt-4 flex justify-center py-6">
          <span className="loading loading-spinner loading-md text-primary" />
        </div>
      ) : loggedIn && rows.length === 0 ? (
        <p className="mt-3 text-sm text-base-content/65">Brak powiadomień do wyświetlenia.</p>
      ) : (
        <ul className="mt-3 space-y-3">
          {rows.map((n) => (
            <li key={`${n.campaign_id}-${n.sort_ts}`} className="rounded-lg border border-base-content/10 bg-base-100/30 p-3">
              <p className="text-sm">{n.message}</p>
              <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
                <p className="text-xs text-base-content/60">{formatPlRelative(n.sort_ts)}</p>
                {n.campaign_id ? (
                  <a
                    href={`/campaigns/view?id=${encodeURIComponent(n.campaign_id)}`}
                    className="link link-primary text-xs"
                  >
                    Szczegóły kampanii
                  </a>
                ) : null}
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
