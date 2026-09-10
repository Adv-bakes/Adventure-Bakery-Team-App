-- D-18 - the master verification schedule, as a table the site can edit and a job can read.
--
-- WHY A TABLE RATHER THAN A GRID INSIDE A FORM ENTRY. The obvious build was a fixed-mode register
-- grid on FRM-008, the way FRM-004 Equipment Register works. It was rejected because a grid row has
-- no stable identity: it is addressed by its ARRAY POSITION (fixedLabels[rowIdx]), or by its _label
-- when deletable is true. Renaming "GMP inspection" would orphan its open notification and mint a
-- duplicate under the new name; deleting a row would silently stop the alerting for that activity
-- while the printed schedule still showed it as scheduled. That is monitoring that looks like it is
-- running and is not - the exact failure 20260908000002's header exists to prevent. An activity_key
-- that survives the wording changing is the whole point.
--
-- IT IS STILL EDITABLE IN THE APP, which is what the owner asked for. Unlike temperature_limits,
-- this table carries INSERT and UPDATE policies for staff, so adding "check the pest devices
-- monthly" is something done in the Team Portal, not a migration. DELETE is admin-or-owner only:
-- an activity that stops applying is RETIRED, never removed, because the schedule is the evidence
-- of what was scheduled when.
--
-- THERE IS DELIBERATELY NO last_completed COLUMN. It is derived at read time from the evidence
-- records - max(submitted_at) of the referenced form's submitted responses. Nothing has to remember
-- to update it, so it cannot be stale, and the "last completed" an auditor is shown IS the record
-- rather than somebody's assertion about it. This also keeps the job read-only against
-- sop_document_responses: any UPDATE there fires the sop_document_responses_touch trigger and bumps
-- updated_at, which hands a StaleResponseError to whoever has that form open.
--
-- FREQUENCY IS UNIT PLUS COUNT, NEVER DAYS. 2.5.1.1 ii requires critical food safety limits to be
-- reviewed ANNUALLY, and 365-day arithmetic drifts a day every leap year until "annually" quietly
-- is not. Calendar addition with month-end clamping is in _shared/verificationSchedule.ts and is
-- tested by scripts/test-verification-schedule.mjs.
--
-- SEVEN OF THE TWENTY SEEDED ROWS ARE 'planned', and that is not an edge case to hide. The site has
-- NO HACCP plan and no CCP register under document control, no calibration program, no water or
-- compressed-air program and no internal audit program - D-14, D-28, D-31, D-32, D-19, D-20/D-21.
-- Those activities belong on the schedule because 2.5.2.2 asks for the schedule, but the site is not
-- performing them, and a schedule that implied otherwise would be worse than one with gaps. A CHECK
-- constraint forces every planned row to name the deliverable that will make it real, and the
-- decision half refuses to raise a notification for a row that is not active.
--
-- EVERY SEEDED FREQUENCY IS A PROPOSAL, not a determination. Both documents are seeded DRAFT and the
-- frequencies are for the SQF Practitioner to confirm before issue. Seeding a plausible-looking
-- cadence and letting it harden into fact is how FRM-004 ended up with pm_frequency set to
-- 'Not yet set' on every row - deliberately, so nobody mistook a guess for a decision.

begin;

create table if not exists public.verification_schedule (
  id                        uuid primary key default gen_random_uuid(),
  -- The stable machine identity. Notification dedupe keys are built from it, so it must survive the
  -- activity being reworded - which is precisely what a grid row label cannot do.
  activity_key              text not null unique,
  activity                  text not null,
  description               text,
  frequency_unit            text not null
                              check (frequency_unit in ('day','week','month','quarter','year')),
  frequency_count           integer not null default 1 check (frequency_count > 0),
  -- The house role vocabulary FSQM-004 and FSQM-036 already use. 2.5.2.2 requires the schedule to
  -- name the person responsible for each activity; this column IS that limb of the clause, and it
  -- is what the notification carries instead of routing to individuals.
  responsible_position      text not null check (responsible_position in
    ('SQF Practitioner','Production Supervisor','Production staff','Admin','Senior Site Management')),
  evidence_kind             text not null check (evidence_kind in ('form_entry','frm008','none')),
  evidence_document_number  text,
  owning_program            text,
  pending_deliverable       text,
  sqf_reference             text,
  lead_days                 integer not null default 0 check (lead_days >= 0),
  grace_days                integer not null default 0 check (grace_days >= 0),
  first_due_on              date,
  status                    text not null default 'active'
                              check (status in ('active','planned','retired')),
  sort_order                integer not null default 0,
  notes                     text,
  created_at                timestamptz not null default now(),
  updated_at                timestamptz not null default now(),
  updated_by                uuid references auth.users(id) on delete set null,

  -- An ACTIVE row must say where its evidence lives, or the job silently skips it while the
  -- schedule still shows it as scheduled. Same shape and same reasoning as
  -- temperature_limits_storage_needs_max.
  constraint verification_schedule_active_needs_evidence
    check (status <> 'active' or evidence_kind <> 'none'),
  -- A PLANNED row must name the deliverable that will make it real, so nobody reads a blank and
  -- concludes the site has simply decided not to do it.
  constraint verification_schedule_planned_names_deliverable
    check (status <> 'planned' or pending_deliverable is not null)
);

create index if not exists verification_schedule_active_idx
  on public.verification_schedule (sort_order)
  where status = 'active';

drop trigger if exists verification_schedule_touch on public.verification_schedule;
create trigger verification_schedule_touch
  before update on public.verification_schedule
  for each row execute function public.update_updated_at_column();

alter table public.verification_schedule enable row level security;

-- The auditor must be able to read the schedule - it is one of the first things an SQF audit asks
-- for - so SELECT is is_compliance_viewer, not is_staff_or_admin.
drop policy if exists "Compliance viewers read the verification schedule" on public.verification_schedule;
create policy "Compliance viewers read the verification schedule"
  on public.verification_schedule for select to authenticated
  using (public.is_compliance_viewer(auth.uid()));

drop policy if exists "Staff maintain the verification schedule" on public.verification_schedule;
create policy "Staff maintain the verification schedule"
  on public.verification_schedule for insert to authenticated
  with check (public.is_staff_or_admin(auth.uid()));

drop policy if exists "Staff amend the verification schedule" on public.verification_schedule;
create policy "Staff amend the verification schedule"
  on public.verification_schedule for update to authenticated
  using (public.is_staff_or_admin(auth.uid()))
  with check (public.is_staff_or_admin(auth.uid()));

-- Retire, do not delete. has_role(uid,'admin') does not include owner, so both are named.
drop policy if exists "Admins delete verification schedule rows" on public.verification_schedule;
create policy "Admins delete verification schedule rows"
  on public.verification_schedule for delete to authenticated
  using (public.has_role(auth.uid(), 'admin') or public.is_owner(auth.uid()));

-- ---------------------------------------------------------------- seed
-- ON CONFLICT DO NOTHING so re-running never clobbers a frequency the site has since corrected.
insert into public.verification_schedule
  (activity_key, activity, description, frequency_unit, frequency_count, responsible_position,
   evidence_kind, evidence_document_number, owning_program, pending_deliverable, sqf_reference,
   grace_days, status, sort_order)
values
  ('gmp_inspection', 'Site GMP and food safety inspection',
   'Monthly full-site inspection against SQF Module 11.',
   'month', 1, 'SQF Practitioner', 'form_entry', 'FRM-913', 'FSQM-022', null, '2.5.4.3', 7, 'active', 10),

  ('sanitation_daily_review', 'Review of daily sanitation and pre-operational records',
   'Confirms the daily confirmations were made and that failures were actioned.',
   'week', 1, 'Production Supervisor', 'form_entry', 'FRM-903', null, null, '11.2.5.9', 3, 'active', 20),

  ('cleaning_verification', 'Sanitation verification',
   'Verification that cleaning achieved its result, beyond the daily confirmation.',
   'week', 1, 'SQF Practitioner', 'form_entry', 'FRM-902', null, null, '11.2.5.9', 3, 'active', 30),

  ('temperature_record_review', 'Temperature monitoring record review',
   'The monthly review that confirms automatic monitoring and alerting worked.',
   'month', 1, 'SQF Practitioner', 'form_entry', 'FRM-401', 'SOP-401', null, '2.5.2.1, 11.6.2.3', 7, 'active', 40),

  ('retention_sample_review', 'Retention sample review and disposal',
   'Reviews the retention shelf and disposes of samples past their discard date.',
   'week', 1, 'SQF Practitioner', 'form_entry', 'FRM-703', 'FSQM-014', null, '2.4.4.5', 3, 'active', 50),

  ('release_record_review', 'Finished product release record review',
   'Confirms nothing was released without a completed release record.',
   'week', 1, 'SQF Practitioner', 'form_entry', 'FRM-701', 'FSQM-020', null, '2.4.7.1', 3, 'active', 60),

  ('dispatch_record_review', 'Dispatch and vehicle loading record review',
   'Confirms every load was checked before loading and the compartment secured.',
   'week', 1, 'SQF Practitioner', 'form_entry', 'FRM-801', 'FSQM-036', null, '11.6.5.2', 3, 'active', 70),

  ('glass_register_check', 'Glass and brittle plastic register check',
   'Physical check of every item on the register.',
   'month', 1, 'Production Supervisor', 'form_entry', 'FRM-907', null, null, '11.7.3', 7, 'active', 80),

  ('capa_review', 'Review of open and overdue corrective actions',
   'Confirms open CAPAs are progressing and closed ones were verified effective.',
   'month', 1, 'SQF Practitioner', 'form_entry', 'FRM-007', 'FSQM-009', null, '2.5.3.1', 7, 'active', 90),

  ('complaint_review', 'Customer complaint review and trending',
   'Reviews complaints received in the period and looks for a trend.',
   'month', 1, 'SQF Practitioner', 'form_entry', 'FRM-002', null, null, '2.1.3.3', 7, 'active', 100),

  ('management_review', 'Management review of the SQF System',
   'Senior site management review of the food safety management system.',
   'year', 1, 'Senior Site Management', 'form_entry', 'FRM-001', null, null, '2.1.2', 30, 'active', 110),

  ('critical_limit_validation', 'Annual review and re-validation of critical food safety limits',
   'The 2.5.1.1 ii limb. Reviews every critical limit in force and re-validates or justifies it.',
   'year', 1, 'SQF Practitioner', 'frm008', 'FRM-008', 'FSQM-017', null, '2.5.1.1', 30, 'active', 120),

  ('program_review', 'Annual review of the Validation and Verification Program',
   'Reviews this schedule itself: are the activities right, the frequencies right, the owners right.',
   'year', 1, 'SQF Practitioner', 'frm008', 'FRM-008', 'FSQM-017', null, '2.5.2.2', 30, 'active', 130),

  -- ---- planned: scheduled, but the program that governs them has not been issued ----
  ('calibration_check', 'Calibration of measuring and monitoring equipment',
   'Scheduled but not yet performed - no calibration program is in force.',
   'year', 1, 'SQF Practitioner', 'none', null, null, 'D-28 Calibration Program', '11.2.3.1', 30, 'planned', 200),

  ('backflow_testing', 'Backflow prevention device testing',
   'Scheduled but not yet performed - no water and utilities program is in force.',
   'year', 1, 'SQF Practitioner', 'none', null, null, 'D-31 Water and Utilities Program', '11.5.1.4', 30, 'planned', 210),

  ('water_analysis', 'Potable water microbiological and chemical analysis',
   'Scheduled but not yet performed - no water and utilities program is in force.',
   'year', 1, 'SQF Practitioner', 'none', null, null, 'D-31 Water and Utilities Program', '11.5.2.1', 30, 'planned', 220),

  ('air_analysis', 'Compressed air quality analysis',
   'Scheduled but not yet performed - scope not yet confirmed for the pneumatic depositor.',
   'year', 1, 'SQF Practitioner', 'none', null, null, 'D-32 Compressed Air and Gases', '11.5.5.2', 30, 'planned', 230),

  ('ccp_record_review', 'CCP monitoring record review',
   'Scheduled but not yet performed - the site has no HACCP plan under document control and no CCPs are defined.',
   'week', 1, 'SQF Practitioner', 'none', null, null, 'D-14 HACCP / Food Safety Plan', '2.5.2.1', 3, 'planned', 240),

  ('internal_audit', 'Internal audit of the SQF System',
   'Scheduled but not yet performed - no internal audit program is in force.',
   'year', 1, 'SQF Practitioner', 'none', null, null, 'D-19 Internal Audit Program', '2.5.4.1', 30, 'planned', 250),

  ('traceability_test', 'Traceability and mock recall test',
   'Scheduled but not yet performed - no traceability or recall program is in force.',
   'year', 1, 'SQF Practitioner', 'none', null, null, 'D-20 Traceability / D-21 Recall', '2.6.2.1', 30, 'planned', 260)
on conflict (activity_key) do nothing;

do $$
declare r record;
begin
  select
    (select count(*) from public.verification_schedule)                                as n,
    (select count(*) from public.verification_schedule where status = 'active')        as n_active,
    (select count(*) from public.verification_schedule where status = 'planned')       as n_planned,
    (select count(*) from public.verification_schedule
      where status = 'active' and evidence_kind = 'none')                              as bad_active,
    (select count(*) from public.verification_schedule
      where status = 'planned' and pending_deliverable is null)                        as bad_planned,
    (select count(*) from pg_policies
      where schemaname = 'public' and tablename = 'verification_schedule')             as policies,
    (select relrowsecurity from pg_class where oid = 'public.verification_schedule'::regclass) as rls
  into r;

  if r.n <> 20 then
    raise exception 'verification_schedule holds % rows, expected 20.', r.n;
  end if;
  if r.n_active <> 13 or r.n_planned <> 7 then
    raise exception 'seed is % active / % planned, expected 13 / 7.', r.n_active, r.n_planned;
  end if;
  -- Both of these are enforced by CHECK constraints; asserting them here proves the constraints
  -- are actually on the table rather than trusting that they were written.
  if r.bad_active <> 0 then
    raise exception '% active row(s) have nowhere to record evidence; the job would skip them silently.', r.bad_active;
  end if;
  if r.bad_planned <> 0 then
    raise exception '% planned row(s) do not name a deliverable.', r.bad_planned;
  end if;
  if not r.rls then
    raise exception 'row level security is not enabled on verification_schedule.';
  end if;
  if r.policies <> 4 then
    raise exception 'verification_schedule has % policies, expected 4.', r.policies;
  end if;
end $$;

commit;
