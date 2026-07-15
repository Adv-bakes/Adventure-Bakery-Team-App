-- Preserve the pre-convention document identifier (e.g. "FRM-046-1") when a row is renumbered
-- to the process-stage scheme (e.g. "FRM-301"). Auditors can still find a document by its old
-- number, and the crosswalk stays queryable. Nullable — only populated on migrated rows.
ALTER TABLE public.sop_documents
  ADD COLUMN IF NOT EXISTS legacy_sop_number text;

COMMENT ON COLUMN public.sop_documents.legacy_sop_number IS
  'Prior sop_number before the process-stage numbering convention was applied. See DOCUMENT_REGISTER.md.';
