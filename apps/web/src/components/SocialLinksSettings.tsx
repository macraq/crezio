import { useEffect, useState } from 'react';
import { createClient } from '@supabase/supabase-js';
import type { User } from '@supabase/supabase-js';

const SOCIAL_PLATFORMS = [
  { key: 'instagram', label: 'Instagram', placeholder: 'https://instagram.com/twoj_profil', icon: '📷' },
  { key: 'tiktok', label: 'TikTok', placeholder: 'https://tiktok.com/@twoj_profil', icon: '🎵' },
  { key: 'youtube', label: 'YouTube', placeholder: 'https://youtube.com/@kanal', icon: '▶️' },
  { key: 'twitter', label: 'X (Twitter)', placeholder: 'https://x.com/twoj_profil', icon: '𝕏' },
  { key: 'facebook', label: 'Facebook', placeholder: 'https://facebook.com/twoj_profil', icon: 'f' },
] as const;

type SocialKey = (typeof SOCIAL_PLATFORMS)[number]['key'];

interface SocialLinksSettingsProps {
  supabaseUrl: string;
  supabaseAnonKey: string;
}

export default function SocialLinksSettings({ supabaseUrl, supabaseAnonKey }: SocialLinksSettingsProps) {
  const [user, setUser] = useState<User | null>(null);
  const [links, setLinks] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

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
      loadSocialLinks(supabase, session.user.id);
    });
  }, [supabaseUrl, supabaseAnonKey]);

  async function loadSocialLinks(supabase: ReturnType<typeof createClient>, profileId: string) {
    const { data, error } = await supabase
      .from('influencer_profiles')
      .select('social_links')
      .eq('profile_id', profileId)
      .maybeSingle();
    if (error) {
      setMessage({ type: 'error', text: 'Nie udało się wczytać linków.' });
      setLoading(false);
      return;
    }
    setLinks((data?.social_links as Record<string, string>) ?? {});
    setLoading(false);
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    if (!user || !supabaseUrl?.trim() || !supabaseAnonKey?.trim()) return;
    setSaving(true);
    setMessage(null);
    const supabase = createClient(supabaseUrl, supabaseAnonKey);
    const trimmed: Record<string, string> = {};
    Object.entries(links).forEach(([k, v]) => {
      const t = (v ?? '').trim();
      if (t) trimmed[k] = t;
    });

    const { error } = await supabase
      .from('influencer_profiles')
      .upsert(
        {
          profile_id: user.id,
          social_links: trimmed,
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'profile_id' }
      );

    setSaving(false);
    if (error) {
      setMessage({ type: 'error', text: error.message || 'Zapis nie powiódł się.' });
      return;
    }
    setMessage({ type: 'success', text: 'Linki do social media zostały zapisane.' });
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
      <div className="flex justify-center py-8">
        <span className="loading loading-spinner loading-md text-primary" />
      </div>
    );
  }

  if (!user) {
    return (
      <div className="rounded-lg bg-base-300 p-6 text-center">
        <p className="text-base-content/80">Zaloguj się, aby zarządzać połączeniami z social media.</p>
        <a href="/login" className="btn btn-primary mt-4">
          Zaloguj się
        </a>
      </div>
    );
  }

  return (
    <section className="card bg-base-100 shadow-sm">
      <div className="card-body">
        <h2 className="card-title text-lg">Połącz social media</h2>
        <p className="text-sm text-base-content/70">
          Dodaj linki do swoich profili. Marki będą mogły je zobaczyć przy Twoim profilu.
        </p>
        <form onSubmit={handleSave} className="mt-4 space-y-4">
          {SOCIAL_PLATFORMS.map(({ key, label, placeholder, icon }) => (
            <div key={key} className="form-control">
              <label className="label py-1">
                <span className="label-text font-medium">
                  <span className="mr-2" aria-hidden="true">{icon}</span>
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
          {message && (
            <div
              role="alert"
              className={`alert ${message.type === 'success' ? 'alert-success' : 'alert-error'}`}
            >
              <span>{message.text}</span>
            </div>
          )}
          <div className="flex justify-end pt-2">
            <button type="submit" className="btn btn-primary" disabled={saving}>
              {saving ? (
                <>
                  <span className="loading loading-spinner loading-sm" />
                  Zapisywanie…
                </>
              ) : (
                'Zapisz linki'
              )}
            </button>
          </div>
        </form>
      </div>
    </section>
  );
}
