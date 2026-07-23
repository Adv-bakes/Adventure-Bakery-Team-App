-- Recovered 2026-07-23 from supabase_migrations.schema_migrations.statements
-- (version 20260717120000). This migration was applied to prod and recorded
-- in history but its file was never committed; content is verbatim as applied.

-- inventory_tolling (+ its two sibling tables) were scoped by client_id,
-- populated app-side from sales_leads.profile_id (falling back to
-- sales_leads.id). profile_id is not guaranteed unique — same root cause
-- already fixed for client_documents in
-- 20260629104844_client_documents_lead_id.sql: leads added manually via
-- "Add Deal" before that flow was patched got profile_id stamped with the
-- staff member's own id, so two different clients collide on it.
--
-- Confirmed against live data: the only collision in the whole database is
-- Morini Brands and Guilt Free Bites LLC sharing profile_id
-- 0ec912f6-3b8a-4d40-ac4b-dd86e398eb84 (the same "shared collision id" named
-- in 20260629112013_reassign_morini_pss.sql). Every existing row across all
-- three tolling tables is stamped with that shared id, and by content it's
-- all one plant-based burger/patty line — Morini Brands' own tolling stock,
-- nothing resembling Guilt Free Bites' arepas. Confirmed with the user.
--
-- Add lead_id to all three tables, scoped to the always-unique sales_leads
-- row, and backfill.

ALTER TABLE public.inventory_tolling
  ADD COLUMN IF NOT EXISTS lead_id uuid REFERENCES public.sales_leads(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_inventory_tolling_lead_id
  ON public.inventory_tolling (lead_id);

ALTER TABLE public.inventory_tolling_adjustments
  ADD COLUMN IF NOT EXISTS lead_id uuid REFERENCES public.sales_leads(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_inventory_tolling_adjustments_lead_id
  ON public.inventory_tolling_adjustments (lead_id);

ALTER TABLE public.inventory_tolling_dismissed_duplicates
  ADD COLUMN IF NOT EXISTS lead_id uuid REFERENCES public.sales_leads(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_inventory_tolling_dismissed_duplicates_lead_id
  ON public.inventory_tolling_dismissed_duplicates (lead_id);

-- General backfill: only the unambiguous case (client_id maps to exactly one
-- sales_leads row, via profile_id or directly via id). Ambiguous rows are
-- left for the explicit, confirmed reassignment below — guessing wrong here
-- would silently move inventory to the wrong client.
UPDATE public.inventory_tolling t
SET lead_id = sl.id
FROM public.sales_leads sl
WHERE t.lead_id IS NULL
  AND t.client_id IS NOT NULL
  AND t.client_id = sl.profile_id
  AND (SELECT count(*) FROM public.sales_leads sl2 WHERE sl2.profile_id = t.client_id) = 1;

UPDATE public.inventory_tolling t
SET lead_id = sl.id
FROM public.sales_leads sl
WHERE t.lead_id IS NULL
  AND t.client_id IS NOT NULL
  AND t.client_id = sl.id;

UPDATE public.inventory_tolling_adjustments t
SET lead_id = sl.id
FROM public.sales_leads sl
WHERE t.lead_id IS NULL
  AND t.client_id = sl.profile_id
  AND (SELECT count(*) FROM public.sales_leads sl2 WHERE sl2.profile_id = t.client_id) = 1;

UPDATE public.inventory_tolling_adjustments t
SET lead_id = sl.id
FROM public.sales_leads sl
WHERE t.lead_id IS NULL
  AND t.client_id = sl.id;

UPDATE public.inventory_tolling_dismissed_duplicates t
SET lead_id = sl.id
FROM public.sales_leads sl
WHERE t.lead_id IS NULL
  AND t.client_id = sl.profile_id
  AND (SELECT count(*) FROM public.sales_leads sl2 WHERE sl2.profile_id = t.client_id) = 1;

UPDATE public.inventory_tolling_dismissed_duplicates t
SET lead_id = sl.id
FROM public.sales_leads sl
WHERE t.lead_id IS NULL
  AND t.client_id = sl.id;

-- Known collision: every remaining unassigned row under the shared
-- Morini/Guilt Free Bites id belongs to Morini Brands (confirmed with user).
UPDATE public.inventory_tolling
SET lead_id = '7ce0fa8c-cfc3-40b4-bf09-b637c4c7ebe0'
WHERE lead_id IS NULL
  AND client_id = '0ec912f6-3b8a-4d40-ac4b-dd86e398eb84';

UPDATE public.inventory_tolling_adjustments
SET lead_id = '7ce0fa8c-cfc3-40b4-bf09-b637c4c7ebe0'
WHERE lead_id IS NULL
  AND client_id = '0ec912f6-3b8a-4d40-ac4b-dd86e398eb84';

UPDATE public.inventory_tolling_dismissed_duplicates
SET lead_id = '7ce0fa8c-cfc3-40b4-bf09-b637c4c7ebe0'
WHERE lead_id IS NULL
  AND client_id = '0ec912f6-3b8a-4d40-ac4b-dd86e398eb84';
