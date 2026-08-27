-- Bilingual training assignment is broken in both directions. Repair the pairing key, restore the
-- ES invariant, and re-language the existing assignments.
--
-- SYMPTOMS, from the live data:
--   * The one Spanish-preferring employee (Production, staff) holds 21 ENGLISH assignments and ZERO
--     Spanish ones, and has already COMPLETED 9 of them. He is the person the bilingual system was
--     built for.
--   * The two English-preferring admins each hold 12 Spanish assignments they should never have had.
--
-- ROOT CAUSE — module_number, not training_category. sync_employee_training and
-- sync_module_training substitute the ES sibling with
--     ... AND en.module_number IS NOT NULL AND e.module_number = en.module_number
-- and module_number is NULL on all 24 rows of the TRN-001..TRN-012 families. The lateral join can
-- never match, so COALESCE(es.id, en.id) always falls back to English. Spanish has therefore never
-- been assignable, for anyone, since the feature shipped.
--
-- The 12 stray ES assignments are NOT caused by training_category being set on the ES rows: both
-- sync functions skip ES rows outright ("ES variants are resolved via their EN sibling, never
-- assigned directly"). Those rows are legacy - created 2026-06-10 and 2026-07-14, at or before the
-- language-aware migration (20260714000009) - and nothing has re-languaged them since, because
-- sync_employee_training only fires on a profile change and neither admin has changed theirs.
--
-- THE PAIRING KEY IS ALREADY IN THE DATA. Every EN/ES couple shares a sop_number (TRN-001..TRN-012,
-- each exactly one EN and one ES row), so the pairing is derived, not guessed. module_number is set
-- from sop_number rather than a dotted number: 1.1-1.4 are already taken by the older TRN-000/002A/
-- 002B/004A series, and inventing 1.5+ for the newer Food Safety 1-12 set would assert an ordering
-- across two series that nobody has decided on. The value only has to be equal across the pair.

begin;

-- 1. Give each EN/ES couple a shared pairing key.
update public.sop_documents
set module_number = sop_number
where type = 'training'
  and status = 'active'
  and sop_number in ('TRN-001','TRN-002','TRN-003','TRN-004','TRN-005','TRN-006',
                     'TRN-007','TRN-008','TRN-009','TRN-010','TRN-011','TRN-012')
  and module_number is distinct from sop_number;

-- 2. Restore the documented invariant: an ES row is a content variant, never an assignable unit.
--    This is hygiene, not the bug - it stops ES rows appearing as modules in their own right in the
--    admin surfaces and stops a future assignment path treating them as assignable.
update public.sop_documents
set training_category = null
where type = 'training'
  and status = 'active'
  and title like '%(ES)%'
  and training_category is not null;

do $$
declare bad text;
begin
  select string_agg(x, '; ') into bad from (
    select 'ES row still assignable: ' || sop_number as x from public.sop_documents
      where type='training' and status='active' and title like '%(ES)%' and training_category is not null
    union all
    select 'unpaired family: ' || sop_number from public.sop_documents
      where type='training' and status='active'
        and sop_number in ('TRN-001','TRN-002','TRN-003','TRN-004','TRN-005','TRN-006',
                           'TRN-007','TRN-008','TRN-009','TRN-010','TRN-011','TRN-012')
      group by sop_number
      having count(distinct module_number) <> 1 or bool_or(module_number is null)
    union all
    -- the EN row of each family must stay assignable, or step 3 grants nothing
    select 'EN row lost its category: ' || sop_number from public.sop_documents
      where type='training' and status='active' and title not like '%(ES)%'
        and sop_number in ('TRN-001','TRN-002','TRN-003','TRN-004','TRN-005','TRN-006',
                           'TRN-007','TRN-008','TRN-009','TRN-010','TRN-011','TRN-012')
        and training_category is null
  ) t;
  if bad is not null then
    raise exception 'bilingual pairing did not apply cleanly: %', bad;
  end if;
end $$;

-- 3. Re-language the existing assignments by re-running the reviewed sync, rather than hand-rolled
--    DELETE/INSERT. That function already preserves any row with progress or completed_at, which is
--    the property that matters most here: nobody's finished or part-finished training is destroyed.
--
--    Scoped to profiles that hold a staff/admin/owner role, which is the same gate both sync
--    functions apply internally. The other seven profiles are auditors and role-less accounts and
--    would receive nothing anyway; naming the gate here makes that explicit rather than incidental.
do $$
declare
  r record;
  before_completed int;
  before_progress int;
  after_completed int;
  after_progress int;
begin
  select count(*) filter (where completed_at is not null),
         count(*) filter (where progress is not null)
    into before_completed, before_progress
    from public.training_assignments;

  for r in
    select distinct p.id
      from public.profiles p
      join public.user_roles ur on ur.user_id = p.id
     where ur.role in ('staff', 'admin', 'owner')
  loop
    perform public.sync_employee_training(r.id);
  end loop;

  select count(*) filter (where completed_at is not null),
         count(*) filter (where progress is not null)
    into after_completed, after_progress
    from public.training_assignments;

  -- A re-language must never cost someone credit for training they finished or started.
  if after_completed < before_completed then
    raise exception 're-sync destroyed completed training: % completed rows before, % after',
      before_completed, after_completed;
  end if;
  if after_progress < before_progress then
    raise exception 're-sync destroyed in-progress training: % rows before, % after',
      before_progress, after_progress;
  end if;
end $$;

do $$
declare
  en_holding_es int;
  es_employee_es int;
  es_employee uuid;
begin
  -- No English-preferring employee should still hold an untouched Spanish assignment. Rows with
  -- progress or completed_at are excluded here BECAUSE the sync deliberately keeps them - see the
  -- note printed at the end of this migration.
  select count(*) into en_holding_es
    from public.training_assignments ta
    join public.sop_documents d on d.id = ta.sop_id
    join public.profiles p on p.id = ta.employee_id
   where coalesce(p.preferred_language, 'en') = 'en'
     and d.title like '%(ES)%'
     and ta.completed_at is null
     and ta.progress is null;
  if en_holding_es <> 0 then
    raise exception '% English-preferring assignment(s) still point at a Spanish module', en_holding_es;
  end if;

  -- And the Spanish-preferring employee should now actually hold Spanish modules.
  select p.id into es_employee
    from public.profiles p
    join public.user_roles ur on ur.user_id = p.id and ur.role in ('staff','admin','owner')
   where p.preferred_language = 'es'
   limit 1;

  if es_employee is not null then
    select count(*) into es_employee_es
      from public.training_assignments ta
      join public.sop_documents d on d.id = ta.sop_id
     where ta.employee_id = es_employee and d.title like '%(ES)%';
    if es_employee_es = 0 then
      raise exception 'the Spanish-preferring employee still has no Spanish assignments - the '
                      'module_number pairing did not take effect';
    end if;
    raise notice 'Spanish-preferring employee now holds % Spanish assignment(s)', es_employee_es;
  end if;
end $$;

commit;

-- TWO THINGS THIS DELIBERATELY LEAVES ALONE, both needing a human decision:
--
-- 1. One admin has a Spanish module IN PROGRESS. The sync preserves any started row, so it survives
--    and she keeps a single Spanish assignment. Deleting someone's part-finished work to satisfy a
--    language preference is not a call a migration should make.
--
-- 2. The Spanish-preferring employee has COMPLETED 9 modules in English. Those completions are
--    kept - voiding finished training automatically would be worse - but they are two different
--    problems and only one of them is this migration's:
--      * 4 (TRN-001..TRN-004) are families where a Spanish deck EXISTS and he was served English
--        anyway, purely because of the null module_number. Those are the ones worth re-examining.
--      * 5 (TRN-000, TRN-000A, TRN-002A, TRN-002B, TRN-004A) have NO Spanish version at all, so
--        English was the only thing to serve.
--    SQF 2.9.2.2 requires training "in language(s) understood by staff", so whether any of those
--    completions is valid evidence of competency is a question for the SQF practitioner, not for
--    this file. If not, the fix is to reset those assignments so they are retaken in Spanish.
--
-- 3. AND THE GAP THIS CANNOT CLOSE: 9 of his assignments are modules with no Spanish version -
--    the 5 above plus Traceability & Recall, Complaint Handling & Non-Conformance, Crisis
--    Management, and SOP-506 Operating the Scales. Even with the pairing fixed he will take those
--    in English. Translating them is the remaining 2.9.2.2 exposure, and it is a content task, not
--    a data one.
