-- Inspiracje na prezentację: odczyt dla influencera tylko po wyborze do kampanii (nie przez zwykły SELECT wiersza).

CREATE OR REPLACE FUNCTION public.get_presentation_inspiration_for_selected_influencer(p_campaign_id uuid)
RETURNS text
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
SET row_security = off
AS $$
  SELECT c.presentation_inspiration
  FROM public.campaigns c
  INNER JOIN public.campaign_applications ca
    ON ca.campaign_id = c.id
   AND ca.influencer_id = auth.uid()
  WHERE c.id = p_campaign_id
    AND ca.status IN (
      'selected',
      'preparation_for_shipping',
      'publication',
      'completed'
    );
$$;

COMMENT ON FUNCTION public.get_presentation_inspiration_for_selected_influencer(uuid) IS
  'Zwraca presentation_inspiration tylko gdy zalogowany influencer ma zgłoszenie w statusie po wyborze.';

GRANT EXECUTE ON FUNCTION public.get_presentation_inspiration_for_selected_influencer(uuid) TO authenticated;
