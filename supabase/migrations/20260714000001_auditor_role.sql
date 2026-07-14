-- Read-only SQF-auditor role + multi-role role administration.
--
-- The 3rd-party SQF certification contractor needs to REVIEW the quality system
-- (SOPs, forms + entries, reports, training material) but must never modify or
-- create anything. We add an 'auditor' role that is deliberately OUTSIDE
-- is_staff_or_admin(), so it can never insert form responses, be auto-assigned
-- training, or write any compliance record — enforced by Postgres, not just the
-- UI. We then grant it READ on exactly the compliance surfaces.
--
-- user_roles.role is a TEXT column: the 'owner' role (20260515193228) is stored
-- as text, so 'auditor' needs no enum change. A user may hold several roles at
-- once (user_roles is keyed UNIQUE(user_id, role)); permissions union additively
-- via the EXISTS-based has_role()/is_staff_or_admin() helpers.

-- 1. Compliance-viewer helper: staff/admin/owner OR auditor. Read-only surfaces
--    switch their SELECT gate to this superset; every write policy stays on
--    is_staff_or_admin/admin, so auditor is read-only by construction.
CREATE OR REPLACE FUNCTION public.is_compliance_viewer(_user_id uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT public.is_staff_or_admin(_user_id) OR public.has_role(_user_id, 'auditor');
$$;

-- 2. Grant auditor READ on the compliance document surfaces (rewrite the
--    existing SELECT policies to the viewer superset; INSERT/UPDATE/DELETE
--    policies are left untouched).
DROP POLICY IF EXISTS "Employees read sop_documents" ON public.sop_documents;
CREATE POLICY "Employees read sop_documents"
  ON public.sop_documents FOR SELECT TO authenticated
  USING (public.is_compliance_viewer(auth.uid()));

DROP POLICY IF EXISTS "Employees read responses" ON public.sop_document_responses;
CREATE POLICY "Employees read responses"
  ON public.sop_document_responses FOR SELECT TO authenticated
  USING (public.is_compliance_viewer(auth.uid()));

DROP POLICY IF EXISTS "Employees read sop_document_history" ON public.sop_document_history;
CREATE POLICY "Employees read sop_document_history"
  ON public.sop_document_history FOR SELECT TO authenticated
  USING (public.is_compliance_viewer(auth.uid()));

DROP POLICY IF EXISTS "Employees read quiz_questions" ON public.quiz_questions;
CREATE POLICY "Employees read quiz_questions"
  ON public.quiz_questions FOR SELECT TO authenticated
  USING (public.is_compliance_viewer(auth.uid()));

-- Profiles: auditor must read staff names to render entry authors, signatures,
-- and the Training Compliance roster.
DROP POLICY IF EXISTS "Staff can view all profiles" ON public.profiles;
CREATE POLICY "Staff can view all profiles"
  ON public.profiles FOR SELECT TO authenticated
  USING (public.is_compliance_viewer(auth.uid()));

-- 3. Training assignments: auditor reads all rows (the Training Compliance
--    dashboard = the completion evidence an SQF auditor wants). Read-only —
--    no insert/update is granted to auditor.
DROP POLICY IF EXISTS "Admins read all training_assignments" ON public.training_assignments;
CREATE POLICY "Admins read all training_assignments"
  ON public.training_assignments FOR SELECT TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin')
    OR public.is_owner(auth.uid())
    OR public.has_role(auth.uid(), 'auditor')
  );

-- 4. Storage: auditor reads slide images / SOP attachments / form photos so the
--    training viewer, Reference Documents, and entry attachments render.
DROP POLICY IF EXISTS "Staff can read training content files" ON storage.objects;
CREATE POLICY "Staff can read training content files"
  ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'training-content' AND public.is_compliance_viewer(auth.uid()));

DROP POLICY IF EXISTS "Staff can read form attachments" ON storage.objects;
CREATE POLICY "Staff can read form attachments"
  ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'form-attachments' AND public.is_compliance_viewer(auth.uid()));

-- 5. temperature_logs is provisioned outside migrations (a Hostinger VPS ingests
--    YoLink data). If it exists, add an additive compliance-viewer SELECT policy.
--    We deliberately do NOT enable RLS or drop existing policies here — that
--    could lock out the current staff/ingest access.
DO $$
BEGIN
  IF to_regclass('public.temperature_logs') IS NOT NULL THEN
    DROP POLICY IF EXISTS "Compliance viewers read temperature_logs" ON public.temperature_logs;
    CREATE POLICY "Compliance viewers read temperature_logs"
      ON public.temperature_logs FOR SELECT TO authenticated
      USING (public.is_compliance_viewer(auth.uid()));
  END IF;
END $$;

-- 6. Tighten user_roles WRITE policies for the new in-app role editor.
--    Previously is_staff_or_admin() could write roles — meaning a STAFF user
--    could grant themselves admin. Restrict writes to admin/owner, with an
--    escalation guard: only an OWNER may grant/modify the 'owner'/'admin'
--    roles; an admin may only manage 'staff'/'auditor'/'user' rows (and cannot
--    elevate an existing admin/owner row, since USING checks the OLD role).
DROP POLICY IF EXISTS "Staff/admin insert roles" ON public.user_roles;
DROP POLICY IF EXISTS "Staff/admin update roles" ON public.user_roles;
DROP POLICY IF EXISTS "Staff/admin delete roles" ON public.user_roles;

CREATE POLICY "Admins insert roles"
  ON public.user_roles FOR INSERT TO authenticated
  WITH CHECK (
    public.is_owner(auth.uid())
    OR (public.has_role(auth.uid(), 'admin') AND role IN ('staff', 'auditor', 'user'))
  );

CREATE POLICY "Admins update roles"
  ON public.user_roles FOR UPDATE TO authenticated
  USING (
    public.is_owner(auth.uid())
    OR (public.has_role(auth.uid(), 'admin') AND role IN ('staff', 'auditor', 'user'))
  )
  WITH CHECK (
    public.is_owner(auth.uid())
    OR (public.has_role(auth.uid(), 'admin') AND role IN ('staff', 'auditor', 'user'))
  );

CREATE POLICY "Admins delete roles"
  ON public.user_roles FOR DELETE TO authenticated
  USING (
    public.is_owner(auth.uid())
    OR (public.has_role(auth.uid(), 'admin') AND role IN ('staff', 'auditor', 'user'))
  );
