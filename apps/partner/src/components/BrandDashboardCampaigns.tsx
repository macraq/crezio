import { useCallback, useEffect, useState } from 'react';
import { createClient } from '@supabase/supabase-js';
import type { SupabaseClient } from '@supabase/supabase-js';
import { CAMPAIGN_LIMITS, type SubscriptionTier } from '@influeapp/lib';

type CampaignStatus = 'draft' | 'active' | 'applications_closed' | 'ended';

type CampaignRow = {
  id: string;
  name: string;
  content_type: string;
  status: CampaignStatus;
  end_applications_date: string;
  end_date: string;
  units_count: number;
  auto_status_change: boolean;
};

type ApplicationRow = {
  campaign_id: string;
  status: string;
};

const STATUS_LABEL: Record<CampaignStatus, string> = {
  draft: 'Szkic',
  active: 'Aktywna',
  applications_closed: 'Zgłoszenia zamknięte',
  ended: 'Zakończona',
};

const ACTIVE_STATUSES: CampaignStatus[] = ['draft', 'active', 'applications_closed'];

function formatPlDate(iso: string): string {
  try {
    return new Date(iso).toLocaleDateString('pl-PL', {
      day: 'numeric',
      month: 'numeric',
      year: 'numeric',
    });
  } catch {
    return iso;
  }
}

function isSelectedProgress(status: string): boolean {
  return status !== 'applied';
}

interface BrandDashboardCampaignsProps {
  supabaseUrl: string;
  supabaseAnonKey: string;
}

export default function BrandDashboardCampaigns({ supabaseUrl, supabaseAnonKey }: BrandDashboardCampaignsProps) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [tier, setTier] = useState<SubscriptionTier>('basic');
  const [campaigns, setCampaigns] = useState<CampaignRow[]>([]);
  const [appCounts, setAppCounts] = useState<Record<string, { total: number; selected: number }>>({});

  const load = useCallback(async (client: SupabaseClient) => {
    setError(null);
    const { data: sessionData, error: sessionError } = await client.auth.getSession();
    if (sessionError || !sessionData.session?.user?.id) {
      setError('Brak sesji. Odśwież stronę lub zaloguj się ponownie.');
      setLoading(false);
      return;
    }

    const userId = sessionData.session.user.id;

    const { data: profile, error: profileError } = await client
      .from('profiles')
      .select('account_type')
      .eq('id', userId)
      .maybeSingle();

    if (profileError || (profile as { account_type?: string } | null)?.account_type !== 'brand') {
      setError('To konto nie ma roli marki.');
      setLoading(false);
      return;
    }

    const { data: brandRow, error: brandError } = await client
      .from('brands')
      .select('id,subscription_tier')
      .eq('profile_id', userId)
      .maybeSingle();

    if (brandError || !brandRow) {
      setError(brandError?.message ?? 'Nie znaleziono profilu marki.');
      setLoading(false);
      return;
    }

    const brandId = (brandRow as { id: string; subscription_tier: SubscriptionTier }).id;
    setTier((brandRow as { subscription_tier: SubscriptionTier }).subscription_tier ?? 'basic');

    const { data: campData, error: campError } = await client
      .from('campaigns')
      .select(
        'id,name,content_type,status,end_applications_date,end_date,units_count,auto_status_change'
      )
      .eq('brand_id', brandId)
      .in('status', ACTIVE_STATUSES)
      .order('created_at', { ascending: false });

    if (campError) {
      setError(campError.message);
      setCampaigns([]);
      setAppCounts({});
      setLoading(false);
      return;
    }

    const rows = (campData ?? []) as CampaignRow[];
    setCampaigns(rows);

    const ids = rows.map((c) => c.id);
    if (ids.length === 0) {
      setAppCounts({});
      setLoading(false);
      return;
    }

    const { data: appsData, error: appsError } = await client
      .from('campaign_applications')
      .select('campaign_id,status')
      .in('campaign_id', ids);

    if (appsError) {
      setError(appsError.message);
      setAppCounts({});
      setLoading(false);
      return;
    }

    const apps = (appsData ?? []) as ApplicationRow[];
    const map: Record<string, { total: number; selected: number }> = {};
    for (const id of ids) {
      map[id] = { total: 0, selected: 0 };
    }
    for (const a of apps) {
      const m = map[a.campaign_id];
      if (!m) continue;
      m.total += 1;
      if (isSelectedProgress(a.status)) m.selected += 1;
    }
    setAppCounts(map);
    setLoading(false);
  }, []);

  useEffect(() => {
    if (!supabaseUrl?.trim() || !supabaseAnonKey?.trim()) {
      setError('Brak konfiguracji Supabase.');
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

  const limit = CAMPAIGN_LIMITS[tier] ?? 1;
  const inUse = campaigns.length;

  return (
    <article className="brand-glass p-5">
      <div className="mb-4 flex items-center justify-between gap-3">
        <h2 className="brand-heading text-lg font-semibold text-white sm:text-xl">Aktywne kampanie</h2>
        <span className="rounded-full border border-emerald-300/30 bg-emerald-500/10 px-3 py-1 text-xs text-emerald-200">
          {loading ? '…' : `${inUse}/${limit} w użyciu`}
        </span>
      </div>

      {error ? (
        <div className="rounded-xl border border-rose-400/30 bg-rose-500/10 px-4 py-3 text-sm text-rose-200">{error}</div>
      ) : loading ? (
        <p className="text-sm text-slate-400">Wczytywanie kampanii…</p>
      ) : campaigns.length === 0 ? (
        <p className="text-sm text-slate-400">
          Brak aktywnych kampanii (szkiców i trwających).{' '}
          <a href="/campaigns/new" className="text-emerald-300 underline hover:text-emerald-200">
            Utwórz kampanię
          </a>
        </p>
      ) : (
        <div className="space-y-3">
          {campaigns.map((campaign) => {
            const counts = appCounts[campaign.id] ?? { total: 0, selected: 0 };
            const statusLabel = STATUS_LABEL[campaign.status] ?? campaign.status;
            return (
              <div
                key={campaign.id}
                className="rounded-xl border border-white/10 bg-white/5 p-4"
              >
                <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <h3 className="text-base font-semibold text-white">
                      <a
                        href={`/campaigns/view?id=${encodeURIComponent(campaign.id)}`}
                        className="hover:text-emerald-200"
                      >
                        {campaign.name}
                      </a>
                    </h3>
                    <a
                      href={`/campaigns/view?id=${encodeURIComponent(campaign.id)}`}
                      className="mt-1 inline-block text-xs font-medium text-emerald-300 hover:text-emerald-200 hover:underline"
                    >
                      Szczegóły kampanii →
                    </a>
                  </div>
                  <span className="rounded-full border border-violet-300/30 bg-violet-500/10 px-2.5 py-1 text-xs text-violet-200">
                    {statusLabel}
                  </span>
                </div>
                <p className="mt-2 text-sm text-slate-300">{campaign.content_type}</p>
                <div className="mt-3 grid gap-2 text-xs text-slate-300 sm:grid-cols-4">
                  <span>Zgłoszenia: {counts.total}</span>
                  <span>Wybrani / w toku: {counts.selected}</span>
                  <span>Deadline zgłoszeń: {formatPlDate(campaign.end_applications_date)}</span>
                  <span>{campaign.auto_status_change ? 'Auto status: TAK' : 'Auto status: NIE'}</span>
                </div>
                <div className="mt-3">
                  <a
                    href={`/campaigns/edit?id=${encodeURIComponent(campaign.id)}`}
                    className="text-xs font-medium text-emerald-300 hover:text-emerald-200 hover:underline"
                  >
                    Edytuj kampanię
                  </a>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </article>
  );
}
