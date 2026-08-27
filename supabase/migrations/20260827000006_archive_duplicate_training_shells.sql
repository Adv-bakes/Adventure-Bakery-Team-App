-- Archive four empty training shells whose subject is already taught by a finished module, and
-- clear the phantom assignments they carry.
--
-- Each of the four is an unnumbered draft created 2026-06-10 with content = NULL: no slides, no
-- narration, no audio, no quiz. They are not partly built, they are placeholders. And each covers
-- ground a complete, active module already covers:
--
--   Food Defense & Site Security      -> TRN-011 Food Defense & Food Fraud   (12 slides, 8 quiz Qs)
--   Food Fraud Awareness              -> TRN-011 Food Defense & Food Fraud   (same module, both halves)
--   Physical Contaminant Control      -> TRN-006 Foreign Material Control    (12 slides, 8 quiz Qs)
--   Recordkeeping & Document Control  -> TRN-012 Records & Talking to Auditors (12 slides, 8 quiz Qs)
--
-- WHY THE ASSIGNMENTS MUST GO WITH THEM. Two people hold each shell, eight rows in all, every one
-- "not started". They are not merely stale - they are IMPOSSIBLE: there is nothing to view and no
-- quiz to pass, so the assignment can never reach completed. They inflate every outstanding count
-- and make the training record read as though staff are behind on work that does not exist.
-- Archiving the module alone would not remove them: sync_module_training only ever INSERTs.
--
-- The delete is narrowed to completed_at IS NULL AND progress IS NULL. All eight qualify today; the
-- clause is there so that if somebody has since started one, this preserves it and the assertion
-- below fails loudly rather than quietly discarding their work.
--
-- SIX OTHER EMPTY SHELLS ARE DELIBERATELY LEFT ALONE. Traceability & Recall, Crisis Management and
-- Complaint Handling & Non-Conformance (D-20, D-21, D-07) plus Finished Product Testing, Kill-Step
-- Monitoring and Vegan Meat Alternative Processing are equally empty, but nothing else covers their
-- subject - archiving them would hide scheduled work rather than remove duplication. The first
-- three carry nine more impossible assignments between them; that is the same defect and a separate
-- decision, since there the ASSIGNMENTS are wrong and the modules are not.
--
-- Rows are addressed by id AND title together: the id makes it exact, the title makes a
-- transcription error fail instead of archiving the wrong module.

begin;

-- 1. Archive. status='archived' is the house soft-delete; nothing is destroyed and the rows stay
--    auditable. The grant predicate requires status='active', so this alone stops future grants.
update public.sop_documents
set status = 'archived'
where id in ('808a3727-5b98-4ccc-9eb4-f394f523f328'::uuid,
             'f0f33cb7-5227-4998-b85d-0df11332e4b9'::uuid,
             'd7f951be-bce9-4eda-8508-b842f17b8bcc'::uuid,
             '7ff62b5d-f5ce-462f-96af-a6e932885c0f'::uuid)
  and title in ('Food Defense & Site Security', 'Food Fraud Awareness',
                'Physical Contaminant Control', 'Recordkeeping & Document Control')
  and type = 'training'
  and status = 'draft';

-- 2. Clear the impossible assignments.
delete from public.training_assignments ta
where ta.sop_id in ('808a3727-5b98-4ccc-9eb4-f394f523f328'::uuid,
                    'f0f33cb7-5227-4998-b85d-0df11332e4b9'::uuid,
                    'd7f951be-bce9-4eda-8508-b842f17b8bcc'::uuid,
                    '7ff62b5d-f5ce-462f-96af-a6e932885c0f'::uuid)
  and ta.completed_at is null
  and ta.progress is null;

do $$
declare
  bad text;
  n_archived int;
  n_left int;
  n_keepers int;
  n_keeper_assignments int;
  total_now int;
begin
  select count(*) into n_archived from public.sop_documents
   where id in ('808a3727-5b98-4ccc-9eb4-f394f523f328'::uuid,
                'f0f33cb7-5227-4998-b85d-0df11332e4b9'::uuid,
                'd7f951be-bce9-4eda-8508-b842f17b8bcc'::uuid,
                '7ff62b5d-f5ce-462f-96af-a6e932885c0f'::uuid)
     and status = 'archived';

  select count(*) into n_left from public.training_assignments
   where sop_id in ('808a3727-5b98-4ccc-9eb4-f394f523f328'::uuid,
                    'f0f33cb7-5227-4998-b85d-0df11332e4b9'::uuid,
                    'd7f951be-bce9-4eda-8508-b842f17b8bcc'::uuid,
                    '7ff62b5d-f5ce-462f-96af-a6e932885c0f'::uuid);

  -- the three keeper shells must still be draft, and must still hold their nine assignments
  select count(*) into n_keepers from public.sop_documents
   where type='training' and status='draft'
     and title in ('Traceability & Recall','Crisis Management',
                   'Complaint Handling & Non-Conformance');

  select count(*) into n_keeper_assignments from public.training_assignments ta
    join public.sop_documents d on d.id = ta.sop_id
   where d.title in ('Traceability & Recall','Crisis Management',
                     'Complaint Handling & Non-Conformance');

  select count(*) into total_now from public.training_assignments;

  select string_agg(x, '; ') into bad from (
    select 'archived ' || n_archived || ' of 4' as x where n_archived <> 4
    union all
    select n_left || ' assignment(s) survive on the archived shells - one was started or completed '
           || 'since this was written; inspect before removing it' where n_left <> 0
    union all
    select 'keeper shells: ' || n_keepers || ' of 3 still draft' where n_keepers <> 3
    union all
    select 'keeper assignments changed: ' || n_keeper_assignments || ', expected 9'
      where n_keeper_assignments <> 9
    union all
    select 'assignment total is ' || total_now || ', expected 64 (72 minus the 8 phantoms)'
      where total_now <> 64
    union all
    -- nothing with real progress may have been touched anywhere in the table
    select 'a completed or in-progress assignment was deleted' where exists (
      select 1 from (select 1) z
       where (select count(*) from public.training_assignments
               where completed_at is not null or progress is not null) <> 30)
    union all
    -- the modules that actually teach this material must be untouched and still active
    select 'covering module not active: ' || sop_number from public.sop_documents
      where sop_number in ('TRN-006','TRN-011','TRN-012')
        and title not like '%(ES)%' and status <> 'active'
  ) t;

  if bad is not null then
    raise exception 'archiving the duplicate training shells did not apply cleanly: %', bad;
  end if;

  raise notice 'archived 4 duplicate shells; assignments 72 -> %', total_now;
end $$;

commit;
