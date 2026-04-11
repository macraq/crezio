-- Influencerzy widzą kampanie, do których mają zgłoszenie (dowolny status kampanii),
-- np. zakończoną — potrzebne do listy „Moje zgłoszenia” / mini CRM (PRD).
CREATE POLICY campaigns_select_influencer_applied ON public.campaigns
  FOR SELECT USING (
    public.current_account_type() = 'influencer'
    AND EXISTS (
      SELECT 1
      FROM public.campaign_applications ca
      WHERE ca.campaign_id = campaigns.id
        AND ca.influencer_id = public.current_profile_id()
    )
  );
