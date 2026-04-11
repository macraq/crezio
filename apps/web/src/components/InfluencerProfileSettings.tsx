import { useEffect, useState } from 'react';
import { createClient } from '@supabase/supabase-js';
import type { SupabaseClient, User } from '@supabase/supabase-js';
import {
  computeInfluencerProfileCompletion,
  type SocialLinksState,
} from '../lib/influencerProfileCompletion';

const SOCIAL_PLATFORMS = [
  { key: 'instagram', label: 'Instagram', placeholder: 'https://instagram.com/twoj_profil', icon: '📷' },
  { key: 'tiktok', label: 'TikTok', placeholder: 'https://tiktok.com/@twoj_profil', icon: '🎵' },
  { key: 'youtube', label: 'YouTube', placeholder: 'https://youtube.com/@kanal', icon: '▶️' },
  { key: 'twitter', label: 'X (Twitter)', placeholder: 'https://x.com/twoj_profil', icon: '𝕏' },
  { key: 'facebook', label: 'Facebook', placeholder: 'https://facebook.com/twoj_profil', icon: 'f' },
] as const;

type SocialKey = (typeof SOCIAL_PLATFORMS)[number]['key'];

const CATEGORIES = [
  { value: '', label: 'Wybierz kategorię' },
  { value: 'beauty', label: 'Beauty' },
  { value: 'skincare', label: 'Pielęgnacja (skincare)' },
  { value: 'makeup', label: 'Makijaż' },
  { value: 'haircare', label: 'Włosy' },
  { value: 'lifestyle', label: 'Lifestyle' },
  { value: 'fashion', label: 'Moda' },
  { value: 'fitness', label: 'Fitness' },
  { value: 'food', label: 'Kulinaria' },
  { value: 'tech', label: 'Tech' },
  { value: 'other', label: 'Inna' },
] as const;

const LOCALES = [
  { value: 'pl', label: 'Polski' },
  { value: 'en', label: 'English' },
] as const;

/** Wartości zapisujemy jako stabilne klucze (filtrowanie / raporty). */
const SKIN_TYPES = [
  { value: '', label: 'Nie podano' },
  { value: 'sucha', label: 'Sucha' },
  { value: 'tlusta', label: 'Tłusta' },
  { value: 'mieszana', label: 'Mieszana' },
  { value: 'normalna', label: 'Normalna' },
  { value: 'wrazliwa', label: 'Wrażliwa / reaktywna' },
  { value: 'trądzikowa', label: 'Skłonna do niedoskonałości / trądziku' },
  { value: 'nie_wiem', label: 'Nie wiem / trudno określić' },
] as const;

interface InfluencerProfileRow {
  category: string | null;
  location: string | null;
  followers_count: number | null;
  engagement_rate: number | string | null;
  height_cm: number | null;
  hair_color: string | null;
  hair_style: string | null;
  skin_type: string | null;
  skin_notes: string | null;
  self_description: string | null;
  shipping_address_encrypted: string | null;
  social_links: SocialLinksState | null;
  profile_completion_pct: number | null;
}

interface InfluencerProfileSettingsProps {
  supabaseUrl: string;
  supabaseAnonKey: string;
}

export default function InfluencerProfileSettings({ supabaseUrl, supabaseAnonKey }: InfluencerProfileSettingsProps) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const [locale, setLocale] = useState('pl');
  const [category, setCategory] = useState('');
  const [location, setLocation] = useState('');
  const [followersInput, setFollowersInput] = useState('');
  const [engagementPercentInput, setEngagementPercentInput] = useState('');
  const [heightInput, setHeightInput] = useState('');
  const [hairColor, setHairColor] = useState('');
  const [hairStyle, setHairStyle] = useState('');
  const [skinType, setSkinType] = useState('');
  const [skinNotes, setSkinNotes] = useState('');
  const [selfDescription, setSelfDescription] = useState('');
  const [shippingAddress, setShippingAddress] = useState('');
  const [links, setLinks] = useState<SocialLinksState>({});
  const [storedCompletion, setStoredCompletion] = useState<number | null>(null);

  useEffect(() => {
    if (!supabaseUrl?.trim() || !supabaseAnonKey?.trim()) {
      setLoading(false);
      return;
    }
    const supabase = createClient(supabaseUrl, supabaseAnonKey);
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null);
      if (!session?.user) {
        setLoading(false);
        return;
      }
      loadAll(supabase, session.user.id);
    });
  }, [supabaseUrl, supabaseAnonKey]);

  async function loadAll(supabase: SupabaseClient, profileId: string) {
    const [profileRes, infRes] = await Promise.all([
      supabase.from('profiles').select('locale').eq('id', profileId).maybeSingle(),
      supabase
        .from('influencer_profiles')
        .select(
          'category,location,followers_count,engagement_rate,height_cm,hair_color,hair_style,skin_type,skin_notes,self_description,shipping_address_encrypted,social_links,profile_completion_pct'
        )
        .eq('profile_id', profileId)
        .maybeSingle(),
    ]);

    if (profileRes.error) {
      setMessage({ type: 'error', text: 'Nie udało się wczytać ustawień konta.' });
      setLoading(false);
      return;
    }
    if (infRes.error) {
      setMessage({ type: 'error', text: 'Nie udało się wczytać profilu influencera.' });
      setLoading(false);
      return;
    }

    setLocale((profileRes.data?.locale as string | undefined) ?? 'pl');

    const row = infRes.data as InfluencerProfileRow | null;
    if (row) {
      setCategory(row.category ?? '');
      setLocation(row.location ?? '');
      setFollowersInput(row.followers_count != null ? String(row.followers_count) : '');
      setEngagementPercentInput(
        row.engagement_rate != null ? String(Math.round(Number(row.engagement_rate) * 10000) / 100) : ''
      );
      setHeightInput(row.height_cm != null ? String(row.height_cm) : '');
      setHairColor(row.hair_color ?? '');
      setHairStyle(row.hair_style ?? '');
      setSkinType(row.skin_type ?? '');
      setSkinNotes(row.skin_notes ?? '');
      setSelfDescription(row.self_description ?? '');
      setShippingAddress(row.shipping_address_encrypted ?? '');
      setLinks((row.social_links as SocialLinksState) ?? {});
      setStoredCompletion(row.profile_completion_pct ?? null);
    }
    setLoading(false);
  }

  const heightCm = parseHeightCm(heightInput);

  const previewCompletion = computeInfluencerProfileCompletion({
    category: category || null,
    location: location || null,
    followersCount: parseFollowers(followersInput),
    shippingAddress: shippingAddress || null,
    socialLinks: links,
    engagementRate: parseEngagementRate(engagementPercentInput),
    heightCm,
    hairColor: hairColor || null,
    hairStyle: hairStyle || null,
    skinType: skinType || null,
    skinNotes: skinNotes || null,
    selfDescription: selfDescription || null,
  });

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    if (!user || !supabaseUrl?.trim() || !supabaseAnonKey?.trim()) return;
    setSaving(true);
    setMessage(null);
    const supabase = createClient(supabaseUrl, supabaseAnonKey);

    const followersCount = parseFollowers(followersInput);
    const engagementRate = parseEngagementRate(engagementPercentInput);
    const heightCmSave = parseHeightCm(heightInput);

    if (heightInput.trim() && heightCmSave === null) {
      setSaving(false);
      setMessage({ type: 'error', text: 'Podaj wzrost w cm (liczba całkowita 120–230) lub zostaw pole puste.' });
      return;
    }

    if (followersInput.trim() && followersCount === null) {
      setSaving(false);
      setMessage({ type: 'error', text: 'Podaj poprawną liczbę followers (liczba całkowita ≥ 0).' });
      return;
    }
    if (engagementPercentInput.trim() && engagementRate === null) {
      setSaving(false);
      setMessage({ type: 'error', text: 'Podaj poprawny ER w zakresie 0–100% (np. 3,5).' });
      return;
    }

    const trimmedLinks: SocialLinksState = {};
    Object.entries(links).forEach(([k, v]) => {
      const t = (v ?? '').trim();
      if (t) trimmedLinks[k] = t;
    });

    const completion = computeInfluencerProfileCompletion({
      category: category || null,
      location: location || null,
      followersCount,
      shippingAddress: shippingAddress.trim() || null,
      socialLinks: trimmedLinks,
      engagementRate,
      heightCm: heightCmSave,
      hairColor: hairColor.trim() || null,
      hairStyle: hairStyle.trim() || null,
      skinType: skinType.trim() || null,
      skinNotes: skinNotes.trim() || null,
      selfDescription: selfDescription.trim() || null,
    });

    const { error: profileErr } = await supabase
      .from('profiles')
      .update({ locale, updated_at: new Date().toISOString() })
      .eq('id', user.id);

    if (profileErr) {
      setSaving(false);
      setMessage({ type: 'error', text: profileErr.message || 'Nie udało się zapisać języka.' });
      return;
    }

    const { error: infErr } = await supabase.from('influencer_profiles').upsert(
      {
        profile_id: user.id,
        category: category.trim() || null,
        location: location.trim() || null,
        followers_count: followersCount,
        engagement_rate: engagementRate,
        height_cm: heightCmSave,
        hair_color: hairColor.trim() || null,
        hair_style: hairStyle.trim() || null,
        skin_type: skinType.trim() || null,
        skin_notes: skinNotes.trim() || null,
        self_description: selfDescription.trim() || null,
        shipping_address_encrypted: shippingAddress.trim() || null,
        social_links: trimmedLinks,
        profile_completion_pct: completion,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'profile_id' }
    );

    setSaving(false);
    if (infErr) {
      setMessage({ type: 'error', text: infErr.message || 'Zapis profilu nie powiódł się.' });
      return;
    }
    setStoredCompletion(completion);
    setMessage({ type: 'success', text: 'Profil został zapisany.' });
  }

  function updateLink(key: SocialKey, value: string) {
    setLinks((prev) => ({ ...prev, [key]: value }));
  }

  if (!supabaseUrl?.trim() || !supabaseAnonKey?.trim()) {
    return (
      <p className="text-base-content/70">Brak konfiguracji. Skonfiguruj Supabase w zmiennych środowiskowych.</p>
    );
  }

  if (loading) {
    return (
      <div className="flex justify-center py-12">
        <span className="loading loading-spinner loading-lg text-primary" />
      </div>
    );
  }

  if (!user) {
    return (
      <div className="rounded-xl border border-base-300 bg-base-100/80 p-8 text-center shadow-sm backdrop-blur-sm">
        <p className="text-base-content/80">Zaloguj się, aby uzupełnić profil i korzystać z kampanii.</p>
        <a href="/login" className="btn btn-crezio-gradient mt-6">
          Zaloguj się
        </a>
      </div>
    );
  }

  return (
    <form onSubmit={handleSave} className="space-y-8">
      <section className="card border border-primary/20 bg-base-100/90 shadow-md backdrop-blur-sm">
        <div className="card-body">
          <h2 className="card-title text-lg">Kompletność profilu</h2>
          <p className="text-sm text-base-content/70">
            Im bardziej kompletny profil, tym lepiej dopasujemy Cię do kampanii beauty i barterowych (PRD).
          </p>
          <div className="mt-4 space-y-2">
            <div className="flex justify-between text-sm font-medium">
              <span>Wskaźnik wypełnienia</span>
              <span className="text-primary">{previewCompletion}%</span>
            </div>
            <progress className="progress progress-primary h-3 w-full" value={previewCompletion} max={100} />
            {storedCompletion != null && storedCompletion !== previewCompletion && (
              <p className="text-xs text-base-content/60">Ostatnio zapisane: {storedCompletion}% — zapisz zmiany, aby zaktualizować.</p>
            )}
          </div>
        </div>
      </section>

      <section className="card bg-base-100 shadow-sm">
        <div className="card-body">
          <h2 className="card-title text-lg">Konto</h2>
          <div className="form-control">
            <label className="label py-1" htmlFor="profile-email">
              <span className="label-text font-medium">E-mail</span>
            </label>
            <input
              id="profile-email"
              type="email"
              className="input input-bordered bg-base-200/50"
              value={user.email ?? ''}
              disabled
              readOnly
            />
            <p className="label-text-alt mt-1 text-base-content/60">Zmiana e-maila wkrótce przez support lub ustawienia konta.</p>
          </div>
          <div className="form-control mt-4 max-w-xs">
            <label className="label py-1" htmlFor="profile-locale">
              <span className="label-text font-medium">Język interfejsu</span>
            </label>
            <select
              id="profile-locale"
              className="select select-bordered w-full"
              value={locale}
              onChange={(e) => setLocale(e.target.value)}
            >
              {LOCALES.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          </div>
        </div>
      </section>

      <section className="card bg-base-100 shadow-sm">
        <div className="card-body">
          <h2 className="card-title text-lg">Dane do kampanii</h2>
          <p className="text-sm text-base-content/70">
            Marki widzą te informacje w kontekście zgłoszeń — ułatwia dopasowanie do testów produktów (np. beauty).
          </p>
          <div className="form-control mt-4">
            <label className="label py-1" htmlFor="profile-self-description">
              <span className="label-text font-medium">Opisz siebie (dopasowanie do testów)</span>
            </label>
            <textarea
              id="profile-self-description"
              className="textarea textarea-bordered min-h-[120px] w-full"
              maxLength={2000}
              placeholder="Kim jesteś jako twórca, jakie treści publikujesz, czym się interesujesz w kontekście testów produktów — pomoże nam ocenić, na ile pasujesz do konkretnej kampanii."
              value={selfDescription}
              onChange={(e) => setSelfDescription(e.target.value)}
              aria-describedby="profile-self-description-hint"
            />
            <p id="profile-self-description-hint" className="label-text-alt mt-1 text-base-content/60">
              Opcjonalnie, maks. 2000 znaków. Wykorzystamy to przy ocenie dopasowania do wymagań marki w teście — zobaczysz też podgląd dopasowania przy kampaniach.
            </p>
          </div>
          <div className="divider my-2 text-xs text-base-content/50">Profil testera</div>
          <p className="text-sm text-base-content/60">
            Uzupełnij, jeśli chcesz lepiej pasować do kampanii kosmetycznych (tonacja, typ skóry, włosy). Wszystkie pola są dobrowolne.
          </p>
          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            <div className="form-control">
              <label className="label py-1" htmlFor="profile-height">
                <span className="label-text font-medium">Wzrost</span>
              </label>
              <div className="input input-bordered flex w-full items-center gap-2">
                <input
                  id="profile-height"
                  type="number"
                  min={120}
                  max={230}
                  step={1}
                  className="grow border-0 bg-transparent p-0 focus:outline-none"
                  placeholder="np. 168"
                  value={heightInput}
                  onChange={(e) => setHeightInput(e.target.value)}
                  inputMode="numeric"
                  aria-describedby="profile-height-hint"
                />
                <span className="text-sm text-base-content/60">cm</span>
              </div>
              <p id="profile-height-hint" className="label-text-alt mt-1">
                Opcjonalnie; zakres 120–230 cm (np. przy doborze rozmiaru odzieży lub próbek).
              </p>
            </div>
            <div className="form-control">
              <label className="label py-1" htmlFor="profile-hair-color">
                <span className="label-text font-medium">Kolor włosów</span>
              </label>
              <input
                id="profile-hair-color"
                type="text"
                className="input input-bordered w-full"
                placeholder="np. ciemny brąz, blond, farbowane"
                value={hairColor}
                onChange={(e) => setHairColor(e.target.value)}
                autoComplete="off"
              />
            </div>
            <div className="form-control sm:col-span-2">
              <label className="label py-1" htmlFor="profile-hair-style">
                <span className="label-text font-medium">Rodzaj włosów</span>
              </label>
              <textarea
                id="profile-hair-style"
                className="textarea textarea-bordered min-h-[80px] w-full"
                placeholder="np. długie do łopatek, cienkie, kręcone, podatne na puszenie…"
                value={hairStyle}
                onChange={(e) => setHairStyle(e.target.value)}
              />
            </div>
            <div className="form-control sm:col-span-2">
              <label className="label py-1" htmlFor="profile-skin-type">
                <span className="label-text font-medium">Typ cery</span>
              </label>
              <select
                id="profile-skin-type"
                className="select select-bordered w-full"
                value={skinType}
                onChange={(e) => setSkinType(e.target.value)}
              >
                {SKIN_TYPES.map((o) => (
                  <option key={o.value || 'empty'} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </select>
            </div>
            <div className="form-control sm:col-span-2">
              <label className="label py-1" htmlFor="profile-skin-notes">
                <span className="label-text font-medium">Dodatkowe informacje o skórze</span>
              </label>
              <textarea
                id="profile-skin-notes"
                className="textarea textarea-bordered min-h-[88px] w-full"
                placeholder="np. skłonność do zaczerwienień, alergie skórne, stany zapalne — tylko to, na czym Ci zależy przy doborze produktów."
                value={skinNotes}
                onChange={(e) => setSkinNotes(e.target.value)}
              />
            </div>
          </div>
          <div className="divider my-6 text-xs text-base-content/50">Zasięgi i kategoria</div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="form-control sm:col-span-2">
              <label className="label py-1" htmlFor="profile-category">
                <span className="label-text font-medium">Kategoria treści</span>
              </label>
              <select
                id="profile-category"
                className="select select-bordered w-full"
                value={category}
                onChange={(e) => setCategory(e.target.value)}
              >
                {CATEGORIES.map((o) => (
                  <option key={o.value || 'empty'} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </select>
            </div>
            <div className="form-control sm:col-span-2">
              <label className="label py-1" htmlFor="profile-location">
                <span className="label-text font-medium">Lokalizacja</span>
              </label>
              <input
                id="profile-location"
                type="text"
                className="input input-bordered w-full"
                placeholder="np. Warszawa, mazowieckie"
                value={location}
                onChange={(e) => setLocation(e.target.value)}
                autoComplete="address-level1"
              />
            </div>
            <div className="form-control">
              <label className="label py-1" htmlFor="profile-followers">
                <span className="label-text font-medium">Liczba followers (łącznie)</span>
              </label>
              <input
                id="profile-followers"
                type="number"
                min={0}
                step={1}
                className="input input-bordered w-full"
                placeholder="np. 12000"
                value={followersInput}
                onChange={(e) => setFollowersInput(e.target.value)}
              />
              <p className="label-text-alt mt-1">Możesz uzupełnić ręcznie; po podłączeniu OAuth wartości mogą być weryfikowane przez API.</p>
            </div>
            <div className="form-control">
              <label className="label py-1" htmlFor="profile-er">
                <span className="label-text font-medium">Engagement rate (ER %)</span>
              </label>
              <input
                id="profile-er"
                type="text"
                inputMode="decimal"
                className="input input-bordered w-full"
                placeholder="np. 3,5"
                value={engagementPercentInput}
                onChange={(e) => setEngagementPercentInput(e.target.value)}
              />
              <p className="label-text-alt mt-1">Opcjonalnie. Format: procent z przecinkiem lub kropką (0–100%).</p>
            </div>
          </div>
        </div>
      </section>

      <section className="card bg-base-100 shadow-sm">
        <div className="card-body">
          <h2 className="card-title text-lg">Adres do wysyłki</h2>
          <p className="text-sm text-base-content/70">
            Używany, gdy marka wybierze Cię do kampanii i będzie przygotowywać przesyłkę produktu. Dane chronimy zgodnie z polityką prywatności (RODO).
          </p>
          <div className="form-control mt-4">
            <label className="label py-1" htmlFor="profile-shipping">
              <span className="label-text font-medium">Pełny adres</span>
            </label>
            <textarea
              id="profile-shipping"
              className="textarea textarea-bordered min-h-[120px] w-full"
              placeholder="Imię i nazwisko, ulica, kod, miasto, telefon…"
              value={shippingAddress}
              onChange={(e) => setShippingAddress(e.target.value)}
              autoComplete="street-address"
            />
          </div>
        </div>
      </section>

      <section className="card bg-base-100 shadow-sm">
        <div className="card-body">
          <h2 className="card-title text-lg">Linki do social media</h2>
          <p className="text-sm text-base-content/70">
            Dodaj publiczne linki do profili — ułatwią weryfikację i kontekst przy zgłoszeniach.
          </p>
          <div className="mt-4 space-y-4">
            {SOCIAL_PLATFORMS.map(({ key, label, placeholder, icon }) => (
              <div key={key} className="form-control">
                <label className="label py-1">
                  <span className="label-text font-medium">
                    <span className="mr-2" aria-hidden="true">
                      {icon}
                    </span>
                    {label}
                  </span>
                </label>
                <input
                  type="url"
                  className="input input-bordered w-full"
                  placeholder={placeholder}
                  value={links[key] ?? ''}
                  onChange={(e) => updateLink(key, e.target.value)}
                  aria-label={`Link do ${label}`}
                />
              </div>
            ))}
          </div>
        </div>
      </section>

      {message && (
        <div
          role="alert"
          className={`alert ${message.type === 'success' ? 'alert-success' : 'alert-error'}`}
        >
          <span>{message.text}</span>
        </div>
      )}

      <div className="flex flex-wrap justify-end gap-3">
        <button type="submit" className="btn btn-crezio-gradient min-w-[200px]" disabled={saving}>
          {saving ? (
            <>
              <span className="loading loading-spinner loading-sm" />
              Zapisywanie…
            </>
          ) : (
            'Zapisz profil'
          )}
        </button>
      </div>
    </form>
  );
}

function parseFollowers(raw: string): number | null {
  const t = raw.trim();
  if (!t) return null;
  const n = Number.parseInt(t, 10);
  if (Number.isNaN(n) || n < 0) return null;
  return n;
}

function parseEngagementRate(raw: string): number | null {
  const t = raw.trim().replace(',', '.');
  if (!t) return null;
  const n = Number.parseFloat(t);
  if (Number.isNaN(n) || n < 0 || n > 100) return null;
  return Math.round((n / 100) * 10000) / 10000;
}

function parseHeightCm(raw: string): number | null {
  const t = raw.trim();
  if (!t) return null;
  const n = Number.parseInt(t, 10);
  if (Number.isNaN(n) || n < 120 || n > 230) return null;
  return n;
}
