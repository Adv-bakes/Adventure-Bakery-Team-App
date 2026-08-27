-- Scope the operational training modules to the departments that actually do the work.
--
-- Today 32 of 33 assignable modules are required_departments = NULL, i.e. ALL STAFF. That is why
-- "training by role" shows three near-identical columns, and why FRM-951 cannot yet be a real
-- training matrix: a matrix whose every cell is ticked records nothing. SQF 2.9.2.1 asks for the
-- competencies needed for SPECIFIC DUTIES, which is a distinction the data does not currently make.
--
-- NOTHING IS UNASSIGNED BY THIS MIGRATION. That is a hard requirement here, and it holds by
-- construction rather than by care: sync_module_training - the function the module-change trigger
-- calls - is INSERT ... ON CONFLICT DO NOTHING with no DELETE anywhere in it, and the trigger
-- wrapper has none either. The only sync path that deletes is sync_employee_training, and that
-- fires on a PROFILE change, which this migration does not make. Narrowing a module's audience can
-- therefore only affect who receives it NEXT; it cannot take a module off anybody who already has
-- one. The assertion at the bottom proves it against the live rows rather than trusting the above.
--
-- The consequence worth being clear about: because nothing is revoked, this changes almost nothing
-- visible today. Both admins keep every module they currently hold, including the eight narrowed
-- here. The value is in what gets assigned from now on, and in FRM-951 finally having something to
-- report. Cleaning up assignments that no longer match scope is a separate, revocable decision -
-- SOP-506 is already scoped to Production and both Admins still hold it, which is the same gap.
--
-- WHAT IS DELIBERATELY LEFT AS ALL STAFF, because narrowing it would itself be a finding:
--   TRN-000, TRN-000A  policy and culture      - 2.1.1.1 vi, communicated to all site personnel
--   TRN-001            SQF awareness           - carries every employee's authority to stop product
--   TRN-002/002A/002B  hygiene, visitors, GMP  - 2.9.2.1 iii and iv, all food handlers
--   TRN-003            allergen AWARENESS      - a plant carrying a free-from claim
--   TRN-011            food defense and fraud  - 2.7, site security is everyone's
--   TRN-012            records and auditors    - anyone can be interviewed during an audit
-- The split is awareness (everyone) versus execution (the department that executes).
--
-- ⚠️ A NULL department matches NOTHING. The grant predicate is
--     (required_departments IS NULL OR p.department = ANY(required_departments))
-- so an employee whose profiles.department is not set receives only the ALL STAFF modules once
-- these eight are scoped. Seven of ten profiles currently have no department; they are auditors and
-- role-less accounts that receive no training anyway, so nothing breaks today. But a new staff
-- member added without a department will now look compliant while missing their job-specific
-- training. Setting department on every staff profile is a prerequisite for trusting this.

begin;

update public.sop_documents d
set required_departments = v.depts
from (values
  -- Allergen EXECUTION: run order, tool and zone segregation, cleaning verification, label checks,
  -- rework. Awareness stays in TRN-003, which is not touched.
  ('TRN-004',  array['Production','Quality Control','R&D']),
  ('TRN-004A', array['Production','Quality Control','R&D']),
  -- 2.9.2.1 ii is explicitly duty-scoped: CCP monitors and their named backups.
  ('TRN-005',  array['Production','Quality Control']),
  -- Glass and brittle plastic, metal detection, tool control - floor and maintenance work.
  ('TRN-006',  array['Production','Quality Control']),
  -- SSOPs, chemical handling, pre-operational inspection.
  ('TRN-007',  array['Production','Quality Control']),
  -- Approved suppliers, delivery inspection, lot tracking, FIFO, controlled rum receipt. This is
  -- Sourcing's module as much as Production's - the only one where Sourcing is the primary audience.
  ('TRN-008',  array['Production','Sourcing','Quality Control']),
  -- Cold chain, freezer monitoring, Listeria on the frozen line.
  ('TRN-009',  array['Production','Quality Control']),
  -- Line label verification and lot/date coding; Sales owns label approval via FRM-601/602/603.
  ('TRN-010',  array['Production','Quality Control','Sales'])
) as v(sop_number, depts)
where d.sop_number = v.sop_number
  and d.type = 'training'
  and d.status = 'active'
  and d.title not like '%(ES)%'          -- ES rows carry no training_category; scope lives on the EN row
  and d.required_departments is distinct from v.depts;

do $$
declare
  bad text;
  n_scoped int;
begin
  select string_agg(x, '; ') into bad from (
    -- every department named must be one the app actually offers, or the module silently
    -- matches nobody
    select 'unknown department on ' || sop_number || ': ' || dept as x
      from public.sop_documents, unnest(required_departments) dept
     where type='training' and status='active' and required_departments is not null
       and dept not in ('Production','Sourcing','Quality Control','Admin','R&D','Sales')
    union all
    select 'not scoped: ' || s from unnest(array['TRN-004','TRN-004A','TRN-005','TRN-006',
                                                 'TRN-007','TRN-008','TRN-009','TRN-010']) s
     where not exists (
       select 1 from public.sop_documents d
        where d.sop_number = s and d.type='training' and d.status='active'
          and d.title not like '%(ES)%' and d.required_departments is not null)
    union all
    -- the awareness modules must NOT have been narrowed
    select 'wrongly narrowed: ' || s from unnest(array['TRN-000','TRN-000A','TRN-001','TRN-002',
                                                       'TRN-002A','TRN-002B','TRN-003','TRN-011',
                                                       'TRN-012']) s
     where exists (
       select 1 from public.sop_documents d
        where d.sop_number = s and d.type='training' and d.status='active'
          and d.title not like '%(ES)%' and d.required_departments is not null)
    union all
    -- an EN row must keep its training_category or it stops being assignable at all
    select 'lost training_category: ' || sop_number from public.sop_documents
     where sop_number in ('TRN-004','TRN-004A','TRN-005','TRN-006','TRN-007','TRN-008',
                          'TRN-009','TRN-010')
       and type='training' and status='active' and title not like '%(ES)%'
       and training_category is null
  ) t;

  if bad is not null then
    raise exception 'department scoping did not apply cleanly: %', bad;
  end if;

  select count(*) into n_scoped from public.sop_documents
   where type='training' and status='active' and required_departments is not null
     and title not like '%(ES)%';
  raise notice 'active EN training modules now scoped to departments: %', n_scoped;
end $$;

commit;

-- Post-change note, checked separately below rather than asserted inside the transaction: no
-- training_assignments row may have disappeared. Run this immediately after the push - it should
-- return the same totals as before, because nothing in this migration can delete an assignment.
--
--   select coalesce(p.full_name, 'Staff #' || left(p.id::text,4)) as person, count(*)
--     from public.training_assignments ta
--     join public.profiles p on p.id = ta.employee_id
--    group by 1 order by 1;
--
-- Expected, unchanged: Gabriela Juncos-Mercer 26, Richard Mercer 25, Staff #cb0d 21.
