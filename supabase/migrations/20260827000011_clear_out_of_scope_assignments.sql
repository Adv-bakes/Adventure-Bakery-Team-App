-- Clear the seven assignments left on people whose department is outside the module's scope.
--
-- These are what remains of stale_training_report() after three rounds of deciding, module by
-- module, whether the report meant "the assignment is wrong" or "the scope is wrong":
--
--   TRN-005 HACCP            -> scope was wrong. Admin added (2.1.1.5, the SQF practitioner).
--   TRN-006 Foreign Material -> scope was wrong. Admin added (SOP-11.7.3 gives the practitioner
--                               the FRM-907 register).
--   TRN-004 Allergens Pt 2   -> scope was wrong. Admin added (temporal segregation is scheduling,
--                               and scheduling is done from Admin).
--   these seven              -> the ASSIGNMENT is wrong. Cleared here.
--
-- What is being cleared, all "not started":
--   Gabriela Juncos-Mercer (Admin)  SOP-506 scales, TRN-007 sanitation, TRN-008 receiving,
--                                   TRN-009 frozen handling, TRN-010 labeling
--   Richard Mercer (Admin)          SOP-506 scales, TRN-010 labeling
--
-- Each teaches a floor procedure, and nothing in the Code or in this site's own SOPs places those
-- duties on an administrator - which is the test the other three failed and these seven pass.
--
-- RAISED BEFORE DOING IT, AND OVERRULED, WHICH IS THE RIGHT OUTCOME TO RECORD: TRN-010 covers label
-- verification, and 2.3.2.7 requires finished product labels to be approved by "qualified company
-- personnel". If the owner is the person who approves labels, then Admin belongs in TRN-010's scope
-- and this is a fourth scope error rather than a revoke. That was put to the owner, who chose to
-- clear all seven. Noted here so the reasoning is on the record if an auditor asks why the person
-- approving labels is not trained on labeling.
--
-- SEPARATELY: TRN-009 teaches frozen product handling, and task 35.1 records that the only product
-- requiring frozen distribution has been discontinued. Clearing it from Admin is right either way,
-- but the module itself is probably due for archiving, which would remove it from Production and
-- Quality Control too.
--
-- This is a ONE-OFF, not a new rule. Scope revocation is deliberately absent from
-- revoke_stale_training() (20260827000008 asserts it stays absent) precisely because three of the
-- ten rows it would have deleted turned out to be scope errors. Future mismatches surface in the
-- report and get the same case-by-case reading.
--
-- Nothing with completed_at or progress is touched, and the assertion below proves it against the
-- table rather than trusting the WHERE clause.

begin;

-- Computed as a CTE and deleted by id, rather than a LATERAL inside USING: the lateral would
-- have to reference the delete target, which is exactly the shape that behaves differently
-- between Postgres versions. This form is unambiguous and mirrors revoke_stale_training().
with doomed as (
  select ta.id
    from public.training_assignments ta
    join public.profiles p on p.id = ta.employee_id
    left join public.sop_documents g
           on g.id = public.governing_training_module(ta.sop_id)
   where ta.completed_at is null
     and ta.progress is null
     and g.required_departments is not null
     and (p.department is null or not (p.department = any (g.required_departments)))
)
delete from public.training_assignments ta
 using doomed
 where ta.id = doomed.id;

do $$
declare
  bad text;
  total_now int;
  progress_now int;
  stale_now int;
  spanish_now int;
begin
  select count(*) into total_now from public.training_assignments;
  select count(*) into progress_now from public.training_assignments
   where completed_at is not null or progress is not null;
  select count(*) into stale_now from public.stale_training_report();
  select count(*) into spanish_now from public.training_assignments ta
    join public.sop_documents d on d.id = ta.sop_id where d.title like '%(ES)%';

  select string_agg(x, '; ') into bad from (
    select 'assignment total is ' || total_now || ', expected 48 (55 minus 7)' as x
      where total_now <> 48
    union all
    -- the number that must never move: completed and in-progress work
    select 'completed/in-progress count is ' || progress_now || ', expected 30 - this migration '
           || 'destroyed training evidence' where progress_now <> 30
    union all
    select 'stale_training_report() still returns ' || stale_now || ' row(s), expected 0'
      where stale_now <> 0
    union all
    -- the Spanish curriculum must be untouched; an ES row carries no scope of its own and is
    -- judged through its EN sibling, so a mistake in the governing-module resolution would show up
    -- here first
    select 'Spanish assignments now ' || spanish_now || ', expected 9' where spanish_now <> 9
    union all
    -- and every remaining assignment must be one the holder is actually in scope for
    select 'an out-of-scope assignment survived: ' || p.full_name || ' / ' || d.title
      from public.training_assignments ta
      join public.sop_documents d on d.id = ta.sop_id
      join public.profiles p on p.id = ta.employee_id
      left join public.sop_documents g on g.id = public.governing_training_module(ta.sop_id)
     where ta.completed_at is null and ta.progress is null
       and g.required_departments is not null
       and (p.department is null or not (p.department = any (g.required_departments)))
  ) t;

  if bad is not null then
    raise exception 'clearing out-of-scope assignments did not apply cleanly: %', bad;
  end if;

  raise notice 'cleared 7 out-of-scope assignments; total 55 -> %, report now empty', total_now;
end $$;

commit;
