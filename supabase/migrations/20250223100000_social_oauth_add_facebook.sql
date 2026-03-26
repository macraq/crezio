-- Dodanie Facebooka do dozwolonych providerów OAuth (po 20250223000000_social_oauth.sql)

ALTER TABLE public.oauth_states
  DROP CONSTRAINT IF EXISTS oauth_states_provider_check;

ALTER TABLE public.oauth_states
  ADD CONSTRAINT oauth_states_provider_check CHECK (provider IN ('instagram', 'youtube', 'tiktok', 'facebook'));

ALTER TABLE public.social_oauth_connections
  DROP CONSTRAINT IF EXISTS social_oauth_provider_check;

ALTER TABLE public.social_oauth_connections
  ADD CONSTRAINT social_oauth_provider_check CHECK (provider IN ('instagram', 'youtube', 'tiktok', 'facebook'));
