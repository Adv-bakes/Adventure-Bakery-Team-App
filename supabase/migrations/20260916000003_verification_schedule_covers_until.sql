-- D-05, second half: put the blackout declaration on the verification schedule, and teach the
-- schedule to date an activity from the period a record DECLARES rather than from the day it was
-- filed.
--
-- WHY THE EXISTING ANCHORING DOES NOT FIT THIS ONE. Every activity on the schedule so far is
-- "do it again N after the last time you did it" - an inspection, a review, a test. nextDue() is
-- therefore last_completed + frequency, and that is right for all of them. FRM-006 is different:
-- a blackout declaration states the period it covers. Filing it early or late says nothing about
-- when it expires. Anchored on submitted_at, a declaration signed in October for the following
-- calendar year would come due the following October - ten months after the site had already been
-- covered, and, worse, a declaration signed late would push its own expiry out and let the site
-- run uncovered without the schedule noticing.
--
-- SO: covers_until_field NAMES A FIELD ON THE EVIDENCE FORM HOLDING THE LAST DATE THAT RECORD
-- COVERS, and the activity is next due THE DAY AFTER - the first day no record covers. The
-- frequency is not consulted at all. A declaration covering a calendar year is due on 1 January
-- whether it was signed the October before or the February after, which is the only reading under
-- which "the site is covered" stays continuously true.
--
-- LEAD_DAYS 90, as asked. The alert has to arrive while there is still time to agree the dates with
-- senior management, sign them, and get them to the certification body - 2.1.1.8 wants them there a
-- month before the sixty-day unannounced window opens, so 90 days is the notice that makes that
-- deadline reachable rather than merely announced.
--
-- GRACE_DAYS 0, unlike the reviews around it. A review a few days late is late. A declaration a day
-- late means a day nothing covers, so there is no grace to give.
--
-- THE ROW GOES IN AS `planned`, NOT `active`. FRM-006 is still a draft: the governing record has not
-- been issued, and the house rule for this table is that a planned row is activated when its program
-- is, never "fixed" by activating it early. The issue migration that makes FRM-006 active flips this
-- row to active and revises FSQM-017 to carry it in Part 6. Until then it raises nothing - which is
-- assessDue()'s single most important line.
--
-- THE READING HALF IS IN THREE PLACES AND ALL THREE MOVED TOGETHER:
--   supabase/functions/_shared/verificationSchedule.ts  - nextDue/rowState/assessDue
--   src/lib/verificationSchedule.ts                     - its twin, regenerated from it
--   supabase/functions/verification-notifications/      - reads the field off submitted entries
--   src/pages/team/compliance/VerificationSchedule.tsx  - the same read, so page and badge agree
-- scripts/test-verification-schedule.mjs asserts the two library copies agree on the new anchoring.
--
-- ⚠️ THE EDGE FUNCTION MUST BE REDEPLOYED for this to take effect:
--       supabase functions deploy verification-notifications
--    There is no ordering hazard if it is not: the old function ignores a column it does not know
--    about, and the row is planned, so nothing is raised either way until both have landed.

begin;

alter table public.verification_schedule
  add column if not exists covers_until_field text;

comment on column public.verification_schedule.covers_until_field is
  'Field on the evidence form holding the last date that record covers. When set, the activity is '
  'next due the day after that date and frequency_unit/count are not used for the due date. Only '
  'meaningful with evidence_kind = ''form_entry''.';

-- A field name against an activity with no form to read it from is a silent no-op, and a silent
-- no-op in a scheduling table is the defect this whole feature exists to avoid.
do $c$
begin
  if not exists (select 1 from pg_constraint
                  where conrelid = 'public.verification_schedule'::regclass
                    and conname = 'verification_schedule_covers_until_needs_form') then
    alter table public.verification_schedule
      add constraint verification_schedule_covers_until_needs_form
      check (covers_until_field is null or evidence_kind = 'form_entry');
  end if;
end $c$;

insert into public.verification_schedule
  (activity_key, activity, description, frequency_unit, frequency_count, responsible_position,
   evidence_kind, evidence_document_number, covers_until_field, pending_deliverable,
   sqf_reference, lead_days, grace_days, first_due_on, status, sort_order)
values
  ('blackout_declaration',
   'Blackout period declaration to the certification body',
   'Senior site management designates the blackout dates for the period ahead and submits them with '
   'their justification to the certification body. Dated from the period the declaration in force '
   'covers (FRM-006 "Period covered to"), not from when it was filed, and raised 90 days before the '
   'next period begins so there is time to agree, sign and send it.',
   'year', 1,
   'Senior Site Management',
   'form_entry', 'FRM-006', 'period_to',
   'D-05 Blackout Period Declaration - FRM-006 is still a draft',
   '2.1.1.8',
   90, 0, null,
   'planned', 115);

do $verify$
declare r record;
begin
  select status, lead_days, grace_days, covers_until_field, evidence_document_number,
         responsible_position, sort_order, pending_deliverable
    into r
    from public.verification_schedule where activity_key = 'blackout_declaration';

  if r.status is null then raise exception 'The blackout_declaration row did not insert.'; end if;
  if r.status <> 'planned' or r.pending_deliverable is null then
    raise exception 'The row must go in planned and name its deliverable (status=%, pending=%).',
      r.status, r.pending_deliverable;
  end if;
  if r.lead_days <> 90 or r.grace_days <> 0 then
    raise exception 'Lead/grace wrong: % / % (expected 90 / 0).', r.lead_days, r.grace_days;
  end if;
  if r.covers_until_field <> 'period_to' or r.evidence_document_number <> 'FRM-006' then
    raise exception 'Evidence wiring wrong: % on %.', r.covers_until_field, r.evidence_document_number;
  end if;

  -- the constraint has to actually bite, or the column is decoration
  begin
    update public.verification_schedule
       set covers_until_field = 'period_to'
     where activity_key = 'management_review' and evidence_kind <> 'form_entry';
  exception when check_violation then null;
  end;
  if exists (select 1 from public.verification_schedule
              where covers_until_field is not null and evidence_kind <> 'form_entry') then
    raise exception 'covers_until_field is set on a row with no form to read it from.';
  end if;

  raise notice 'D-05: blackout_declaration on the schedule as planned, dated from FRM-006.period_to, 90 days lead.';
end $verify$;

commit;
