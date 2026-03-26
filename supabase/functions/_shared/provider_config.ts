/**
 * Konfiguracja OAuth dla Instagram, YouTube, TikTok, Facebook, Twitch, X (Twitter).
 * Zmienne środowiskowe w Supabase: Dashboard → Project Settings → Edge Functions → Secrets
 * np. YOUTUBE_CLIENT_ID, INSTAGRAM_CLIENT_ID, TIKTOK_CLIENT_KEY, FACEBOOK_CLIENT_ID, TWITCH_CLIENT_ID, X_CLIENT_ID + odpowiadające *_SECRET
 */

export type OAuthProvider = 'instagram' | 'youtube' | 'tiktok' | 'facebook' | 'twitch' | 'x';

export interface ProviderConfig {
  authUrl: string;
  tokenUrl: string;
  scopes: string[];
  clientIdEnv: string;
  clientSecretEnv: string;
  /** Nazwa parametru client id w URL autoryzacji (TikTok: client_key) */
  authClientIdKey?: string;
  /** X (Twitter) wymaga PKCE – w oauth-start generujemy code_verifier i zapisujemy w oauth_states */
  usePkce?: boolean;
}

export const PROVIDER_CONFIG: Record<OAuthProvider, ProviderConfig> = {
  youtube: {
    authUrl: 'https://accounts.google.com/o/oauth2/v2/auth',
    tokenUrl: 'https://oauth2.googleapis.com/token',
    scopes: ['https://www.googleapis.com/auth/youtube.readonly'],
    clientIdEnv: 'YOUTUBE_CLIENT_ID',
    clientSecretEnv: 'YOUTUBE_CLIENT_SECRET',
  },
  instagram: {
    // Facebook Login for Instagram Graph API (insights, stats)
    authUrl: 'https://www.facebook.com/v18.0/dialog/oauth',
    tokenUrl: 'https://graph.facebook.com/v18.0/oauth/access_token',
    scopes: ['instagram_basic', 'instagram_manage_insights'],
    clientIdEnv: 'INSTAGRAM_CLIENT_ID',
    clientSecretEnv: 'INSTAGRAM_CLIENT_SECRET',
  },
  tiktok: {
    authUrl: 'https://www.tiktok.com/v2/auth/authorize/',
    tokenUrl: 'https://open.tiktokapis.com/v2/oauth/token/',
    scopes: ['user.info.basic', 'user.info.stats'],
    clientIdEnv: 'TIKTOK_CLIENT_KEY',
    clientSecretEnv: 'TIKTOK_CLIENT_SECRET',
    authClientIdKey: 'client_key',
  },
  facebook: {
    // Facebook Login – strony, statystyki (Graph API)
    authUrl: 'https://www.facebook.com/v18.0/dialog/oauth',
    tokenUrl: 'https://graph.facebook.com/v18.0/oauth/access_token',
    scopes: ['public_profile', 'pages_show_list', 'pages_read_engagement'],
    clientIdEnv: 'FACEBOOK_CLIENT_ID',
    clientSecretEnv: 'FACEBOOK_CLIENT_SECRET',
  },
  twitch: {
    // Twitch OAuth 2.0 – Helix API (kanał, statystyki streamów)
    authUrl: 'https://id.twitch.tv/oauth2/authorize',
    tokenUrl: 'https://id.twitch.tv/oauth2/token',
    scopes: ['user:read:email', 'user:read:broadcast', 'channel:read:analytics'],
    clientIdEnv: 'TWITCH_CLIENT_ID',
    clientSecretEnv: 'TWITCH_CLIENT_SECRET',
  },
  x: {
    // X (Twitter) OAuth 2.0 z PKCE – Twitter API v2 (posty, użytkownik, statystyki)
    authUrl: 'https://twitter.com/i/oauth2/authorize',
    tokenUrl: 'https://api.twitter.com/2/oauth2/token',
    scopes: ['tweet.read', 'users.read', 'offline.access'],
    clientIdEnv: 'X_CLIENT_ID',
    clientSecretEnv: 'X_CLIENT_SECRET',
    usePkce: true,
  },
};

export function getProviderConfig(provider: OAuthProvider): ProviderConfig | null {
  const config = PROVIDER_CONFIG[provider];
  const clientId = Deno.env.get(config.clientIdEnv);
  const clientSecret = Deno.env.get(config.clientSecretEnv);
  if (!clientId || !clientSecret) return null;
  return config;
}
