import { useCallback, useEffect, useState } from 'react';
import { createClient } from '@supabase/supabase-js';
import type { SupabaseClient } from '@supabase/supabase-js';

const APP_STATUS_LABEL: Record<string, string> = {
  applied: 'Zgłoszono',
  selected: 'Wybrano',
  preparation_for_shipping: 'Przygotowanie do wysyłki',
  publication: 'Publikacja',
  completed: 'Zakończono',
};

function shortProfileId(id: string): string {
  return id.length > 10 ? `${id.slice(0, 6)}…${id.slice(-4)}` : id;
}

function formatFollowers(n: number | null | undefined): string {
  if (n == null || Number.isNaN(n)) return '—';
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}k`;
  return String(n);
}

function formatEr(rate: number | null | undefined): string {
  if (rate == null || Number.isNaN(rate)) return '—';
  const pct = rate <= 1 ? rate * 100 : rate;
  return `${pct.toFixed(1)}%`;
}

type CampaignNameCell = { name: string } | { name: string }[] | null;

type AppRow = {
  id: string;
  status: string;
  created_at: string;
  influencer_id: string;
  campaigns: CampaignNameCell;
};

interface BrandDashboardRecentApplicationsProps {
  supabaseUrl: string;
  supabaseAnonKey: string;
}

function resolveCampaignName(c: CampaignNameCell): string {
  if (!c) return 'Kampania';
  if (Array.isArray(c)) return c[0]?.name ?? 'Kampania';
  return c.name ?? 'Kampania';
}

export default function BrandDashboardRecentApplications({
  supabaseUrl,
  supabaseAnonKey,
}: BrandDashboardRecentApplicationsProps) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [rows, setRows] = useState<
    Array<{
      id: string;
      status: string;
      influencer_id: string;
      campaignName: string;
      followers: string;
      er: string;
    }>
  >([]);

  const load = useCallback(async (client: SupabaseClient) => {
    setError(null);

    const { data: sessionData, error: sessionError } = await client.auth.getSession();
    if (sessionError || !sessionData.session?.user?.id) {
      setError('Brak sesji.');
      setLoading(false);
      return;
    }

    const userId = sessionData.session.user.id;

    const { data: profile } = await client.from('profiles').select('account_type').eq('id', userId).maybeSingle();
    if ((profile as { account_type?: string } | null)?.account_type !== 'brand') {
      setError('To konto nie ma roli marki.');
      setLoading(false);
      return;
    }

    const { data: brandRow, error: brandError } = await client
      .from('brands')
      .select('id')
      .eq('profile_id', userId)
      .maybeSingle();

    if (brandError || !brandRow) {
      setError(brandError?.message ?? 'Brak profilu marki.');
      setLoading(false);
      return;
    }

    const brandId = (brandRow as { id: string }).id;

    const { data: campaignIdsRows, error: idsErr } = await client.from('campaigns').select('id').eq('brand_id', brandId);

    if (idsErr) {
      setError(idsErr.message);
      setRows([]);
      setLoading(false);
      return;
    }

    const campaignIds = (campaignIdsRows ?? []).map((r) => (r as { id: string }).id);
    if (campaignIds.length === 0) {
      setRows([]);
      setLoading(false);
      return;
    }

    const { data: apps, error: appsErr } = await client
      .from('campaign_applications')
      .select('id,status,created_at,influencer_id,campaigns(name)')
      .in('campaign_id', campaignIds)
      .order('created_at', { ascending: false })
      .limit(8);

    if (appsErr) {
      setError(appsErr.message);
      setRows([]);
      setLoading(false);
      return;
    }

    const list = (apps ?? []) as unknown as AppRow[];
    const infIds = [...new Set(list.map((a) => a.influencer_id))];

    let metrics = new Map<string, { followers_count: number | null; engagement_rate: number | null }>();
    if (infIds.length > 0) {
      const { data: ipRows } = await client
        .from('influencer_profiles')
        .select('profile_id,followers_count,engagement_rate')
        .in('profile_id', infIds);
      metrics = new Map(
        (ipRows ?? []).map((r) => {
          const row = r as {
            profile_id: string;
            followers_count: number | null;
            engagement_rate: number | string | null;
          };
          return [
            row.profile_id,
            {
              followers_count: row.followers_count,
              engagement_rate: row.engagement_rate != null ? Number(row.engagement_rate) : null,
            },
          ];
        })
      );
    }

    const merged = list.map((a) => {
      const m = metrics.get(a.influencer_id);
      return {
        id: a.id,
        status: a.status,
        influencer_id: a.influencer_id,
        campaignName: resolveCampaignName(a.campaigns),
        followers: formatFollowers(m?.followers_count),
        er: formatEr(m?.engagement_rate ?? null),
      };
    });

    setRows(merged);
    setLoading(false);
  }, []);

  useEffect(() => {
    if (!supabaseUrl?.trim() || !supabaseAnonKey?.trim()) {
      setError('Brak konfiguracji Supabase.');
      setLoading(false);
      return;
    }
    const client = createClient(supabaseUrl, supabaseAnonKey);
    setLoading(true);
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
      <div className="rounded-xl border border-rose-400/30 bg-rose-500/10 px-4 py-3 text-sm text-rose-200">
        Brak konfiguracji Supabase.
      </div>
    );
  }

  return (
    <article className="brand-glass p-5">
      <h2 className="brand-heading text-lg font-semibold text-white sm:text-xl">Najnowsze zgłoszenia</h2>
      {error ? (
        <p className="mt-4 text-sm text-rose-300">{error}</p>
      ) : loading ? (
        <p className="mt-4 text-sm text-slate-500">Wczytywanie…</p>
      ) : rows.length === 0 ? (
        <p className="mt-4 text-sm text-slate-500">Brak zgłoszeń do Twoich kampanii.</p>
      ) : (
        <div className="mt-4 space-y-3">
          {rows.map((application) => {
            const stLabel = APP_STATUS_LABEL[application.status] ?? application.status;
            return (
              <div key={application.id} className="rounded-xl border border-white/10 bg-white/5 p-4">
                <div className="flex items-center justify-between gap-3">
                  <p
                    className="font-mono text-sm font-medium text-white"
                    title={application.influencer_id}
                  >
                    {shortProfileId(application.influencer_id)}
                  </p>
                  <span className="text-xs text-emerald-200">{stLabel}</span>
                </div>
                <p className="mt-2 text-xs text-slate-300">{application.campaignName}</p>
                <div className="mt-2 flex gap-4 text-xs text-slate-300">
                  <span>Followers: {application.followers}</span>
                  <span>ER: {application.er}</span>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </article>
  );
}
