
-- 1. Add draft_token column
ALTER TABLE public.stage2_prf_submissions
  ADD COLUMN IF NOT EXISTS draft_token text;

-- 2. Replace public update policy with token-scoped check
DROP POLICY IF EXISTS "Public update draft or submit stage2_prf" ON public.stage2_prf_submissions;

CREATE POLICY "Public update own draft stage2_prf"
ON public.stage2_prf_submissions
FOR UPDATE
TO anon, authenticated
USING (
  COALESCE(status, 'draft') = 'draft'
  AND draft_token IS NOT NULL
  AND draft_token = current_setting('request.headers', true)::json->>'x-draft-token'
)
WITH CHECK (
  id IS NOT NULL
  AND company_stage IS NOT NULL
  AND COALESCE(status, 'draft') = ANY (ARRAY['draft','submitted'])
  AND draft_token IS NOT NULL
  AND draft_token = current_setting('request.headers', true)::json->>'x-draft-token'
);

-- 3. Tighten public insert to require a draft token
DROP POLICY IF EXISTS "Public insert stage2_prf" ON public.stage2_prf_submissions;
CREATE POLICY "Public insert stage2_prf"
ON public.stage2_prf_submissions
FOR INSERT
TO anon, authenticated
WITH CHECK (
  company_stage IS NOT NULL
  AND draft_token IS NOT NULL
  AND length(draft_token) >= 16
);

-- 4. Update get_stage2_draft RPC to require token match
CREATE OR REPLACE FUNCTION public.get_stage2_draft(_id text, _token text DEFAULT NULL)
RETURNS TABLE(id text, company_stage text, status text, data_json jsonb, created_at timestamp with time zone)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  SELECT s.id, s.company_stage, s.status, s.data_json, s.created_at
  FROM public.stage2_prf_submissions s
  WHERE s.id = _id
    AND COALESCE(s.status, 'draft') = 'draft'
    AND (
      public.is_staff_or_admin(auth.uid())
      OR (s.draft_token IS NOT NULL AND s.draft_token = _token)
    )
  LIMIT 1;
$function$;

-- 5. Remove weight_conversions from realtime publication to close channel-topic exposure
ALTER PUBLICATION supabase_realtime DROP TABLE public.weight_conversions;
