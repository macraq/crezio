-- =============================================================================
-- Influencer Marketing Platform (MVP) – schemat PostgreSQL / Supabase
-- Kolejność: 20250222000000_schema.sql → 20250222000001_rls.sql
-- Wymagane: schemat auth (Supabase) z tabelą auth.users
-- =============================================================================

-- -----------------------------------------------------------------------------
-- ENUMy
-- -----------------------------------------------------------------------------
CREATE TYPE account_type AS ENUM ('influencer', 'brand', 'admin');
CREATE TYPE subscription_tier AS ENUM ('basic', 'medium', 'platinum');
CREATE TYPE campaign_status AS ENUM ('draft', 'active', 'applications_closed', 'ended');
CREATE TYPE application_status AS ENUM (
  'applied',
  'selected',
  'preparation_for_shipping',
  'publication',
  'completed'
);

-- -----------------------------------------------------------------------------
-- Tabela profili (1:1 z auth.users)
-- -----------------------------------------------------------------------------
CREATE TABLE public.profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  account_type account_type NOT NULL,
  terms_accepted_at timestamptz,
  privacy_accepted_at timestamptz,
  locale text NOT NULL DEFAULT 'pl',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT terms_and_privacy_required CHECK (
    (account_type = 'admin')
    OR (terms_accepted_at IS NOT NULL AND privacy_accepted_at IS NOT NULL)
  )
);

-- -----------------------------------------------------------------------------
-- Dane rozszerzone: influencer
-- -----------------------------------------------------------------------------
CREATE TABLE public.influencer_profiles (
  profile_id uuid PRIMARY KEY REFERENCES public.profiles(id) ON DELETE CASCADE,
  shipping_address_encrypted text,
  category text,
  location text,
  followers_count integer,
  engagement_rate numeric(5,4),
  social_links jsonb DEFAULT '{}',
  profile_completion_pct integer DEFAULT 0,
  is_premium boolean NOT NULL DEFAULT false,
  last_verified_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT profile_completion_range CHECK (profile_completion_pct >= 0 AND profile_completion_pct <= 100),
  CONSTRAINT followers_non_negative CHECK (followers_count IS NULL OR followers_count >= 0),
  CONSTRAINT engagement_rate_range CHECK (engagement_rate IS NULL OR (engagement_rate >= 0 AND engagement_rate <= 1))
);

-- -----------------------------------------------------------------------------
-- Dane rozszerzone: marka
-- -----------------------------------------------------------------------------
CREATE TABLE public.brands (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id uuid NOT NULL UNIQUE REFERENCES public.profiles(id) ON DELETE CASCADE,
  name text NOT NULL,
  industry text,
  contact text,
  subscription_tier subscription_tier NOT NULL DEFAULT 'basic',
  subscription_active boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- -----------------------------------------------------------------------------
-- Kampanie
-- -----------------------------------------------------------------------------
CREATE TABLE public.campaigns (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  brand_id uuid NOT NULL REFERENCES public.brands(id) ON DELETE CASCADE,
  name text NOT NULL,
  description text,
  units_count integer NOT NULL,
  content_type text NOT NULL,
  category text,
  start_date timestamptz NOT NULL,
  end_applications_date timestamptz NOT NULL,
  end_date timestamptz NOT NULL,
  status campaign_status NOT NULL DEFAULT 'draft',
  auto_status_change boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT dates_order CHECK (
    start_date < end_applications_date
    AND end_applications_date <= end_date
  ),
  CONSTRAINT units_positive CHECK (units_count > 0)
);

CREATE INDEX idx_campaigns_status_dates ON public.campaigns (status, start_date, end_applications_date);
CREATE INDEX idx_campaigns_brand_id ON public.campaigns (brand_id);
CREATE INDEX idx_campaigns_content_type ON public.campaigns (content_type);
CREATE INDEX idx_campaigns_category ON public.campaigns (category);

-- -----------------------------------------------------------------------------
-- Zgłoszenia do kampanii
-- -----------------------------------------------------------------------------
CREATE TABLE public.campaign_applications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id uuid NOT NULL REFERENCES public.campaigns(id) ON DELETE CASCADE,
  influencer_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  status application_status NOT NULL DEFAULT 'applied',
  brief text,
  materials_from_brand text,
  deadline date,
  publication_link text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (campaign_id, influencer_id)
);

CREATE INDEX idx_campaign_applications_campaign_id ON public.campaign_applications (campaign_id);
CREATE INDEX idx_campaign_applications_influencer_id ON public.campaign_applications (influencer_id);
CREATE INDEX idx_campaign_applications_status ON public.campaign_applications (status);

-- -----------------------------------------------------------------------------
-- Oceny influencera od marki
-- -----------------------------------------------------------------------------
CREATE TABLE public.influencer_ratings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  brand_id uuid NOT NULL REFERENCES public.brands(id) ON DELETE CASCADE,
  influencer_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  campaign_id uuid NOT NULL REFERENCES public.campaigns(id) ON DELETE CASCADE,
  score smallint NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT score_range CHECK (score >= 1 AND score <= 5)
);

CREATE INDEX idx_influencer_ratings_influencer_brand ON public.influencer_ratings (influencer_id, brand_id);
CREATE INDEX idx_influencer_ratings_campaign ON public.influencer_ratings (campaign_id);

-- -----------------------------------------------------------------------------
-- Logi audytu
-- -----------------------------------------------------------------------------
CREATE TABLE public.audit_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  actor_type account_type,
  action text NOT NULL,
  entity_type text,
  entity_id uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_audit_logs_created_at ON public.audit_logs (created_at);
CREATE INDEX idx_audit_logs_actor ON public.audit_logs (actor_id, created_at);

-- -----------------------------------------------------------------------------
-- Powiadomienia
-- -----------------------------------------------------------------------------
CREATE TABLE public.notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  type text NOT NULL,
  payload jsonb DEFAULT '{}',
  read_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_notifications_user_read ON public.notifications (user_id, read_at);
CREATE INDEX idx_notifications_created_at ON public.notifications (created_at);

-- -----------------------------------------------------------------------------
-- Sesje
-- -----------------------------------------------------------------------------
CREATE TABLE public.sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  jti text UNIQUE,
  expires_at timestamptz NOT NULL,
  revoked_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_sessions_user_expires ON public.sessions (user_id, expires_at);
CREATE INDEX idx_sessions_jti ON public.sessions (jti) WHERE jti IS NOT NULL;

-- -----------------------------------------------------------------------------
-- Trigger: limit równoległych kampanii (Basic 1, Medium 3, Platinum 10)
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.check_campaign_limit()
RETURNS trigger AS $$
DECLARE
  tier subscription_tier;
  active_count integer;
  max_campaigns integer;
BEGIN
  SELECT b.subscription_tier INTO tier
  FROM public.brands b WHERE b.id = NEW.brand_id;
  IF tier IS NULL THEN
    RAISE EXCEPTION 'brand_id invalid';
  END IF;
  max_campaigns := CASE tier
    WHEN 'basic' THEN 1
    WHEN 'medium' THEN 3
    WHEN 'platinum' THEN 10
    ELSE 0
  END;
  SELECT count(*)::integer INTO active_count
  FROM public.campaigns c
  WHERE c.brand_id = NEW.brand_id
    AND c.status IN ('draft', 'active', 'applications_closed')
    AND (TG_OP = 'INSERT' OR c.id != NEW.id);
  IF active_count >= max_campaigns THEN
    RAISE EXCEPTION 'Campaign limit exceeded for subscription tier %. Current: %, max: %', tier, active_count, max_campaigns;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS check_campaign_limit_trigger ON public.campaigns;
CREATE TRIGGER check_campaign_limit_trigger
  BEFORE INSERT OR UPDATE OF brand_id, status ON public.campaigns
  FOR EACH ROW EXECUTE FUNCTION public.check_campaign_limit();

-- -----------------------------------------------------------------------------
-- Widok PII: adres wysyłki tylko gdy status = preparation_for_shipping
-- -----------------------------------------------------------------------------
CREATE OR REPLACE VIEW public.influencer_shipping_for_brand AS
SELECT
  ca.id AS application_id,
  ca.campaign_id,
  c.brand_id,
  ca.influencer_id,
  ip.shipping_address_encrypted,
  ca.status
FROM public.campaign_applications ca
JOIN public.campaigns c ON c.id = ca.campaign_id
JOIN public.influencer_profiles ip ON ip.profile_id = ca.influencer_id
WHERE ca.status = 'preparation_for_shipping';

-- -----------------------------------------------------------------------------
-- Indeksy pod sortowanie listy zgłoszeń
-- -----------------------------------------------------------------------------
CREATE INDEX idx_influencer_profiles_category_followers ON public.influencer_profiles (category, followers_count);
CREATE INDEX idx_influencer_profiles_engagement_rate ON public.influencer_profiles (engagement_rate) WHERE engagement_rate IS NOT NULL;

-- -----------------------------------------------------------------------------
-- Trigger: aktualizacja updated_at
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS trigger AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS set_updated_at_on_profiles ON public.profiles;
CREATE TRIGGER set_updated_at_on_profiles
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS set_updated_at_on_influencer_profiles ON public.influencer_profiles;
CREATE TRIGGER set_updated_at_on_influencer_profiles
  BEFORE UPDATE ON public.influencer_profiles
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS set_updated_at_on_brands ON public.brands;
CREATE TRIGGER set_updated_at_on_brands
  BEFORE UPDATE ON public.brands
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS set_updated_at_on_campaigns ON public.campaigns;
CREATE TRIGGER set_updated_at_on_campaigns
  BEFORE UPDATE ON public.campaigns
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS set_updated_at_on_campaign_applications ON public.campaign_applications;
CREATE TRIGGER set_updated_at_on_campaign_applications
  BEFORE UPDATE ON public.campaign_applications
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
