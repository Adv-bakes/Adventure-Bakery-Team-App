-- client_documents only ever linked to a client via user_id, which is meant
-- to be the client's own portal account id. Until Client Portal exists, that
-- id either stays null or (for leads added manually via "Add Deal") gets
-- stamped with the staff member's own id — so two different leads added by
-- the same staffer collide on user_id and each one's documents show up in
-- both client folders.
--
-- Add a lead_id column so documents can be scoped to the always-unique
-- sales_leads row instead. Backfill only the unambiguous case: a user_id
-- that maps to exactly one sales_leads row. Rows where user_id maps to more
-- than one lead (the actual collision) are left for manual reassignment —
-- guessing wrong here would silently move a document to the wrong client,
-- which is the exact bug we're fixing.

ALTER TABLE public.client_documents
  ADD COLUMN IF NOT EXISTS lead_id uuid REFERENCES public.sales_leads(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_client_documents_lead_id
  ON public.client_documents (lead_id);

UPDATE public.client_documents cd
SET lead_id = sl.id
FROM public.sales_leads sl
WHERE cd.lead_id IS NULL
  AND cd.user_id IS NOT NULL
  AND cd.user_id = sl.profile_id::text
  AND (SELECT count(*) FROM public.sales_leads sl2 WHERE sl2.profile_id::text = cd.user_id) = 1;

-- Some documents (notably PSS uploads from the public intake token flow)
-- were stamped with sales_leads.id directly in user_id when no profile_id
-- existed yet. Backfill those too.
UPDATE public.client_documents cd
SET lead_id = sl.id
FROM public.sales_leads sl
WHERE cd.lead_id IS NULL
  AND cd.user_id IS NOT NULL
  AND cd.user_id = sl.id::text;
