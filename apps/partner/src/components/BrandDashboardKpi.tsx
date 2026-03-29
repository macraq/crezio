import { useCallback, useEffect, useState } from 'react';
import { createClient } from '@supabase/supabase-js';
import type { SupabaseClient } from '@supabase/supabase-js';
import { CAMPAIGN_LIMITS, type SubscriptionTier } from '@influeapp/lib';

const ACTIVE_CAMPAIGN_STATUSES = ['draft', 'active', 'applications_closed'] as const;

interface BrandDashboardKpiProps {
  supabaseUrl: string;
  supabaseAnonKey: string;
}

export default function BrandDashboardKpi({ supabaseUrl, supabaseAnonKey }: BrandDashboardKpiProps) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [tier, setTier] = useState<SubscriptionTier>('basic');
  const [subscriptionActive, setSubscriptionActive] = useState(false);
  const [activeCampaignsInUse, setActiveCampaignsInUse] = useState(0);
  const [campaignLimit, setCampaignLimit] = useState(1);

  const [openApplications, setOpenApplications] = useState(0);
  const [prepShippingCount, setPrepShippingCount] = useState(0);
  const [endedCampaigns, setEndedCampaigns] = useState(0);

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
      .select('id,subscription_tier,subscription_active')
      .eq('profile_id', userId)
      .maybeSingle();

    if (brandError || !brandRow) {
      setError(brandError?.message ?? 'Brak profilu marki.');
      setLoading(false);
      return;
    }

    const brandId = (brandRow as { id: string }).id;
    const st = (brandRow as { subscription_tier: SubscriptionTier; subscription_active: boolean }).subscription_tier;
    const subActive = (brandRow as { subscription_active: boolean }).subscription_active;

    setTier(st ?? 'basic');
    setSubscriptionActive(subActive);
    setCampaignLimit(CAMPAIGN_LIMITS[st] ?? 1);

    const { count: activeCnt, error: activeErr } = await client
      .from('campaigns')
      .select('*', { count: 'exact', head: true })
      .eq('brand_id', brandId)
      .in('status', [...ACTIVE_CAMPAIGN_STATUSES]);

    if (activeErr) {
      setError(activeErr.message);
      setLoading(false);
      return;
    }
    setActiveCampaignsInUse(activeCnt ?? 0);

    const { count: endedCnt, error: endedErr } = await client
      .from('campaigns')
      .select('*', { count: 'exact', head: true })
      .eq('brand_id', brandId)
      .eq('status', 'ended');

    if (!endedErr) {
      setEndedCampaigns(endedCnt ?? 0);
    }

    const { data: campaignIdsRows, error: idsErr } = await client.from('campaigns').select('id').eq('brand_id', brandId);

    if (idsErr) {
      setError(idsErr.message);
      setLoading(false);
      return;
    }

    const campaignIds = (campaignIdsRows ?? []).map((r) => (r as { id: string }).id);

    if (campaignIds.length === 0) {
      setOpenApplications(0);
      setPrepShippingCount(0);
      setLoading(false);
      return;
    }

    const { count: openCnt, error: openErr } = await client
      .from('campaign_applications')
      .select('*', { count: 'exact', head: true })
      .in('campaign_id', campaignIds)
      .in('status', ['applied', 'selected']);

    if (!openErr) {
      setOpenApplications(openCnt ?? 0);
    }

    const { count: prepCnt, error: prepErr } = await client
      .from('campaign_applications')
      .select('*', { count: 'exact', head: true })
      .in('campaign_id', campaignIds)
      .eq('status', 'preparation_for_shipping');

    if (!prepErr) {
      setPrepShippingCount(prepCnt ?? 0);
    }

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

  const tierLabel =
    tier === 'basic' ? 'Basic' : tier === 'medium' ? 'Medium' : tier === 'platinum' ? 'Platinum' : tier;

  if (!supabaseUrl?.trim() || !supabaseAnonKey?.trim()) {
    return (
      <div className="rounded-xl border border-rose-400/30 bg-rose-500/10 px-4 py-3 text-sm text-rose-200">
        Brak konfiguracji Supabase.
      </div>
    );
  }

  return (
    <>
      <section className="mt-5 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <article className="brand-glass p-4">
          <p className="text-xs uppercase tracking-wider text-slate-400">Pakiet</p>
          {loading ? (
            <p className="mt-2 text-sm text-slate-500">Wczytywanie…</p>
          ) : (
            <>
              <p className="mt-2 text-xl font-semibold text-white">{tierLabel}</p>
              <p className="mt-1 text-sm text-slate-300">
                Limit kampanii: {activeCampaignsInUse}/{campaignLimit}
              </p>
              {!subscriptionActive ? (
                <p className="mt-2 text-xs text-amber-200/90">Abonament nieaktywny</p>
              ) : null}
            </>
          )}
        </article>
        <article className="brand-glass p-4">
          <p className="text-xs uppercase tracking-wider text-slate-400">Zgłoszenia</p>
          {loading ? (
            <p className="mt-2 text-sm text-slate-500">Wczytywanie…</p>
          ) : (
            <>
              <p className="mt-2 text-xl font-semibold text-white">{openApplications}</p>
              <p className="mt-1 text-sm text-slate-300">Zgłoszono lub wybrano (w toku)</p>
            </>
          )}
        </article>
        <article className="brand-glass p-4">
          <p className="text-xs uppercase tracking-wider text-slate-400">Wybrani influencerzy</p>
          {loading ? (
            <p className="mt-2 text-sm text-slate-500">Wczytywanie…</p>
          ) : (
            <>
              <p className="mt-2 text-xl font-semibold text-white">{prepShippingCount}</p>
              <p className="mt-1 text-sm text-slate-300">Przygotowanie do wysyłki</p>
            </>
          )}
        </article>
        <article className="brand-glass p-4">
          <p className="text-xs uppercase tracking-wider text-slate-400">Zakończone kampanie</p>
          {loading ? (
            <p className="mt-2 text-sm text-slate-500">Wczytywanie…</p>
          ) : (
            <>
              <p className="mt-2 text-xl font-semibold text-white">{endedCampaigns}</p>
              <p className="mt-1 text-sm text-slate-300">Status: zakończona</p>
            </>
          )}
        </article>
      </section>

      {error ? (
        <div className="mt-4 rounded-xl border border-rose-400/30 bg-rose-500/10 px-4 py-3 text-sm text-rose-200">
          {error}
        </div>
      ) : null}
    </>
  );
}
