CREATE OR REPLACE FUNCTION public.get_prf_prefill_for_token(_token text)
RETURNS jsonb
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  t public.document_send_tokens%ROWTYPE;
  p public.prf_submissions%ROWTYPE;
BEGIN
  IF _token IS NULL OR length(_token) < 16 THEN
    RETURN NULL;
  END IF;
  SELECT * INTO t FROM public.document_send_tokens WHERE token = _token LIMIT 1;
  IF NOT FOUND OR t.expires_at < now() THEN
    RETURN NULL;
  END IF;

  SELECT * INTO p
  FROM public.prf_submissions
  WHERE owner_user_id IS NOT NULL AND owner_user_id::uuid IN (
    SELECT profile_id FROM public.sales_leads WHERE id = t.lead_id AND profile_id IS NOT NULL
  )
  OR (email IS NOT NULL AND lower(email) = lower(t.prospect_email))
  ORDER BY COALESCE(submitted_at, created_at) DESC
  LIMIT 1;

  IF NOT FOUND THEN
    RETURN NULL;
  END IF;

  RETURN jsonb_build_object(
    'product_name', p.product_name,
    'project_type', p.project_type,
    'finished_form', p.finished_form,
    'flavor_type', p.flavor_type,
    'intended_application', p.intended_application,
    'additional_requirements', p.additional_requirements,
    'is_nutraceutical', p.is_nutraceutical,
    'weight_per_unit', p.weight_per_unit,
    'weight_per_unit_unit', p.weight_per_unit_unit,
    'unit_dimension_l', p.unit_dimension_l,
    'unit_dimension_w', p.unit_dimension_w,
    'unit_dimension_h', p.unit_dimension_h,
    'unit_dimension_unit', p.unit_dimension_unit,
    'primary_packaging_vessel', p.primary_packaging_vessel,
    'primary_packaging_other', p.primary_packaging_other,
    'units_per_primary_pack', p.units_per_primary_pack,
    'net_weight_per_primary_pack', p.net_weight_per_primary_pack,
    'net_weight_per_primary_pack_unit', p.net_weight_per_primary_pack_unit,
    'secondary_packaging', p.secondary_packaging,
    'units_per_vessel', p.units_per_vessel,
    'company_name', p.company_name,
    'founder_name', p.founder_name
  );
END;
$$;