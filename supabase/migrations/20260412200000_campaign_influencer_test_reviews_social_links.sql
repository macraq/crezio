-- Linki do postów w social media (prezentacja użycia produktu)
ALTER TABLE public.campaign_influencer_test_reviews
  ADD COLUMN social_post_urls text[] NOT NULL DEFAULT '{}'::text[];

ALTER TABLE public.campaign_influencer_test_reviews
  ADD CONSTRAINT campaign_influencer_test_reviews_social_urls_max5
  CHECK (cardinality(social_post_urls) <= 5);

COMMENT ON COLUMN public.campaign_influencer_test_reviews.social_post_urls IS
  'URL-e do postów (np. Instagram, TikTok); min. 1 przy zapisie — walidacja w aplikacji.';
