import { useCallback, useEffect, useState } from 'react';
import { createClient } from '@supabase/supabase-js';
import type { SupabaseClient, User } from '@supabase/supabase-js';

type CampaignEmbed = {
  id: string;
  name: string;
  content_type: string;
  status: string;
  end_date: string;
  end_applications_date: string;
  brands: { name: string } | { name: string }[] | null;
};

type CampaignsCell = CampaignEmbed | null;

type ApplicationRow = {
  id: string;
  status: string;
  created_at: string;
  campaigns: CampaignsCell;
};

const APP_STATUS_LABEL: Record<string, string> = {
  applied: 'Zgłoszono',
  selected: 'Wybrano',
  preparation_for_shipping: 'Przygotowanie do wysyłki',
  publication: 'Publikacja',
  completed: 'Zakończono',
};

const CAMPAIGN_STATUS_LABEL: Record<string, string> = {
  draft: 'Szkic',
  active: 'Aktywna',
  applications_closed: 'Zgłoszenia zamknięte',
  ended: 'Zakończona',
};

interface DashboardAppliedCampaignsBoxProps {
  supabaseUrl: string;
  supabaseAnonKey: string;
}

function normalizeCampaign(c: CampaignEmbed | CampaignEmbed[] | null | undefined): CampaignsCell {
  if (!c) return null;
  if (Array.isArray(c)) return c[0] ?? null;
  return c;
}

function resolveBrandName(campaign: CampaignsCell): string {
  if (!campaign?.brands) return 'Marka';
  const b = campaign.brands;
  if (Array.isArray(b)) return b[0]?.name ?? 'Marka';
  return b.name ?? 'Marka';
}

function formatPlDate(iso: string): string {
  try {
    return new Date(iso).toLocaleDateString('pl-PL', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    });
  } catch {
    return iso;
  }
}

/** Lista zgłoszeń influencera — tylko dla `account_type === 'influencer'`, inaczej zwraca `null`. */
export default function DashboardAppliedCampaignsBox({
  supabaseUrl,
  supabaseAnonKey,
}: DashboardAppliedCampaignsBoxProps) {
  const [user, setUser] = useState<User | null>(null);
  const [isInfluencer, setIsInfluencer] = useState(false);
  const [loading, setLoading] = useState(true);
  const [rows, setRows] = useState<ApplicationRow[]>([]);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async (client: SupabaseClient, uid: string) => {
    setError(null);
    const { data: profile } = await client.from('profiles').select('account_type').eq('id', uid).maybeSingle();
    const at = (profile as { account_type?: string } | null)?.account_type;
    const inf = at === 'influencer';
    setIsInfluencer(inf);
    if (!inf) {
      setRows([]);
      setLoading(false);
      return;
    }

    const { data, error: qErr } = await client
      .from('campaign_applications')
      .select(
        'id,status,created_at,campaigns(id,name,content_type,status,end_date,end_applications_date,brands(name))'
      )
      .eq('influencer_id', uid)
      .order('created_at', { ascending: false })
      .limit(6);

    if (qErr) {
      setError(qErr.message);
      setRows([]);
    } else {
      const list = (data ?? []) as Array<{
        id: string;
        status: string;
        created_at: string;
        campaigns: CampaignEmbed | CampaignEmbed[] | null;
      }>;
      setRows(
        list.map((r) => ({
          id: r.id,
          status: r.status,
          created_at: r.created_at,
          campaigns: normalizeCampaign(r.campaigns),
        }))
      );
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    if (!supabaseUrl?.trim() || !supabaseAnonKey?.trim()) {
      setLoading(false);
      return;
    }
    const client = createClient(supabaseUrl, supabaseAnonKey);
    setLoading(true);
    client.auth.getSession().then(({ data: { session } }) => {
      const u = session?.user ?? null;
      setUser(u);
      if (u?.id) void load(client, u.id);
      else {
        setIsInfluencer(false);
        setRows([]);
        setLoading(false);
      }
    });
    const {
      data: { subscription },
    } = client.auth.onAuthStateChange((_e, session) => {
      const u = session?.user ?? null;
      setUser(u);
      setLoading(true);
      if (u?.id) void load(client, u.id);
      else {
        setIsInfluencer(false);
        setRows([]);
        setLoading(false);
      }
    });
    return () => subscription.unsubscribe();
  }, [supabaseUrl, supabaseAnonKey, load]);

  if (!supabaseUrl?.trim() || !supabaseAnonKey?.trim()) {
    return null;
  }

  if (!user || !isInfluencer) {
    return null;
  }

  return (
    <section
      className="mt-6 rounded-2xl border border-base-content/10 bg-base-100/35 p-5"
      aria-labelledby="dashboard-applied-heading"
    >
      <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-start sm:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-base-content/55">Twoje zgłoszenia</p>
          <h2 id="dashboard-applied-heading" className="mt-1 text-xl font-semibold">
            Kampanie, na które się zgłosiłeś(-aś)
          </h2>
          <p className="mt-2 text-sm text-base-content/70">
            Status zgłoszenia i skrót kampanii — szczegóły i brief w widoku kampanii (mini CRM).
          </p>
        </div>
        <a
          href="/campaigns"
          className="btn btn-sm btn-outline shrink-0 border-base-content/30 hover:border-base-content/60"
        >
          Wszystkie kampanie
        </a>
      </div>

      {error ? (
        <p className="mt-4 text-sm text-error">{error}</p>
      ) : loading ? (
        <p className="mt-4 text-sm text-base-content/55">Wczytywanie…</p>
      ) : rows.length === 0 ? (
        <p className="mt-4 text-sm text-base-content/70">
          Nie masz jeszcze zgłoszeń.{' '}
          <a href="/campaigns" className="font-medium text-primary underline-offset-2 hover:underline">
            Przeglądaj dostępne testy
          </a>
        </p>
      ) : (
        <ul className="mt-4 space-y-3">
          {rows.map((r) => {
            const c = r.campaigns;
            const campaignId = c?.id;
            const title = c?.name ?? 'Kampania';
            const brand = resolveBrandName(c);
            const campSt = c?.status ? CAMPAIGN_STATUS_LABEL[c.status] ?? c.status : '—';
            const appSt = APP_STATUS_LABEL[r.status] ?? r.status;
            const href = campaignId ? `/campaigns/view?id=${encodeURIComponent(campaignId)}` : '/campaigns';
            return (
              <li key={r.id}>
                <a
                  href={href}
                  className="flex flex-col gap-2 rounded-xl border border-base-content/10 bg-base-100/40 p-4 transition hover:border-primary/40 hover:bg-base-100/55 sm:flex-row sm:items-center sm:justify-between"
                >
                  <div className="min-w-0">
                    <p className="truncate font-medium text-base-content">{title}</p>
                    <p className="mt-0.5 text-sm text-base-content/65">
                      {brand}
                      {c?.content_type ? ` · ${c.content_type}` : null}
                    </p>
                    <div className="mt-2 flex flex-wrap gap-2 text-xs text-base-content/70">
                      <span className="rounded-full border border-base-content/15 px-2 py-0.5">Kampania: {campSt}</span>
                      {c?.end_applications_date ? (
                        <span className="rounded-full border border-base-content/15 px-2 py-0.5">
                          Zgłoszenia do: {formatPlDate(c.end_applications_date)}
                        </span>
                      ) : null}
                      {c?.end_date ? (
                        <span className="rounded-full border border-base-content/15 px-2 py-0.5">
                          Koniec: {formatPlDate(c.end_date)}
                        </span>
                      ) : null}
                    </div>
                  </div>
                  <div className="flex shrink-0 flex-col items-start gap-2 sm:items-end">
                    <span className="badge badge-primary badge-outline whitespace-nowrap">{appSt}</span>
                    <span className="text-xs text-base-content/55">Zgłoszono {formatPlDate(r.created_at)}</span>
                  </div>
                </a>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
