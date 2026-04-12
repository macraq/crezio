import { useCallback, useEffect, useState, type FormEvent } from 'react';
import type { SupabaseClient, User } from '@supabase/supabase-js';

export interface CampaignInfluencerTestReviewProps {
  supabase: SupabaseClient;
  user: User;
  campaignId: string;
}

const MAX_REVIEW = 4000;
const MAX_SOCIAL_LINKS = 5;
const MIN_SOCIAL_LINKS = 1;

function normalizeUrlInput(raw: string): string {
  const t = raw.trim();
  return t;
}

function isValidHttpUrl(s: string): boolean {
  const t = s.trim();
  if (!t) return false;
  try {
    const u = new URL(t);
    return u.protocol === 'http:' || u.protocol === 'https:';
  } catch {
    return false;
  }
}

export default function CampaignInfluencerTestReview({
  supabase,
  user,
  campaignId,
}: CampaignInfluencerTestReviewProps) {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [rating, setRating] = useState<number>(0);
  const [review, setReview] = useState('');
  /** Edytowalne pola URL; przy zapisie musi zostać 1–5 poprawnych linków. */
  const [socialLinks, setSocialLinks] = useState<string[]>(['']);
  const [savedAt, setSavedAt] = useState<string | null>(null);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  function linksFromDb(raw: unknown): string[] {
    if (!Array.isArray(raw) || raw.length === 0) return [''];
    const strs = raw.filter((x): x is string => typeof x === 'string').map((s) => s.trim());
    if (strs.length === 0) return [''];
    return strs.slice(0, MAX_SOCIAL_LINKS);
  }

  const fetchExisting = useCallback(async () => {
    if (!user?.id || !campaignId) {
      setLoading(false);
      return;
    }
    setLoading(true);
    setMessage(null);
    const { data, error } = await supabase
      .from('campaign_influencer_test_reviews')
      .select('rating,review,social_post_urls,updated_at')
      .eq('campaign_id', campaignId)
      .eq('influencer_id', user.id)
      .maybeSingle();

    if (error) {
      setMessage({ type: 'error', text: error.message });
      setRating(0);
      setReview('');
      setSocialLinks(['']);
      setSavedAt(null);
    } else if (data) {
      setRating(typeof data.rating === 'number' ? data.rating : 0);
      setReview(typeof data.review === 'string' ? data.review : '');
      setSocialLinks(linksFromDb((data as { social_post_urls?: unknown }).social_post_urls));
      setSavedAt(typeof data.updated_at === 'string' ? data.updated_at : null);
    } else {
      setRating(0);
      setReview('');
      setSocialLinks(['']);
      setSavedAt(null);
    }
    setLoading(false);
  }, [supabase, user?.id, campaignId]);

  useEffect(() => {
    void fetchExisting();
  }, [fetchExisting]);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!user?.id || rating < 1 || rating > 5) {
      setMessage({ type: 'error', text: 'Wybierz ocenę od 1 do 5 gwiazdek.' });
      return;
    }
    const trimmed = review.trim();
    if (trimmed.length > MAX_REVIEW) {
      setMessage({ type: 'error', text: `Opis może mieć maks. ${MAX_REVIEW} znaków.` });
      return;
    }

    const normalizedLinks = socialLinks.map(normalizeUrlInput).filter((s) => s.length > 0);
    if (normalizedLinks.length < MIN_SOCIAL_LINKS) {
      setMessage({
        type: 'error',
        text: `Dodaj co najmniej ${MIN_SOCIAL_LINKS} link do postu w mediach społecznościowych (http lub https).`,
      });
      return;
    }
    if (normalizedLinks.length > MAX_SOCIAL_LINKS) {
      setMessage({ type: 'error', text: `Możesz podać maksymalnie ${MAX_SOCIAL_LINKS} linków.` });
      return;
    }
    for (let i = 0; i < normalizedLinks.length; i++) {
      if (!isValidHttpUrl(normalizedLinks[i])) {
        setMessage({
          type: 'error',
          text: `Link ${i + 1} nie jest poprawnym adresem URL (użyj https://… lub http://…).`,
        });
        return;
      }
    }

    setSaving(true);
    setMessage(null);
    const { error } = await supabase.from('campaign_influencer_test_reviews').upsert(
      {
        campaign_id: campaignId,
        influencer_id: user.id,
        rating,
        review: trimmed.length ? trimmed : null,
        social_post_urls: normalizedLinks,
      },
      { onConflict: 'campaign_id,influencer_id' }
    );

    setSaving(false);
    if (error) {
      setMessage({ type: 'error', text: error.message });
      return;
    }
    setMessage({ type: 'success', text: 'Zapisano ocenę i opis testu.' });
    setSavedAt(new Date().toISOString());
  }

  if (loading) {
    return (
      <section className="rounded-2xl border border-base-content/10 bg-base-100/40 p-6">
        <div className="flex justify-center py-8">
          <span className="loading loading-spinner loading-md text-primary" />
        </div>
      </section>
    );
  }

  return (
    <section className="rounded-2xl border border-base-content/10 bg-base-100/40 p-6">
      <h2 className="text-lg font-semibold">Ocena testu</h2>
      <p className="mt-1 text-sm text-base-content/60">
        Oceń testowany produkt (1–5), podaj linki do postów, w których pokazujesz użycie produktu, oraz krótki opis dla marki.
      </p>

      <form className="mt-6 space-y-5" onSubmit={handleSubmit}>
        <div>
          <p className="mb-2 text-sm font-medium text-base-content/80">Ocena</p>
          <div className="flex flex-wrap items-center gap-1" role="group" aria-label="Ocena od 1 do 5">
            {[1, 2, 3, 4, 5].map((n) => {
              const filled = rating >= n;
              return (
                <button
                  key={n}
                  type="button"
                  className={`btn btn-ghost btn-sm gap-0 px-1.5 text-2xl leading-none ${
                    filled ? 'text-warning' : 'text-base-content/25'
                  }`}
                  aria-pressed={filled}
                  aria-label={`${n} ${n === 1 ? 'gwiazdka' : 'gwiazdki'}`}
                  onClick={() => setRating(n)}
                >
                  ★
                </button>
              );
            })}
            {rating > 0 ? (
              <span className="ml-2 text-sm text-base-content/60">
                {rating}/5
              </span>
            ) : (
              <span className="ml-2 text-sm text-base-content/50">wybierz gwiazdki</span>
            )}
          </div>
        </div>

        <div className="form-control">
          <label className="label">
            <span className="label-text font-medium">Linki do postów (social media)</span>
            <span className="label-text-alt text-base-content/50">
              {MIN_SOCIAL_LINKS}–{MAX_SOCIAL_LINKS} linków
            </span>
          </label>
          <p className="mb-2 text-xs text-base-content/55">
            Wklej adresy URL postów, w których pokazujesz produkt i jak sprawia Ci przyjemność (Instagram, TikTok itd.).
          </p>
          <div className="space-y-2">
            {socialLinks.map((link, index) => (
              <div key={index} className="flex gap-2">
                <input
                  type="url"
                  inputMode="url"
                  autoComplete="url"
                  placeholder="https://…"
                  className="input input-bordered input-sm w-full flex-1 font-mono text-sm"
                  value={link}
                  onChange={(e) => {
                    const v = e.target.value;
                    setSocialLinks((prev) => {
                      const next = [...prev];
                      next[index] = v;
                      return next;
                    });
                  }}
                />
                {socialLinks.length > MIN_SOCIAL_LINKS ? (
                  <button
                    type="button"
                    className="btn btn-ghost btn-sm shrink-0"
                    aria-label={`Usuń link ${index + 1}`}
                    onClick={() =>
                      setSocialLinks((prev) =>
                        prev.length <= MIN_SOCIAL_LINKS ? prev : prev.filter((_, i) => i !== index)
                      )
                    }
                  >
                    ✕
                  </button>
                ) : (
                  <span className="w-10 shrink-0" aria-hidden />
                )}
              </div>
            ))}
          </div>
          {socialLinks.length < MAX_SOCIAL_LINKS ? (
            <button
              type="button"
              className="btn btn-outline btn-xs mt-2"
              onClick={() => setSocialLinks((prev) => (prev.length >= MAX_SOCIAL_LINKS ? prev : [...prev, '']))}
            >
              Dodaj kolejny link ({socialLinks.length}/{MAX_SOCIAL_LINKS})
            </button>
          ) : null}
        </div>

        <div className="form-control">
          <label className="label" htmlFor="campaign-test-review">
            <span className="label-text font-medium">Opis (recenzja)</span>
          </label>
          <textarea
            id="campaign-test-review"
            className="textarea textarea-bordered min-h-[120px] w-full text-sm"
            maxLength={MAX_REVIEW}
            placeholder="Jak oceniasz produkt? Co warto przekazać marce?"
            value={review}
            onChange={(e) => setReview(e.target.value)}
          />
          <p className="label-text-alt mt-1 text-base-content/50">
            {review.length}/{MAX_REVIEW}
          </p>
        </div>

        {message ? (
          <p
            className={`text-sm ${message.type === 'success' ? 'text-success' : 'text-error'}`}
            role={message.type === 'error' ? 'alert' : 'status'}
          >
            {message.text}
          </p>
        ) : null}

        {savedAt ? (
          <p className="text-xs text-base-content/50">
            Ostatni zapis:{' '}
            {new Date(savedAt).toLocaleString('pl-PL', {
              day: 'numeric',
              month: 'long',
              year: 'numeric',
              hour: '2-digit',
              minute: '2-digit',
            })}
          </p>
        ) : null}

        <button
          type="submit"
          className="btn btn-primary"
          disabled={saving || rating < 1}
        >
          {saving ? <span className="loading loading-spinner loading-sm" /> : null}
          Zapisz ocenę
        </button>
      </form>
    </section>
  );
}
