-- Nazwa marki przy kampaniach, do których influencer ma zgłoszenie (także zakończone).
CREATE POLICY brands_select_influencer_applied_campaigns ON public.brands
  FOR SELECT USING (
    public.current_account_type() = 'influencer'
    AND EXISTS (
      SELECT 1
      FROM public.campaigns c
      JOIN public.campaign_applications ca ON ca.campaign_id = c.id
      WHERE c.brand_id = brands.id
        AND ca.influencer_id = public.current_profile_id()
    )
  );
