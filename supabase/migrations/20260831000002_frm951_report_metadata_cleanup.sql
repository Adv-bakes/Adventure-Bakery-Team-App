-- Finish FRM-951's conversion to a report: remove the stale snapshot and stop the
-- record asserting a revision it does not have.
--
-- 20260831000001 changed the TYPE. It could not change the three fields that still
-- described a paper form, and left as they were they contradict the purpose text sitting
-- directly above them:
--
--   attachments    A PDF and a DOCX generated on 2026-06-27 by the since-deleted
--                  scripts/generate-training-matrix.py. An auditor opening FRM-951 today
--                  downloads a June snapshot while the record tells them the report is
--                  generated live. That is worse than having no attachment at all, and it
--                  is the exact staleness this whole change set exists to remove.
--   revision       'New' - the revision of the retired paper form.
--   effective_date 2026-06-27 - the date that paper form took effect.
--
-- WHAT REVISION MEANS FOR THIS ROW NOW. The row no longer holds data; it holds the
-- DEFINITION of a report - its scope, its columns, and the note explaining where the live
-- one is. A definition genuinely can be revised, so revision and effective_date are
-- meaningful again, and they move when the definition changes rather than when somebody
-- completes a module. Each printed instance carries its own generation date, stamped by
-- lib/trainingPdf.ts at export time. The two no longer compete.
--
-- 'New' -> 'v2' follows this site's convention ('New' for first issue, then v2, v3 - as
-- on SOP-2.9, SOP-901 and FRM-903).
--
-- STORAGE OBJECTS ARE DELIBERATELY NOT DELETED. This only detaches them from the
-- document. Deleting rows out of storage.objects in SQL bypasses the storage API and can
-- leave the underlying file behind, and an orphaned file is harmless where a destroyed
-- one is not recoverable. The two paths, should they ever be wanted again:
--
--   41764b7d-fab5-4b1c-bf63-5441f5fe6dca/files/FRM-951_Training_Matrix.pdf
--   41764b7d-fab5-4b1c-bf63-5441f5fe6dca/files/FRM-951_Training_Matrix.docx
--
-- Remove them through the SOPs Library drawer if the storage should be reclaimed.
--
-- ⚠️ NOT SET BY THIS MIGRATION: approved_by is still null on FRM-951, as it was before.
-- Every other active controlled document here names an approver, so this is a real
-- document-control gap - but approval is an act by a person, and recording one that did
-- not happen would be worse than leaving the field empty. Set it in the SOPs Library
-- drawer when the report definition has actually been approved.

begin;

update public.sop_documents
   set revision = 'v2',
       effective_date = date '2026-08-31',
       content = coalesce(content, '{}'::jsonb)
                 -- the generated snapshot, detached (see the note above on storage)
                 || jsonb_build_object('attachments', '[]'::jsonb)
                 || jsonb_build_object(
                      'revision_history',
                      'New — 2026-06-27 — Initial issue as a paper training matrix, maintained by hand.'
                      || chr(10) ||
                      'v2 — 2026-08-31 — Reclassified from a form to a generated report. The matrix is '
                      || 'now produced live by the Team App from each module''s required departments and '
                      || 'from the training assignment records; the hand-maintained PDF and DOCX were '
                      || 'withdrawn because a snapshot of a live report is stale the moment it is taken.')
 where sop_number = 'FRM-951'
   and status = 'active'
   and type = 'report';

do $$
declare
  bad text;
  r record;
begin
  select * into r from public.sop_documents
   where sop_number = 'FRM-951' and status = 'active';

  select string_agg(x, '; ') into bad from (
    -- the migration must have matched a row at all
    select 'FRM-951 is missing, not active, or no longer type=report' as x
     where r.id is null or r.type is distinct from 'report'
    union all
    select 'revision is ' || coalesce(r.revision, 'null') || ', expected v2'
     where r.revision is distinct from 'v2'
    union all
    select 'effective_date is ' || coalesce(r.effective_date::text, 'null') || ', expected 2026-08-31'
     where r.effective_date is distinct from date '2026-08-31'
    union all
    -- the stale snapshot must be gone
    select 'attachments still present: '
           || jsonb_array_length(coalesce(r.content->'attachments', '[]'::jsonb))::text
     where jsonb_array_length(coalesce(r.content->'attachments', '[]'::jsonb)) <> 0
    union all
    -- and the explanation written by the previous migration must have survived the merge
    select 'the purpose text was lost'
     where coalesce(r.content->>'purpose', '') not like '%generated report%'
    union all
    select 'revision_history was not written'
     where coalesce(r.content->>'revision_history', '') not like '%2026-08-31%'
    union all
    -- nothing else may have moved
    select 'expected 1 report row, found ' || count(*)::text
      from public.sop_documents where type = 'report' having count(*) <> 1
    union all
    select 'expected ' || sop_number || ' to stay type=form, it is ' || type
      from public.sop_documents
     where sop_number in ('FRM-952', 'FRM-953') and status = 'active'
       and type is distinct from 'form'
  ) t;

  if bad is not null then
    raise exception 'FRM-951 metadata cleanup did not apply cleanly: %', bad;
  end if;

  if r.approved_by is null then
    raise warning 'FRM-951 has no approved_by - set it in the SOPs Library once the report definition is approved';
  end if;

  raise notice 'FRM-951 is now rev v2, effective 2026-08-31, with the stale snapshot detached';
end $$;

commit;
