-- Powiadomienia na dashboardzie influencera: agregacja po stronie bazy, deduplikacja po campaign_id, limit wyników.

CREATE OR REPLACE FUNCTION public.influencer_dashboard_notifications(p_limit integer DEFAULT 3)
RETURNS TABLE (
  sort_ts timestamptz,
  message text,
  campaign_id uuid
)
LANGUAGE plpgsql
STABLE
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  uid uuid := auth.uid();
  lim integer := GREATEST(1, LEAST(COALESCE(p_limit, 3), 20));
BEGIN
  IF uid IS NULL THEN
    RETURN;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.profiles p
    WHERE p.id = uid AND p.account_type = 'influencer'
  ) THEN
    RETURN;
  END IF;

  RETURN QUERY
  WITH
  new_campaigns AS (
    SELECT
      c.created_at AS ts,
      c.id AS cid,
      format(
        'Nowa kampania: %s • %s',
        b.name,
        left(regexp_replace(coalesce(c.name, ''), E'\\s+', ' ', 'g'), 120)
      ) AS msg
    FROM public.campaigns c
    INNER JOIN public.brands b ON b.id = c.brand_id
    WHERE c.status = 'active'
      AND c.start_date <= now()
      AND c.end_applications_date >= now()
      AND c.created_at >= now() - interval '14 days'
      AND NOT EXISTS (
        SELECT 1
        FROM public.campaign_applications ca
        WHERE ca.campaign_id = c.id
          AND ca.influencer_id = uid
      )
  ),
  application_deadline AS (
    SELECT
      c.end_applications_date AS ts,
      c.id AS cid,
      format(
        'Zbliża się koniec zapisów: %s • %s (do %s)',
        b.name,
        left(regexp_replace(coalesce(c.name, ''), E'\\s+', ' ', 'g'), 80),
        to_char(c.end_applications_date AT TIME ZONE 'Europe/Warsaw', 'DD.MM.YYYY HH24:MI')
      ) AS msg
    FROM public.campaign_applications ca
    INNER JOIN public.campaigns c ON c.id = ca.campaign_id
    INNER JOIN public.brands b ON b.id = c.brand_id
    WHERE ca.influencer_id = uid
      AND ca.status = 'applied'
      AND c.status = 'active'
      AND c.end_applications_date > now()
      AND c.end_applications_date <= now() + interval '72 hours'
  ),
  campaign_end_soon AS (
    SELECT
      c.end_date AS ts,
      c.id AS cid,
      format(
        'Kończy się kampania: %s • %s — uzupełnij materiały / publikację jeśli wymagane (do %s)',
        b.name,
        left(regexp_replace(coalesce(c.name, ''), E'\\s+', ' ', 'g'), 70),
        to_char(c.end_date AT TIME ZONE 'Europe/Warsaw', 'DD.MM.YYYY')
      ) AS msg
    FROM public.campaign_applications ca
    INNER JOIN public.campaigns c ON c.id = ca.campaign_id
    INNER JOIN public.brands b ON b.id = c.brand_id
    WHERE ca.influencer_id = uid
      AND ca.status IN ('selected', 'preparation_for_shipping', 'publication')
      AND c.end_date > now()
      AND c.end_date <= now() + interval '7 days'
  ),
  selected_notice AS (
    SELECT
      ca.updated_at AS ts,
      c.id AS cid,
      format(
        'Zostałeś(-aś) wybrany(-a) do kampanii: %s • %s',
        b.name,
        left(regexp_replace(coalesce(c.name, ''), E'\\s+', ' ', 'g'), 100)
      ) AS msg
    FROM public.campaign_applications ca
    INNER JOIN public.campaigns c ON c.id = ca.campaign_id
    INNER JOIN public.brands b ON b.id = c.brand_id
    WHERE ca.influencer_id = uid
      AND ca.status IN ('selected', 'preparation_for_shipping')
      AND ca.updated_at >= now() - interval '14 days'
  ),
  publication_reminder AS (
    SELECT
      ca.updated_at AS ts,
      c.id AS cid,
      format(
        'Dodaj link do publikacji: %s • %s',
        b.name,
        left(regexp_replace(coalesce(c.name, ''), E'\\s+', ' ', 'g'), 100)
      ) AS msg
    FROM public.campaign_applications ca
    INNER JOIN public.campaigns c ON c.id = ca.campaign_id
    INNER JOIN public.brands b ON b.id = c.brand_id
    WHERE ca.influencer_id = uid
      AND ca.status = 'publication'
      AND (ca.publication_link IS NULL OR btrim(ca.publication_link) = '')
      AND c.end_date > now()
  ),
  candidates AS (
    SELECT * FROM new_campaigns
    UNION ALL
    SELECT * FROM application_deadline
    UNION ALL
    SELECT * FROM campaign_end_soon
    UNION ALL
    SELECT * FROM selected_notice
    UNION ALL
    SELECT * FROM publication_reminder
  ),
  dedup AS (
    SELECT DISTINCT ON (c.cid)
      c.ts,
      c.cid,
      c.msg
    FROM candidates c
    ORDER BY c.cid, c.ts DESC
  )
  SELECT d.ts, d.msg, d.cid
  FROM dedup d
  ORDER BY d.ts DESC
  LIMIT lim;
END;
$$;

COMMENT ON FUNCTION public.influencer_dashboard_notifications(integer) IS
  'Dashboard influencera: do 3 (parametr) powiadomień, jedna pozycja na kampanię (najświeższy wariant).';

GRANT EXECUTE ON FUNCTION public.influencer_dashboard_notifications(integer) TO authenticated;
