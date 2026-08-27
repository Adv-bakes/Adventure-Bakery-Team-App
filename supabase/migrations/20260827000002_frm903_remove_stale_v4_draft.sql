-- Remove the FRM-903 draft that a stale browser tab created against the v4 schema.
--
-- WHAT HAPPENED. The v5 migration (20260827000001) applied at 09:51:47 ET. At 09:55:50 a new entry
-- was created that pinned `form_revision = 'v4'` and seeded only 11 of the 14 section-1 rows: the
-- SOPs Library fetches sop_documents with a one-shot `useEffect(..., [])` (SopsLibrary.tsx:167 —
-- not React Query, so no staleTime and no refetch-on-focus), and the tab had been open since before
-- the push. `createResponse` pinned the revision and ran `emptyValues` against that cached schema.
--
-- WHY IT CANNOT BE FIXED IN PLACE. For a fixed + deletable grid, `emptyFieldValue` copies
-- `rows.labels` into each row's own `_label` in the ENTRY'S DATA. The missing rows are therefore
-- absent from the record itself, not merely from the render — reloading cannot add them.
--
-- WHY IT COULD NOT BE DELETED THROUGH THE APP. FormEntry.tsx read `settings.deletable` off the
-- RESOLVED schema, and a v4-pinned entry resolves the v4 history snapshot, where deletable was
-- false. Turning the setting on in the live document could never reach this entry. That is fixed in
-- the same PR (policy now reads off the live doc); this migration removes the orphan the bug left,
-- so the cleanup does not have to wait on a deploy.
--
-- NOTHING HUMAN IS BEING DISCARDED. Every value on the entry is a schema default: detergent_used,
-- sanitizer_used, concentration_ppm, detergent_concentration, detergent_test_method and
-- test_method are `defaultValue`s; inspection_date is `defaultToday`; the glass_check rows carry
-- their seeded Item values. Not one of the 29 grid rows across the three checklists has an answered
-- cell, and there are no attachments. Verified by reading the row before writing this.
--
-- DELETING A RECORD IS NOT SOMETHING TO DO CASUALLY, so the guard is deliberately narrow: the exact
-- id, still a draft, still pinned to v4, still unattached. If any of that has changed since - the
-- entry was filled in, submitted, or already deleted - this deletes nothing and the assertion
-- below tells you so rather than silently doing something else.
--
-- The 2026-08-25 draft (pinned v2, all 11 surface rows answered) is deliberately NOT touched. That
-- one is a finished record for that day and needs a human decision - submit it or discard it.

begin;

delete from public.sop_document_responses resp
 using public.sop_documents d
 where d.id = resp.document_id
   and d.sop_number = 'FRM-903'
   and resp.id = 'b73236b1-a326-4923-9365-6f64cc33ffbf'::uuid
   and resp.status = 'draft'
   and resp.form_revision = 'v4'
   and jsonb_array_length(coalesce(resp.attachments, '[]'::jsonb)) = 0;

do $$
declare
  still_there int;
  v2_draft int;
begin
  select count(*) into still_there
    from public.sop_document_responses
   where id = 'b73236b1-a326-4923-9365-6f64cc33ffbf'::uuid;

  if still_there <> 0 then
    raise exception
      'FRM-903: the stale v4 draft is still present - it is no longer a draft, no longer pinned to v4, or has gained attachments. Inspect it before removing it by hand.';
  end if;

  -- The 08-25 draft must survive: it holds real answers and is not this migration's business.
  select count(*) into v2_draft
    from public.sop_document_responses resp
    join public.sop_documents d on d.id = resp.document_id
   where d.sop_number = 'FRM-903' and resp.form_revision = 'v2' and resp.status = 'draft';

  if v2_draft <> 1 then
    raise exception 'FRM-903: expected the 2026-08-25 v2 draft to survive untouched, found % of it', v2_draft;
  end if;
end $$;

commit;
