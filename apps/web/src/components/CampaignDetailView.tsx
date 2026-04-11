import { useCallback, useEffect, useState } from 'react';
import { createClient } from '@supabase/supabase-js';
import type { SupabaseClient, User } from '@supabase/supabase-js';

type CampaignDetail = {
  id: string;
  name: string;
  description: string | null;
  presentation_inspiration: string | null;
  units_count: number;
  content_type: string;
  category: string | null;
  start_date: string;
  end_applications_date: string;
  end_date: string;
  status: string;
  auto_status_change: boolean;
  brands: { name: string } | { name: string }[] | null;
};

interface CampaignDetailViewProps {
  /** Opcjonalnie; bez propsa ID jest czytane z `?id=` (build statyczny). */
  campaignId?: string;
  supabaseUrl: string;
  supabaseAnonKey: string;
}

function resolveBrandName(brands: CampaignDetail['brands']): string {
  if (!brands) return 'Marka';
  if (Array.isArray(brands)) return brands[0]?.name ?? 'Marka';
  return brands.name ?? 'Marka';
}

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

const STATUS_LABEL: Record<string, string> = {
  draft: 'Szkic',
  active: 'Aktywna',
  applications_closed: 'Zgłoszenia zamknięte',
  ended: 'Zakończona',
};

export default function CampaignDetailView({ campaignId, supabaseUrl, supabaseAnonKey }: CampaignDetailViewProps) {
  const [resolvedId, setResolvedId] = useState<string | null>(null);
  const [idReady, setIdReady] = useState(false);
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [campaign, setCampaign] = useState<CampaignDetail | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [applied, setApplied] = useState(false);
  const [applying, setApplying] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

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

  const load = useCallback(async (client: SupabaseClient, uid: string | undefined, id: string) => {
    setLoadError(null);
    setMessage(null);

    const { data, error } = await client
      .from('campaigns')
      .select(
        'id,name,description,presentation_inspiration,units_count,content_type,category,start_date,end_applications_date,end_date,status,auto_status_change,brands(name)'
      )
      .eq('id', id)
      .maybeSingle();

    if (error) {
      setLoadError(error.message);
      setCampaign(null);
      setLoading(false);
      return;
    }

    if (!data) {
      setLoadError('Nie znaleziono kampanii lub nie masz do niej dostępu.');
      setCampaign(null);
      setLoading(false);
      return;
    }

    setCampaign(data as unknown as CampaignDetail);

    if (uid) {
      const { data: app } = await client
        .from('campaign_applications')
        .select('id')
        .eq('campaign_id', id)
        .eq('influencer_id', uid)
        .maybeSingle();
      setApplied(!!app);
    } else {
      setApplied(false);
    }

    setLoading(false);
  }, []);

  useEffect(() => {
    if (!idReady) return;

    if (!supabaseUrl?.trim() || !supabaseAnonKey?.trim()) {
      setLoading(false);
      setLoadError('Brak konfiguracji Supabase.');
      return;
    }

    if (resolvedId === null) {
      setLoading(false);
      setLoadError('Brak identyfikatora kampanii. Otwórz link z listy kampanii (?id=…).');
      setCampaign(null);
      return;
    }

    const supabase = createClient(supabaseUrl, supabaseAnonKey);
    setLoading(true);
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null);
      load(supabase, session?.user?.id, resolvedId);
    });
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_e, session) => {
      setUser(session?.user ?? null);
      setLoading(true);
      load(supabase, session?.user?.id, resolvedId);
    });
    return () => subscription.unsubscribe();
  }, [idReady, resolvedId, supabaseUrl, supabaseAnonKey, load]);

  const now = Date.now();

  function canApply(c: CampaignDetail): boolean {
    if (c.status !== 'active') return false;
    const start = new Date(c.start_date).getTime();
    const endApp = new Date(c.end_applications_date).getTime();
    return now >= start && now <= endApp;
  }

  async function handleApply() {
    if (!user || !campaign || !supabaseUrl?.trim() || !supabaseAnonKey?.trim()) {
      setMessage({ type: 'error', text: 'Zaloguj się, aby zgłosić się do kampanii.' });
      return;
    }
    setApplying(true);
    setMessage(null);
    const supabase = createClient(supabaseUrl, supabaseAnonKey);
    const { error } = await supabase.from('campaign_applications').insert({
      campaign_id: campaign.id,
      influencer_id: user.id,
    });
    setApplying(false);
    if (error) {
      if (error.code === '23505') {
        setMessage({ type: 'error', text: 'Masz już zgłoszenie do tej kampanii.' });
      } else {
        setMessage({ type: 'error', text: error.message || 'Zgłoszenie nie powiodło się.' });
      }
      return;
    }
    setApplied(true);
    setMessage({ type: 'success', text: 'Zgłoszenie zostało wysłane.' });
  }

  if (!supabaseUrl?.trim() || !supabaseAnonKey?.trim()) {
    return <p className="text-base-content/70">Brak konfiguracji Supabase.</p>;
  }

  if (loading) {
    return (
      <div className="flex justify-center py-20">
        <span className="loading loading-spinner loading-lg text-primary" />
      </div>
    );
  }

  if (loadError || !campaign) {
    return (
      <div className="rounded-2xl border border-base-content/15 bg-base-100/50 p-8 text-center">
        <p className="text-base-content/80">{loadError ?? 'Kampania niedostępna.'}</p>
        <a href="/campaigns" className="btn btn-outline btn-sm mt-6">
          Wróć do listy
        </a>
      </div>
    );
  }

  const brandName = resolveBrandName(campaign.brands);
  const statusLabel = STATUS_LABEL[campaign.status] ?? campaign.status;
  const applyOpen = canApply(campaign);

  return (
    <article className="space-y-8">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <a href="/campaigns" className="link link-hover text-sm text-base-content/65">
            ← Lista kampanii
          </a>
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <span className="badge badge-outline">{brandName}</span>
            {campaign.category ? (
              <span className="badge badge-primary badge-outline">{campaign.category}</span>
            ) : null}
            <span className="badge badge-ghost">{campaign.content_type}</span>
            <span className="badge badge-neutral badge-outline">{statusLabel}</span>
          </div>
          <h1 className="mt-4 text-3xl font-bold leading-tight">{campaign.name}</h1>
        </div>
      </div>

      {message && (
        <div role="alert" className={`alert ${message.type === 'success' ? 'alert-success' : 'alert-error'}`}>
          <span>{message.text}</span>
        </div>
      )}

      {campaign.description ? (
        <section className="rounded-2xl border border-base-content/10 bg-base-100/40 p-6">
          <h2 className="text-lg font-semibold">Opis kampanii</h2>
          <div
            className="campaign-description mt-3 max-w-none text-sm leading-relaxed text-base-content/90 [&_a]:text-primary [&_p]:my-2 [&_ul]:my-2 [&_ul]:list-disc [&_ul]:pl-5"
            dangerouslySetInnerHTML={{ __html: campaign.description }}
          />
        </section>
      ) : (
        <p className="text-sm text-base-content/60">Brak opisu od marki.</p>
      )}

      {campaign.presentation_inspiration?.trim() ? (
        <section className="rounded-2xl border border-base-content/10 bg-base-100/40 p-6">
          <h2 className="text-lg font-semibold">Inspiracje na prezentację produktu</h2>
          <p className="mt-1 text-sm text-base-content/60">
            Poniżej kilka propozycji od marki — możesz je zignorować i zaplanować treść po swojemu, jeśli masz lepszy pomysł.
          </p>
          <p className="mt-4 whitespace-pre-wrap text-sm leading-relaxed text-base-content/90">
            {campaign.presentation_inspiration}
          </p>
        </section>
      ) : null}

      <section className="rounded-2xl border border-base-content/10 bg-base-100/40 p-6">
        <h2 className="text-lg font-semibold">Terminy i zasady</h2>
        <dl className="mt-4 grid gap-3 text-sm sm:grid-cols-2">
          <div>
            <dt className="text-base-content/60">Start kampanii</dt>
            <dd className="font-medium">{formatPlDateTime(campaign.start_date)}</dd>
          </div>
          <div>
            <dt className="text-base-content/60">Koniec zbierania zgłoszeń</dt>
            <dd className="font-medium">{formatPlDateTime(campaign.end_applications_date)}</dd>
          </div>
          <div>
            <dt className="text-base-content/60">Koniec kampanii</dt>
            <dd className="font-medium">{formatPlDateTime(campaign.end_date)}</dd>
          </div>
          <div>
            <dt className="text-base-content/60">Liczba produktów / miejsc</dt>
            <dd className="font-medium">{campaign.units_count} szt.</dd>
          </div>
          <div className="sm:col-span-2">
            <dt className="text-base-content/60">Automatyczna zmiana statusu</dt>
            <dd className="font-medium">{campaign.auto_status_change ? 'Tak (wg dat)' : 'Nie'}</dd>
          </div>
        </dl>
      </section>

      <div className="flex flex-wrap items-center gap-3">
        {applied ? (
          <span className="btn btn-outline border-success/40 text-success pointer-events-none">Zgłoszono do tej kampanii</span>
        ) : user ? (
          applyOpen ? (
            <button type="button" className="btn btn-crezio-gradient" disabled={applying} onClick={handleApply}>
              {applying ? (
                <>
                  <span className="loading loading-spinner loading-sm" />
                  Wysyłanie…
                </>
              ) : (
                'Zgłoś się do kampanii'
              )}
            </button>
          ) : (
            <p className="text-sm text-base-content/70">
              {campaign.status === 'applications_closed'
                ? 'Zbieranie zgłoszeń zostało zamknięte.'
                : 'Zgłoszenia nie są jeszcze lub już nie są przyjmowane w tych terminach.'}
            </p>
          )
        ) : (
          <>
            <p className="text-sm text-base-content/70">Zaloguj się, aby wysłać zgłoszenie.</p>
            <a href="/login" className="btn btn-primary btn-sm">
              Zaloguj się
            </a>
          </>
        )}
        <a href="/dashboard" className="btn btn-ghost btn-sm">
          Panel
        </a>
      </div>
    </article>
  );
}
