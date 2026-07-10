-- Dynamic fillable forms: response records + document history snapshots.
--
-- 1. sop_document_history — auto-snapshot of the PRIOR sop_documents row every
--    time a published (status='active') document's watched fields change, so a
--    filled form entry can always be rendered against the exact form revision
--    it was recorded on, even after the form is republished.
-- 2. sop_document_responses — one row per filled-out form instance, pinned to
--    the form's sop_number/revision at creation time.
--
-- NOTE: the dormant scaffold tables sop_versions / form_templates /
-- form_submissions (20260608000001) are deliberately NOT reused — their RLS is
-- incompatible with the draft -> submitted -> admin-reopen lifecycle. They are
-- left untouched.

-- ---------------------------------------------------------------------------
-- 1. History snapshots
-- ---------------------------------------------------------------------------

CREATE TABLE public.sop_document_history (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  document_id    uuid NOT NULL REFERENCES public.sop_documents(id) ON DELETE CASCADE,
  revision       text,                          -- OLD.revision: what the snapshot was published under
  changed_fields text[] NOT NULL DEFAULT '{}',  -- which watched fields differed in the firing update
  snapshot       jsonb NOT NULL,                -- to_jsonb(OLD): the FULL prior row
  snapshotted_at timestamptz NOT NULL DEFAULT now(),
  changed_by     uuid
);

CREATE INDEX sop_document_history_doc_idx
  ON public.sop_document_history (document_id, snapshotted_at DESC);

ALTER TABLE public.sop_document_history ENABLE ROW LEVEL SECURITY;

-- Read-only to staff; rows are written exclusively by the SECURITY DEFINER
-- trigger below, so no INSERT/UPDATE/DELETE policies exist on purpose.
CREATE POLICY "Employees read sop_document_history"
  ON public.sop_document_history FOR SELECT TO authenticated
  USING (public.is_staff_or_admin(auth.uid()));

-- Snapshot trigger. Fires only when the PRIOR row was published
-- (OLD.status = 'active') AND at least one watched field changed. Inside
-- content, only form_schema is watched — slide/narration/quiz/attachment saves
-- churn content constantly and must not spam history. Documented consequence:
-- a body edit on an active doc without a revision/schema change does not
-- snapshot, matching the convention that published changes bump revision.
CREATE OR REPLACE FUNCTION public.snapshot_sop_document()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  changed text[] := '{}';
BEGIN
  IF OLD.revision       IS DISTINCT FROM NEW.revision       THEN changed := changed || 'revision'; END IF;
  IF OLD.sop_number     IS DISTINCT FROM NEW.sop_number     THEN changed := changed || 'sop_number'; END IF;
  IF OLD.title          IS DISTINCT FROM NEW.title          THEN changed := changed || 'title'; END IF;
  IF OLD.effective_date IS DISTINCT FROM NEW.effective_date THEN changed := changed || 'effective_date'; END IF;
  IF OLD.approved_by    IS DISTINCT FROM NEW.approved_by    THEN changed := changed || 'approved_by'; END IF;
  IF OLD.status         IS DISTINCT FROM NEW.status         THEN changed := changed || 'status'; END IF;
  IF (OLD.content -> 'form_schema') IS DISTINCT FROM (NEW.content -> 'form_schema')
                                                            THEN changed := changed || 'form_schema'; END IF;

  IF array_length(changed, 1) IS NULL THEN
    RETURN NEW;
  END IF;

  INSERT INTO public.sop_document_history (document_id, revision, changed_fields, snapshot, changed_by)
  VALUES (OLD.id, OLD.revision, changed, to_jsonb(OLD), auth.uid());
  RETURN NEW;
END;
$$;

CREATE TRIGGER sop_documents_snapshot
  AFTER UPDATE ON public.sop_documents
  FOR EACH ROW
  WHEN (OLD.status = 'active')
  EXECUTE FUNCTION public.snapshot_sop_document();

-- ---------------------------------------------------------------------------
-- 2. Form responses (filled instances)
-- ---------------------------------------------------------------------------

CREATE TABLE public.sop_document_responses (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  -- RESTRICT (not CASCADE): a form with filled entries cannot be hard-deleted;
  -- the app surfaces FK error 23503 as "archive instead" (records retention).
  document_id   uuid NOT NULL REFERENCES public.sop_documents(id) ON DELETE RESTRICT,
  form_number   text,                    -- denormalized sop_number at creation (survives renumbering)
  form_revision text,                    -- denormalized revision at creation — the schema pin
  data          jsonb NOT NULL DEFAULT '{}'::jsonb,
  status        text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','submitted')),
  created_by    uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id),
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now(),
  updated_by    uuid,
  submitted_at  timestamptz,
  submitted_by  uuid,
  reopened_at   timestamptz,             -- audit trail for admin reopen
  reopened_by   uuid
);

CREATE INDEX sop_document_responses_doc_idx
  ON public.sop_document_responses (document_id, created_at DESC);
CREATE INDEX sop_document_responses_creator_idx
  ON public.sop_document_responses (created_by);

-- updated_at doubles as the optimistic-concurrency token (the client updates
-- with .eq("updated_at", <loaded value>) and treats zero rows as a stale edit).
-- Defined here via CREATE OR REPLACE (idempotent, identical body to
-- 20251020220126) rather than assumed to already exist, since that migration's
-- function was found missing on the remote database when this one was applied.
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER sop_document_responses_touch
  BEFORE UPDATE ON public.sop_document_responses
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

ALTER TABLE public.sop_document_responses ENABLE ROW LEVEL SECURITY;

-- Entries are shared compliance records: all staff can read all of them
-- (the Entries tab and Form Records reports are cross-user surfaces).
CREATE POLICY "Employees read responses"
  ON public.sop_document_responses FOR SELECT TO authenticated
  USING (public.is_staff_or_admin(auth.uid()));

CREATE POLICY "Employees insert own responses"
  ON public.sop_document_responses FOR INSERT TO authenticated
  WITH CHECK (public.is_staff_or_admin(auth.uid()) AND created_by = auth.uid());

-- Authors may edit their own row only while it is a draft. Submitting IS an
-- update of a draft row (USING checks the OLD row) whose WITH CHECK permits
-- the resulting status='submitted'; once submitted, USING fails and the row
-- is locked for the filler.
CREATE POLICY "Authors update own drafts"
  ON public.sop_document_responses FOR UPDATE TO authenticated
  USING (public.is_staff_or_admin(auth.uid()) AND created_by = auth.uid() AND status = 'draft')
  WITH CHECK (created_by = auth.uid());

-- has_role(uid,'admin') does not include owner (see 20260623000001), so admin
-- gates check is_owner() too, matching the app's isAdmin = admin || owner.
CREATE POLICY "Admins update responses"
  ON public.sop_document_responses FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'admin') OR public.is_owner(auth.uid()))
  WITH CHECK (true);

-- Deletion is admin-only at the DB level; the per-form settings.deletable=false
-- flag additionally hides the delete affordance in the UI (even for admins).
CREATE POLICY "Admins delete responses"
  ON public.sop_document_responses FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(), 'admin') OR public.is_owner(auth.uid()));
