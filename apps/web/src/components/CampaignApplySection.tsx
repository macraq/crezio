import { useEffect, useState, type FormEvent } from 'react';
import { createClient } from '@supabase/supabase-js';
import type { User } from '@supabase/supabase-js';

export type PitchMode = 'profile' | 'custom';

export interface CampaignApplySectionProps {
  supabaseUrl: string;
  supabaseAnonKey: string;
  user: User;
  campaignId: string;
  canApply: boolean;
  alreadyApplied: boolean;
  onApplied?: () => void;
  /** Mniejsze odstępy w modalu na liście kampanii. */
  compact?: boolean;
}

const MAX_DEDICATED = 2000;

export default function CampaignApplySection({
  supabaseUrl,
  supabaseAnonKey,
  user,
  campaignId,
  canApply,
  alreadyApplied,
  onApplied,
  compact,
}: CampaignApplySectionProps) {
  const [loadingProfile, setLoadingProfile] = useState(true);
  const [profileSelfDescription, setProfileSelfDescription] = useState<string | null>(null);
  const [pitchMode, setPitchMode] = useState<PitchMode>('profile');
  const [dedicatedText, setDedicatedText] = useState('');
  const [applying, setApplying] = useState(false);
  const [localMessage, setLocalMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  useEffect(() => {
    if (!supabaseUrl?.trim() || !supabaseAnonKey?.trim() || !user?.id) {
      setLoadingProfile(false);
      return;
    }
    const supabase = createClient(supabaseUrl, supabaseAnonKey);
    setLoadingProfile(true);
    supabase
      .from('influencer_profiles')
      .select('self_description')
      .eq('profile_id', user.id)
      .maybeSingle()
      .then(({ data, error }) => {
        if (!error && data?.self_description != null) {
          setProfileSelfDescription(String(data.self_description).trim() || null);
        } else {
          setProfileSelfDescription(null);
        }
        setLoadingProfile(false);
      });
  }, [supabaseUrl, supabaseAnonKey, user?.id]);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!user || !supabaseUrl?.trim() || !supabaseAnonKey?.trim() || !canApply || alreadyApplied) return;

    const trimmedDedicated = dedicatedText.trim();
    const profileTrim = (profileSelfDescription ?? '').trim();
    if (pitchMode === 'custom' && !trimmedDedicated) {
      setLocalMessage({
        type: 'error',
        text: 'Uzupełnij dedykowany opis albo wybierz opis domyślny z profilu.',
      });
      return;
    }

    const pitchTextAtSubmit = pitchMode === 'custom' ? trimmedDedicated : profileTrim;

    setApplying(true);
    setLocalMessage(null);
    const supabase = createClient(supabaseUrl, supabaseAnonKey);
    const { error } = await supabase.from('campaign_applications').insert({
      campaign_id: campaignId,
      influencer_id: user.id,
      dedicated_self_description: pitchMode === 'custom' ? trimmedDedicated : null,
      pitch_text_at_submit: pitchTextAtSubmit || null,
    });
    setApplying(false);

    if (error) {
      if (error.code === '23505') {
        setLocalMessage({ type: 'error', text: 'Masz już zgłoszenie do tej kampanii.' });
      } else {
        setLocalMessage({ type: 'error', text: error.message || 'Zgłoszenie nie powiodło się.' });
      }
      return;
    }
    setLocalMessage({ type: 'success', text: 'Zgłoszenie zostało wysłane.' });
    onApplied?.();
  }

  if (alreadyApplied || !user) {
    return null;
  }

  if (!canApply) {
    return null;
  }

  const sectionClass = compact ? 'space-y-3' : 'space-y-4';
  const preview =
    profileSelfDescription && profileSelfDescription.length > 320
      ? `${profileSelfDescription.slice(0, 320)}…`
      : profileSelfDescription;

  return (
    <form onSubmit={handleSubmit} className={sectionClass}>
      {localMessage ? (
        <div
          role="alert"
          className={`alert text-sm ${localMessage.type === 'success' ? 'alert-success' : 'alert-error'}`}
        >
          <span>{localMessage.text}</span>
        </div>
      ) : null}

      <div className={`rounded-2xl border border-base-content/10 bg-base-100/50 ${compact ? 'p-4' : 'p-6'}`}>
        <h2 className={`font-semibold ${compact ? 'text-base' : 'text-lg'}`}>Twój opis przy zgłoszeniu</h2>
        <p className="mt-2 text-sm text-base-content/75">
          <strong className="font-medium text-base-content">Wskazówka:</strong> dedykowany opis dopasowany do produktu i briefu
          może zwiększyć szanse na zakwalifikowanie do testu — marka widzi, dlaczego pasujesz właśnie do tej kampanii.
        </p>

        {loadingProfile ? (
          <div className="mt-4 flex items-center gap-2 text-sm text-base-content/60">
            <span className="loading loading-spinner loading-sm" />
            Wczytywanie opisu z profilu…
          </div>
        ) : (
          <div className="mt-4 space-y-3">
            <label className="flex cursor-pointer gap-3 rounded-xl border border-base-content/15 bg-base-100/40 p-3 has-[:checked]:border-primary/40 has-[:checked]:bg-primary/5">
              <input
                type="radio"
                name={`pitch-${campaignId}`}
                className="radio radio-primary mt-0.5 shrink-0"
                checked={pitchMode === 'profile'}
                onChange={() => setPitchMode('profile')}
              />
              <span className="min-w-0 text-sm">
                <span className="font-medium text-base-content">Użyj domyślnego opisu z profilu</span>
                {profileSelfDescription ? (
                  <span className="mt-1 block text-base-content/70">
                    Podgląd: <span className="italic">{preview}</span>
                  </span>
                ) : (
                  <span className="mt-1 block text-amber-700/90 dark:text-amber-200/90">
                    Nie masz jeszcze opisu w ustawieniach profilu — rozważ dedykowany opis poniżej lub uzupełnij profil w
                    ustawieniach.
                  </span>
                )}
              </span>
            </label>

            <label className="flex cursor-pointer gap-3 rounded-xl border border-base-content/15 bg-base-100/40 p-3 has-[:checked]:border-primary/40 has-[:checked]:bg-primary/5">
              <input
                type="radio"
                name={`pitch-${campaignId}`}
                className="radio radio-primary mt-0.5 shrink-0"
                checked={pitchMode === 'custom'}
                onChange={() => setPitchMode('custom')}
              />
              <span className="min-w-0 flex-1 text-sm">
                <span className="font-medium text-base-content">Dedykowany opis pod tę kampanię</span>
                <textarea
                  className="textarea textarea-bordered mt-2 min-h-[100px] w-full text-sm"
                  maxLength={MAX_DEDICATED}
                  placeholder="Np. dlaczego ten produkt jest dla Ciebie, jak tworzysz treści w tej kategorii, co chcesz pokazać odbiorcom…"
                  value={dedicatedText}
                  onChange={(e) => setDedicatedText(e.target.value)}
                  onFocus={() => setPitchMode('custom')}
                  disabled={applying}
                  aria-label="Dedykowany opis pod kampanię"
                />
                <p className="label-text-alt mt-1 text-base-content/55">Maks. {MAX_DEDICATED} znaków.</p>
              </span>
            </label>
          </div>
        )}

        <div className={`mt-4 flex flex-wrap items-center gap-3 ${compact ? '' : 'pt-2'}`}>
          <button type="submit" className="btn btn-crezio-gradient" disabled={applying || loadingProfile}>
            {applying ? (
              <>
                <span className="loading loading-spinner loading-sm" />
                Wysyłanie…
              </>
            ) : (
              'Wyślij zgłoszenie'
            )}
          </button>
        </div>
      </div>
    </form>
  );
}
