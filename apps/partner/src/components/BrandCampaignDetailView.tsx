import { useCallback, useEffect, useState } from 'react';
import { createClient } from '@supabase/supabase-js';
import type { SupabaseClient } from '@supabase/supabase-js';

type CampaignStatus = 'draft' | 'active' | 'applications_closed' | 'ended';

type CampaignDetail = {
  id: string;
  name: string;
  description: string | null;
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
};

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
  const [resolvedId, setResolvedId] = useState<string | null>(null);
  /** Po pierwszym odczycie propsa / ?id= w przeglądarce */
  const [idReady, setIdReady] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [campaign, setCampaign] = useState<CampaignDetail | null>(null);
  const [applications, setApplications] = useState<ApplicationRow[]>([]);

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

    const { data: camp, error: campError } = await client
      .from('campaigns')
      .select(
        'id,name,description,units_count,content_type,category,start_date,end_applications_date,end_date,status,auto_status_change,created_at,updated_at'
      )
      .eq('id', id)
      .maybeSingle();

    if (campError) {
      setError(campError.message);
      setCampaign(null);
      setApplications([]);
      setLoading(false);
      return;
    }

    if (!camp) {
      setError('Nie znaleziono kampanii lub nie masz do niej dostępu.');
      setCampaign(null);
      setApplications([]);
      setLoading(false);
      return;
    }

    setCampaign(camp as CampaignDetail);

    const { data: apps, error: appsError } = await client
      .from('campaign_applications')
      .select('id,status,deadline,publication_link,created_at,influencer_id')
      .eq('campaign_id', id)
      .order('created_at', { ascending: false });

    if (appsError) {
      setError(appsError.message);
      setApplications([]);
    } else {
      setApplications((apps ?? []) as ApplicationRow[]);
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
      return;
    }

    const client = createClient(supabaseUrl, supabaseAnonKey);
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
          <div
            className="mt-4 max-w-none text-sm leading-relaxed text-slate-300 [&_a]:text-emerald-300 [&_p]:my-2 [&_ul]:my-2 [&_ul]:list-disc [&_ul]:pl-5"
            dangerouslySetInnerHTML={{ __html: campaign.description }}
          />
        ) : (
          <p className="mt-3 text-sm text-slate-500">Brak opisu.</p>
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
          <h2 className="brand-heading text-lg font-semibold text-white">Zgłoszenia influencerów</h2>
          <span className="rounded-full border border-emerald-300/25 bg-emerald-500/10 px-2.5 py-1 text-xs text-emerald-200">
            {applications.length} w sumie
          </span>
        </div>
        {applications.length === 0 ? (
          <p className="text-sm text-slate-500">Brak zgłoszeń do tej kampanii.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="table table-sm">
              <thead>
                <tr className="border-white/10 text-slate-400">
                  <th className="bg-transparent">Uczestnik (ID)</th>
                  <th className="bg-transparent">Status</th>
                  <th className="bg-transparent">Zgłoszono</th>
                  <th className="bg-transparent">Deadline</th>
                  <th className="bg-transparent">Publikacja</th>
                </tr>
              </thead>
              <tbody>
                {applications.map((a) => (
                  <tr key={a.id} className="border-white/10">
                    <td className="font-mono text-xs text-slate-300" title={a.influencer_id}>
                      {shortId(a.influencer_id)}
                    </td>
                    <td className="text-slate-200">{APP_STATUS_LABEL[a.status] ?? a.status}</td>
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
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
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
