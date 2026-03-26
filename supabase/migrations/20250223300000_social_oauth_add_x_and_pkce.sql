-- Dodanie X (Twitter) oraz kolumny code_verifier dla PKCE (X wymaga OAuth 2.0 z PKCE)

ALTER TABLE public.oauth_states
  ADD COLUMN IF NOT EXISTS code_verifier text;

ALTER TABLE public.oauth_states
  DROP CONSTRAINT IF EXISTS oauth_states_provider_check;

ALTER TABLE public.oauth_states
  ADD CONSTRAINT oauth_states_provider_check CHECK (
    provider IN ('instagram', 'youtube', 'tiktok', 'facebook', 'twitch', 'x')
  );

ALTER TABLE public.social_oauth_connections
  DROP CONSTRAINT IF EXISTS social_oauth_provider_check;

ALTER TABLE public.social_oauth_connections
  ADD CONSTRAINT social_oauth_provider_check CHECK (
    provider IN ('instagram', 'youtube', 'tiktok', 'facebook', 'twitch', 'x')
  );
