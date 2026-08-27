-- TRN-004 (Allergens Part 2) and TRN-006 (Foreign Material Control) also reach Admin.
--
-- Both were scoped away from Admin in 20260827000005 on the general principle that execution
-- modules belong to the departments that execute. For these two that principle is outrun by duties
-- the site's own documents place on people who sit in Admin.
--
-- TRN-006 — FOREIGN MATERIAL CONTROL. The strongest case, and it is not a judgement call: SOP-11.7.3
-- assigns the master glass and brittle plastic register (FRM-907) to the SQF PRACTITIONER in its
-- Responsibility section. The practitioner sits in Admin. Requiring someone to maintain the register
-- while excluding them from the module that explains what goes on it is incoherent. 11.7.3.1 also
-- requires foreign-matter methods to be "communicated to all staff", which cuts the same way.
--
-- TRN-004 — ALLERGENS PART 2: PROTECTING THE CLAIM. The module teaches run scheduling, temporal
-- segregation, changeover verification and label checks. TRN-004A records that this site cannot
-- physically separate allergens and relies on TEMPORAL SEGREGATION - managing the production
-- schedule - and the schedule is set from Admin, not on the line. The site also carries a free-from
-- claim, which 2.8.1 treats as a management responsibility rather than an operator one.
--
-- WHAT THIS IS NOT. It is not "the owner is hands-on, so give her everything". Five modules stay out
-- of Admin scope - TRN-007 sanitation, TRN-008 receiving, TRN-009 frozen handling, TRN-010 labeling
-- and SOP-506 scales - because nothing in the Code or in the site's own SOPs puts those duties on an
-- administrator. Each widening here names the specific duty that justifies it. A scope that widens
-- because widening feels safer is not a scope.
--
-- ⚠️ TRN-004A (Allergen Management in Shared Spaces) is deliberately NOT changed here, because it
-- was not asked for - but it is the same subject with the same scope, and leaving it means a future
-- Admin hire is required to take Allergens Part 2 and not the shared-spaces module. It does not show
-- in stale_training_report() only because the owner has already COMPLETED it. Worth deciding
-- separately; flagged rather than folded in.
--
-- Effect on assignments: none. The owner already holds TRN-004 and TRN-006 (both not started), so
-- this stops them reporting as stale rather than granting anything. Future Admin hires receive them.

begin;

update public.sop_documents
set required_departments = array['Production', 'Quality Control', 'R&D', 'Admin']
where sop_number = 'TRN-004'
  and type = 'training' and status = 'active' and title not like '%(ES)%'
  and required_departments is distinct from array['Production', 'Quality Control', 'R&D', 'Admin'];

update public.sop_documents
set required_departments = array['Production', 'Quality Control', 'Admin']
where sop_number = 'TRN-006'
  and type = 'training' and status = 'active' and title not like '%(ES)%'
  and required_departments is distinct from array['Production', 'Quality Control', 'Admin'];

do $$
declare
  bad text;
  n_stale int;
begin
  select string_agg(x, '; ') into bad from (
    select 'TRN-004 scope is ' || coalesce(required_departments::text,'ALL') as x
      from public.sop_documents
     where sop_number='TRN-004' and type='training' and status='active' and title not like '%(ES)%'
       and required_departments is distinct from array['Production','Quality Control','R&D','Admin']
    union all
    select 'TRN-006 scope is ' || coalesce(required_departments::text,'ALL')
      from public.sop_documents
     where sop_number='TRN-006' and type='training' and status='active' and title not like '%(ES)%'
       and required_departments is distinct from array['Production','Quality Control','Admin']
    union all
    select 'lost training_category: ' || sop_number from public.sop_documents
     where sop_number in ('TRN-004','TRN-006') and type='training' and status='active'
       and title not like '%(ES)%' and training_category is null
    union all
    -- The five modules that must stay out of Admin scope. No type filter: SOP-506 is
    -- type='sop' with a training_category, so a type='training' predicate would silently
    -- exclude it from this guard and the check would pass without ever looking at it.
    select 'wrongly widened to Admin: ' || sop_number from public.sop_documents
     where sop_number in ('TRN-007','TRN-008','TRN-009','TRN-010','SOP-506')
       and status='active' and title not like '%(ES)%'
       and required_departments is not null
       and 'Admin' = any(required_departments)
    union all
    select 'TRN-004 or TRN-006 still stale' from public.stale_training_report()
     where module in ('TRN-004','TRN-006')
  ) t;

  if bad is not null then
    raise exception 'TRN-004/TRN-006 scope change did not apply cleanly: %', bad;
  end if;

  select count(*) into n_stale from public.stale_training_report();
  raise notice 'stale_training_report() now returns % row(s)', n_stale;
end $$;

commit;
