-- Public (non-PII) influencer profile preview for brand selection flows.
-- Motivation: brands must see reach metrics for applications (US-020) while PII (shipping_address_encrypted)
-- remains available only in 'preparation_for_shipping' (US-021).

-- -----------------------------------------------------------------------------
-- Table: influencer_profiles_public (subset of influencer_profiles without PII)
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.influencer_profiles_public (
  profile_id uuid PRIMARY KEY REFERENCES public.profiles(id) ON DELETE CASCADE,
  category text,
  location text,
  followers_count integer,
  engagement_rate numeric,
  height_cm integer,
  hair_color text,
  hair_style text,
  skin_type text,
  skin_notes text,
  social_links jsonb NOT NULL DEFAULT '{}'::jsonb,
  last_verified_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_influencer_profiles_public_followers ON public.influencer_profiles_public (followers_count);
CREATE INDEX IF NOT EXISTS idx_influencer_profiles_public_er ON public.influencer_profiles_public (engagement_rate);

-- -----------------------------------------------------------------------------
-- Sync trigger from influencer_profiles → influencer_profiles_public
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.sync_influencer_profiles_public()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.influencer_profiles_public (
    profile_id,
    category,
    location,
    followers_count,
    engagement_rate,
    height_cm,
    hair_color,
    hair_style,
    skin_type,
    skin_notes,
    social_links,
    last_verified_at,
    created_at,
    updated_at
  )
  VALUES (
    NEW.profile_id,
    NEW.category,
    NEW.location,
    NEW.followers_count,
    NEW.engagement_rate,
    NEW.height_cm,
    NEW.hair_color,
    NEW.hair_style,
    NEW.skin_type,
    NEW.skin_notes,
    COALESCE(NEW.social_links, '{}'::jsonb),
    NEW.last_verified_at,
    COALESCE(NEW.created_at, now()),
    COALESCE(NEW.updated_at, now())
  )
  ON CONFLICT (profile_id) DO UPDATE SET
    category = EXCLUDED.category,
    location = EXCLUDED.location,
    followers_count = EXCLUDED.followers_count,
    engagement_rate = EXCLUDED.engagement_rate,
    height_cm = EXCLUDED.height_cm,
    hair_color = EXCLUDED.hair_color,
    hair_style = EXCLUDED.hair_style,
    skin_type = EXCLUDED.skin_type,
    skin_notes = EXCLUDED.skin_notes,
    social_links = EXCLUDED.social_links,
    last_verified_at = EXCLUDED.last_verified_at,
    updated_at = now();

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS sync_influencer_profiles_public_on_influencer_profiles ON public.influencer_profiles;
CREATE TRIGGER sync_influencer_profiles_public_on_influencer_profiles
  AFTER INSERT OR UPDATE ON public.influencer_profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.sync_influencer_profiles_public();

-- One-time backfill for existing rows.
INSERT INTO public.influencer_profiles_public (
  profile_id,
  category,
  location,
  followers_count,
  engagement_rate,
  height_cm,
  hair_color,
  hair_style,
  skin_type,
  skin_notes,
  social_links,
  last_verified_at,
  created_at,
  updated_at
)
SELECT
  ip.profile_id,
  ip.category,
  ip.location,
  ip.followers_count,
  ip.engagement_rate,
  ip.height_cm,
  ip.hair_color,
  ip.hair_style,
  ip.skin_type,
  ip.skin_notes,
  COALESCE(ip.social_links, '{}'::jsonb),
  ip.last_verified_at,
  ip.created_at,
  ip.updated_at
FROM public.influencer_profiles ip
ON CONFLICT (profile_id) DO NOTHING;

-- -----------------------------------------------------------------------------
-- RLS: allow brands to read non-PII metrics for applicants to their campaigns
-- -----------------------------------------------------------------------------
ALTER TABLE public.influencer_profiles_public ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS influencer_profiles_public_select_own ON public.influencer_profiles_public;
CREATE POLICY influencer_profiles_public_select_own ON public.influencer_profiles_public
  FOR SELECT USING (
    profile_id = public.current_profile_id()
    OR public.is_admin()
    OR (
      public.current_account_type() = 'brand'
      AND EXISTS (
        SELECT 1
        FROM public.campaign_applications ca
        JOIN public.campaigns c ON c.id = ca.campaign_id
        WHERE ca.influencer_id = influencer_profiles_public.profile_id
          AND c.brand_id = public.current_brand_id()
          AND ca.status IN ('applied', 'selected', 'preparation_for_shipping', 'publication', 'completed')
      )
    )
  );

-- Keep writes restricted (MVP: managed via trigger).
DROP POLICY IF EXISTS influencer_profiles_public_no_write ON public.influencer_profiles_public;
CREATE POLICY influencer_profiles_public_no_write ON public.influencer_profiles_public
  FOR ALL USING (false) WITH CHECK (false);

