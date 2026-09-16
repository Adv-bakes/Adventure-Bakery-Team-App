-- D-06: issue FSQM-005 and FRM-009, start the monthly prompt, and carry it in FSQM-017 Part 6.
--
-- FOUR CHANGES THAT HAVE TO LAND TOGETHER:
--   FRM-009    draft -> active, approved GJM, effective 2026-09-16.
--   FSQM-005   draft -> active, approved GJM, effective 2026-09-16. Its old effective date, 18 June
--              2026, belonged to the inherited draft this replaced and is overwritten.
--   verification_schedule.monthly_sqf_update  planned -> active. The row was seeded planned so the
--              monthly prompt could not start before the record and the programme existed.
--   FSQM-017   v6 -> v7, the monthly update added to Part 6. A change to the schedule is a revision
--              of that programme - Part 6 is its copy of the schedule as at its effective date and
--              says so - and leaving it out would have the printed programme disagreeing with the
--              live schedule. This is the third time that rule has applied today; it is not
--              optional.
--
-- WHAT THIS CLOSES, AND WHAT IT DOES NOT. 2.1.2.1 is answered: FRM-001 v4 carries the six agenda
-- items, and FSQM-005 states how the annual review is run and recorded. 2.1.2.2 now has a record to
-- be evidenced by rather than a sentence asserting one - but it is evidenced when the first FRM-009
-- entry is SUBMITTED, not when this migration runs. Both activities will read as never recorded in
-- the feed until their first entry lands, which is the prompt doing its job.
--
-- THE MONTHLY ACTIVITY STARTS PROMPTING IMMEDIATELY. first_due_on is null and no entry exists, so
-- assessDue() raises it as never recorded at the next cron run, under one dedupe key. That is
-- deliberate: the update is already overdue in the sense that matters - it has been happening
-- without a record for as long as the site has been meeting.
--
-- Guarded on the exact pre-state of all four. Not idempotent by design.

begin;

-- ------------------------------------------------------------------ guards
do $guard$
declare r record;
begin
  select (select status   from public.sop_documents where sop_number = 'FRM-009')   as s009,
         (select revision from public.sop_documents where sop_number = 'FRM-009')   as r009,
         (select status   from public.sop_documents where sop_number = 'FSQM-005')  as s005,
         (select revision from public.sop_documents where sop_number = 'FSQM-005')  as r005,
         (select status   from public.sop_documents where sop_number = 'FSQM-017')  as s017,
         (select revision from public.sop_documents where sop_number = 'FSQM-017')  as r017,
         (select jsonb_array_length(content->'procedure')
            from public.sop_documents where sop_number = 'FSQM-017')                as l017,
         (select status from public.verification_schedule
           where activity_key = 'monthly_sqf_update')                               as vs
    into r;

  if (r.s009, r.r009) is distinct from ('draft', 'New') then
    raise exception 'FRM-009 is %/% - expected the unissued draft.', r.s009, r.r009;
  end if;
  if (r.s005, r.r005) is distinct from ('draft', 'New') then
    raise exception 'FSQM-005 is %/% - expected the unissued draft.', r.s005, r.r005;
  end if;
  if (r.s017, r.r017) is distinct from ('active', 'v6') or r.l017 <> 74 then
    raise exception 'FSQM-017 is %/% with % lines - expected active/v6/74.', r.s017, r.r017, r.l017;
  end if;
  if r.vs is distinct from 'planned' then
    raise exception 'monthly_sqf_update is % - expected planned.', r.vs;
  end if;

  -- FSQM-005 must be the rewritten one that names FRM-009, not the inherited shell
  if (select (content->'procedure')::text from public.sop_documents where sop_number = 'FSQM-005')
     not like '%FRM-009 Monthly SQF Update Record%' then
    raise exception 'FSQM-005 does not name FRM-009; issue the wrong document and the record has no programme.';
  end if;
  -- the Part 6 insert point: 50 is the last monthly activity, 51 the first annual one
  if (select content->'procedure'->>50 from public.sop_documents where sop_number = 'FSQM-017')
       not like '%Customer complaint review%Monthly%'
     or (select content->'procedure'->>51 from public.sop_documents where sop_number = 'FSQM-017')
       not like '%Management review of the SQF System%Annually%' then
    raise exception 'FSQM-017 Part 6 is not ordered as this migration expects; re-derive the index.';
  end if;
end $guard$;

-- ------------------------------------------------------------------ 1. issue FRM-009
update public.sop_documents
   set status         = 'active',
       approved_by    = 'GJM',
       effective_date = date '2026-09-16'
 where sop_number = 'FRM-009';

-- ------------------------------------------------------------------ 2. issue FSQM-005
update public.sop_documents
   set status         = 'active',
       approved_by    = 'GJM',
       effective_date = date '2026-09-16',
       content        = jsonb_set(content, '{revision_history}',
         to_jsonb(replace(content->>'revision_history',
           'Status stays draft until reviewed.',
           'ISSUED active 2026-09-16, approved GJM, with FRM-009 and with FRM-001 at v4. The '
           'monthly activity goes live on the master verification schedule in the same change, so '
           'the update is prompted rather than remembered. 2.1.2.2 is evidenced when the first '
           'FRM-009 entry is submitted, not by this issue.')))
 where sop_number = 'FSQM-005';

-- ------------------------------------------------------------------ 3. start the monthly prompt
update public.verification_schedule
   set status              = 'active',
       pending_deliverable = null,
       updated_at          = now()
 where activity_key = 'monthly_sqf_update';

-- ------------------------------------------------------------------ 4. FSQM-017 v7
-- Inserted at 51: after the last monthly activity and before the first annual one, which is how
-- Part 6 is ordered.
update public.sop_documents
   set content = jsonb_set(
         jsonb_insert(content, '{procedure,51}', to_jsonb($p6$• Monthly SQF update to senior site management — Monthly — SQF Practitioner — FRM-009; the update required by 2.1.2.2 and management's response to it, distinct from the annual management review above$p6$::text)),
         '{revision_history}',
         to_jsonb((content->>'revision_history') || E'\n\n' || $rh$v7 — 2026-09-16 — The monthly SQF update added to the schedule, under D-06.

SQF 2.1.2.2 requires the SQF Practitioner to update senior site management at least monthly on matters affecting the SQF System, and for the update and management's response to be documented. FRM-009 Monthly SQF Update Record is issued with this revision as that record, governed by FSQM-005, and the activity joins Part 6.

IT WAS ASSESSED COMPLIANT AT THE GAP ASSESSMENT AND WAS NOT. The management review procedure then in draft said the monthly update was recorded in a "Flash Report", and no such report exists anywhere in this system. The rewritten FSQM-005 first replaced that with minutes "retained with the management review records", which named no form and nothing to prompt it — the same weakness one level less obvious, and caught on review before issue. FRM-009 is the answer to it: a short record, on the schedule, that prompts itself.

THE ACTIVITY WILL READ AS NEVER RECORDED until the first entry is submitted. That is the prompt working rather than a fault, and it is honest: the monthly meeting has been happening without a retained record for as long as the site has been holding it.$rh$::text)),
       revision       = 'v7',
       effective_date = date '2026-09-16',
       approved_by    = 'GJM'
 where sop_number = 'FSQM-017';

-- ------------------------------------------------------------------ verify
do $verify$
declare r record;
begin
  select (select status   from public.sop_documents where sop_number = 'FRM-009')  as s009,
         (select approved_by    from public.sop_documents where sop_number = 'FRM-009')  as a009,
         (select effective_date from public.sop_documents where sop_number = 'FRM-009')  as e009,
         (select status   from public.sop_documents where sop_number = 'FSQM-005') as s005,
         (select approved_by    from public.sop_documents where sop_number = 'FSQM-005') as a005,
         (select effective_date from public.sop_documents where sop_number = 'FSQM-005') as e005,
         (select revision from public.sop_documents where sop_number = 'FSQM-017') as r017,
         (select jsonb_array_length(content->'procedure')
            from public.sop_documents where sop_number = 'FSQM-017')               as l017,
         (select status from public.verification_schedule
           where activity_key = 'monthly_sqf_update')                              as vs,
         (select pending_deliverable from public.verification_schedule
           where activity_key = 'monthly_sqf_update')                              as vsp
    into r;

  if r.s009 <> 'active' or r.a009 <> 'GJM' or r.e009 <> date '2026-09-16' then
    raise exception 'FRM-009 did not issue: %, %, %.', r.s009, r.a009, r.e009;
  end if;
  if r.s005 <> 'active' or r.a005 <> 'GJM' or r.e005 <> date '2026-09-16' then
    raise exception 'FSQM-005 did not issue: %, %, %.', r.s005, r.a005, r.e005;
  end if;
  if r.vs <> 'active' or r.vsp is not null then
    raise exception 'The monthly activity is % with pending %.', r.vs, r.vsp;
  end if;
  if r.r017 <> 'v7' or r.l017 <> 75 then
    raise exception 'FSQM-017 is % with % lines, expected v7 / 75.', r.r017, r.l017;
  end if;

  -- the Part 6 line must be in the monthly block, with its neighbours undisturbed
  if (select content->'procedure'->>51 from public.sop_documents where sop_number = 'FSQM-017')
     not like '%Monthly SQF update to senior site management%FRM-009%' then
    raise exception 'The Part 6 line did not land at index 51.';
  end if;
  if (select content->'procedure'->>50 from public.sop_documents where sop_number = 'FSQM-017')
     not like '%Customer complaint review%' then
    raise exception 'The insert displaced the monthly block above it.';
  end if;
  if (select content->'procedure'->>52 from public.sop_documents where sop_number = 'FSQM-017')
     not like '%Management review of the SQF System%' then
    raise exception 'The insert displaced the annual block below it.';
  end if;

  -- an active row must have something to be evidenced by, which the CHECK enforces but say it here
  if not exists (select 1 from public.verification_schedule
                  where activity_key = 'monthly_sqf_update'
                    and evidence_kind = 'form_entry'
                    and evidence_document_number = 'FRM-009'
                    and frequency_unit = 'month' and frequency_count = 1) then
    raise exception 'The monthly activity lost its evidence wiring through activation.';
  end if;
  -- and the form it points at has to be the one just issued
  if not exists (select 1 from public.sop_documents
                  where sop_number = 'FRM-009' and status = 'active'
                    and content->'form_schema'->'sections' @> '[{"id": "matters"}]'::jsonb) then
    raise exception 'FRM-009 is active but no longer carries the matters section.';
  end if;
  if (select content->>'revision_history' from public.sop_documents where sop_number = 'FSQM-005')
     like '%Status stays draft%' then
    raise exception 'FSQM-005 still says it is a draft.';
  end if;

  raise notice 'D-06: FSQM-005 and FRM-009 issued active/GJM/2026-09-16; monthly activity live; FSQM-017 v7 (% lines).',
    r.l017;
end $verify$;

commit;
