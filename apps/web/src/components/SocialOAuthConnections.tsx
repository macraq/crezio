import { useEffect, useState } from 'react';
import { createClient } from '@supabase/supabase-js';
import type { User } from '@supabase/supabase-js';

export interface OAuthConnection {
  id: string;
  provider: 'instagram' | 'youtube' | 'tiktok' | 'facebook' | 'twitch' | 'x';
  username: string | null;
  expires_at: string | null;
}

const PROVIDERS: { key: 'instagram' | 'youtube' | 'tiktok' | 'facebook' | 'twitch' | 'x'; label: string; icon: string }[] = [
  { key: 'instagram', label: 'Instagram', icon: '📷' },
  { key: 'youtube', label: 'YouTube', icon: '▶️' },
  { key: 'tiktok', label: 'TikTok', icon: '🎵' },
  { key: 'facebook', label: 'Facebook', icon: 'f' },
  { key: 'twitch', label: 'Twitch', icon: '🎮' },
  { key: 'x', label: 'X (Twitter)', icon: '𝕏' },
];

interface SocialOAuthConnectionsProps {
  supabaseUrl: string;
  supabaseAnonKey: string;
}

export default function SocialOAuthConnections({ supabaseUrl, supabaseAnonKey }: SocialOAuthConnectionsProps) {
  const [user, setUser] = useState<User | null>(null);
  const [connections, setConnections] = useState<OAuthConnection[]>([]);
  const [loading, setLoading] = useState(true);
  const [connecting, setConnecting] = useState<string | null>(null);
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
      loadConnections(supabase, session.user.id);
    });
  }, [supabaseUrl, supabaseAnonKey]);

  useEffect(() => {
    const params = new URLSearchParams(typeof window !== 'undefined' ? window.location.search : '');
    const connected = params.get('oauth_connected');
    const err = params.get('oauth_error');
    const msg = params.get('oauth_message');
    if (connected) {
      setMessage({ type: 'success', text: `Konto ${connected} zostało połączone.` });
      window.history.replaceState({}, '', '/settings');
    }
    if (err) {
      const text =
        err === 'invalid_state'
          ? 'Sesja OAuth wygasła. Spróbuj ponownie.'
          : err === 'token_exchange_failed'
            ? 'Nie udało się wymienić kodu na token. Sprawdź konfigurację aplikacji.'
            : msg || 'Połączenie nie powiodło się.';
      setMessage({ type: 'error', text });
      window.history.replaceState({}, '', '/settings');
    }
  }, []);

  async function loadConnections(supabase: ReturnType<typeof createClient>, profileId: string) {
    const { data, error } = await supabase
      .from('social_oauth_connections')
      .select('id, provider, username, expires_at')
      .eq('profile_id', profileId);
    if (error) {
      setMessage({ type: 'error', text: 'Nie udało się wczytać połączeń.' });
      setLoading(false);
      return;
    }
    setConnections((data ?? []) as OAuthConnection[]);
    setLoading(false);
  }

  async function handleConnect(provider: 'instagram' | 'youtube' | 'tiktok' | 'facebook' | 'twitch' | 'x') {
    if (!user || !supabaseUrl?.trim()) return;
    const supabase = createClient(supabaseUrl, supabaseAnonKey);
    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.access_token) {
      setMessage({ type: 'error', text: 'Zaloguj się ponownie i spróbuj jeszcze raz.' });
      return;
    }
    setConnecting(provider);
    setMessage(null);
    const functionsUrl = `${supabaseUrl.replace(/\/$/, '')}/functions/v1/oauth-start`;
    try {
      const res = await fetch(functionsUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({ provider }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        setMessage({ type: 'error', text: json.error || `Błąd ${res.status}. Spróbuj później.` });
        setConnecting(null);
        return;
      }
      if (json.redirect_url) {
        window.location.href = json.redirect_url;
        return;
      }
      setMessage({ type: 'error', text: 'Brak adresu przekierowania.' });
    } catch (e) {
      setMessage({ type: 'error', text: 'Nie udało się połączyć. Sprawdź połączenie i CORS.' });
    }
    setConnecting(null);
  }

  async function handleDisconnect(connectionId: string) {
    if (!supabaseUrl?.trim() || !supabaseAnonKey?.trim()) return;
    const supabase = createClient(supabaseUrl, supabaseAnonKey);
    const { error } = await supabase.from('social_oauth_connections').delete().eq('id', connectionId);
    if (error) {
      setMessage({ type: 'error', text: 'Nie udało się odłączyć konta.' });
      return;
    }
    setConnections((prev) => prev.filter((c) => c.id !== connectionId));
    setMessage({ type: 'success', text: 'Konto zostało odłączone.' });
  }

  if (!supabaseUrl?.trim() || !supabaseAnonKey?.trim()) return null;

  if (loading) {
    return (
      <div className="flex justify-center py-6">
        <span className="loading loading-spinner loading-md text-primary" />
      </div>
    );
  }

  if (!user) return null;

  const connectionByProvider = Object.fromEntries(connections.map((c) => [c.provider, c]));

  return (
    <section className="card bg-base-100 shadow-sm">
      <div className="card-body">
        <h2 className="card-title text-lg">Połącz konta (OAuth)</h2>
        <p className="text-sm text-base-content/70">
          Połącz profile, aby później pobierać statystyki i zasięgi z API (kampanie, posty).
        </p>
        {message && (
          <div
            role="alert"
            className={`alert ${message.type === 'success' ? 'alert-success' : 'alert-error'}`}
          >
            <span>{message.text}</span>
          </div>
        )}
        <div className="mt-4 space-y-3">
          {PROVIDERS.map(({ key, label, icon }) => {
            const conn = connectionByProvider[key];
            return (
              <div
                key={key}
                className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-base-300 bg-base-200/50 p-3"
              >
                <span className="font-medium">
                  <span className="mr-2" aria-hidden="true">
                    {icon}
                  </span>
                  {label}
                </span>
                <div className="flex items-center gap-2">
                  {conn ? (
                    <>
                      {conn.username && (
                        <span className="text-sm text-base-content/70">@{conn.username}</span>
                      )}
                      <button
                        type="button"
                        className="btn btn-ghost btn-sm"
                        onClick={() => handleDisconnect(conn.id)}
                      >
                        Odłącz
                      </button>
                    </>
                  ) : (
                    <button
                      type="button"
                      className="btn btn-primary btn-sm"
                      disabled={connecting !== null}
                      onClick={() => handleConnect(key)}
                    >
                      {connecting === key ? (
                        <>
                          <span className="loading loading-spinner loading-xs" />
                          Przekierowanie…
                        </>
                      ) : (
                        'Połącz'
                      )}
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
        <p className="mt-2 text-xs text-base-content/60">
          Wymagana konfiguracja OAuth w Supabase (Edge Functions → Secrets) dla każdej platformy.
        </p>
      </div>
    </section>
  );
}
