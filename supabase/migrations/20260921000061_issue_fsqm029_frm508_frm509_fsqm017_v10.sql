-- D-26: issue FSQM-029 Preventive Maintenance Program, FRM-508 Monthly Maintenance Check and FRM-509
-- Maintenance and Repair Record; activate the maintenance check on the verification schedule; FSQM-017 v10.
--
-- All three: active, GJM, 2026-09-21, revision New (first issue). Guarded on the md5 of each document's
-- content as seeded by 20260921000059 (verified unchanged before this was written) and on no entries.
--
-- verification_schedule.maintenance_check: planned -> ACTIVE, form_entry FRM-508, owning program
-- FSQM-029, first_due_on 2026-10-21 (a month after issue, like calibration). Lead/grace unchanged (0 / 7).
--
-- FSQM-017 v9 -> v10: Part 6's line (procedure[57]) loses NOT YET IMPLEMENTED and names FRM-508;
-- FRM-508 added to its form references. Guarded on the md5 of FSQM-017's content.

begin;

do $guard$
declare h text; st text; rev text;
begin
  select md5(content::text), status into h, st from public.sop_documents where sop_number = 'FSQM-029';
  if st is distinct from 'draft' or h <> '18dad05e81bd88e1fdf9c4227c21ff50' then raise exception 'FSQM-029 is % or changed since review (md5 %).', st, h; end if;
  select md5(content::text), status into h, st from public.sop_documents where sop_number = 'FRM-508';
  if st is distinct from 'draft' or h <> '1786448d203c7a3197fccad99c2c0e7b' then raise exception 'FRM-508 is % or changed since review (md5 %).', st, h; end if;
  select md5(content::text), status into h, st from public.sop_documents where sop_number = 'FRM-509';
  if st is distinct from 'draft' or h <> '6f333a93448bfed8ad8451189467f73c' then raise exception 'FRM-509 is % or changed since review (md5 %).', st, h; end if;
  select md5(content::text), status, revision into h, st, rev from public.sop_documents where sop_number = 'FSQM-017';
  if (st, rev) is distinct from ('active', 'v9') or h <> '40b1cf8f7fc559a6d21e54e6b4e44ef5' then
    raise exception 'FSQM-017 is %/% or changed since this migration was written (md5 %).', st, rev, h;
  end if;
  if (select status from public.verification_schedule where activity_key = 'maintenance_check') is distinct from 'planned' then
    raise exception 'maintenance_check is not planned.';
  end if;
  if (select count(*) from public.sop_document_responses r join public.sop_documents d on d.id = r.document_id
       where d.sop_number in ('FRM-508', 'FRM-509')) <> 0 then
    raise exception 'FRM-508/509 have entries before issue - check they are not test entries.';
  end if;
end $guard$;

update public.sop_documents
   set status = 'active', approved_by = 'GJM', effective_date = date '2026-09-21'
 where sop_number in ('FSQM-029', 'FRM-508', 'FRM-509');

update public.verification_schedule
   set status = 'active',
       evidence_kind = 'form_entry',
       evidence_document_number = 'FRM-508',
       owning_program = 'FSQM-029',
       pending_deliverable = null,
       first_due_on = date '2026-10-21'
 where activity_key = 'maintenance_check' and status = 'planned';

update public.sop_documents
   set content = jsonb_set(jsonb_set(jsonb_set(content,
                   '{procedure,57}', to_jsonb($t$• Preventive maintenance check of equipment and building — Monthly — SQF Practitioner — FRM-508$t$::text)),
                   '{form_references}', to_jsonb((content->>'form_references') || $t$; FRM-508 Monthly Maintenance Check$t$)),
                   '{revision_history}', to_jsonb((content->>'revision_history') || $t$

v10 — 2026-09-21 — Preventive maintenance brought into force under D-26. FSQM-029 Preventive Maintenance Program, FRM-508 Monthly Maintenance Check and FRM-509 Maintenance and Repair Record are issued, so the preventive maintenance check in Part 6 moves from NOT YET IMPLEMENTED to active: monthly, SQF Practitioner, evidenced by FRM-508. First due 2026-10-21, a month after issue. Nothing else in the schedule changes.$t$)),
       revision = 'v10', effective_date = date '2026-09-21', approved_by = 'GJM'
 where sop_number = 'FSQM-017';

do $verify$
declare n int; v record; l text;
begin
  select count(*) into n from public.sop_documents
   where sop_number in ('FSQM-029', 'FRM-508', 'FRM-509') and status = 'active' and approved_by = 'GJM'
     and effective_date = date '2026-09-21' and revision = 'New';
  if n <> 3 then raise exception 'FSQM-029 / FRM-508 / FRM-509 did not all issue.'; end if;
  select * into v from public.verification_schedule where activity_key = 'maintenance_check';
  if (v.status, v.frequency_unit, v.evidence_kind, v.evidence_document_number, v.owning_program)
     is distinct from ('active', 'month', 'form_entry', 'FRM-508', 'FSQM-029')
     or v.pending_deliverable is not null or v.first_due_on <> date '2026-10-21' then
    raise exception 'maintenance_check not activated correctly.';
  end if;
  select content->'procedure'->>57 into l from public.sop_documents where sop_number = 'FSQM-017' and revision = 'v10';
  if l is null or l not like '%Monthly%FRM-508' or l like '%NOT YET IMPLEMENTED%' then
    raise exception 'FSQM-017 Part 6 maintenance line not updated: %', l;
  end if;
  if (select count(*) from public.sop_documents, jsonb_array_elements_text(content->'procedure') x
       where sop_number = 'FSQM-017' and x like '%awaiting D-26%') <> 0 then
    raise exception 'FSQM-017 still says maintenance awaits D-26.';
  end if;
end $verify$;

commit;
