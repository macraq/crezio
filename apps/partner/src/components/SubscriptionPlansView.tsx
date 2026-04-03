import { useCallback, useEffect, useState } from 'react';
import { createClient } from '@supabase/supabase-js';
import type { SupabaseClient } from '@supabase/supabase-js';
import {
  SUBSCRIPTION_COMPARISON_ROWS,
  SUBSCRIPTION_PLANS,
  SUBSCRIPTION_PLANS_ORDER,
  tierLabel,
  type ComparisonCellValue,
  type SubscriptionTier,
} from '@influeapp/lib';

interface SubscriptionPlansViewProps {
  supabaseUrl: string;
  supabaseAnonKey: string;
  /** np. biuro@… — jeśli puste, przycisk e-mail jest ukryty */
  contactEmail?: string;
  /** Opcjonalny link (np. formularz, Calendly) */
  contactUrl?: string;
}

function formatCell(v: ComparisonCellValue): string {
  if (typeof v === 'boolean') return v ? 'Tak' : '—';
  return String(v);
}

export default function SubscriptionPlansView({
  supabaseUrl,
  supabaseAnonKey,
  contactEmail,
  contactUrl,
}: SubscriptionPlansViewProps) {
  const [loading, setLoading] = useState(true);
  const [tier, setTier] = useState<SubscriptionTier | null>(null);
  const [subscriptionActive, setSubscriptionActive] = useState<boolean | null>(null);
  /** guest = wylogowany, brand = profil marki, other = zalogowany, ale nie marka */
  const [viewer, setViewer] = useState<'guest' | 'brand' | 'other'>('guest');

  const loadBrand = useCallback(async (client: SupabaseClient) => {
    const { data: sessionData } = await client.auth.getSession();
    const userId = sessionData.session?.user?.id;
    if (!userId) {
      setViewer('guest');
      setTier(null);
      setSubscriptionActive(null);
      setLoading(false);
      return;
    }

    const { data: profile } = await client.from('profiles').select('account_type').eq('id', userId).maybeSingle();
    if ((profile as { account_type?: string } | null)?.account_type !== 'brand') {
      setViewer('other');
      setTier(null);
      setSubscriptionActive(null);
      setLoading(false);
      return;
    }

    setViewer('brand');

    const { data: brandRow } = await client
      .from('brands')
      .select('subscription_tier,subscription_active')
      .eq('profile_id', userId)
      .maybeSingle();

    if (brandRow) {
      const st = (brandRow as { subscription_tier: SubscriptionTier }).subscription_tier;
      const active = (brandRow as { subscription_active: boolean }).subscription_active;
      setTier(st ?? 'basic');
      setSubscriptionActive(active);
    } else {
      setTier(null);
      setSubscriptionActive(null);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    if (!supabaseUrl?.trim() || !supabaseAnonKey?.trim()) {
      setViewer('guest');
      setLoading(false);
      return;
    }
    const client = createClient(supabaseUrl, supabaseAnonKey);
    loadBrand(client);
    const {
      data: { subscription },
    } = client.auth.onAuthStateChange(() => {
      loadBrand(client);
    });
    return () => subscription.unsubscribe();
  }, [supabaseUrl, supabaseAnonKey, loadBrand]);

  const mailtoHref = contactEmail?.trim()
    ? `mailto:${contactEmail.trim()}?subject=${encodeURIComponent('Abonament Crezio – panel marki')}`
    : '';

  return (
    <div className="space-y-8">
      {loading ? (
        <p className="text-sm text-slate-400">Ładowanie…</p>
      ) : viewer === 'brand' && tier !== null ? (
        <section className="brand-glass border border-white/10 p-5 sm:p-6">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-emerald-300/90">Twój abonament</p>
          <p className="brand-heading mt-2 text-lg font-semibold text-white">
            Pakiet: {tierLabel(tier)}{' '}
            <span className="font-normal text-slate-300">
              ·{' '}
              {subscriptionActive ? (
                <span className="text-emerald-300/95">aktywny</span>
              ) : (
                <span className="text-amber-200/90">nieaktywny</span>
              )}
            </span>
          </p>
          <p className="mt-2 text-sm text-slate-300">
            Aktywacja i zmiana pakietu odbywają się po kontakcie z zespołem. Porównanie poniżej pomoże dobrać skalę.
          </p>
        </section>
      ) : viewer === 'brand' && tier === null ? (
        <section className="brand-glass border border-amber-500/25 p-5 sm:p-6">
          <p className="text-sm text-amber-100/95">Nie znaleziono profilu marki powiązanego z kontem.</p>
        </section>
      ) : viewer === 'guest' ? (
        <section className="brand-glass border border-white/10 p-5 sm:p-6">
          <p className="text-sm text-slate-300">
            <a href="/login" className="text-emerald-300/95 underline-offset-2 hover:underline">
              Zaloguj się
            </a>{' '}
            jako marka, aby zobaczyć przypisany pakiet i status.
          </p>
        </section>
      ) : viewer === 'other' ? (
        <section className="brand-glass border border-white/10 p-5 sm:p-6">
          <p className="text-sm text-slate-300">Ta strona pokazuje abonament dla kont marki. Jesteś zalogowany na innym typie konta.</p>
        </section>
      ) : null}

      <section>
        <div className="mb-6">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-emerald-300/90">Porównanie pakietów</p>
          <h1 className="brand-heading mt-2 text-2xl font-bold text-white sm:text-3xl">Wybierz skalę działań</h1>
          <p className="mt-2 max-w-2xl text-sm text-slate-300">
            Najpierw limit równoległych kampanii, potem funkcje dostępne w każdym planie, na końcu to, co odróżnia pakiety (produkty
            testowe, selekcja twórców, podgląd profili).
          </p>
        </div>

        {/* Mobile: karty */}
        <div className="grid gap-4 md:hidden">
          {SUBSCRIPTION_PLANS.map((plan) => (
            <article
              key={plan.id}
              className={`brand-glass flex flex-col p-5 ${
                plan.highlighted ? 'border border-emerald-300/35 bg-emerald-500/[0.07]' : 'border border-white/10'
              }`}
            >
              <div className="flex items-start justify-between gap-2">
                <div>
                  <h2 className="brand-heading text-lg font-semibold text-white">{plan.label}</h2>
                  <p className="mt-1 text-sm text-slate-300">{plan.shortDescription}</p>
                </div>
                {plan.highlighted ? (
                  <span className="shrink-0 rounded-full border border-emerald-400/40 bg-emerald-500/15 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-emerald-200">
                    Polecane
                  </span>
                ) : null}
              </div>
              <p className="mt-3 text-xs text-slate-400">{plan.pricingHint}</p>
              <ul className="mt-4 space-y-2 border-t border-white/10 pt-4 text-sm text-slate-200">
                {SUBSCRIPTION_COMPARISON_ROWS.map((row) => (
                  <li key={row.id} className="flex justify-between gap-3">
                    <span className="text-slate-400">{row.label}</span>
                    <span className="shrink-0 text-right font-medium text-white">{formatCell(row.values[plan.id])}</span>
                  </li>
                ))}
              </ul>
              <div className="mt-5 flex flex-col gap-2 border-t border-white/10 pt-4">
                {mailtoHref ? (
                  <a href={mailtoHref} className="brand-cta w-full text-center text-sm">
                    Zapytaj o {plan.label}
                  </a>
                ) : null}
                {contactUrl?.trim() ? (
                  <a href={contactUrl.trim()} className="brand-cta-outline w-full text-center text-sm" target="_blank" rel="noreferrer">
                    Formularz / strona kontaktu
                  </a>
                ) : null}
                {!mailtoHref && !contactUrl?.trim() ? (
                  <p className="text-center text-xs text-slate-500">Skonfiguruj PUBLIC_CONTACT_EMAIL lub PUBLIC_CONTACT_URL.</p>
                ) : null}
              </div>
            </article>
          ))}
        </div>

        {/* Desktop: tabela */}
        <div className="hidden overflow-x-auto md:block">
          <table className="w-full min-w-[640px] border-collapse text-left text-sm">
            <thead>
              <tr>
                <th className="border border-white/10 bg-slate-900/70 p-4 font-medium text-slate-300">Funkcja</th>
                {SUBSCRIPTION_PLANS_ORDER.map((tid) => {
                  const plan = SUBSCRIPTION_PLANS.find((p) => p.id === tid)!;
                  return (
                    <th
                      key={tid}
                      className={`border p-4 font-semibold text-white ${
                        plan.highlighted ? 'border-emerald-300/35 bg-emerald-500/10' : 'border-white/10 bg-slate-900/70'
                      }`}
                    >
                      <div className="flex flex-col gap-1">
                        <span className="brand-heading text-base">{plan.label}</span>
                        <span className="text-xs font-normal text-slate-400">{plan.pricingHint}</span>
                      </div>
                    </th>
                  );
                })}
              </tr>
            </thead>
            <tbody>
              {SUBSCRIPTION_COMPARISON_ROWS.map((row) => (
                <tr key={row.id}>
                  <td className="border border-white/10 bg-slate-900/70 p-4 text-slate-300">{row.label}</td>
                  {SUBSCRIPTION_PLANS_ORDER.map((tid) => {
                    const plan = SUBSCRIPTION_PLANS.find((p) => p.id === tid)!;
                    return (
                      <td
                        key={tid}
                        className={`border p-4 text-white ${
                          plan.highlighted ? 'border-emerald-300/35 bg-emerald-500/[0.06]' : 'border-white/10 bg-slate-900/70'
                        }`}
                      >
                        {formatCell(row.values[tid])}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="mt-8 flex flex-col items-stretch justify-center gap-3 sm:flex-row sm:justify-center">
          {mailtoHref ? (
            <a href={mailtoHref} className="brand-cta w-full text-center sm:w-auto">
              Napisz w sprawie abonamentu
            </a>
          ) : null}
          {contactUrl?.trim() ? (
            <a
              href={contactUrl.trim()}
              className="brand-cta-outline w-full text-center sm:w-auto"
              target="_blank"
              rel="noreferrer"
            >
              Otwórz stronę kontaktu
            </a>
          ) : null}
        </div>
      </section>
    </div>
  );
}
