-- Backfill type='training' for documents that carry training material, so the
-- Type column can be read straight from sop_documents.type (no derived logic).
-- "Training material" = an assigned training_category, or slide images on content.
UPDATE public.sop_documents
SET type = 'training'
WHERE type <> 'training'
  AND (
    training_category IS NOT NULL
    OR (
      jsonb_typeof(content->'slides') = 'array'
      AND jsonb_array_length(content->'slides') > 0
    )
  );
