-- Fix: "infinite recursion detected in policy for relation campaigns"
-- Cause: policy on campaigns referenced campaign_applications; policy on
-- campaign_applications references campaigns → nested RLS evaluation loops.
-- Fix: existence checks in SECURITY DEFINER helpers with row_security off.

DROP POLICY IF EXISTS campaigns_select_influencer_applied ON public.campaigns;
DROP POLICY IF EXISTS brands_select_influencer_applied_campaigns ON public.brands;

CREATE OR REPLACE FUNCTION public.influencer_has_application_to_campaign(p_campaign_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
SET row_security = off
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.campaign_applications ca
    WHERE ca.campaign_id = p_campaign_id
      AND ca.influencer_id = auth.uid()
  );
$$;

CREATE OR REPLACE FUNCTION public.influencer_has_application_to_brand(p_brand_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
SET row_security = off
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.campaign_applications ca
    INNER JOIN public.campaigns c ON c.id = ca.campaign_id
    WHERE c.brand_id = p_brand_id
      AND ca.influencer_id = auth.uid()
  );
$$;

GRANT EXECUTE ON FUNCTION public.influencer_has_application_to_campaign(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.influencer_has_application_to_brand(uuid) TO authenticated;

CREATE POLICY campaigns_select_influencer_applied ON public.campaigns
  FOR SELECT USING (
    public.current_account_type() = 'influencer'
    AND public.influencer_has_application_to_campaign(id)
  );

CREATE POLICY brands_select_influencer_applied_campaigns ON public.brands
  FOR SELECT USING (
    public.current_account_type() = 'influencer'
    AND public.influencer_has_application_to_brand(id)
  );
