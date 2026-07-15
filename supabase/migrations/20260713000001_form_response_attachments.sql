-- Per-entry file/photo attachments for dynamic fillable forms.
-- Stored as a dedicated column (not folded into `data`) so FormEntry's
-- "Unmapped answers" block never mistakes attachment metadata for a stray
-- schema field, and so attachment saves are independent of the field-level
-- optimistic-concurrency guard used for `data`.

ALTER TABLE public.sop_document_responses
  ADD COLUMN IF NOT EXISTS attachments jsonb NOT NULL DEFAULT '[]'::jsonb;

-- Dedicated storage bucket — private, staff-only. Separate from
-- training-content: response attachments are keyed per-response (many
-- files per response, many responses per form) and need bulk cleanup on
-- entry deletion, unlike training-content's one-file-per-slot convention.
INSERT INTO storage.buckets (id, name, public)
VALUES ('form-attachments', 'form-attachments', false)
ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS "Staff can read form attachments" ON storage.objects;
CREATE POLICY "Staff can read form attachments"
ON storage.objects FOR SELECT TO authenticated
USING (bucket_id = 'form-attachments' AND public.is_staff_or_admin(auth.uid()));

DROP POLICY IF EXISTS "Staff can write form attachments" ON storage.objects;
CREATE POLICY "Staff can write form attachments"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'form-attachments' AND public.is_staff_or_admin(auth.uid()));

DROP POLICY IF EXISTS "Staff can update form attachments" ON storage.objects;
CREATE POLICY "Staff can update form attachments"
ON storage.objects FOR UPDATE TO authenticated
USING (bucket_id = 'form-attachments' AND public.is_staff_or_admin(auth.uid()));

DROP POLICY IF EXISTS "Staff can delete form attachments" ON storage.objects;
CREATE POLICY "Staff can delete form attachments"
ON storage.objects FOR DELETE TO authenticated
USING (bucket_id = 'form-attachments' AND public.is_staff_or_admin(auth.uid()));
