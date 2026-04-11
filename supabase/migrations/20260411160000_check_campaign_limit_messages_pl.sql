-- Polskie komunikaty błędów limitu kampanii (trigger check_campaign_limit).

CREATE OR REPLACE FUNCTION public.check_campaign_limit()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  tier subscription_tier;
  active_count integer;
  max_campaigns integer;
  tier_label text;
BEGIN
  SELECT b.subscription_tier INTO tier
  FROM public.brands b WHERE b.id = NEW.brand_id;
  IF tier IS NULL THEN
    RAISE EXCEPTION 'Nieprawidłowy identyfikator marki (brand_id).';
  END IF;
  tier_label := CASE tier
    WHEN 'basic' THEN 'Basic'
    WHEN 'medium' THEN 'Medium'
    WHEN 'platinum' THEN 'Platinum'
    ELSE tier::text
  END;
  max_campaigns := CASE tier
    WHEN 'basic' THEN 1
    WHEN 'medium' THEN 3
    WHEN 'platinum' THEN 10
    ELSE 0
  END;
  SELECT count(*)::integer INTO active_count
  FROM public.campaigns c
  WHERE c.brand_id = NEW.brand_id
    AND c.status IN ('draft', 'active', 'applications_closed')
    AND (TG_OP = 'INSERT' OR c.id != NEW.id);
  IF active_count >= max_campaigns THEN
    RAISE EXCEPTION
      'Przekroczono limit równoległych kampanii dla pakietu %s. Obecnie: %s, maksimum: %s.',
      tier_label,
      active_count,
      max_campaigns;
  END IF;
  RETURN NEW;
END;
$$;
