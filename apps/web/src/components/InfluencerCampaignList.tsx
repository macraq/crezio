import { useCallback, useEffect, useMemo, useState } from 'react';
import { createClient } from '@supabase/supabase-js';
import type { SupabaseClient, User } from '@supabase/supabase-js';

type CampaignRow = {
  id: string;
  name: string;
  description: string | null;
  units_count: number;
  content_type: string;
  category: string | null;
  start_date: string;
  end_applications_date: string;
  end_date: string;
  status: string;
  /** PostgREST może zwrócić obiekt lub tablicę przy relacji many-to-one. */
  brands: { name: string } | { name: string }[] | null;
};

function resolveBrandName(brands: CampaignRow['brands']): string {
  if (!brands) return 'Marka';
  if (Array.isArray(brands)) return brands[0]?.name ?? 'Marka';
  return brands.name ?? 'Marka';
}

interface InfluencerCampaignListProps {
  supabaseUrl: string;
  supabaseAnonKey: string;
}

function formatPlDate(iso: string): string {
  try {
    return new Date(iso).toLocaleDateString('pl-PL', {
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    });
  } catch {
    return iso;
  }
}

export default function InfluencerCampaignList({ supabaseUrl, supabaseAnonKey }: InfluencerCampaignListProps) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [campaigns, setCampaigns] = useState<CampaignRow[]>([]);
  const [appliedIds, setAppliedIds] = useState<Set<string>>(new Set());
  const [applyingId, setApplyingId] = useState<string | null>(null);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [filterCategory, setFilterCategory] = useState('');
  const [filterContentType, setFilterContentType] = useState('');

  const load = useCallback(
    async (client: SupabaseClient, uid: string | undefined) => {
      setMessage(null);
      const now = new Date().toISOString();

      const { data: campaignsData, error: campErr } = await client
        .from('campaigns')
        .select(
          'id,name,description,units_count,content_type,category,start_date,end_applications_date,end_date,status,brands(name)'
        )
        .eq('status', 'active')
        .lte('start_date', now)
        .gte('end_applications_date', now)
        .order('end_applications_date', { ascending: true });

      if (campErr) {
        setCampaigns([]);
        setMessage({ type: 'error', text: campErr.message || 'Nie udało się wczytać kampanii.' });
        setLoading(false);
        return;
      }

      const rows = (campaignsData ?? []) as unknown as CampaignRow[];
      setCampaigns(rows);

      if (uid) {
        const { data: apps, error: appErr } = await client
          .from('campaign_applications')
          .select('campaign_id')
          .eq('influencer_id', uid);
        if (!appErr && apps) {
          setAppliedIds(new Set(apps.map((a) => a.campaign_id as string)));
        } else {
          setAppliedIds(new Set());
        }
      } else {
        setAppliedIds(new Set());
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
    setLoading(true);
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null);
      load(supabase, session?.user?.id);
    });
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_e, session) => {
      setUser(session?.user ?? null);
      setLoading(true);
      load(supabase, session?.user?.id);
    });
    return () => subscription.unsubscribe();
  }, [supabaseUrl, supabaseAnonKey, load]);

  const categoryOptions = useMemo(() => {
    const s = new Set<string>();
    campaigns.forEach((c) => {
      if (c.category?.trim()) s.add(c.category.trim());
    });
    return Array.from(s).sort((a, b) => a.localeCompare(b, 'pl'));
  }, [campaigns]);

  const contentTypeOptions = useMemo(() => {
    const s = new Set<string>();
    campaigns.forEach((c) => {
      if (c.content_type?.trim()) s.add(c.content_type.trim());
    });
    return Array.from(s).sort((a, b) => a.localeCompare(b, 'pl'));
  }, [campaigns]);

  const filtered = useMemo(() => {
    return campaigns.filter((c) => {
      if (filterCategory && (c.category ?? '') !== filterCategory) return false;
      if (filterContentType && c.content_type !== filterContentType) return false;
      return true;
    });
  }, [campaigns, filterCategory, filterContentType]);

  async function handleApply(campaignId: string) {
    if (!user || !supabaseUrl?.trim() || !supabaseAnonKey?.trim()) {
      setMessage({ type: 'error', text: 'Zaloguj się, aby zgłosić się do kampanii.' });
      return;
    }
    setApplyingId(campaignId);
    setMessage(null);
    const supabase = createClient(supabaseUrl, supabaseAnonKey);
    const { error } = await supabase.from('campaign_applications').insert({
      campaign_id: campaignId,
      influencer_id: user.id,
    });
    setApplyingId(null);
    if (error) {
      if (error.code === '23505') {
        setMessage({ type: 'error', text: 'Masz już zgłoszenie do tej kampanii.' });
      } else {
        setMessage({ type: 'error', text: error.message || 'Zgłoszenie nie powiodło się.' });
      }
      return;
    }
    setAppliedIds((prev) => new Set([...prev, campaignId]));
    setMessage({ type: 'success', text: 'Zgłoszenie zostało wysłane. Status zobaczysz w panelu (Moje kampanie).' });
  }

  if (!supabaseUrl?.trim() || !supabaseAnonKey?.trim()) {
    return (
      <p className="text-base-content/70">Brak konfiguracji Supabase. Uzupełnij zmienne środowiskowe.</p>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:flex-wrap sm:items-end sm:justify-between">
        <div className="flex flex-wrap gap-3">
          <div className="form-control min-w-[200px]">
            <label className="label py-1" htmlFor="filter-category">
              <span className="label-text text-sm">Kategoria</span>
            </label>
            <select
              id="filter-category"
              className="select select-bordered select-sm w-full max-w-xs"
              value={filterCategory}
              onChange={(e) => setFilterCategory(e.target.value)}
            >
              <option value="">Wszystkie</option>
              {categoryOptions.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </div>
          <div className="form-control min-w-[200px]">
            <label className="label py-1" htmlFor="filter-content">
              <span className="label-text text-sm">Typ treści</span>
            </label>
            <select
              id="filter-content"
              className="select select-bordered select-sm w-full max-w-xs"
              value={filterContentType}
              onChange={(e) => setFilterContentType(e.target.value)}
            >
              <option value="">Wszystkie</option>
              {contentTypeOptions.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </div>
        </div>
        {!user ? (
          <a href="/login" className="btn btn-primary btn-sm">
            Zaloguj się, aby zgłaszać się do kampanii
          </a>
        ) : null}
      </div>

      {message && (
        <div role="alert" className={`alert ${message.type === 'success' ? 'alert-success' : 'alert-error'}`}>
          <span>{message.text}</span>
        </div>
      )}

      {loading ? (
        <div className="flex justify-center py-16">
          <span className="loading loading-spinner loading-lg text-primary" />
        </div>
      ) : filtered.length === 0 ? (
        <div className="rounded-2xl border border-base-content/10 bg-base-100/35 p-8 text-center">
          <p className="text-base-content/80">
            {campaigns.length === 0
              ? 'Brak kampanii z otwartym zbieraniem zgłoszeń. Wróć później lub sprawdź panel.'
              : 'Żadna kampania nie pasuje do wybranych filtrów.'}
          </p>
        </div>
      ) : (
        <ul className="space-y-4">
          {filtered.map((c) => {
            const brandName = resolveBrandName(c.brands);
            const applied = appliedIds.has(c.id);
            return (
              <li
                key={c.id}
                className="rounded-2xl border border-base-content/10 bg-base-100/40 p-5 shadow-sm transition hover:border-primary/30"
              >
                <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                  <div className="min-w-0 flex-1 space-y-2">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="badge badge-outline badge-sm">{brandName}</span>
                      {c.category ? (
                        <span className="badge badge-primary badge-outline badge-sm">{c.category}</span>
                      ) : null}
                      <span className="badge badge-ghost badge-sm">{c.content_type}</span>
                    </div>
                    <h2 className="text-xl font-semibold leading-tight">
                      <a
                        href={`/campaigns/view?id=${encodeURIComponent(c.id)}`}
                        className="link link-hover text-base-content"
                      >
                        {c.name}
                      </a>
                    </h2>
                    <a
                      href={`/campaigns/view?id=${encodeURIComponent(c.id)}`}
                      className="text-sm font-medium text-primary hover:underline"
                    >
                      Szczegóły kampanii →
                    </a>
                    {c.description ? (
                      <p className="text-sm text-base-content/75 line-clamp-3">{c.description}</p>
                    ) : null}
                    <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-base-content/65">
                      <span>
                        Zgłoszenia do: <strong className="text-base-content/90">{formatPlDate(c.end_applications_date)}</strong>
                      </span>
                      <span>
                        Koniec kampanii: {formatPlDate(c.end_date)}
                      </span>
                      <span>Liczba miejsc (szt.): {c.units_count}</span>
                    </div>
                  </div>
                  <div className="flex shrink-0 flex-col items-stretch gap-2 sm:flex-row sm:items-center lg:flex-col">
                    {applied ? (
                      <span className="btn btn-outline btn-sm border-success/40 text-success pointer-events-none">
                        Zgłoszono
                      </span>
                    ) : user ? (
                      <button
                        type="button"
                        className="btn btn-crezio-gradient btn-sm whitespace-nowrap"
                        disabled={applyingId !== null}
                        onClick={() => handleApply(c.id)}
                      >
                        {applyingId === c.id ? (
                          <>
                            <span className="loading loading-spinner loading-xs" />
                            Wysyłanie…
                          </>
                        ) : (
                          'Zgłoś się'
                        )}
                      </button>
                    ) : (
                      <span className="text-sm text-base-content/60">Wymagane logowanie</span>
                    )}
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
