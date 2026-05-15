-- 1) Re-add weight_conversions to realtime
DO $$ BEGIN
  BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.weight_conversions;
  EXCEPTION WHEN duplicate_object THEN NULL;
  END;
END $$;

-- 2) prf_submissions: owner_user_id + backfill + RLS
ALTER TABLE public.prf_submissions
  ADD COLUMN IF NOT EXISTS owner_user_id uuid;

CREATE INDEX IF NOT EXISTS idx_prf_submissions_owner_user_id
  ON public.prf_submissions(owner_user_id);
CREATE INDEX IF NOT EXISTS idx_prf_submissions_email_lower
  ON public.prf_submissions(lower(email));

-- Backfill any existing PRF rows whose email matches an existing auth user
UPDATE public.prf_submissions p
SET owner_user_id = u.id
FROM auth.users u
WHERE p.owner_user_id IS NULL
  AND p.email IS NOT NULL
  AND lower(u.email) = lower(p.email);

-- Trigger function: when a new auth user is created, claim any matching PRFs
CREATE OR REPLACE FUNCTION public.claim_prfs_for_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.prf_submissions
  SET owner_user_id = NEW.id
  WHERE owner_user_id IS NULL
    AND email IS NOT NULL
    AND lower(email) = lower(NEW.email);
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created_claim_prfs ON auth.users;
CREATE TRIGGER on_auth_user_created_claim_prfs
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.claim_prfs_for_new_user();

-- Client SELECT/UPDATE policies on their own PRFs
DROP POLICY IF EXISTS "Owners read own prf_submissions" ON public.prf_submissions;
CREATE POLICY "Owners read own prf_submissions"
  ON public.prf_submissions FOR SELECT
  TO authenticated
  USING (auth.uid() = owner_user_id);

DROP POLICY IF EXISTS "Owners update own editable prf_submissions" ON public.prf_submissions;
CREATE POLICY "Owners update own editable prf_submissions"
  ON public.prf_submissions FOR UPDATE
  TO authenticated
  USING (auth.uid() = owner_user_id
         AND COALESCE(status, 'new') IN ('new', 'draft', 'needs_revision'))
  WITH CHECK (auth.uid() = owner_user_id);

-- 3) client_activity table
CREATE TABLE IF NOT EXISTS public.client_activity (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id uuid NOT NULL,
  actor_id uuid,
  action text NOT NULL,
  payload jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_client_activity_client_id
  ON public.client_activity(client_id, created_at DESC);

ALTER TABLE public.client_activity ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Staff/admin read client_activity" ON public.client_activity;
CREATE POLICY "Staff/admin read client_activity"
  ON public.client_activity FOR SELECT
  TO authenticated
  USING (is_staff_or_admin(auth.uid()));

DROP POLICY IF EXISTS "Staff/admin insert client_activity" ON public.client_activity;
CREATE POLICY "Staff/admin insert client_activity"
  ON public.client_activity FOR INSERT
  TO authenticated
  WITH CHECK (is_staff_or_admin(auth.uid()));