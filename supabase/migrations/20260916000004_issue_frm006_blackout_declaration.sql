-- D-05: issue FRM-006, activate the schedule row, and carry the activity in FSQM-017 Part 6.
--
-- THREE CHANGES THAT HAVE TO LAND TOGETHER, which is why they are one migration:
--   FRM-006                        draft -> active, approved GJM, effective 2026-09-16.
--   verification_schedule          blackout_declaration planned -> active.
--   FSQM-017                       v5 -> v6, the activity added to Part 6.
-- The schedule row was seeded `planned` precisely so it could not go live before the record it is
-- evidenced by. And a change to the schedule is a revision of FSQM-017 - that programme's Part 6 is
-- its copy of the schedule as at its effective date, and it says so. Activating the row without
-- revising FSQM-017 would leave the printed programme disagreeing with the live schedule, which is
-- the thing the rule exists to stop.
--
-- WHAT WILL HAPPEN AT THE NEXT CRON RUN, so it is not a surprise: no declaration has ever been
-- filed, so the activity has no anchor and assessDue() raises it as NEVER RECORDED - "No record of
-- this activity has ever been made. Record it on FRM-006." That is the intended prompt rather than
-- a fault. 2.1.1.8 is open until senior site management files one, and the notification is what
-- says so. It carries a single dedupe key (`...:never`) rather than one per day, so it is raised
-- once and stays cleared if somebody clears it.
--
-- WHAT ISSUING THIS DOES NOT CLOSE. 2.1.1.8 has two limbs. The designation limb closes when a real
-- entry is filled and SUBMITTED by senior site management - a blank form is not a record. The
-- submission limb cannot close at all yet: no certification body is engaged, so there is nothing to
-- submit to. FRM-006 Section 5 stays blank and says so on its face. D-05 stays WIP.
--
-- Guarded on the exact pre-state of all three. Not idempotent by design.

begin;

-- ------------------------------------------------------------------ guards
do $guard$
declare r record;
begin
  select (select status   from public.sop_documents where sop_number = 'FRM-006')  as s006,
         (select revision from public.sop_documents where sop_number = 'FRM-006')  as r006,
         (select status   from public.sop_documents where sop_number = 'FSQM-017') as s017,
         (select revision from public.sop_documents where sop_number = 'FSQM-017') as r017,
         (select jsonb_array_length(content->'procedure')
            from public.sop_documents where sop_number = 'FSQM-017')               as l017,
         (select status from public.verification_schedule
           where activity_key = 'blackout_declaration')                            as vs
    into r;

  if (r.s006, r.r006) is distinct from ('draft', 'New') then
    raise exception 'FRM-006 is %/% - expected the unissued draft.', r.s006, r.r006;
  end if;
  if (r.s017, r.r017) is distinct from ('active', 'v5') or r.l017 <> 73 then
    raise exception 'FSQM-017 is %/% with % lines - expected active/v5/73. Re-derive.',
      r.s017, r.r017, r.l017;
  end if;
  if r.vs is distinct from 'planned' then
    raise exception 'blackout_declaration is % - expected planned.', r.vs;
  end if;
  if (select content->'procedure'->>51 from public.sop_documents where sop_number = 'FSQM-017')
     not like '%Management review of the SQF System%' then
    raise exception 'FSQM-017 procedure[51] is not the management review line; the insert point moved.';
  end if;
end $guard$;

-- ------------------------------------------------------------------ 1. issue FRM-006
update public.sop_documents
   set status         = 'active',
       approved_by    = 'GJM',
       effective_date = date '2026-09-16'
 where sop_number = 'FRM-006';

-- ------------------------------------------------------------------ 2. activate the activity
update public.verification_schedule
   set status              = 'active',
       pending_deliverable = null,
       owning_program      = 'FSQM-017',
       updated_at          = now()
 where activity_key = 'blackout_declaration';

-- ------------------------------------------------------------------ 3. FSQM-017 v6
-- Inserted at 52, immediately after the management review: the schedule's other annual activity
-- owned by senior site management, and before the block of annuals that are not yet performed.
update public.sop_documents
   set content = jsonb_set(
         jsonb_insert(content, '{procedure,52}', to_jsonb($p6$• Blackout period declaration to the certification body — Annually — Senior Site Management — FRM-006; dated from the period the declaration in force covers, not from when it was filed, and raised 90 days ahead of the next period$p6$::text)),
         '{revision_history}',
         to_jsonb((content->>'revision_history') || E'\n\n' || $rh$v6 — 2026-09-16 — The blackout period declaration added to the schedule, under D-05.

SQF 2.1.1.8 requires senior site management to designate defined blackout periods and to submit them, with their justification, to the certification body at least one month before the sixty-day unannounced re-certification window opens. FRM-006 Blackout Period Declaration is issued with this revision as the record of that designation, and the activity joins Part 6.

IT IS DATED DIFFERENTLY FROM EVERY OTHER ACTIVITY ON THIS SCHEDULE, AND DELIBERATELY SO. The rest are "do it again a period after the last time you did it". A blackout declaration states the period it covers, so filing it early or late says nothing about when it expires. Anchored on the filing date, a declaration signed in October for the following calendar year would come due the following October — ten months after the site was already covered — and one signed late would push its own expiry out and let the site run uncovered without the schedule noticing. It is therefore dated from the last day the declaration in force covers, and raised ninety days before the next period begins: enough notice to agree the dates, sign them and send them.

NO DECLARATION HAS BEEN FILED YET, so the activity will be raised as never recorded at the next run of the reminder job. That is the intended prompt and not a fault — 2.1.1.8 is open until senior site management files one.

THE SUBMISSION LIMB REMAINS OPEN, and it is not a matter of scheduling. No certification body is engaged and no certificate is held, so there is nothing to submit to and no sixty-day window to count back from. FRM-006 Section 5 stays blank until there is one, and says so on its face.$rh$::text)),
       revision       = 'v6',
       effective_date = date '2026-09-16',
       approved_by    = 'GJM'
 where sop_number = 'FSQM-017';

-- ------------------------------------------------------------------ verify
do $verify$
declare r record;
begin
  select (select status   from public.sop_documents where sop_number = 'FRM-006')  as s006,
         (select approved_by from public.sop_documents where sop_number = 'FRM-006') as a006,
         (select effective_date from public.sop_documents where sop_number = 'FRM-006') as e006,
         (select revision from public.sop_documents where sop_number = 'FSQM-017') as r017,
         (select jsonb_array_length(content->'procedure')
            from public.sop_documents where sop_number = 'FSQM-017')               as l017,
         (select status from public.verification_schedule
           where activity_key = 'blackout_declaration')                            as vs,
         (select pending_deliverable from public.verification_schedule
           where activity_key = 'blackout_declaration')                            as vsp
    into r;

  if r.s006 <> 'active' or r.a006 <> 'GJM' or r.e006 <> date '2026-09-16' then
    raise exception 'FRM-006 did not issue: status=%, approved_by=%, effective=%.',
      r.s006, r.a006, r.e006;
  end if;
  if r.vs <> 'active' or r.vsp is not null then
    raise exception 'The schedule row is % with pending_deliverable %.', r.vs, r.vsp;
  end if;
  if r.r017 <> 'v6' or r.l017 <> 74 then
    raise exception 'FSQM-017 is % with % lines, expected v6 / 74.', r.r017, r.l017;
  end if;

  -- the line must be in Part 6, in the right place, and must not have displaced its neighbours
  if (select content->'procedure'->>52 from public.sop_documents where sop_number = 'FSQM-017')
     not like '%Blackout period declaration%FRM-006%' then
    raise exception 'The Part 6 line did not land at index 52.';
  end if;
  if (select content->'procedure'->>51 from public.sop_documents where sop_number = 'FSQM-017')
     not like '%Management review of the SQF System%' then
    raise exception 'The management review line moved.';
  end if;
  if (select content->'procedure'->>53 from public.sop_documents where sop_number = 'FSQM-017')
     not like '%critical food safety limits%' then
    raise exception 'The insert displaced the annual re-validation line.';
  end if;

  -- the wiring the notification job depends on must still be intact after activation
  if not exists (select 1 from public.verification_schedule
                  where activity_key = 'blackout_declaration'
                    and evidence_kind = 'form_entry'
                    and evidence_document_number = 'FRM-006'
                    and covers_until_field = 'period_to'
                    and lead_days = 90 and grace_days = 0) then
    raise exception 'The blackout activity lost its evidence wiring or its 90-day lead.';
  end if;
  -- and the form it points at has to be the one that was just issued
  if not exists (select 1 from public.sop_documents
                  where sop_number = 'FRM-006' and status = 'active'
                    and content->'form_schema'->'sections' @> '[{"id": "period"}]'::jsonb) then
    raise exception 'FRM-006 is active but no longer carries the period section the schedule reads.';
  end if;

  raise notice 'D-05: FRM-006 issued active/GJM/2026-09-16; blackout_declaration active; FSQM-017 v6 (% lines).',
    r.l017;
end $verify$;

commit;
