-- =============================================================================
-- RLS (Row Level Security) – polityki i funkcje pomocnicze
-- Uruchomić po 20250222000000_schema.sql. Supabase: auth.uid() = auth.users.id = profiles.id
-- =============================================================================

-- -----------------------------------------------------------------------------
-- Funkcje pomocnicze
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.current_profile_id()
RETURNS uuid AS $$
  SELECT auth.uid()
$$ LANGUAGE sql STABLE SECURITY DEFINER;

CREATE OR REPLACE FUNCTION public.current_account_type()
RETURNS account_type AS $$
  SELECT account_type FROM public.profiles WHERE id = auth.uid()
$$ LANGUAGE sql STABLE SECURITY DEFINER;

CREATE OR REPLACE FUNCTION public.current_brand_id()
RETURNS uuid AS $$
  SELECT id FROM public.brands WHERE profile_id = auth.uid()
$$ LANGUAGE sql STABLE SECURITY DEFINER;

CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS boolean AS $$
  SELECT EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND account_type = 'admin')
$$ LANGUAGE sql STABLE SECURITY DEFINER;

-- -----------------------------------------------------------------------------
-- Włączenie RLS
-- -----------------------------------------------------------------------------
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.influencer_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.brands ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.campaigns ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.campaign_applications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.influencer_ratings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;

-- -----------------------------------------------------------------------------
-- profiles
-- -----------------------------------------------------------------------------
CREATE POLICY profiles_select_own ON public.profiles
  FOR SELECT USING (id = public.current_profile_id() OR public.is_admin());

CREATE POLICY profiles_insert_own ON public.profiles
  FOR INSERT WITH CHECK (id = auth.uid());

CREATE POLICY profiles_update_own ON public.profiles
  FOR UPDATE USING (id = public.current_profile_id());

-- -----------------------------------------------------------------------------
-- influencer_profiles
-- -----------------------------------------------------------------------------
CREATE POLICY influencer_profiles_select_own ON public.influencer_profiles
  FOR SELECT USING (
    profile_id = public.current_profile_id()
    OR public.is_admin()
    OR (
      public.current_account_type() = 'brand'
      AND EXISTS (
        SELECT 1 FROM public.campaign_applications ca
        JOIN public.campaigns c ON c.id = ca.campaign_id
        WHERE ca.influencer_id = influencer_profiles.profile_id
          AND c.brand_id = public.current_brand_id()
          AND ca.status = 'preparation_for_shipping'
      )
    )
  );

CREATE POLICY influencer_profiles_insert_own ON public.influencer_profiles
  FOR INSERT WITH CHECK (profile_id = public.current_profile_id());

CREATE POLICY influencer_profiles_update_own ON public.influencer_profiles
  FOR UPDATE USING (profile_id = public.current_profile_id() OR public.is_admin());

-- -----------------------------------------------------------------------------
-- brands
-- -----------------------------------------------------------------------------
CREATE POLICY brands_select_own_or_admin ON public.brands
  FOR SELECT USING (profile_id = public.current_profile_id() OR public.is_admin());

CREATE POLICY brands_insert_own ON public.brands
  FOR INSERT WITH CHECK (profile_id = public.current_profile_id());

CREATE POLICY brands_update_own ON public.brands
  FOR UPDATE USING (profile_id = public.current_profile_id() OR public.is_admin());

-- -----------------------------------------------------------------------------
-- campaigns
-- -----------------------------------------------------------------------------
CREATE POLICY campaigns_select ON public.campaigns
  FOR SELECT USING (
    public.is_admin()
    OR brand_id = public.current_brand_id()
    OR (
      public.current_account_type() = 'influencer'
      AND status IN ('active', 'applications_closed')
    )
  );

CREATE POLICY campaigns_insert_brand ON public.campaigns
  FOR INSERT WITH CHECK (
    brand_id = public.current_brand_id()
    AND public.current_account_type() = 'brand'
  );

CREATE POLICY campaigns_update_own ON public.campaigns
  FOR UPDATE USING (brand_id = public.current_brand_id() OR public.is_admin());

-- -----------------------------------------------------------------------------
-- campaign_applications
-- -----------------------------------------------------------------------------
CREATE POLICY campaign_applications_select ON public.campaign_applications
  FOR SELECT USING (
    public.is_admin()
    OR influencer_id = public.current_profile_id()
    OR EXISTS (SELECT 1 FROM public.campaigns c WHERE c.id = campaign_id AND c.brand_id = public.current_brand_id())
  );

CREATE POLICY campaign_applications_insert_influencer ON public.campaign_applications
  FOR INSERT WITH CHECK (
    influencer_id = public.current_profile_id()
    AND public.current_account_type() = 'influencer'
  );

CREATE POLICY campaign_applications_update ON public.campaign_applications
  FOR UPDATE USING (
    influencer_id = public.current_profile_id()
    OR EXISTS (SELECT 1 FROM public.campaigns c WHERE c.id = campaign_id AND c.brand_id = public.current_brand_id())
    OR public.is_admin()
  );

-- -----------------------------------------------------------------------------
-- influencer_ratings
-- -----------------------------------------------------------------------------
CREATE POLICY influencer_ratings_select ON public.influencer_ratings
  FOR SELECT USING (brand_id = public.current_brand_id() OR public.is_admin());

CREATE POLICY influencer_ratings_insert_brand ON public.influencer_ratings
  FOR INSERT WITH CHECK (
    brand_id = public.current_brand_id()
    AND public.current_account_type() = 'brand'
  );

CREATE POLICY influencer_ratings_update_brand ON public.influencer_ratings
  FOR UPDATE USING (brand_id = public.current_brand_id() OR public.is_admin());

-- -----------------------------------------------------------------------------
-- notifications
-- -----------------------------------------------------------------------------
CREATE POLICY notifications_select_own ON public.notifications
  FOR SELECT USING (user_id = public.current_profile_id());

CREATE POLICY notifications_update_own ON public.notifications
  FOR UPDATE USING (user_id = public.current_profile_id());

CREATE POLICY notifications_insert ON public.notifications
  FOR INSERT WITH CHECK (user_id = public.current_profile_id());

-- -----------------------------------------------------------------------------
-- sessions
-- -----------------------------------------------------------------------------
CREATE POLICY sessions_select_own ON public.sessions
  FOR SELECT USING (user_id = public.current_profile_id());

CREATE POLICY sessions_insert_own ON public.sessions
  FOR INSERT WITH CHECK (user_id = public.current_profile_id());

CREATE POLICY sessions_update_own ON public.sessions
  FOR UPDATE USING (user_id = public.current_profile_id());

CREATE POLICY sessions_delete_own ON public.sessions
  FOR DELETE USING (user_id = public.current_profile_id());

-- -----------------------------------------------------------------------------
-- audit_logs
-- -----------------------------------------------------------------------------
CREATE POLICY audit_logs_select_admin ON public.audit_logs
  FOR SELECT USING (public.is_admin());

CREATE POLICY audit_logs_insert ON public.audit_logs
  FOR INSERT WITH CHECK (true);
