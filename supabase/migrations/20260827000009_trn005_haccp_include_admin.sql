-- TRN-005 (HACCP & Your Critical Control Points) must also reach Admin.
--
-- 20260827000005 scoped it to {Production, Quality Control} on the reasoning that CCP monitoring is
-- duty-specific - 2.9.2.1 ii names "staff engaged in monitoring critical control points". That is
-- right about the monitors and wrong about who else needs HACCP.
--
-- 2.9.2.1 i requires HACCP training for "staff involved in developing and maintaining food safety
-- plans", and 2.1.1.5 requires the SQF PRACTITIONER to have completed a HACCP course. The
-- practitioner and the food safety team sit in Admin here, not on the line. Under the previous
-- scope the person the Code most explicitly requires to hold HACCP training was the one person
-- excluded from the module that teaches it.
--
-- This surfaced from stale_training_report(): the revoke pass flagged TRN-005 as out of scope for
-- the owner/CEO. That is exactly the case 20260827000008 refused to automate - the report said the
-- assignment was out of scope, and the correct reading was that the SCOPE was wrong, not the
-- assignment. Had scope mismatches been auto-revoked, this would have removed a Code requirement
-- silently and nobody would have seen it happen.
--
-- Deliberately NOT extended to Admin: TRN-007 (sanitation), TRN-008 (receiving), TRN-009 (frozen
-- handling), TRN-010 (labeling) and SOP-506 (scales). Those teach floor procedures, and no clause
-- requires an administrator to hold them. TRN-004 (allergen execution) and TRN-006 (foreign
-- material) are arguable for a hands-on owner in a small bakery, but "arguable" is not a reason to
-- widen scope - if they are wanted, widen them on their own justification, not on this one's.
--
-- Effect on assignments: none directly. Gabriela already HOLDS TRN-005 (not started); widening the
-- scope stops it being reported as stale, rather than granting anything new. Any future Admin hire
-- now receives it automatically, which is the real point.

begin;

update public.sop_documents
set required_departments = array['Production', 'Quality Control', 'Admin']
where sop_number = 'TRN-005'
  and type = 'training'
  and status = 'active'
  and title not like '%(ES)%'
  and required_departments is distinct from array['Production', 'Quality Control', 'Admin'];

do $$
declare
  bad text;
  n_stale_trn005 int;
begin
  select string_agg(x, '; ') into bad from (
    select 'TRN-005 scope is ' || coalesce(required_departments::text, 'ALL') as x
      from public.sop_documents
     where sop_number = 'TRN-005' and type='training' and status='active'
       and title not like '%(ES)%'
       and required_departments is distinct from array['Production','Quality Control','Admin']
    union all
    select 'TRN-005 lost training_category' from public.sop_documents
     where sop_number = 'TRN-005' and type='training' and status='active'
       and title not like '%(ES)%' and training_category is null
    union all
    -- the other seven scoped modules must be untouched by this migration
    select 'scope changed on ' || sop_number from public.sop_documents
     where sop_number in ('TRN-004','TRN-004A','TRN-006','TRN-007','TRN-008','TRN-009','TRN-010')
       and type='training' and status='active' and title not like '%(ES)%'
       and 'Admin' = any(required_departments)
  ) t;

  if bad is not null then
    raise exception 'TRN-005 scope change did not apply cleanly: %', bad;
  end if;

  -- TRN-005 must no longer appear in the stale report for anyone.
  select count(*) into n_stale_trn005
    from public.stale_training_report() where module = 'TRN-005';
  if n_stale_trn005 <> 0 then
    raise exception 'TRN-005 still reports as stale for % assignment(s)', n_stale_trn005;
  end if;

  raise notice 'TRN-005 now covers Production, Quality Control and Admin';
end $$;

commit;
