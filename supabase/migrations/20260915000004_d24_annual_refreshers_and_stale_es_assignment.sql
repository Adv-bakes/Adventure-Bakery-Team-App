-- D-24 Training Records Completion: set annual refreshers, and remove one stale ES assignment.
--
-- TWO FINDINGS FROM READING THE LIVE TRAINING TABLES ON 2026-09-15.
--
-- 1. NOTHING EVER COMES DUE AGAIN. Of the 18 active assignable modules only TRN-002A and
--    TRN-004A carry is_annual_refresher. Every other completion -- 13 modules' worth, including
--    all of the Food Safety series -- has expires_at null, so once a person passes it the system
--    never asks again. An auditor asking "when is hygiene training refreshed?" gets no answer.
--    The fix belongs on the MODULE, not the assignment: sop_documents.is_annual_refresher is read
--    by both assignment paths -- the SQL sync trigger (20260714000009 lines 77 and 131) and
--    assignModulesToEmployees() in training.ts line 174 -- each mapping it to recurrence_months
--    12. Setting it on the module therefore fixes every FUTURE assignment as well as today's.
--    Setting recurrence_months on existing rows alone would have fixed today and quietly regressed
--    on the next assignment.
--
-- 2. GABRIELA HOLDS TRN-001 TWICE, IN BOTH LANGUAGES. She completed the English row on
--    2026-06-12 and the Spanish sibling assigned the same day sits open and always will. Her
--    preferred_language is 'en', and the rule since 20260714000009 is that an EN-preferring
--    employee gets the ES sibling instead of EN, never both. This row predates that migration, so
--    it is a leftover rather than a live bug -- but it inflates her outstanding count by one and
--    cannot close on its own. Deleted here, guarded so the English completion must exist first.
--
-- SOP-506 IS INCLUDED IN THE ANNUAL SWEEP AND IS THE ONE JUDGEMENT CALL. It is a job-specific
-- category 3 module (Operating the Scales) rather than a category 1 food safety module. Annual is
-- the safer default for a competency that drifts, but if the site wants scales competency on a
-- different cycle, exclude it -- it is one line in the update below.
--
-- WHAT THIS DOES NOT DO. It does not complete anybody's training. 17 assignments remain
-- outstanding after the stale row goes -- Diana 8 (none started), Gabriela 7, Richard 2 -- and
-- those close by people sitting the modules, not by SQL.
--
-- IDEMPOTENT: guarded on the state it produces, so a second run is a clean no-op.

begin;

-- ---------------------------------------------------------------- 1. stale ES assignment
-- Deleted only where the SAME employee has already completed the EN sibling of the SAME module,
-- so this can never remove somebody's only copy. The check is correlated per row rather than
-- resolved through subqueries that pick an arbitrary row.
do $$
declare candidates int; removed int;
begin
  select count(*) into candidates
    from public.training_assignments ta
    join public.sop_documents d on d.id = ta.sop_id
    join public.profiles p on p.id = ta.employee_id
   where p.preferred_language = 'en' and d.title like '%(ES)' and ta.completed_at is null;

  if candidates = 0 then
    raise notice 'No stale ES assignment for an EN-preferring employee. Nothing to remove.';
  elsif candidates <> 1 then
    raise exception 'Expected exactly one stale ES assignment, found %. Review before deleting.',
      candidates;
  else
    with gone as (
      delete from public.training_assignments ta
       using public.sop_documents d, public.profiles p
       where d.id = ta.sop_id
         and p.id = ta.employee_id
         and p.preferred_language = 'en'
         and d.title like '%(ES)'
         and ta.completed_at is null
         and exists (
               select 1
                 from public.training_assignments t2
                 join public.sop_documents d2 on d2.id = t2.sop_id
                where t2.employee_id = ta.employee_id
                  and d2.module_number = d.module_number
                  and d2.title not like '%(ES)'
                  and t2.completed_at is not null)
      returning 1)
    select count(*) into removed from gone;

    if removed <> 1 then
      raise exception 'Found a stale ES assignment but the EN sibling is not completed for that '
                      'employee; refusing to remove their only copy.';
    end if;
    raise notice 'Removed the stale ES assignment (EN sibling already completed).';
  end if;
end $$;

-- ---------------------------------------------------------------- 2. annual refreshers
update public.sop_documents
   set is_annual_refresher = true
 where training_category is not null
   and status = 'active'
   and is_annual_refresher is distinct from true;

-- bring today's assignments into line with the module setting
update public.training_assignments ta
   set recurrence_months = 12
  from public.sop_documents d
 where d.id = ta.sop_id
   and d.is_annual_refresher
   and ta.recurrence_months is distinct from 12;

-- and give completed ones the due date they should already have had
update public.training_assignments ta
   set expires_at = (ta.completed_at + interval '12 months')::date
  from public.sop_documents d
 where d.id = ta.sop_id
   and d.is_annual_refresher
   and ta.completed_at is not null
   and ta.expires_at is null;

-- ---------------------------------------------------------------- verify
do $$
declare
  mods int; not_annual int; no_recur int; no_expiry int; stale int; outstanding int;
begin
  select count(*) into mods from public.sop_documents
   where training_category is not null and status = 'active';
  select count(*) into not_annual from public.sop_documents
   where training_category is not null and status = 'active' and not is_annual_refresher;
  if not_annual <> 0 then
    raise exception '% active assignable module(s) still not marked annual.', not_annual;
  end if;

  select count(*) into no_recur
    from public.training_assignments ta join public.sop_documents d on d.id = ta.sop_id
   where d.is_annual_refresher and ta.recurrence_months is distinct from 12;
  if no_recur <> 0 then
    raise exception '% assignment(s) of an annual module still lack recurrence_months.', no_recur;
  end if;

  select count(*) into no_expiry
    from public.training_assignments ta join public.sop_documents d on d.id = ta.sop_id
   where d.is_annual_refresher and ta.completed_at is not null and ta.expires_at is null;
  if no_expiry <> 0 then
    raise exception '% completed assignment(s) still have no expiry.', no_expiry;
  end if;

  select count(*) into stale
    from public.training_assignments ta
    join public.sop_documents d on d.id = ta.sop_id
    join public.profiles p on p.id = ta.employee_id
   where p.preferred_language = 'en' and d.title like '%(ES)' and ta.completed_at is null;
  if stale <> 0 then
    raise exception '% stale ES assignment(s) remain.', stale;
  end if;

  select count(*) into outstanding from public.training_assignments where completed_at is null;
  raise notice 'D-24: % active modules all annual; every completion now has an expiry; '
               '% assignment(s) still outstanding and needing a person to sit them.',
               mods, outstanding;
end $$;

commit;
