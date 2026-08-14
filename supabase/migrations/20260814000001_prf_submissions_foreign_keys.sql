-- Declare the foreign keys prf_submissions has always had in spirit but never in the schema.
--
-- lead_id / owner_user_id / concept_id were plain columns with no constraint, so nothing stopped
-- a PRF from pointing at a lead that no longer exists, and PostgREST could not embed the related
-- rows (`select("*, sales_leads(...)")` requires a real FK — without one the request 400s). The
-- PRF review panel therefore fetches each related row in a separate query.
--
-- Checked against production before writing this migration (5 PRF rows):
--   orphaned lead_id ......... 0
--   orphaned owner_user_id ... 0
--   orphaned concept_id ...... 0   (no PRF has a concept_id set)
-- so all three constraints validate immediately. No data repair is needed and no rows are touched.
--
-- stage2_submission_id is deliberately NOT constrained here — see the note at the bottom.

-- ── 1. concepts needs a primary key first ────────────────────────────────────────────────────
-- concepts has no constraints at all (no PK, no unique, no indexes), and a foreign key must
-- reference a uniquely-constrained column. id is already a proper serial
-- (default nextval('concepts_id_seq')) with 3 rows, no nulls and no duplicates, so promoting it
-- to the primary key is a no-op for existing data.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint c
    JOIN pg_class t ON t.oid = c.conrelid
    JOIN pg_namespace n ON n.oid = t.relnamespace
    WHERE n.nspname = 'public' AND t.relname = 'concepts' AND c.contype = 'p'
  ) THEN
    ALTER TABLE public.concepts ADD CONSTRAINT concepts_pkey PRIMARY KEY (id);
  END IF;
END $$;

-- ── 2. index the FK column that lacks one ───────────────────────────────────────────────────
-- Postgres does NOT automatically index the referencing side of a foreign key. concept_id
-- (idx_prf_concept) and owner_user_id (idx_prf_submissions_owner_user_id) are already covered,
-- but lead_id is not — despite being the most-joined of the three (sales dashboard, client
-- folder, project workspace). Without it, every ON DELETE check and every lead lookup is a seq
-- scan.
CREATE INDEX IF NOT EXISTS idx_prf_submissions_lead_id
  ON public.prf_submissions (lead_id);

-- ── 3. the foreign keys ─────────────────────────────────────────────────────────────────────
-- ON DELETE choices are per-column and deliberate:
--
--   lead_id      RESTRICT — this codebase soft-deletes (sales_leads.archived_at; see the
--                "never hard-delete records" convention in CLAUDE.md) and nothing in the app
--                hard-deletes a lead. Refusing to drop a lead that still has PRFs turns a
--                silent orphaning into a loud error, and breaks no existing flow.
--
--   owner_user_id SET NULL — profiles rows follow auth users. Losing the assigned owner must
--                never take the PRF with it; the record simply becomes unassigned.
--
--   concept_id   SET NULL — src/pages/Concepts.tsx:58 genuinely hard-deletes concepts
--                (`from("concepts").delete()`). RESTRICT would break that existing flow the
--                moment any PRF referenced a concept.

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'prf_submissions_lead_id_fkey') THEN
    ALTER TABLE public.prf_submissions
      ADD CONSTRAINT prf_submissions_lead_id_fkey
      FOREIGN KEY (lead_id) REFERENCES public.sales_leads (id) ON DELETE RESTRICT;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'prf_submissions_owner_user_id_fkey') THEN
    ALTER TABLE public.prf_submissions
      ADD CONSTRAINT prf_submissions_owner_user_id_fkey
      FOREIGN KEY (owner_user_id) REFERENCES public.profiles (id) ON DELETE SET NULL;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'prf_submissions_concept_id_fkey') THEN
    ALTER TABLE public.prf_submissions
      ADD CONSTRAINT prf_submissions_concept_id_fkey
      FOREIGN KEY (concept_id) REFERENCES public.concepts (id) ON DELETE SET NULL;
  END IF;
END $$;

COMMENT ON CONSTRAINT prf_submissions_lead_id_fkey ON public.prf_submissions IS
  'RESTRICT: leads are archived (archived_at), never hard-deleted. Refuse to orphan PRFs.';
COMMENT ON CONSTRAINT prf_submissions_owner_user_id_fkey ON public.prf_submissions IS
  'SET NULL: a removed owner unassigns the PRF, it never deletes it.';
COMMENT ON CONSTRAINT prf_submissions_concept_id_fkey ON public.prf_submissions IS
  'SET NULL: concepts are hard-deleted by the Concepts page; the PRF outlives the concept.';

-- ── NOT DONE: stage2_submission_id ──────────────────────────────────────────────────────────
-- prf_submissions.stage2_submission_id is `uuid`, but the table it points at
-- (public.stage2_prf_submissions) has a `text` primary key. A foreign key requires comparable
-- types, so this constraint cannot be added without first changing one side's column type.
--
-- It is also not merely a typing problem — the data is already broken:
--   stage2_prf_submissions ......... 0 rows
--   PRFs with stage2_submission_id .. 2  (both pointing at ids that do not exist)
--
-- Adding the constraint today would fail validation regardless of the cast. Resolving this needs
-- a decision about where those Stage 2 submissions actually live before any schema change; it is
-- intentionally left out of this migration rather than papered over.
