import { useCallback, useEffect, useState } from 'react';
import { createClient } from '@supabase/supabase-js';
import type { SupabaseClient } from '@supabase/supabase-js';
import {
  canManuallySelectInfluencers,
  INFLUENCER_DETAIL_LEVEL_BY_TIER,
  maxManualSelections,
  type SubscriptionTier,
} from '@influeapp/lib';
import CollapsibleClamp from './CollapsibleClamp';
import TierBlockedWybierzButton from './TierBlockedWybierzButton';

type CampaignStatus = 'draft' | 'active' | 'applications_closed' | 'ended';

type CampaignDetail = {
  id: string;
  name: string;
  description: string | null;
  presentation_inspiration: string | null;
  target_tester_description: string | null;
  units_count: number;
  content_type: string;
  category: string | null;
  start_date: string;
  end_applications_date: string;
  end_date: string;
  status: CampaignStatus;
  auto_status_change: boolean;
  created_at: string;
  updated_at: string;
};

type ApplicationRow = {
  id: string;
  status: string;
  deadline: string | null;
  publication_link: string | null;
  created_at: string;
  influencer_id: string;
  dedicated_self_description: string | null;
  pitch_text_at_submit: string | null;
  /** Tekst do wyświetlenia (snapshot przy zgłoszeniu). */
  resolvedPitch: string | null;
  pitchSource: 'dedicated' | 'profile' | 'empty';
  followers?: string;
  er?: string;
};

type TestReviewRow = {
  influencer_id: string;
  rating: number;
  review: string | null;
  social_post_urls: string[];
  updated_at: string;
};

type SubmissionsTabId = 'all' | 'selected_for_test' | 'reviews';

const STATUS_LABEL: Record<CampaignStatus, string> = {
  draft: 'Szkic',
  active: 'Aktywna',
  applications_closed: 'Zgłoszenia zamknięte',
  ended: 'Zakończona',
};

const APP_STATUS_LABEL: Record<string, string> = {
  applied: 'Zgłoszono',
  selected: 'Wybrano',
  preparation_for_shipping: 'Przygotowanie do wysyłki',
  publication: 'Publikacja',
  completed: 'Zakończono',
};

function formatPlDateTime(iso: string): string {
  try {
    return new Date(iso).toLocaleString('pl-PL', {
      day: 'numeric',
      month: 'long',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return iso;
  }
}

function shortId(id: string): string {
  return id.length > 12 ? `${id.slice(0, 8)}…` : id;
}

function StarRow({ rating }: { rating: number }) {
  const r = Math.min(5, Math.max(1, Math.round(Number(rating)) || 1));
  return (
    <span className="inline-flex items-center gap-1.5" title={`Ocena ${r}/5`}>
      <span className="text-amber-300/95" aria-hidden>
        {'★'.repeat(r)}
      </span>
      <span className="text-slate-600" aria-hidden>
        {'☆'.repeat(5 - r)}
      </span>
      <span className="text-xs text-slate-400">{r}/5</span>
    </span>
  );
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

function isSelectedProgress(status: string): boolean {
  return status !== 'applied';
}

interface BrandCampaignDetailViewProps {
  /** Opcjonalnie; bez propsa ID jest czytane z `?id=` (strona statyczna). */
  campaignId?: string;
  supabaseUrl: string;
  supabaseAnonKey: string;
}

export default function BrandCampaignDetailView({
  campaignId,
  supabaseUrl,
  supabaseAnonKey,
}: BrandCampaignDetailViewProps) {
  const [client, setClient] = useState<SupabaseClient | null>(null);
  const [resolvedId, setResolvedId] = useState<string | null>(null);
  /** Po pierwszym odczycie propsa / ?id= w przeglądarce */
  const [idReady, setIdReady] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [campaign, setCampaign] = useState<CampaignDetail | null>(null);
  const [applications, setApplications] = useState<ApplicationRow[]>([]);
  const [testReviews, setTestReviews] = useState<TestReviewRow[]>([]);
  const [reviewsLoadError, setReviewsLoadError] = useState<string | null>(null);
  const [submissionsTab, setSubmissionsTab] = useState<SubmissionsTabId>('all');
  const [tier, setTier] = useState<SubscriptionTier>('basic');
  const [subscriptionActive, setSubscriptionActive] = useState(false);

  useEffect(() => {
    const fromProp = campaignId?.trim();
    if (fromProp) {
      setResolvedId(fromProp);
    } else {
      const q = new URLSearchParams(window.location.search).get('id')?.trim();
      setResolvedId(q ?? null);
    }
    setIdReady(true);
  }, [campaignId]);

  useEffect(() => {
    setSubmissionsTab('all');
  }, [resolvedId]);

  const load = useCallback(async (client: SupabaseClient, id: string) => {
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
      .select('subscription_tier,subscription_active')
      .eq('profile_id', userId)
      .maybeSingle();

    if (brandError || !brandRow) {
      setError(brandError?.message ?? 'Brak profilu marki.');
      setLoading(false);
      return;
    }

    const st = (brandRow as { subscription_tier: SubscriptionTier }).subscription_tier ?? 'basic';
    const subActive = (brandRow as { subscription_active: boolean }).subscription_active ?? false;
    setTier(st);
    setSubscriptionActive(Boolean(subActive));

    const { data: camp, error: campError } = await client
      .from('campaigns')
      .select(
        'id,name,description,presentation_inspiration,target_tester_description,units_count,content_type,category,start_date,end_applications_date,end_date,status,auto_status_change,created_at,updated_at'
      )
      .eq('id', id)
      .maybeSingle();

    if (campError) {
      setError(campError.message);
      setCampaign(null);
      setApplications([]);
      setTestReviews([]);
      setReviewsLoadError(null);
      setLoading(false);
      return;
    }

    if (!camp) {
      setError('Nie znaleziono kampanii lub nie masz do niej dostępu.');
      setCampaign(null);
      setApplications([]);
      setTestReviews([]);
      setReviewsLoadError(null);
      setLoading(false);
      return;
    }

    setCampaign(camp as CampaignDetail);
    setReviewsLoadError(null);

    const [{ data: apps, error: appsError }, reviewsResult] = await Promise.all([
      client
        .from('campaign_applications')
        .select(
          'id,status,deadline,publication_link,created_at,influencer_id,dedicated_self_description,pitch_text_at_submit'
        )
        .eq('campaign_id', id)
        .order('created_at', { ascending: false }),
      client
        .from('campaign_influencer_test_reviews')
        .select('influencer_id,rating,review,social_post_urls,updated_at')
        .eq('campaign_id', id)
        .order('updated_at', { ascending: false }),
    ]);

    if (reviewsResult.error) {
      setTestReviews([]);
      setReviewsLoadError(reviewsResult.error.message);
    } else {
      const raw = (reviewsResult.data ?? []) as Array<{
        influencer_id: string;
        rating: number;
        review: string | null;
        social_post_urls?: string[] | null;
        updated_at: string;
      }>;
      setTestReviews(
        raw.map((r) => ({
          influencer_id: r.influencer_id,
          rating: r.rating,
          review: r.review,
          social_post_urls: Array.isArray(r.social_post_urls) ? r.social_post_urls : [],
          updated_at: r.updated_at,
        }))
      );
      setReviewsLoadError(null);
    }

    if (appsError) {
      setError(appsError.message);
      setApplications([]);
    } else {
      const list = ((apps ?? []) as ApplicationRow[]) ?? [];
      const infIds = [...new Set(list.map((a) => a.influencer_id))];

      let metrics = new Map<string, { followers_count: number | null; engagement_rate: number | null }>();
      const detailLevel = INFLUENCER_DETAIL_LEVEL_BY_TIER[st] ?? 'none';
      if (detailLevel !== 'none' && infIds.length > 0) {
        const { data: ipRows } = await client
          .from('influencer_profiles_public')
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
        const dedicated = (a.dedicated_self_description ?? '').trim() || null;
        const resolvedPitch = (a.pitch_text_at_submit ?? '').trim() || null;
        const pitchSource: ApplicationRow['pitchSource'] = dedicated
          ? 'dedicated'
          : resolvedPitch
            ? 'profile'
            : 'empty';
        return {
          ...a,
          resolvedPitch,
          pitchSource,
          followers: detailLevel === 'none' ? '—' : formatFollowers(m?.followers_count),
          er: detailLevel === 'none' ? '—' : formatEr(m?.engagement_rate ?? null),
        };
      });

      setApplications(merged);
    }

    setLoading(false);
  }, []);

  useEffect(() => {
    if (!idReady) return;

    if (!supabaseUrl?.trim() || !supabaseAnonKey?.trim()) {
      setError('Brak konfiguracji Supabase.');
      setLoading(false);
      return;
    }

    if (resolvedId === null) {
      setLoading(false);
      setError('Brak identyfikatora kampanii. Użyj adresu /campaigns/view?id=… (np. z dashboardu).');
      setCampaign(null);
      setApplications([]);
      setTestReviews([]);
      setReviewsLoadError(null);
      return;
    }

    const client = createClient(supabaseUrl, supabaseAnonKey);
    setClient(client);
    setLoading(true);
    load(client, resolvedId);
    const {
      data: { subscription },
    } = client.auth.onAuthStateChange(() => {
      setLoading(true);
      load(client, resolvedId);
    });
    return () => subscription.unsubscribe();
  }, [idReady, resolvedId, supabaseUrl, supabaseAnonKey, load]);

  if (!supabaseUrl?.trim() || !supabaseAnonKey?.trim()) {
    return (
      <div className="rounded-xl border border-rose-400/30 bg-rose-500/10 px-4 py-3 text-sm text-rose-200">
        Brak konfiguracji Supabase.
      </div>
    );
  }

  if (loading) {
    return (
      <div className="brand-glass p-8 text-center text-sm text-slate-400">Wczytywanie kampanii…</div>
    );
  }

  if (error && !campaign) {
    return (
      <div className="space-y-4">
        <a href="/dashboard" className="brand-link text-sm">
          ← Wróć do dashboardu
        </a>
        <div className="rounded-xl border border-rose-400/30 bg-rose-500/10 px-4 py-3 text-sm text-rose-200">{error}</div>
      </div>
    );
  }

  if (!campaign) {
    return null;
  }

  const statusLabel = STATUS_LABEL[campaign.status] ?? campaign.status;
  const detailLevel = INFLUENCER_DETAIL_LEVEL_BY_TIER[tier] ?? 'none';
  const showReach = detailLevel !== 'none';
  const canManual = subscriptionActive && canManuallySelectInfluencers(tier);
  const manualBlockedByTier = !canManuallySelectInfluencers(tier);
  const maxManual = maxManualSelections(tier, campaign.units_count);
  const selectedInProgress = applications.filter((a) => isSelectedProgress(a.status)).length;
  const remainingManual = Math.max(0, maxManual - selectedInProgress);
  const selectedForTesting = applications.filter((a) => isSelectedProgress(a.status));

  const onSelect = async (applicationId: string) => {
    if (!client) return;
    if (!canManual) {
      setError('Ręczna selekcja jest niedostępna w Twoim pakiecie lub abonament jest nieaktywny.');
      return;
    }
    if (remainingManual <= 0) {
      setError('Osiągnięto limit ręcznej selekcji w tym pakiecie dla tej kampanii.');
      return;
    }
    setError(null);
    const { error: upErr } = await client.rpc('brand_select_application', { application_id: applicationId });
    if (upErr) setError(upErr.message);
    else if (resolvedId) void load(client, resolvedId);
  };

  const onMoveToShipping = async (applicationId: string) => {
    if (!client) return;
    if (!subscriptionActive) {
      setError('Abonament nieaktywny.');
      return;
    }
    setError(null);
    const { error: upErr } = await client.rpc('brand_move_application_to_shipping', { application_id: applicationId });
    if (upErr) setError(upErr.message);
    else if (resolvedId) void load(client, resolvedId);
  };

  const tabButtonClass = (id: SubmissionsTabId) =>
    `rounded-t-lg px-3 py-2 text-sm font-medium transition-colors sm:px-4 ${
      submissionsTab === id
        ? 'border-b-2 border-emerald-400 text-white'
        : 'border-b-2 border-transparent text-slate-400 hover:text-slate-200'
    }`;

  const renderApplicationsTable = (rows: ApplicationRow[]) => (
    <div className="overflow-x-auto">
      <table className="table table-sm">
        <thead>
          <tr className="border-white/10 text-slate-400">
            <th className="bg-transparent">Uczestnik (ID)</th>
            {showReach ? (
              <>
                <th className="bg-transparent">Followers</th>
                <th className="bg-transparent">ER</th>
              </>
            ) : null}
            <th className="bg-transparent">Status</th>
            <th className="bg-transparent max-w-[220px]">Opis zgłoszenia</th>
            <th className="bg-transparent">Zgłoszono</th>
            <th className="bg-transparent">Deadline</th>
            <th className="bg-transparent">Publikacja</th>
            <th className="bg-transparent text-right">Akcje</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((a) => (
            <tr key={a.id} className="border-white/10">
              <td className="font-mono text-xs text-slate-300" title={a.influencer_id}>
                {shortId(a.influencer_id)}
              </td>
              {showReach ? (
                <>
                  <td className="text-slate-300">{a.followers ?? '—'}</td>
                  <td className="text-slate-300">{a.er ?? '—'}</td>
                </>
              ) : null}
              <td className="text-slate-200">{APP_STATUS_LABEL[a.status] ?? a.status}</td>
              <td className="max-w-[220px] align-top text-slate-300">
                {a.resolvedPitch ? (
                  <div className="space-y-1">
                    <span
                      className={`badge badge-xs ${
                        a.pitchSource === 'dedicated'
                          ? 'border-emerald-400/40 bg-emerald-500/15 text-emerald-100'
                          : 'border-white/15 bg-white/5 text-slate-300'
                      }`}
                    >
                      {a.pitchSource === 'dedicated' ? 'Dedykowany' : 'Z profilu'}
                    </span>
                    <CollapsibleClamp
                      variant="text"
                      text={a.resolvedPitch}
                      lines={2}
                      contentClassName="text-xs leading-relaxed text-slate-300"
                    />
                  </div>
                ) : (
                  <span className="text-slate-500">—</span>
                )}
              </td>
              <td className="text-slate-400">{formatPlDateTime(a.created_at)}</td>
              <td className="text-slate-400">{a.deadline ? formatPlDateTime(a.deadline) : '—'}</td>
              <td className="max-w-[180px] truncate">
                {a.publication_link ? (
                  <a
                    href={a.publication_link}
                    target="_blank"
                    rel="noreferrer"
                    className="text-emerald-300 underline hover:text-emerald-200"
                  >
                    link
                  </a>
                ) : (
                  '—'
                )}
              </td>
              <td className="text-right">
                {a.status === 'applied' ? (
                  manualBlockedByTier ? (
                    <TierBlockedWybierzButton applicationId={a.id} resetKey={resolvedId ?? ''} />
                  ) : (
                    <button
                      type="button"
                      className="brand-cta-outline text-xs"
                      onClick={() => onSelect(a.id)}
                      disabled={!canManual || remainingManual <= 0}
                      title={
                        !subscriptionActive
                          ? 'Abonament nieaktywny'
                          : remainingManual <= 0
                            ? 'Osiągnięto limit ręcznych wyborów'
                            : 'Dodaj do shortlisty'
                      }
                    >
                      Wybierz
                    </button>
                  )
                ) : a.status === 'selected' ? (
                  <button
                    type="button"
                    className="brand-cta text-xs"
                    onClick={() => onMoveToShipping(a.id)}
                    disabled={!subscriptionActive}
                    title={!subscriptionActive ? 'Abonament nieaktywny' : 'Przejdź do przygotowania wysyłki'}
                  >
                    Do wysyłki
                  </button>
                ) : (
                  <span className="text-xs text-slate-500">—</span>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      {!showReach ? (
        <p className="mt-3 text-xs text-slate-500">
          W pakiecie Basic podgląd metryk (followers/ER) jest niedostępny przed decyzją.
        </p>
      ) : null}
    </div>
  );

  return (
    <div className="space-y-6">
      <div>
        <a href="/dashboard" className="brand-link text-sm">
          ← Wróć do dashboardu
        </a>
        <div className="mt-4 flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-emerald-300/90">Podgląd kampanii</p>
            <h1 className="brand-heading mt-2 text-2xl font-bold text-white sm:text-3xl">{campaign.name}</h1>
          </div>
          <span className="rounded-full border border-violet-300/30 bg-violet-500/10 px-3 py-1.5 text-sm text-violet-200">
            {statusLabel}
          </span>
        </div>
        <div className="mt-3 flex flex-wrap gap-2">
          {campaign.category ? (
            <span className="rounded-full border border-white/15 bg-white/5 px-3 py-1 text-xs text-slate-200">
              {campaign.category}
            </span>
          ) : null}
          <span className="rounded-full border border-white/15 bg-white/5 px-3 py-1 text-xs text-slate-200">
            {campaign.content_type}
          </span>
          <span className="rounded-full border border-white/15 bg-white/5 px-3 py-1 text-xs text-slate-200">
            {campaign.units_count} szt.
          </span>
        </div>
      </div>

      {error ? (
        <div className="rounded-xl border border-amber-400/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-100">{error}</div>
      ) : null}

      <section className="brand-glass p-5 sm:p-6">
        <h2 className="brand-heading text-lg font-semibold text-white">Opis</h2>
        {campaign.description ? (
          <CollapsibleClamp
            variant="html"
            html={campaign.description}
            lines={4}
            contentClassName="max-w-none text-sm leading-relaxed text-slate-300 [&_a]:text-emerald-300 [&_p]:my-2 [&_ul]:my-2 [&_ul]:list-disc [&_ul]:pl-5"
          />
        ) : (
          <p className="mt-3 text-sm text-slate-500">Brak opisu.</p>
        )}
      </section>

      <section className="brand-glass p-5 sm:p-6">
        <h2 className="brand-heading text-lg font-semibold text-white">Inspiracje na prezentację (widok testerów)</h2>
        <p className="mt-1 text-xs text-slate-500">
          To samo zobaczą uczestnicy na stronie kampanii — opcjonalne podpowiedzi, nie wymóg określonej formy treści.
        </p>
        {campaign.presentation_inspiration?.trim() ? (
          <CollapsibleClamp
            variant="text"
            text={campaign.presentation_inspiration}
            lines={4}
            contentClassName="text-sm leading-relaxed text-slate-300"
          />
        ) : (
          <p className="mt-3 text-sm text-slate-500">
            Nie uzupełniono — możesz dodać treść w{' '}
            <a href={`/campaigns/edit?id=${encodeURIComponent(campaign.id)}`} className="text-emerald-300 underline hover:text-emerald-200">
              edycji kampanii
            </a>
            .
          </p>
        )}
      </section>

      <section className="brand-glass p-5 sm:p-6">
        <h2 className="brand-heading text-lg font-semibold text-white">Oczekiwania co do uczestników (AI)</h2>
        {campaign.target_tester_description?.trim() ? (
          <CollapsibleClamp
            variant="text"
            text={campaign.target_tester_description}
            lines={4}
            contentClassName="text-sm leading-relaxed text-slate-300"
          />
        ) : (
          <p className="mt-3 text-sm text-slate-500">
            Nie uzupełniono — możesz dodać opis w{' '}
            <a href={`/campaigns/edit?id=${encodeURIComponent(campaign.id)}`} className="text-emerald-300 underline hover:text-emerald-200">
              edycji kampanii
            </a>
            .
          </p>
        )}
      </section>

      <section className="brand-glass p-5 sm:p-6">
        <h2 className="brand-heading text-lg font-semibold text-white">Harmonogram</h2>
        <dl className="mt-4 grid gap-4 text-sm sm:grid-cols-2">
          <div>
            <dt className="text-slate-500">Start</dt>
            <dd className="mt-1 font-medium text-slate-200">{formatPlDateTime(campaign.start_date)}</dd>
          </div>
          <div>
            <dt className="text-slate-500">Koniec zbierania zgłoszeń</dt>
            <dd className="mt-1 font-medium text-slate-200">{formatPlDateTime(campaign.end_applications_date)}</dd>
          </div>
          <div>
            <dt className="text-slate-500">Koniec kampanii</dt>
            <dd className="mt-1 font-medium text-slate-200">{formatPlDateTime(campaign.end_date)}</dd>
          </div>
          <div>
            <dt className="text-slate-500">Auto status (wg dat)</dt>
            <dd className="mt-1 font-medium text-slate-200">{campaign.auto_status_change ? 'Tak' : 'Nie'}</dd>
          </div>
          <div className="sm:col-span-2">
            <dt className="text-slate-500">Utworzono / aktualizacja</dt>
            <dd className="mt-1 text-slate-400">
              {formatPlDateTime(campaign.created_at)} · {formatPlDateTime(campaign.updated_at)}
            </dd>
          </div>
        </dl>
      </section>

      <section className="brand-glass p-5 sm:p-6">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
          <div>
            <h2 className="brand-heading text-lg font-semibold text-white">Zgłoszenia influencerów</h2>
            <p className="mt-1 text-xs text-slate-400">
              Pakiet: <span className="font-semibold text-slate-200">{tier.toUpperCase()}</span> · Ręczny wybór:{' '}
              <span className="font-semibold text-slate-200">
                {canManuallySelectInfluencers(tier) ? `${selectedInProgress}/${maxManual}` : 'Niedostępny'}
              </span>
            </p>
            {!subscriptionActive ? <p className="mt-1 text-xs text-amber-200/90">Abonament nieaktywny</p> : null}
          </div>
          <span className="rounded-full border border-emerald-300/25 bg-emerald-500/10 px-2.5 py-1 text-xs text-emerald-200">
            {applications.length} w sumie
          </span>
        </div>

        <div className="mb-4 flex flex-wrap gap-1 border-b border-white/10">
          <button type="button" className={tabButtonClass('all')} onClick={() => setSubmissionsTab('all')}>
            Wszystkie ({applications.length})
          </button>
          <button
            type="button"
            className={tabButtonClass('selected_for_test')}
            onClick={() => setSubmissionsTab('selected_for_test')}
          >
            Wybrani do testowania ({selectedForTesting.length})
          </button>
          <button type="button" className={tabButtonClass('reviews')} onClick={() => setSubmissionsTab('reviews')}>
            Opinie z testów ({testReviews.length})
          </button>
        </div>

        {submissionsTab === 'reviews' ? (
          reviewsLoadError ? (
            <div className="rounded-lg border border-rose-400/30 bg-rose-500/10 px-4 py-3 text-sm text-rose-100">
              Nie udało się wczytać opinii: {reviewsLoadError}
            </div>
          ) : testReviews.length === 0 ? (
            <p className="text-sm text-slate-500">
              Żaden tester nie wystawił jeszcze opinii (ocena i opis po zakończeniu testu pojawią się tutaj).
            </p>
          ) : (
            <ul className="space-y-4">
              {testReviews.map((rev) => (
                <li
                  key={rev.influencer_id}
                  className="rounded-xl border border-white/10 bg-white/[0.03] p-4 sm:p-5"
                >
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <p className="text-xs uppercase tracking-wide text-slate-500">Uczestnik (ID)</p>
                      <p className="font-mono text-sm text-slate-200" title={rev.influencer_id}>
                        {shortId(rev.influencer_id)}
                      </p>
                    </div>
                    <StarRow rating={rev.rating} />
                  </div>
                  {rev.review?.trim() ? (
                    <div className="mt-3">
                      <p className="text-xs uppercase tracking-wide text-slate-500">Opinia</p>
                      <CollapsibleClamp
                        variant="text"
                        text={rev.review}
                        lines={4}
                        contentClassName="mt-1 text-sm leading-relaxed text-slate-300"
                      />
                    </div>
                  ) : (
                    <p className="mt-3 text-sm text-slate-500">Bez tekstowej opinii (tylko ocena).</p>
                  )}
                  {rev.social_post_urls.length > 0 ? (
                    <div className="mt-3">
                      <p className="text-xs uppercase tracking-wide text-slate-500">Posty (social)</p>
                      <ul className="mt-1 space-y-1">
                        {rev.social_post_urls.map((url, i) => (
                          <li key={`${rev.influencer_id}-link-${i}`}>
                            <a
                              href={url}
                              target="_blank"
                              rel="noreferrer"
                              className="break-all text-sm text-emerald-300 underline hover:text-emerald-200"
                            >
                              {url}
                            </a>
                          </li>
                        ))}
                      </ul>
                    </div>
                  ) : null}
                  <p className="mt-3 text-xs text-slate-500">Ostatnia aktualizacja: {formatPlDateTime(rev.updated_at)}</p>
                </li>
              ))}
            </ul>
          )
        ) : applications.length === 0 ? (
          <p className="text-sm text-slate-500">Brak zgłoszeń do tej kampanii.</p>
        ) : submissionsTab === 'selected_for_test' && selectedForTesting.length === 0 ? (
          <p className="text-sm text-slate-500">Nikt nie został jeszcze wybrany do testowania (status „Zgłoszono”).</p>
        ) : (
          renderApplicationsTable(submissionsTab === 'all' ? applications : selectedForTesting)
        )}
      </section>

      <div className="flex flex-wrap gap-3">
        <a
          href={`/campaigns/edit?id=${encodeURIComponent(campaign.id)}`}
          className="brand-cta text-sm"
        >
          Edytuj kampanię
        </a>
        <a href="/campaigns/new" className="brand-cta-outline text-sm">
          + Nowa kampania
        </a>
      </div>
    </div>
  );
}
