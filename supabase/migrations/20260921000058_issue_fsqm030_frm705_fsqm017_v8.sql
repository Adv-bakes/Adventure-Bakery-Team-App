-- D-28: issue FSQM-030 Calibration Program and FRM-705 Calibration Directory and Check Record,
-- activate the calibration activity on the verification schedule, and revise FSQM-017 to v8.
--
-- FSQM-030, FRM-705: active, GJM, 2026-09-21, revision New (first issue). Guarded on the md5 of each
-- document's content as reviewed.
--
-- verification_schedule.calibration_check: planned/annual/no evidence -> ACTIVE, MONTHLY, form_entry
-- FRM-705, owning program FSQM-030. first_due_on 2026-10-21 - a month after issue, so the owner can buy
-- the 25 lb certified test weight first; a month where it is still missing is recorded on FRM-705 as
-- "Not checked this month - reason recorded" rather than skipped. Lead/grace copied from the other
-- monthly reviews (0 / 7).
--
-- FSQM-017 v7 -> v8: Part 6 prints the schedule, so its calibration line (procedure[56]) changes from
-- "Annually ... NOT YET IMPLEMENTED - awaiting D-28" to "Monthly - SQF Practitioner - FRM-705", in the
-- same place (the list follows the schedule's sort order). FRM-705 added to its form references.
-- Guarded on the md5 of FSQM-017's content.

begin;

do $guard$
declare h text; st text; rev text;
begin
  select md5(content::text), status into h, st from public.sop_documents where sop_number = 'FSQM-030';
  if st is distinct from 'draft' or h <> '2fdf1f770f768776da9fae346b4ede4d' then
    raise exception 'FSQM-030 is % or changed since review (md5 %).', st, h;
  end if;
  select md5(content::text), status into h, st from public.sop_documents where sop_number = 'FRM-705';
  if st is distinct from 'draft' or h <> 'd908a77e0a6bf39f2f0b3ea0d1b2c540' then
    raise exception 'FRM-705 is % or changed since review (md5 %).', st, h;
  end if;
  select md5(content::text), status, revision into h, st, rev from public.sop_documents where sop_number = 'FSQM-017';
  if (st, rev) is distinct from ('active', 'v7') or h <> '8e9584d5f71c23afaa394b49a2a8ceb4' then
    raise exception 'FSQM-017 is %/% or changed since this migration was written (md5 %).', st, rev, h;
  end if;
  if (select status from public.verification_schedule where activity_key = 'calibration_check') <> 'planned' then
    raise exception 'calibration_check is not planned.';
  end if;
  if (select count(*) from public.sop_document_responses r join public.sop_documents d on d.id = r.document_id
       where d.sop_number = 'FRM-705') <> 0 then
    raise exception 'FRM-705 has entries before issue - check they are not test entries.';
  end if;
end $guard$;

-- Owner, 2026-09-21, after review: the most the scales weigh is 30 lb, not 50 lb. The 25 lb certified
-- test weight still stands (about 83% of the working load); only FSQM-030's two statements of the
-- scales' range are corrected before issue. The md5 guard above is on the reviewed draft, so this is
-- the only change made to it.
update public.sop_documents
   set content = replace(replace(content::text,
         'The scales weigh up to about 50 lb, so 25 lb tests them in the range they are used in',
         'The scales weigh up to about 30 lb, so 25 lb tests them in the range they are used in'),
         'for the scales, which weigh up to about 50 lb.',
         'for the scales, which weigh up to about 30 lb.')::jsonb
 where sop_number = 'FSQM-030';

update public.sop_documents
   set status = 'active', approved_by = 'GJM', effective_date = date '2026-09-21'
 where sop_number in ('FSQM-030', 'FRM-705');

update public.verification_schedule
   set status = 'active',
       description = $t$Monthly calibration check of every device on the FRM-705 directory, under FSQM-030: the probe thermometer at two points (ice point on FRM-401, boiling water on FRM-705), the oven display and bake timer, the two bench scales against a 25 lb certified test weight, and the refrigerator and freezer sensors (compared on FRM-401). The vacuum gauge is listed but not relied on.$t$,
       frequency_unit = 'month',
       frequency_count = 1,
       evidence_kind = 'form_entry',
       evidence_document_number = 'FRM-705',
       owning_program = 'FSQM-030',
       pending_deliverable = null,
       lead_days = 0,
       grace_days = 7,
       first_due_on = date '2026-10-21',
       sqf_reference = '11.2.3.1, 11.2.3.3, 11.2.3.6'
 where activity_key = 'calibration_check' and status = 'planned';

update public.sop_documents
   set content = jsonb_set(jsonb_set(jsonb_set(content,
                   '{procedure,56}', to_jsonb($t$• Calibration of measuring and monitoring equipment — Monthly — SQF Practitioner — FRM-705$t$::text)),
                   '{form_references}', to_jsonb((content->>'form_references') || $t$; FRM-705 Calibration Directory and Check Record$t$)),
                   '{revision_history}', to_jsonb((content->>'revision_history') || $t$

v8 — 2026-09-21 — Calibration brought into force under D-28. FSQM-030 Calibration Program and FRM-705 Calibration Directory and Check Record are issued, so the calibration activity in Part 6 moves from NOT YET IMPLEMENTED to active: monthly, SQF Practitioner, evidenced by FRM-705. It was carried as annual while no program existed; FSQM-030 sets it monthly, one session covering every device on the directory. First due 2026-10-21, a month after issue, so the 25 lb certified test weight can be bought before the first check. Nothing else in the schedule changes.$t$)),
       revision = 'v8', effective_date = date '2026-09-21', approved_by = 'GJM'
 where sop_number = 'FSQM-017';

do $verify$
declare n int; v record; l text;
begin
  select count(*) into n from public.sop_documents
   where sop_number in ('FSQM-030', 'FRM-705') and status = 'active' and approved_by = 'GJM'
     and effective_date = date '2026-09-21' and revision = 'New';
  if n <> 2 then raise exception 'FSQM-030 / FRM-705 did not both issue.'; end if;
  if (select content::text from public.sop_documents where sop_number = 'FSQM-030') like '%50 lb%'
     or (select count(*) from public.sop_documents where sop_number = 'FSQM-030'
          and content::text like '%up to about 30 lb, so 25 lb%' and content::text like '%which weigh up to about 30 lb.%') <> 1 then
    raise exception 'FSQM-030 scale range not corrected to 30 lb.';
  end if;
  select * into v from public.verification_schedule where activity_key = 'calibration_check';
  if (v.status, v.frequency_unit, v.evidence_kind, v.evidence_document_number, v.owning_program)
     is distinct from ('active', 'month', 'form_entry', 'FRM-705', 'FSQM-030') or v.pending_deliverable is not null then
    raise exception 'calibration_check not activated correctly.';
  end if;
  select content->'procedure'->>56 into l from public.sop_documents where sop_number = 'FSQM-017' and revision = 'v8';
  if l is null or l not like '%Monthly%FRM-705' or l like '%NOT YET IMPLEMENTED%' then
    raise exception 'FSQM-017 Part 6 calibration line not updated: %', l;
  end if;
  if (select count(*) from public.sop_documents, jsonb_array_elements_text(content->'procedure') x
       where sop_number = 'FSQM-017' and x like '%awaiting D-28%') <> 0 then
    raise exception 'FSQM-017 still says calibration awaits D-28.';
  end if;
  raise notice 'D-28 issued: FSQM-030, FRM-705 active; calibration_check monthly on FRM-705, first due 2026-10-21; FSQM-017 v8.';
end $verify$;

commit;
