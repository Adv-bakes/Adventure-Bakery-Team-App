-- Record GJM as the approver of FRM-951.
--
-- 20260831000002 left approved_by null and raised a warning instead of filling it: approval is an
-- act by a person, and a migration that records one nobody performed is worse than an empty field.
-- The owner has now approved the report definition and asked for it to be set, so this records the
-- decision rather than inventing it.
--
-- WHY THIS CLOSES TWO THINGS AT ONCE. FRM-951 was the live example under remediation task INT-14 -
-- a controlled document that could be set active with no approver recorded. It was active with the
-- field empty, which is the exact gap that task exists to guard against. INT-14 itself stays open:
-- the APP still permits it, and this fixes the instance, not the hole.
--
-- NO REVISION BUMP, DELIBERATELY. v2 was issued today by 20260831000002 with an effective date of
-- 2026-08-31; naming its approver completes that issue rather than superseding it. Bumping to v3
-- for the approval of v2 would imply the definition changed again, which it did not, and would put
-- a third revision on a document that has existed as a report for one day.
--
-- approved_by IS a watched field on the sop_document_history trigger, so this write leaves an audit
-- snapshot of the prior state on its own - which is the right trail for an approval.

begin;

update public.sop_documents
   set approved_by = 'GJM'
 where sop_number = 'FRM-951'
   and status = 'active'
   and type = 'report'
   and approved_by is distinct from 'GJM';

do $$
declare
  bad text;
  r record;
begin
  select * into r from public.sop_documents
   where sop_number = 'FRM-951' and status = 'active';

  select string_agg(x, '; ') into bad from (
    select 'FRM-951 is missing, not active, or no longer type=report' as x
     where r.id is null or r.type is distinct from 'report'
    union all
    select 'approved_by is ' || coalesce(r.approved_by, 'null') || ', expected GJM'
     where r.approved_by is distinct from 'GJM'
    union all
    -- the approval attaches to v2; if the revision moved, this migration approved something else
    select 'revision is ' || coalesce(r.revision, 'null') || ', expected v2 - approval would be '
           || 'attaching to a revision this migration did not review'
     where r.revision is distinct from 'v2'
    union all
    -- the UPDATE keys on sop_number, so it is only single-row if the number is unique
    -- among active documents. Assert that rather than assume it.
    select 'sop_number FRM-951 is on ' || count(*)::text || ' active rows - the update was not '
           || 'single-row' from public.sop_documents
     where sop_number = 'FRM-951' and status = 'active' having count(*) <> 1
  ) t;

  if bad is not null then
    raise exception 'FRM-951 approver did not apply cleanly: %', bad;
  end if;

  raise notice 'FRM-951 approved by GJM at revision v2, effective %', r.effective_date;
end $$;

commit;
