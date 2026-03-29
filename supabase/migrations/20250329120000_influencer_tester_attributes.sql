-- Pola profilu testera (beauty) – dopasowanie do kampanii produktowych
ALTER TABLE public.influencer_profiles
  ADD COLUMN IF NOT EXISTS height_cm integer,
  ADD COLUMN IF NOT EXISTS hair_color text,
  ADD COLUMN IF NOT EXISTS hair_style text,
  ADD COLUMN IF NOT EXISTS skin_type text,
  ADD COLUMN IF NOT EXISTS skin_notes text;

ALTER TABLE public.influencer_profiles
  DROP CONSTRAINT IF EXISTS influencer_profiles_height_cm_range;

ALTER TABLE public.influencer_profiles
  ADD CONSTRAINT influencer_profiles_height_cm_range
  CHECK (height_cm IS NULL OR (height_cm >= 120 AND height_cm <= 230));

COMMENT ON COLUMN public.influencer_profiles.height_cm IS 'Wzrost w cm (opcjonalnie, dla dopasowania rozmiaru / kampanii beauty).';
COMMENT ON COLUMN public.influencer_profiles.hair_color IS 'Kolor włosów (opisowy).';
COMMENT ON COLUMN public.influencer_profiles.hair_style IS 'Rodzaj włosów: długość, faktura (np. kręcone, proste).';
COMMENT ON COLUMN public.influencer_profiles.skin_type IS 'Typ cery (np. sucha, tłusta, mieszana).';
COMMENT ON COLUMN public.influencer_profiles.skin_notes IS 'Dodatkowe informacje o skórze (np. wrażliwość, stany).';
