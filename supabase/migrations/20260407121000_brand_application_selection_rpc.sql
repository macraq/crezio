-- Server-side enforcement for brand selection flow.
-- Prevents bypassing client-side limits (units_count + subscription tier).

CREATE OR REPLACE FUNCTION public.brand_select_application(application_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_brand_id uuid;
  v_campaign_id uuid;
  v_units_count integer;
  v_tier subscription_tier;
  v_max_manual integer;
  v_selected_count integer;
  v_status application_status;
BEGIN
  IF public.current_account_type() <> 'brand' THEN
    RAISE EXCEPTION 'Not a brand account';
  END IF;

  v_brand_id := public.current_brand_id();
  IF v_brand_id IS NULL THEN
    RAISE EXCEPTION 'Brand not found';
  END IF;

  SELECT ca.campaign_id, ca.status
    INTO v_campaign_id, v_status
  FROM public.campaign_applications ca
  JOIN public.campaigns c ON c.id = ca.campaign_id
  WHERE ca.id = application_id
    AND c.brand_id = v_brand_id;

  IF v_campaign_id IS NULL THEN
    RAISE EXCEPTION 'Application not found or access denied';
  END IF;

  IF v_status <> 'applied' THEN
    RAISE EXCEPTION 'Only applied applications can be selected';
  END IF;

  SELECT c.units_count
    INTO v_units_count
  FROM public.campaigns c
  WHERE c.id = v_campaign_id;

  SELECT b.subscription_tier
    INTO v_tier
  FROM public.brands b
  WHERE b.id = v_brand_id;

  IF v_tier = 'basic' THEN
    RAISE EXCEPTION 'Manual selection not available for Basic tier';
  ELSIF v_tier = 'medium' THEN
    v_max_manual := floor(GREATEST(v_units_count, 0) / 2.0);
  ELSE
    v_max_manual := GREATEST(v_units_count, 0);
  END IF;

  SELECT count(*)
    INTO v_selected_count
  FROM public.campaign_applications ca
  WHERE ca.campaign_id = v_campaign_id
    AND ca.status <> 'applied';

  IF v_selected_count >= v_max_manual THEN
    RAISE EXCEPTION 'Manual selection limit reached';
  END IF;

  UPDATE public.campaign_applications
  SET status = 'selected',
      updated_at = now()
  WHERE id = application_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.brand_move_application_to_shipping(application_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_brand_id uuid;
  v_campaign_id uuid;
  v_status application_status;
BEGIN
  IF public.current_account_type() <> 'brand' THEN
    RAISE EXCEPTION 'Not a brand account';
  END IF;

  v_brand_id := public.current_brand_id();
  IF v_brand_id IS NULL THEN
    RAISE EXCEPTION 'Brand not found';
  END IF;

  SELECT ca.campaign_id, ca.status
    INTO v_campaign_id, v_status
  FROM public.campaign_applications ca
  JOIN public.campaigns c ON c.id = ca.campaign_id
  WHERE ca.id = application_id
    AND c.brand_id = v_brand_id;

  IF v_campaign_id IS NULL THEN
    RAISE EXCEPTION 'Application not found or access denied';
  END IF;

  IF v_status <> 'selected' THEN
    RAISE EXCEPTION 'Only selected applications can be moved to shipping';
  END IF;

  UPDATE public.campaign_applications
  SET status = 'preparation_for_shipping',
      updated_at = now()
  WHERE id = application_id;
END;
$$;

