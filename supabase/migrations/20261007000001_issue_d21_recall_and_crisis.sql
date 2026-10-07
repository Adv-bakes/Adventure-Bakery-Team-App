-- D-21 ISSUE: FSQM-023 Product Withdrawal and Recall Program, FSQM-024 Crisis Management Plan, FRM-011
-- Recall and Crisis Contact List, FRM-012 Withdrawal, Recall and Mock Recall Record, FRM-013 Crisis
-- Management Review and Test Record. Approved GJM, effective 2026-10-07. First issue: revision "New".
-- FSQM-017 Validation and Verification Program v12 -> v13 for the two schedule lines.
--
-- Their precondition was the traceability program, issued 2026-10-06 (20261006000011).
--
-- What the drafts listed to confirm, as answered by the owner on 2026-10-07:
--   - the customer agreements make the brand owner responsible for consumer notices - as written;
--   - there was NO off-site copy of the contact list. FSQM-024 now says a printed copy is kept off
--     the site by the SQF Practitioner and replaced each time the list is approved;
--   - the temperature sensors run on batteries but their hub needs mains power, so a power cut
--     leaves a gap in the record. FSQM-024's restart check said "the temperature record is checked
--     for the whole outage", which would have been a record that does not exist. It now says the
--     units are treated as out of range for the whole gap and the product is probed (SOP-401).
-- The contacts themselves, the first mock recall and the first crisis walk-through are the site's
-- to do after issue; the schedule now asks for the last two.
--
-- verification_schedule:
--   - traceability_test: planned -> ACTIVE, yearly, FRM-012, owned by FSQM-023, first due 2026-12-31;
--   - crisis_plan_review: NEW, yearly, FRM-013, owned by FSQM-024, Senior Site Management, first due
--     2027-05-31 (the plan asks for it before 1 June), raised 45 days ahead.
-- FSQM-017 Part 6: line 61 loses NOT YET IMPLEMENTED and names FRM-012; a line for the crisis review
-- is inserted after it. ONE UPDATE per document.

begin;

do $guard$
declare r record; h text; st text; rev text;
begin
  for r in select * from (values
      ('FSQM-023', '338d483725490bc9e01ee16fb2b20235'), ('FSQM-024', '17c4c69593f4828c308276d9823e6aef'), ('FRM-011', 'e6e0b139286010ebcc3553138da8f0a1'),
      ('FRM-012', '3a61b335e394f0f019dbfbe6e4bb3001'), ('FRM-013', '4245e5671e044b51b31ddf4b249560ad')) v(num, md5) loop
    select md5((content - 'attachments')::text) into h from public.sop_documents where sop_number = r.num and status = 'draft';
    if h is distinct from r.md5 then raise exception '% is not the draft that was approved (md5 %).', r.num, h; end if;
  end loop;
  if exists (select 1 from public.sop_documents where sop_number in ('FSQM-023','FSQM-024','FRM-011','FRM-012','FRM-013') and status = 'active') then
    raise exception 'one of the five documents is already active.';
  end if;
  select md5(content::text), status, revision into h, st, rev from public.sop_documents where sop_number = 'FSQM-017' and status = 'active';
  if rev is distinct from 'v12' or h <> '415d1074a1e9e257b13bbb08cd08db47' then raise exception 'FSQM-017 is % or changed (md5 %).', rev, h; end if;
  if (select status from public.verification_schedule where activity_key = 'traceability_test') is distinct from 'planned' then
    raise exception 'the traceability_test row is not planned.';
  end if;
  if exists (select 1 from public.verification_schedule where activity_key = 'crisis_plan_review') then
    raise exception 'a crisis_plan_review row already exists.';
  end if;
  if not exists (select 1 from public.sop_documents where sop_number = 'FSQM-021' and status = 'active')
     or not exists (select 1 from public.sop_documents where sop_number = 'FRM-520' and status = 'active') then
    raise exception 'FSQM-021 and FRM-520 must be issued first.';
  end if;
end $guard$;

update public.sop_documents
   set content = jsonb_set(content, '{revision_history}', to_jsonb((content->>'revision_history') || $t$

ISSUED 2026-10-07, with FSQM-024, FRM-011, FRM-012 and FRM-013; FSQM-021 and FRM-520 were issued the day before. What the draft listed to confirm (owner, 2026-10-07): (1) the customer agreements do make the brand owner responsible for telling consumers and the public, as written. (2) No certification body is contracted yet; it is added to FRM-011 when one is. (3) Legal counsel and a food safety consultant are entered on FRM-011 by Senior Site Management. (4) The first mock recall is due by 2026-12-31: the 'traceability and mock recall test' row of the verification schedule is now active, yearly, on FRM-012.$t$)),
       status = 'active', approved_by = 'GJM', effective_date = date '2026-10-07'
 where sop_number = 'FSQM-023' and status = 'draft';

update public.sop_documents
   set content = jsonb_set(jsonb_set(jsonb_set(content,
                   '{procedure,13}', to_jsonb($t$• The crisis contact list is FRM-011: the team, the landlord, utilities, the insurer, customers, suppliers and the authorities. It is kept in the Team Portal, and a printed copy is kept off the site by the SQF Practitioner so that it can be reached when the site and the portal cannot. The printed copy is replaced each time the list is approved, and FRM-011 states where it is kept (SQF 2.6.4.1 vi).$t$::text)),
                   '{procedure,23}', to_jsonb($t$◦ The temperature sensors run on batteries, but the hub that sends their readings needs mains power, so readings stop arriving during a power cut and the record has a gap. The gap runs from the last reading before the cut to the first after it. The refrigerator and freezer are treated as out of range for the whole of that gap, the product temperature is taken with the calibrated probe as soon as the site is entered, and the contents are dealt with under SOP-401.$t$::text)),
                   '{revision_history}', to_jsonb((content->>'revision_history') || $t$

ISSUED 2026-10-07, with FSQM-023 and the three records. What the draft listed to confirm (owner, 2026-10-07): (1) OFF-SITE COPY - there was none; the plan now says a printed copy is kept off the site by the SQF Practitioner and replaced each time the list is approved. (2) Insurer, landlord and utility contacts are entered on FRM-011 by Senior Site Management. (3) SENSORS - they run on batteries but the hub needs mains power, so a power cut leaves a gap in the record. The plan now says so: the units are treated as out of range for the whole gap and the product temperature is taken with the probe before anything is used. (4) The first review and test is due by 2027-05-31, before the storm season: a 'crisis management plan review and test' row is added to the verification schedule, yearly, on FRM-013.$t$)),
       status = 'active', approved_by = 'GJM', effective_date = date '2026-10-07'
 where sop_number = 'FSQM-024' and status = 'draft';

update public.sop_documents
   set status = 'active', approved_by = 'GJM', effective_date = date '2026-10-07'
 where sop_number in ('FRM-011', 'FRM-012', 'FRM-013') and status = 'draft';

update public.verification_schedule
   set status = 'active',
       evidence_kind = 'form_entry',
       evidence_document_number = 'FRM-012',
       owning_program = 'FSQM-023',
       pending_deliverable = null,
       sqf_reference = '2.6.2.1, 2.6.3.2',
       description = 'One mock recall a year under FSQM-023, recorded on FRM-012: a finished lot traced back to every supplier lot and forward to every customer, and an incoming material lot traced forward, within 4 hours, with the FRM-011 contact list checked in the same test. It is also the annual trace test of FSQM-021.',
       lead_days = 30,
       first_due_on = date '2026-12-31'
 where activity_key = 'traceability_test' and status = 'planned';

insert into public.verification_schedule
  (activity_key, activity, description, frequency_unit, frequency_count, responsible_position,
   evidence_kind, evidence_document_number, owning_program, sqf_reference, lead_days, grace_days,
   first_due_on, status, sort_order)
values
  ('crisis_plan_review', 'Crisis management plan review and test', 'The crisis management team walks through a storm scenario against FSQM-024, checks the FRM-011 contact list, and records the review, who took part, the gaps and the actions on FRM-013. Done before 1 June each year, ahead of the storm season.', 'year', 1, 'Senior Site Management',
   'form_entry', 'FRM-013', 'FSQM-024', '2.6.4.2', 45, 0, date '2027-05-31', 'active', 265);

update public.sop_documents
   set content = jsonb_set(
                   jsonb_insert(
                     jsonb_set(content, '{procedure,61}', to_jsonb($t$• Traceability and mock recall test — Annually — SQF Practitioner — FRM-012$t$::text)),
                     '{procedure,62}', to_jsonb($t$• Crisis management plan review and test — Annually, before 1 June — Senior Site Management — FRM-013$t$::text)),
                   '{revision_history}', to_jsonb((content->>'revision_history') || $t$

v13 — 2026-10-07 — Recall and crisis brought into force under D-21. FSQM-023 Product Withdrawal and Recall Program and FSQM-024 Crisis Management Plan are issued with their records, and FSQM-021 Product Identification and Traceability Program was issued on 2026-10-06. In Part 6 the traceability and mock recall test moves from NOT YET IMPLEMENTED to active: yearly, evidenced by FRM-012, first due 2026-12-31. One activity is added: the crisis management plan review and test, yearly before 1 June, Senior Site Management, evidenced by FRM-013, first due 2027-05-31. Nothing else in the schedule changes.$t$)),
       revision = 'v13', effective_date = date '2026-10-07', approved_by = 'GJM'
 where sop_number = 'FSQM-017' and status = 'active' and revision = 'v12';

do $verify$
declare n int; c jsonb; v record;
begin
  select count(*) into n from public.sop_documents
   where sop_number in ('FSQM-023','FSQM-024','FRM-011','FRM-012','FRM-013') and status = 'active' and revision = 'New'
     and approved_by = 'GJM' and effective_date = date '2026-10-07';
  if n <> 5 then raise exception 'expected five documents active and stamped, found %.', n; end if;
  if exists (select 1 from public.sop_documents where sop_number in ('FSQM-023','FSQM-024','FRM-011','FRM-012','FRM-013') and status = 'draft') then
    raise exception 'a draft copy is left behind.';
  end if;
  select content into c from public.sop_documents where sop_number = 'FSQM-024' and status = 'active';
  if jsonb_array_length(c->'procedure') <> 33 or c->'procedure'->>13 not like '%a printed copy is kept off the site%'
     or c->'procedure'->>23 not like '%the record has a gap%' then
    raise exception 'FSQM-024 was not updated as intended.';
  end if;
  if (select md5((content - 'attachments')::text) from public.sop_documents where sop_number = 'FRM-012' and status = 'active') <> '3a61b335e394f0f019dbfbe6e4bb3001' then
    raise exception 'FRM-012 content must not change at issue.';
  end if;
  select * into v from public.verification_schedule where activity_key = 'traceability_test';
  if v.status <> 'active' or v.evidence_document_number <> 'FRM-012' or v.first_due_on <> date '2026-12-31' or v.pending_deliverable is not null then
    raise exception 'traceability_test row not as intended.';
  end if;
  select * into v from public.verification_schedule where activity_key = 'crisis_plan_review';
  if v.status <> 'active' or v.evidence_document_number <> 'FRM-013' or v.first_due_on <> date '2027-05-31' then
    raise exception 'crisis_plan_review row not as intended.';
  end if;
  select content into c from public.sop_documents where sop_number = 'FSQM-017' and status = 'active' and revision = 'v13';
  if c is null or jsonb_array_length(c->'procedure') <> 77 or c->'procedure'->>61 not like '%mock recall test%FRM-012'
     or c->'procedure'->>62 not like '%Crisis management plan review and test%FRM-013' or c->'procedure'->>63 not like '> The schedule is maintained%' then
    raise exception 'FSQM-017 Part 6 not as intended.';
  end if;
  if c::text like '%awaiting D-20%' then raise exception 'FSQM-017 still says the trace test awaits D-20.'; end if;
  for v in select sop_number, content from public.sop_documents where sop_number in ('FSQM-023','FSQM-024') and status = 'active' loop
    if v.content::text ~* '(Diana|Gabriela|Richard|Mercer|Botta)' then raise exception '% names a person or a customer.', v.sop_number; end if;
  end loop;
end $verify$;

commit;
