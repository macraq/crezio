-- Influencerzy widzą marki powiązane z kampaniami widocznymi w panelu (nazwa przy liście kampanii).
CREATE POLICY brands_select_influencer_visible_campaigns ON public.brands
  FOR SELECT USING (
    public.current_account_type() = 'influencer'
    AND EXISTS (
      SELECT 1
      FROM public.campaigns c
      WHERE c.brand_id = brands.id
        AND c.status IN ('active', 'applications_closed')
    )
  );
