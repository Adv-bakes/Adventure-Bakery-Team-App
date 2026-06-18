-- Allow "fsqm" as a sop_documents.type value (in addition to sop/form/policy/training).
-- FSQM (Food Safety Quality Manual) docs parse with structured SOP-style sections but
-- carry their own distinct type/label.
ALTER TABLE public.sop_documents
  DROP CONSTRAINT IF EXISTS sop_documents_type_check;

ALTER TABLE public.sop_documents
  ADD CONSTRAINT sop_documents_type_check
  CHECK (type IN ('sop', 'form', 'policy', 'training', 'fsqm'));
