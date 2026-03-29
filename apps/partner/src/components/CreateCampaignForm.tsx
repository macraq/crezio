import { useEffect, useMemo, useState } from 'react';
import { createClient } from '@supabase/supabase-js';
import RichTextEditor from './RichTextEditor';

interface CreateCampaignFormProps {
  supabaseUrl: string;
  supabaseAnonKey: string;
}

type BrandContext = {
  id: string;
  subscription_active: boolean;
  subscription_tier: 'basic' | 'medium' | 'platinum';
};

export default function CreateCampaignForm({ supabaseUrl, supabaseAnonKey }: CreateCampaignFormProps) {
  const supabase = useMemo(() => {
    if (!supabaseUrl?.trim() || !supabaseAnonKey?.trim()) return null;
    return createClient(supabaseUrl, supabaseAnonKey);
  }, [supabaseUrl, supabaseAnonKey]);

  const [loadingContext, setLoadingContext] = useState(true);
  const [brand, setBrand] = useState<BrandContext | null>(null);
  const [contextError, setContextError] = useState<string | null>(null);

  const [name, setName] = useState('');
  const [productLead, setProductLead] = useState('');
  const [description, setDescription] = useState('');
  const [unitsCount, setUnitsCount] = useState(20);
  const [suggestedRetailPrice, setSuggestedRetailPrice] = useState('');
  const [category, setCategory] = useState('beauty');
  const [startDate, setStartDate] = useState('');
  const [endApplicationsDate, setEndApplicationsDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [autoStatusChange, setAutoStatusChange] = useState(true);

  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  function stripHtml(html: string) {
    return html
      .replace(/<br\s*\/?>/gi, ' ')
      .replace(/<[^>]+>/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  }

  useEffect(() => {
    if (!supabase) {
      setLoadingContext(false);
      setContextError('Brak konfiguracji Supabase.');
      return;
    }

    let cancelled = false;

    async function loadContext() {
      setLoadingContext(true);
      setContextError(null);

      const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
      if (cancelled) return;
      if (sessionError) {
        setContextError(sessionError.message);
        setLoadingContext(false);
        return;
      }

      const userId = sessionData.session?.user?.id;
      if (!userId) {
        setContextError('Brak aktywnej sesji.');
        setLoadingContext(false);
        return;
      }

      const { data: profile, error: profileError } = await supabase
        .from('profiles')
        .select('account_type')
        .eq('id', userId)
        .maybeSingle();

      if (cancelled) return;
      if (profileError) {
        setContextError(profileError.message);
        setLoadingContext(false);
        return;
      }

      if ((profile as { account_type?: string } | null)?.account_type !== 'brand') {
        setContextError('To konto nie ma roli marki.');
        setLoadingContext(false);
        return;
      }

      const { data: brandRow, error: brandError } = await supabase
        .from('brands')
        .select('id,subscription_active,subscription_tier')
        .eq('profile_id', userId)
        .maybeSingle();

      if (cancelled) return;
      if (brandError) {
        setContextError(brandError.message);
        setLoadingContext(false);
        return;
      }

      if (!brandRow) {
        setContextError('Nie znaleziono profilu marki.');
        setLoadingContext(false);
        return;
      }

      setBrand(brandRow as BrandContext);
      setLoadingContext(false);
    }

    loadContext();
    return () => {
      cancelled = true;
    };
  }, [supabase]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitError(null);
    setSuccess(null);

    if (!supabase || !brand) {
      setSubmitError('Brak danych kontekstowych marki.');
      return;
    }

    if (!brand.subscription_active) {
      setSubmitError('Aktywny abonament jest wymagany, aby tworzyć kampanie.');
      return;
    }

    if (!name.trim()) {
      setSubmitError('Podaj nazwę kampanii.');
      return;
    }
    if (!productLead.trim()) {
      setSubmitError('Podaj lead opisujący testowany produkt.');
      return;
    }
    if (!stripHtml(description)) {
      setSubmitError('Podaj dokładny opis kampanii.');
      return;
    }
    if (!startDate || !endApplicationsDate || !endDate) {
      setSubmitError('Uzupełnij wszystkie daty kampanii.');
      return;
    }
    if (!Number.isFinite(unitsCount) || unitsCount <= 0) {
      setSubmitError('Liczba sztuk musi być większa od 0.');
      return;
    }

    const start = new Date(`${startDate}T00:00:00`);
    const endApplications = new Date(`${endApplicationsDate}T00:00:00`);
    const end = new Date(`${endDate}T23:59:59`);
    if (!(start < endApplications && endApplications <= end)) {
      setSubmitError('Daty muszą spełniać warunek: start < koniec zgłoszeń <= koniec kampanii.');
      return;
    }

    const srpLine = suggestedRetailPrice.trim()
      ? `\n\nSugerowana cena detaliczna: ${suggestedRetailPrice.trim()}`
      : '';
    const mergedDescription = `Lead produktu:\n${productLead.trim()}${srpLine}\n\nDokładny opis (HTML):\n${description}`;

    setSubmitting(true);
    const { error } = await supabase.from('campaigns').insert({
      brand_id: brand.id,
      name: name.trim(),
      description: mergedDescription,
      units_count: unitsCount,
      content_type: 'barter',
      category: category.trim() || null,
      start_date: start.toISOString(),
      end_applications_date: endApplications.toISOString(),
      end_date: end.toISOString(),
      auto_status_change: autoStatusChange,
      status: 'draft',
    });
    setSubmitting(false);

    if (error) {
      setSubmitError(error.message);
      return;
    }

    setSuccess('Kampania została utworzona.');
    setTimeout(() => {
      window.location.href = '/dashboard';
    }, 1200);
  }

  if (loadingContext) {
    return (
      <div className="brand-glass p-5 text-sm text-slate-300">
        Ładowanie kontekstu marki...
      </div>
    );
  }

  if (contextError) {
    return (
      <div className="rounded-xl border border-rose-400/40 bg-rose-500/10 px-4 py-3 text-sm text-rose-200">
        {contextError}
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="brand-glass p-6 sm:p-8">
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="brand-heading text-2xl font-semibold text-white">Nowa kampania</h1>
          <p className="mt-1 text-sm text-slate-300">
            Pakiet: <span className="font-medium text-white">{brand?.subscription_tier.toUpperCase()}</span>
          </p>
        </div>
        {!brand?.subscription_active ? (
          <span className="rounded-full border border-amber-300/40 bg-amber-500/10 px-3 py-1 text-xs text-amber-200">
            Abonament nieaktywny
          </span>
        ) : (
          <span className="rounded-full border border-emerald-300/40 bg-emerald-500/10 px-3 py-1 text-xs text-emerald-200">
            Abonament aktywny
          </span>
        )}
      </div>

      {submitError && (
        <div className="mb-4 rounded-lg border border-rose-400/40 bg-rose-500/10 px-3 py-2 text-sm text-rose-200">
          {submitError}
        </div>
      )}

      {success && (
        <div className="mb-4 rounded-lg border border-emerald-300/40 bg-emerald-500/10 px-3 py-2 text-sm text-emerald-200">
          {success}
        </div>
      )}

      <div className="grid gap-4 sm:grid-cols-2">
        <label className="sm:col-span-2 flex flex-col gap-1.5">
          <span className="text-sm text-slate-300">Nazwa kampanii *</span>
          <input
            type="text"
            className="w-full rounded-xl border border-white/15 bg-slate-900/70 px-3 py-2.5 text-sm text-white outline-none transition focus:border-emerald-300/70 focus:ring-2 focus:ring-emerald-300/20"
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
            placeholder="np. Spring Glow Test Box"
          />
        </label>

        <label className="sm:col-span-2 flex flex-col gap-1.5">
          <span className="text-sm text-slate-300">Lead produktu *</span>
          <textarea
            className="min-h-20 w-full rounded-xl border border-white/15 bg-slate-900/70 px-3 py-2.5 text-sm text-white outline-none transition focus:border-emerald-300/70 focus:ring-2 focus:ring-emerald-300/20"
            value={productLead}
            onChange={(e) => setProductLead(e.target.value)}
            placeholder="Krótki lead: jaki produkt testujemy i dlaczego jest ważny dla kampanii"
            required
          />
        </label>

        <label className="sm:col-span-2 flex flex-col gap-1.5">
          <span className="text-sm text-slate-300">Dokładny opis kampanii *</span>
          <RichTextEditor
            value={description}
            onChange={setDescription}
            placeholder="Szczegółowy opis: brief, oczekiwania, format publikacji, cele i warunki testu"
          />
        </label>

        <label className="flex flex-col gap-1.5">
          <span className="text-sm text-slate-300">Liczba sztuk *</span>
          <input
            type="number"
            min={1}
            className="w-full rounded-xl border border-white/15 bg-slate-900/70 px-3 py-2.5 text-sm text-white outline-none transition focus:border-emerald-300/70 focus:ring-2 focus:ring-emerald-300/20"
            value={unitsCount}
            onChange={(e) => setUnitsCount(Number(e.target.value))}
            required
          />
        </label>

        <label className="flex flex-col gap-1.5">
          <span className="text-sm text-slate-300">Sugerowana cena detaliczna (opcjonalnie)</span>
          <input
            type="text"
            className="w-full rounded-xl border border-white/15 bg-slate-900/70 px-3 py-2.5 text-sm text-white outline-none transition focus:border-emerald-300/70 focus:ring-2 focus:ring-emerald-300/20"
            value={suggestedRetailPrice}
            onChange={(e) => setSuggestedRetailPrice(e.target.value)}
            placeholder="np. 129 PLN"
          />
        </label>

        <label className="sm:col-span-2 flex flex-col gap-1.5">
          <span className="text-sm text-slate-300">Kategoria</span>
          <input
            type="text"
            className="w-full rounded-xl border border-white/15 bg-slate-900/70 px-3 py-2.5 text-sm text-white outline-none transition focus:border-emerald-300/70 focus:ring-2 focus:ring-emerald-300/20"
            value={category}
            onChange={(e) => setCategory(e.target.value)}
            placeholder="np. beauty"
          />
        </label>

        <label className="flex flex-col gap-1.5">
          <span className="text-sm text-slate-300">Data startu *</span>
          <input
            type="date"
            className="w-full rounded-xl border border-white/15 bg-slate-900/70 px-3 py-2.5 text-sm text-white outline-none transition focus:border-emerald-300/70 focus:ring-2 focus:ring-emerald-300/20"
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
            required
          />
        </label>

        <label className="flex flex-col gap-1.5">
          <span className="text-sm text-slate-300">Koniec zbierania zgłoszeń *</span>
          <input
            type="date"
            className="w-full rounded-xl border border-white/15 bg-slate-900/70 px-3 py-2.5 text-sm text-white outline-none transition focus:border-emerald-300/70 focus:ring-2 focus:ring-emerald-300/20"
            value={endApplicationsDate}
            onChange={(e) => setEndApplicationsDate(e.target.value)}
            required
          />
        </label>

        <label className="sm:col-span-2 flex flex-col gap-1.5">
          <span className="text-sm text-slate-300">Koniec kampanii *</span>
          <input
            type="date"
            className="w-full rounded-xl border border-white/15 bg-slate-900/70 px-3 py-2.5 text-sm text-white outline-none transition focus:border-emerald-300/70 focus:ring-2 focus:ring-emerald-300/20"
            value={endDate}
            onChange={(e) => setEndDate(e.target.value)}
            required
          />
        </label>
      </div>

      <label className="mt-4 flex cursor-pointer gap-2 text-sm text-slate-300">
        <input
          type="checkbox"
          className="mt-0.5 h-4 w-4 rounded border-white/30 bg-slate-900 text-emerald-300"
          checked={autoStatusChange}
          onChange={(e) => setAutoStatusChange(e.target.checked)}
        />
        <span>Automatyczna zmiana statusu kampanii na podstawie dat</span>
      </label>

      <div className="mt-6 flex flex-col gap-3 sm:flex-row">
        <button type="submit" className="brand-cta w-full sm:w-auto disabled:cursor-not-allowed disabled:opacity-60" disabled={submitting}>
          {submitting ? 'Zapisywanie...' : 'Utwórz kampanię'}
        </button>
        <a href="/dashboard" className="brand-cta-outline w-full sm:w-auto text-center">
          Anuluj
        </a>
      </div>
    </form>
  );
}
