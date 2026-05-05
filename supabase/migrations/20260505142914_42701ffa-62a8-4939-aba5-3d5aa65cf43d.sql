
-- 1) Fix EXPOSED_SENSITIVE_DATA on stage2_prf_submissions
-- Drop the public read policy and replace with a SECURITY DEFINER RPC that returns
-- a draft by its (unguessable UUID) id only.
DROP POLICY IF EXISTS "Public read draft stage2_prf" ON public.stage2_prf_submissions;

CREATE OR REPLACE FUNCTION public.get_stage2_draft(_id text)
RETURNS TABLE(
  id text,
  company_stage text,
  status text,
  data_json jsonb,
  created_at timestamptz
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT s.id, s.company_stage, s.status, s.data_json, s.created_at
  FROM public.stage2_prf_submissions s
  WHERE s.id = _id
    AND COALESCE(s.status, 'draft') = 'draft'
  LIMIT 1;
$$;

REVOKE ALL ON FUNCTION public.get_stage2_draft(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_stage2_draft(text) TO anon, authenticated;

-- 2) Lock down SECURITY DEFINER functions that should NOT be publicly executable.
REVOKE ALL ON FUNCTION public.cleanup_old_stage2_drafts() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.enqueue_email(text, jsonb) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.read_email_batch(text, integer, integer) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.delete_email(text, bigint) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.move_to_dlq(text, bigint) FROM PUBLIC, anon, authenticated;

-- accept_invitation / validate_invitation_token are called from the client during
-- onboarding, so they must remain callable by anon + authenticated.
-- has_role / is_staff_or_admin are used inside RLS policies and must stay executable.
