-- Ocena testu produktu / kampanii przez influencera (po akceptacji zgłoszenia)
CREATE TABLE public.campaign_influencer_test_reviews (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id uuid NOT NULL REFERENCES public.campaigns(id) ON DELETE CASCADE,
  influencer_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  rating smallint NOT NULL,
  review text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT campaign_influencer_test_reviews_rating_range CHECK (rating >= 1 AND rating <= 5),
  CONSTRAINT campaign_influencer_test_reviews_review_len CHECK (review IS NULL OR char_length(review) <= 4000),
  UNIQUE (campaign_id, influencer_id)
);

CREATE INDEX idx_campaign_influencer_test_reviews_campaign ON public.campaign_influencer_test_reviews (campaign_id);

CREATE TRIGGER set_updated_at_on_campaign_influencer_test_reviews
  BEFORE UPDATE ON public.campaign_influencer_test_reviews
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE OR REPLACE FUNCTION public.prevent_campaign_influencer_test_review_key_change()
RETURNS trigger AS $$
BEGIN
  IF TG_OP = 'UPDATE' AND (
    NEW.campaign_id IS DISTINCT FROM OLD.campaign_id
    OR NEW.influencer_id IS DISTINCT FROM OLD.influencer_id
  ) THEN
    RAISE EXCEPTION 'Cannot change campaign_id or influencer_id on test review';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER campaign_influencer_test_reviews_no_key_change
  BEFORE UPDATE ON public.campaign_influencer_test_reviews
  FOR EACH ROW EXECUTE FUNCTION public.prevent_campaign_influencer_test_review_key_change();

ALTER TABLE public.campaign_influencer_test_reviews ENABLE ROW LEVEL SECURITY;

-- Influencer: własny wiersz; marka: recenzje przy swoich kampaniach; admin
CREATE POLICY campaign_influencer_test_reviews_select ON public.campaign_influencer_test_reviews
  FOR SELECT USING (
    public.is_admin()
    OR influencer_id = public.current_profile_id()
    OR EXISTS (
      SELECT 1 FROM public.campaigns c
      WHERE c.id = campaign_id AND c.brand_id = public.current_brand_id()
    )
  );

CREATE POLICY campaign_influencer_test_reviews_insert ON public.campaign_influencer_test_reviews
  FOR INSERT WITH CHECK (
    influencer_id = public.current_profile_id()
    AND public.current_account_type() = 'influencer'
    AND EXISTS (
      SELECT 1 FROM public.campaign_applications ca
      WHERE ca.campaign_id = campaign_influencer_test_reviews.campaign_id
        AND ca.influencer_id = public.current_profile_id()
        AND ca.status IN (
          'selected',
          'preparation_for_shipping',
          'publication',
          'completed'
        )
    )
  );

CREATE POLICY campaign_influencer_test_reviews_update ON public.campaign_influencer_test_reviews
  FOR UPDATE
  USING (
    influencer_id = public.current_profile_id()
    AND public.current_account_type() = 'influencer'
  )
  WITH CHECK (
    influencer_id = public.current_profile_id()
    AND public.current_account_type() = 'influencer'
  );

COMMENT ON TABLE public.campaign_influencer_test_reviews IS
  'Ocena i opis testu produktu przez influencera po wyborze do kampanii.';
