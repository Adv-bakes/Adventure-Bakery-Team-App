
DROP POLICY IF EXISTS "Public update own draft stage2_prf" ON public.stage2_prf_submissions;

CREATE OR REPLACE FUNCTION public.save_stage2_draft(_id text, _token text, _data jsonb)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  rows_updated int;
BEGIN
  IF _token IS NULL OR length(_token) < 16 THEN
    RETURN false;
  END IF;

  UPDATE public.stage2_prf_submissions
  SET data_json = _data
  WHERE id = _id
    AND draft_token = _token
    AND COALESCE(status, 'draft') = 'draft';

  GET DIAGNOSTICS rows_updated = ROW_COUNT;
  RETURN rows_updated > 0;
END;
$$;

CREATE OR REPLACE FUNCTION public.submit_stage2_draft(_id text, _token text, _data jsonb)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  rows_updated int;
BEGIN
  IF _token IS NULL OR length(_token) < 16 THEN
    RETURN false;
  END IF;

  UPDATE public.stage2_prf_submissions
  SET data_json = _data,
      status = 'submitted',
      submitted_at = now()
  WHERE id = _id
    AND draft_token = _token
    AND COALESCE(status, 'draft') = 'draft';

  GET DIAGNOSTICS rows_updated = ROW_COUNT;
  RETURN rows_updated > 0;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.save_stage2_draft(text, text, jsonb) FROM public;
REVOKE EXECUTE ON FUNCTION public.submit_stage2_draft(text, text, jsonb) FROM public;
GRANT EXECUTE ON FUNCTION public.save_stage2_draft(text, text, jsonb) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.submit_stage2_draft(text, text, jsonb) TO anon, authenticated;
