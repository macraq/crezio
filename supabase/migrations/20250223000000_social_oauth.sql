-- =============================================================================
-- OAuth połączenia z social media (Instagram, TikTok, YouTube) – statystyki / zasięgi
-- Uruchomić po 20250222000001_rls.sql
-- =============================================================================

-- Stany OAuth (state → profile_id, provider) – krótkożyciowe, do callbacku
CREATE TABLE public.oauth_states (
  state uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  provider text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT oauth_states_provider_check CHECK (provider IN ('instagram', 'youtube', 'tiktok'))
);

CREATE INDEX idx_oauth_states_created_at ON public.oauth_states (created_at);

-- Połączenia OAuth: tokeny do wywołań API (zasięgi, statystyki)
-- W produkcji rozważ Supabase Vault lub szyfrowanie kolumn z tokenami
CREATE TABLE public.social_oauth_connections (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  provider text NOT NULL,
  access_token text NOT NULL,
  refresh_token text,
  expires_at timestamptz,
  external_user_id text,
  username text,
  scopes text[] DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (profile_id, provider),
  CONSTRAINT social_oauth_provider_check CHECK (provider IN ('instagram', 'youtube', 'tiktok'))
);

CREATE INDEX idx_social_oauth_connections_profile ON public.social_oauth_connections (profile_id);
CREATE INDEX idx_social_oauth_connections_expires ON public.social_oauth_connections (expires_at) WHERE expires_at IS NOT NULL;

-- Trigger updated_at
CREATE TRIGGER set_updated_at_on_social_oauth_connections
  BEFORE UPDATE ON public.social_oauth_connections
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- RLS
ALTER TABLE public.oauth_states ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.social_oauth_connections ENABLE ROW LEVEL SECURITY;

-- oauth_states: tylko własne wiersze (Edge Function używa service_role lub sprawdza po state w callbacku)
CREATE POLICY oauth_states_insert_own ON public.oauth_states
  FOR INSERT WITH CHECK (profile_id = public.current_profile_id());

CREATE POLICY oauth_states_select_own ON public.oauth_states
  FOR SELECT USING (profile_id = public.current_profile_id());

CREATE POLICY oauth_states_delete_own ON public.oauth_states
  FOR DELETE USING (profile_id = public.current_profile_id());

-- social_oauth_connections: influencer tylko swoje
CREATE POLICY social_oauth_select_own ON public.social_oauth_connections
  FOR SELECT USING (profile_id = public.current_profile_id());

CREATE POLICY social_oauth_insert_own ON public.social_oauth_connections
  FOR INSERT WITH CHECK (profile_id = public.current_profile_id());

CREATE POLICY social_oauth_update_own ON public.social_oauth_connections
  FOR UPDATE USING (profile_id = public.current_profile_id());

CREATE POLICY social_oauth_delete_own ON public.social_oauth_connections
  FOR DELETE USING (profile_id = public.current_profile_id());

COMMENT ON TABLE public.social_oauth_connections IS 'Tokeny OAuth do API social media (Instagram Graph, TikTok, YouTube) – zasięgi i statystyki kampanii.';
