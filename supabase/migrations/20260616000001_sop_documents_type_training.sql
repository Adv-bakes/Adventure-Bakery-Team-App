-- Allow "training" as a sop_documents.type value (in addition to sop/form/policy).
-- The original inline CHECK auto-named the constraint sop_documents_type_check.
ALTER TABLE public.sop_documents
  DROP CONSTRAINT IF EXISTS sop_documents_type_check;

ALTER TABLE public.sop_documents
  ADD CONSTRAINT sop_documents_type_check
  CHECK (type IN ('sop', 'form', 'policy', 'training'));
