-- approved_by stores approval initials (e.g. "JD") from SOP header tables, not a user reference
ALTER TABLE public.sop_documents
  DROP CONSTRAINT IF EXISTS sop_documents_approved_by_fkey;

ALTER TABLE public.sop_documents
  ALTER COLUMN approved_by TYPE text USING approved_by::text;
