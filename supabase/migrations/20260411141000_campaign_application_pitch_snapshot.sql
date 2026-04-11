-- Pełny tekst opisu w momencie zgłoszenia (profil lub dedykowany) — marka widzi go bez odczytu całego `influencer_profiles` (PII).

ALTER TABLE public.campaign_applications
  ADD COLUMN IF NOT EXISTS pitch_text_at_submit text;

COMMENT ON COLUMN public.campaign_applications.pitch_text_at_submit IS
  'Treść opisu przy zgłoszeniu: kopia z profilu albo dedykowany tekst. `dedicated_self_description` nie-NULL oznacza, że wybrano dedykowany.';
