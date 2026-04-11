-- Opis influencera o sobie — dopasowanie do oczekiń marki w teście (por. campaigns.target_tester_description).

ALTER TABLE public.influencer_profiles
  ADD COLUMN IF NOT EXISTS self_description text;

COMMENT ON COLUMN public.influencer_profiles.self_description IS
  'Swobodny opis influencera o sobie (styl treści, doświadczenie, preferencje) — do analizy dopasowania do kampanii/testów.';
