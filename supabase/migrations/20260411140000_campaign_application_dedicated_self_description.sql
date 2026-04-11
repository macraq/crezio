-- Opcjonalny opis przy zgłoszeniu: NULL = użyj `influencer_profiles.self_description`; w przeciwnym razie treść dedykowana pod kampanię.

ALTER TABLE public.campaign_applications
  ADD COLUMN IF NOT EXISTS dedicated_self_description text;

COMMENT ON COLUMN public.campaign_applications.dedicated_self_description IS
  'Tekst od influencera pod tę kampanię; NULL oznacza domyślny opis z profilu (`influencer_profiles.self_description`).';
