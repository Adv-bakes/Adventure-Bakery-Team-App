-- Record GJM as the approver of FRM-952 and FRM-953.
--
-- The two records SOP-2.9 points at: the Training Competency Verification Record and the Training
-- Sign-In Sheet. Both have been active since 2026-06-27 with the approver field empty. As with
-- FRM-951 in 20260831000004, this records a decision the owner made rather than inventing one.
--
-- APPROVAL AFTER THE EFFECTIVE DATE, DELIBERATELY NOT BACKDATED. Both forms took effect on
-- 2026-06-27 and are being approved on 2026-08-31. The effective date is left alone because it
-- records when the form entered use, which is a fact and not a thing to tidy. The approval is
-- being formalised late; moving the date to hide that would be the actual falsification.
--
-- NO REVISION BUMP. Neither form's content changes here, and both are still at first issue ("New").
-- Naming an approver completes that issue rather than superseding it.
--
-- ⚠️ THIS IS 2 OF 40. A count taken before writing this migration found FORTY of the eighty-seven
-- active documents with no approver recorded - twenty FRM forms, fourteen TRN training modules, the
-- HACCP PLAN, and five internal technical guides that arguably should not be controlled documents
-- at all. Fixing the two that came up in conversation does not make the other thirty-eight go away,
-- and remediation task INT-14 stays open for the real work: the app permits an active document with
-- no approver, so instances will keep appearing until it does not. The remaining set is a decision
-- for the owner, document by document, and specifically NOT something to sweep with an UPDATE.

begin;

update public.sop_documents
   set approved_by = 'GJM'
 where sop_number in ('FRM-952', 'FRM-953')
   and status = 'active'
   and type = 'form'
   and approved_by is distinct from 'GJM';

do $$
declare
  bad text;
  n_approved int;
  n_unapproved int;
begin
  select count(*) into n_approved from public.sop_documents
   where sop_number in ('FRM-952','FRM-953') and status='active' and approved_by = 'GJM';

  -- The blast radius, pinned to a number: 40 active documents lacked an approver before this
  -- migration, so exactly 38 must lack one after. A wider UPDATE shows up here immediately.
  select count(*) into n_unapproved from public.sop_documents
   where status='active' and coalesce(nullif(trim(approved_by),''), null) is null
     and title not like '%(ES)%';

  select string_agg(x, '; ') into bad from (
    select 'expected 2 approved rows, found ' || n_approved::text as x where n_approved <> 2
    union all
    select 'expected 38 active documents still without an approver, found ' || n_unapproved::text
     where n_unapproved <> 38
    union all
    -- neither form's identity may have shifted; only the approver was meant to move
    select 'unexpected change on ' || sop_number || ': type=' || type || ' rev='
           || coalesce(revision,'null')
      from public.sop_documents
     where sop_number in ('FRM-952','FRM-953') and status='active'
       and (type is distinct from 'form' or revision is distinct from 'New'
            or effective_date is distinct from date '2026-06-27')
    union all
    -- and FRM-951's approval from 20260831000004 must still stand
    select 'FRM-951 approver is now ' || coalesce(approved_by,'null')
      from public.sop_documents
     where sop_number='FRM-951' and status='active' and approved_by is distinct from 'GJM'
  ) t;

  if bad is not null then
    raise exception 'FRM-952/FRM-953 approver did not apply cleanly: %', bad;
  end if;

  raise warning '% active documents still have no approver recorded - INT-14 remains open',
    n_unapproved;
  raise notice 'FRM-952 and FRM-953 approved by GJM';
end $$;

commit;
