-- Inspiracje na prezentację produktu — widoczne dla testerów (opcjonalne podpowiedzi, nie wymóg).
ALTER TABLE public.campaigns
  ADD COLUMN IF NOT EXISTS presentation_inspiration text;

COMMENT ON COLUMN public.campaigns.presentation_inspiration IS
  'Propozycje jak można pokazać produkt w treści; inspiracja dla testerów — nie zastępuje briefu.';
