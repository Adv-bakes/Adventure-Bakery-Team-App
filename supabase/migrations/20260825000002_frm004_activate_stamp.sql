-- FRM-004 Equipment Register — activate and stamp.
--
-- The owner reviewed the register and confirmed the seeded Food contact values are correct as
-- they stand (2026-08-25). That was the one column held back for review, because it sets the
-- scope of the food-grade lubricant requirement (SQF 11.2.1.7) and of the calibration programme -
-- so the register could not go live until someone who knows the line had signed off on it.
--
-- Approved by GJM effective 2026-08-25.
--
-- Revision stays 'New'. That is the house pattern for a first issue - the equipment SOPs and
-- FRM-909/910/911/912 were all activated the same way (20260726000007) and only move off 'New'
-- when they are actually revised. It is not an oversight.
--
-- No history snapshot: the trigger is WHEN (OLD.status = 'active') (20260709000001), and this row
-- is still a draft going in. A first activation supersedes nothing, so there is nothing to
-- snapshot.
--
-- This closes task 26.1 on the remediation plan and unblocks D-26 (Preventive Maintenance,
-- 11.2.1.1-.8) and D-28 (Calibration), both of which need a list of what equipment exists before
-- they can say anything about maintaining or calibrating it.
--
-- Idempotent: guarded on the row not already being active with these values.

begin;

update public.sop_documents
set status = 'active',
    effective_date = date '2026-08-25',
    approved_by = 'GJM'
where sop_number = 'FRM-004'
  and (status is distinct from 'active'
    or effective_date is distinct from date '2026-08-25'
    or approved_by is distinct from 'GJM');

do $$
declare
  r record;
begin
  select status, effective_date, approved_by, revision into r
    from public.sop_documents where sop_number = 'FRM-004';

  if r is null then
    raise exception 'FRM-004 not found - migration 20260822000002 has not been applied.';
  end if;
  if r.status is distinct from 'active'
     or r.effective_date is distinct from date '2026-08-25'
     or r.approved_by is distinct from 'GJM' then
    raise exception 'FRM-004 not activated cleanly: status=%, effective=%, approved_by=%',
      r.status, r.effective_date, r.approved_by;
  end if;
end $$;

commit;
