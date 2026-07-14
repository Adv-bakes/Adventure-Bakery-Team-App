-- Preferred training language per employee.
--
-- Adventure Bakery has bilingual (EN/ES) training content. This column records
-- which language an employee should be trained in, captured at invite
-- acceptance and editable later. The language-aware assignment sync
-- (20260714000009) reads it to pick the Spanish variant of a module where a
-- translation exists, otherwise English. 'en' is the default for everyone.
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS preferred_language text NOT NULL DEFAULT 'en'
    CHECK (preferred_language IN ('en', 'es'));
