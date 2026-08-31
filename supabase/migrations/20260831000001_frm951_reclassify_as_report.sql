-- FRM-951 Training Matrix is a REPORT, not a form.
--
-- Every value on it is derived - computed from sop_documents.required_departments and rows in
-- training_assignments. A form is a blank a human fills; nothing on this sheet is filled. Three
-- consequences of the wrong class, all of them real rather than theoretical:
--
--   1. Its revision asserts a stability it does not have. The content changes whenever somebody
--      completes a module or a hire lands, and no revision bump tracks that.
--   2. It goes stale silently - the same failure that left FRM-903's printed blank two revisions
--      behind the app.
--   3. It invites an auditor to ask for filled instances, of which there are none and can be none.
--
-- THE NUMBER IS DELIBERATELY KEPT. SOP-2.9 v2 (active, issued 2026-08-27 by migration
-- 20260827000003) cites FRM-951 by number in Procedure steps 2 and 6 and again in Records. Keeping
-- FRM-951 means that SOP needs no revision, and an auditor who already has the number still finds
-- the document. Only the TYPE changes.
--
-- FRM-952 and FRM-953 stay type='form' and this migration asserts it. They are genuine forms: a
-- trainer fills the Training Competency Verification Record, and attendees sign the Training
-- Sign-In Sheet. Only FRM-951 was misclassified.
--
-- The new type value follows the exact precedent of 20260616000001 (training) and 20260617000001
-- (fsqm): drop and re-add the auto-named inline CHECK.
--
-- STILL TO DO BY HAND, and it cannot be done from a migration: FRM-951's content.attachments still
-- point at the PDF/DOCX produced by the now-deleted scripts/generate-training-matrix.py. Those are
-- snapshots of a report and are already out of date. Replace or remove them in the SOPs Library
-- drawer - storage writes are is_staff_or_admin gated.

begin;

alter table public.sop_documents
  drop constraint if exists sop_documents_type_check;

alter table public.sop_documents
  add constraint sop_documents_type_check
  check (type in ('sop', 'form', 'policy', 'training', 'fsqm', 'report'));

update public.sop_documents
   set type = 'report',
       -- A purpose makes hasSopBody() true, so the drawer's Document tab renders this
       -- explanation instead of the record looking like a form with nothing in it.
       content = coalesce(content, '{}'::jsonb) || jsonb_build_object(
         'purpose',
         'This is a generated report, not a form. It is produced live by the Adventure Bakery Team '
         || 'App from each training module''s required departments and from the training assignment '
         || 'records, and is viewed at Team Portal > HR > Training Compliance. Three views are '
         || 'available there: Required Training by Department (SQF 2.9.2.1), the Completion Record '
         || '(SQF 2.9.2.3), and Exceptions, which lists any employee whose required training is not '
         || 'assigned or who holds training their department does not require. Each view exports to '
         || 'PDF, stamped with the date it was generated. Do not maintain this document by hand: '
         || 'change a module''s required departments in the SOPs Library and the report follows. '
         || 'Scope limitation: training is assigned by department, while SQF 2.9.2.1 ii asks for '
         || 'competencies by duty. Closing that requires the job descriptions and named critical '
         || 'control point monitors from remediation deliverable D-01.')
 where sop_number = 'FRM-951'
   and status = 'active'
   and type = 'form';

do $$
declare
  bad text;
begin
  select string_agg(x, '; ') into bad from (
    select 'FRM-951 is type ' || type || ', expected report' as x
      from public.sop_documents
     where sop_number = 'FRM-951' and status = 'active' and type is distinct from 'report'
    union all
    -- exactly one row may hold the new type; a broader WHERE would have moved others
    select 'expected 1 report row, found ' || count(*)::text
      from public.sop_documents where type = 'report'
     having count(*) <> 1
    union all
    -- FRM-951 must still exist and still be active: this migration reclassifies, never retires
    select 'FRM-951 is missing or not active'
     where not exists (
       select 1 from public.sop_documents
        where sop_number = 'FRM-951' and status = 'active')
    union all
    -- the two genuine forms must not have been swept along
    select 'expected ' || sop_number || ' to stay type=form, it is ' || type
      from public.sop_documents
     where sop_number in ('FRM-952', 'FRM-953') and status = 'active'
       and type is distinct from 'form'
    union all
    -- the constraint must still reject a value that was never valid
    select 'the type check constraint is missing'
     where not exists (
       select 1 from pg_constraint
        where conname = 'sop_documents_type_check'
          and conrelid = 'public.sop_documents'::regclass)
  ) t;

  if bad is not null then
    raise exception 'FRM-951 reclassification did not apply cleanly: %', bad;
  end if;

  raise notice 'FRM-951 is now type=report; FRM-952 and FRM-953 remain forms';
end $$;

commit;
