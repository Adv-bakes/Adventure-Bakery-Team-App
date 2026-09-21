-- D-26: put the monthly preventive maintenance check (FRM-508) on the verification schedule, and revise
-- FSQM-017 to v9 because Part 6 prints the schedule.
--
-- Owner, 2026-09-21: "Add the monthly check reminder."
--
-- The row is PLANNED, not active: FRM-508 and FSQM-029 are drafts, and a planned row raises no
-- notification (assessDue refuses). The D-26 issue migration flips it to active, form_entry FRM-508,
-- owning program FSQM-029, with a first_due_on - no second FSQM-017 revision is needed then except the
-- Part 6 line losing its NOT YET IMPLEMENTED suffix.
--
-- sort_order 205: after calibration (200), before backflow (210). FSQM-017's Part 6 line is inserted at
-- the same place (procedure[57]). Guarded on the md5 of FSQM-017's content.

begin;

do $guard$
declare h text; st text; rev text;
begin
  select md5(content::text), status, revision into h, st, rev from public.sop_documents where sop_number = 'FSQM-017';
  if (st, rev) is distinct from ('active', 'v8') or h <> '2b1dbd0f2b3890b7513d2186e0dd36e6' then
    raise exception 'FSQM-017 is %/% or changed since this migration was written (md5 %).', st, rev, h;
  end if;
  if exists (select 1 from public.verification_schedule where activity_key = 'maintenance_check') then
    raise exception 'maintenance_check already on the schedule.';
  end if;
  if (select count(*) from public.sop_documents where sop_number in ('FSQM-029', 'FRM-508') and status = 'draft') <> 2 then
    raise exception 'FSQM-029 / FRM-508 are not both drafts.';
  end if;
end $guard$;

insert into public.verification_schedule
  (activity_key, activity, description, frequency_unit, frequency_count, responsible_position, evidence_kind,
   pending_deliverable, sqf_reference, lead_days, grace_days, status, sort_order)
values
  ('maintenance_check', 'Preventive maintenance check of equipment and building', $t$Monthly check of every row on the FRM-508 maintenance schedule under FSQM-029: each machine, the walk-in refrigerator and freezer, the building (via FRM-913) and the annual technician services, with open temporary repairs and failures reviewed.$t$, 'month', 1,
   'SQF Practitioner', 'none', 'D-26 Preventive Maintenance Program', '11.2.1.2, 11.2.1.3, 11.2.1.6', 0, 7, 'planned', 205);

update public.sop_documents
   set content = jsonb_set(jsonb_insert(content, '{procedure,57}', to_jsonb($t$• Preventive maintenance check of equipment and building — Monthly — SQF Practitioner — no record; not yet performed. NOT YET IMPLEMENTED — awaiting D-26 Preventive Maintenance Program$t$::text)),
                   '{revision_history}', to_jsonb((content->>'revision_history') || $t$

v9 — 2026-09-21 — Preventive maintenance check added to Part 6 at the owner's request, so the monthly FRM-508 check is prompted by the reminder system like the other monthly activities. Carried as NOT YET IMPLEMENTED until FSQM-029 and FRM-508 are issued under D-26, when it becomes active against FRM-508. Nothing else in the schedule changes.$t$)),
       revision = 'v9', effective_date = date '2026-09-21', approved_by = 'GJM'
 where sop_number = 'FSQM-017';

do $verify$
declare p jsonb;
begin
  select content->'procedure' into p from public.sop_documents where sop_number = 'FSQM-017' and revision = 'v9';
  if jsonb_array_length(p) <> 76 or p->>57 not like '• Preventive maintenance check%'
     or p->>56 not like '• Calibration%' or p->>58 not like '• Backflow%' then
    raise exception 'FSQM-017 Part 6 line not inserted in place.';
  end if;
  if (select status from public.verification_schedule where activity_key = 'maintenance_check') <> 'planned' then
    raise exception 'maintenance_check not planned.';
  end if;
end $verify$;

commit;
