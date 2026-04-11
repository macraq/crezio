-- Oczekiwania co do profilu testerów — treść pod analizę AI i dopasowanie uczestników.
ALTER TABLE public.campaigns
  ADD COLUMN IF NOT EXISTS target_tester_description text;

COMMENT ON COLUMN public.campaigns.target_tester_description IS
  'Opis oczekiwanych uczestników (kto może potwierdzić skuteczność produktu); używane przy dopasowaniu AI.';
