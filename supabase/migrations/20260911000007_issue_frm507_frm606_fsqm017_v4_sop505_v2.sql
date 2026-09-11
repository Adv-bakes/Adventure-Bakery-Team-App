-- D-14 / D-18 - issue FRM-507 and FRM-606, and bring FSQM-017, the schedule and SOP-505 into line.
--
-- FRM-507 CCP 1 Baking Monitoring Record and FRM-606 CCP 2 Vacuum Sealing Monitoring Record go ACTIVE,
-- approved GJM (Senior Site Management, FSQM-004), effective 2026-09-11. Until today the two CCPs in the
-- site's HACCP plan were monitored and not recorded; from today every oven load and sealing check has a
-- record carrying a required verification signature.
--
-- THE SAME TRANSACTION HAS TO CHANGE THREE OTHER THINGS, because each of them states the opposite:
--   * FSQM-017 v3 said the CCPs are "monitored, and neither is recorded", that CCP verification "is not
--     performed", and carried the CCP record review in Part 6 as NOT YET IMPLEMENTED. v4 says what is now
--     true, and records 2.5.2.1 as in force for CCPs with the two limitations the forms already state.
--   * The schedule carried ONE planned "CCP monitoring record review". An activity names a single evidence
--     document, so it becomes two active weekly activities, FRM-507 and FRM-606. Its activity_key is
--     renamed ccp_record_review -> ccp1_record_review, which is safe only because a planned activity never
--     raised a notification; the pre-guard proves none references the old key. First due 2026-09-18 so
--     neither is raised as "never recorded" on the day it is switched on.
--   * SOP-505 said oven temperature and bake time go on the batch sheet. No batch sheet holds them.
--
-- NOT CHANGED, deliberately: critical_limit_validation stays PLANNED. Recording the monitoring does not
-- establish or validate the limits, and that is still D-14's.
--
-- Part 6 of FSQM-017 is the program's copy of the schedule table. The post-guard rebuilds every Part 6
-- line from the table and requires the document to match it line for line.

begin;

create temporary table _ccp_before on commit drop as
  select
    (select md5(((((((content->'procedure') - 56) - 37) - 33) - 23) - 22)::text) from public.sop_documents where sop_number = 'FSQM-017') as f17_rest,
    (select md5((content - 'procedure' - 'revision_history' - 'form_references')::text) from public.sop_documents where sop_number = 'FSQM-017') as f17_keys,
    (select content->>'revision_history' from public.sop_documents where sop_number = 'FSQM-017') as f17_rh,
    (select content->>'form_references' from public.sop_documents where sop_number = 'FSQM-017') as f17_refs,
    (select md5(((content->'procedure') - 4)::text) from public.sop_documents where sop_number = 'SOP-505') as s505_rest,
    (select md5((content - 'procedure' - 'records' - 'form_references' - 'revision_history')::text) from public.sop_documents where sop_number = 'SOP-505') as s505_keys,
    (select content->>'revision_history' from public.sop_documents where sop_number = 'SOP-505') as s505_rh,
    (select md5(string_agg(to_jsonb(v)::text, '|' order by activity_key)) from public.verification_schedule v
      where activity_key not in ('ccp_record_review', 'critical_limit_validation')) as sched_rest,
    (select count(*) from public.verification_schedule where status = 'active') as n_active,
    (select count(*) from public.verification_schedule where status = 'planned') as n_planned,
    (select md5(string_agg(content::text, '|' order by sop_number)) from public.sop_documents
      where sop_number in ('FRM-507', 'FRM-606')) as forms_content;

do $$
declare r record;
begin
  select
    (select count(*) from public.sop_documents
      where sop_number in ('FRM-507', 'FRM-606') and type = 'form' and status = 'draft' and revision = 'New'
        and approved_by is null and effective_date is null)                                   as forms_draft,
    (select status from public.sop_documents where sop_number = 'FSQM-017')                    as s17,
    (select revision from public.sop_documents where sop_number = 'FSQM-017')                  as r17,
    (select jsonb_array_length(content->'procedure') from public.sop_documents where sop_number = 'FSQM-017') as n17,
    (select content->'procedure' from public.sop_documents where sop_number = 'FSQM-017')      as p17,
    (select status from public.sop_documents where sop_number = 'SOP-505')                     as s505,
    (select revision from public.sop_documents where sop_number = 'SOP-505')                   as r505,
    (select jsonb_array_length(content->'procedure') from public.sop_documents where sop_number = 'SOP-505') as n505,
    (select content from public.sop_documents where sop_number = 'SOP-505')                    as c505,
    (select to_jsonb(v) from public.verification_schedule v where activity_key = 'ccp_record_review') as ccp,
    (select to_jsonb(v) from public.verification_schedule v where activity_key = 'critical_limit_validation') as lim,
    (select count(*) from public.verification_schedule where activity_key in ('ccp1_record_review', 'ccp2_record_review')) as taken,
    (select count(*) from public.internal_notifications where dedupe_key like 'verification:ccp%')  as ccp_notes,
    (select count(*) from public.sop_documents where sop_number in ('FRM-507', 'FRM-606', 'FSQM-017', 'SOP-505')
        and lower(content::text) ~ 'diana|gabriela|samboni|juncos|christina|richard|pickett')                                               as named
  into r;

  if r.forms_draft <> 2 then
    raise exception 'Expected FRM-507 and FRM-606 as unstamped drafts at New; found % of 2.', r.forms_draft;
  end if;
  if r.s17 is distinct from 'active' or r.r17 is distinct from 'v3' or r.n17 <> 73 then
    raise exception 'FSQM-017 is %/%/% lines, expected active/v3/73.', r.s17, r.r17, r.n17;
  end if;
  if r.p17->>22 is distinct from $t$> The plan requires a monitoring record for each point, the CCP 1 and CCP 2 Monitoring Forms, and neither is kept: both points are monitored, and neither is recorded, so there is no record to review a limit against. The plan names an approver on its cover, but it carries no document number, is not under document control, and its approval page is unsigned, so none of the limits above is yet established by a controlled document. Nor are they all settled: the vacuum level and seal width are stated only as the equipment specification, with typical values of 27 in. Hg and 5 mm that are not confirmed for this site's machine, and the plan recommends a lethality study to validate the bake rather than relying on one.$t$ or r.p17->>23 is distinct from $t$> The rule therefore stands, and the activity is carried on the schedule as not yet implemented rather than as a review somebody is failing to do. The two cooling steps after the bake are not critical control points: the plan's hazard analysis table marks them as CCP 1, but its flow diagram and control chart do not, and set no limit or monitoring for them. That discrepancy is the plan's to correct when it is brought under document control.$t$
     or r.p17->>33 is distinct from $t$• The verification signature on the record IS the authorization required by 2.5.2.1. FRM-903, FRM-913, FRM-902, FRM-401 and FRM-701 each carry one, and it is not repeated anywhere else.$t$ or r.p17->>37 is distinct from $t$> CRITICAL CONTROL POINTS ARE NOT YET VERIFIED, AND THIS PART DOES NOT CLAIM THEM. The two critical control points in the site's HACCP plan, baking and vacuum sealing, are monitored on the floor, but the monitoring is not recorded. Verification confirms a record and authorization signs one, so with no record neither can take place, and the verification of critical control point monitoring that 2.5.2.1 requires is not performed. It is carried on the schedule as not yet implemented, and becomes real when the food safety plan is brought under document control with a monitoring record for each point.$t$ then
    raise exception 'FSQM-017 Parts 3/5 are not the v3 text this revision replaces.';
  end if;
  if r.p17->>45 is distinct from $t$• Dispatch and vehicle loading record review — Weekly — SQF Practitioner — FRM-801$t$ or r.p17->>46 is distinct from $t$• Glass and brittle plastic register check — Monthly — Production Supervisor — FRM-907$t$ or r.p17->>56 is distinct from $t$• CCP monitoring record review — Weekly — SQF Practitioner — no record; not yet performed. NOT YET IMPLEMENTED — awaiting D-14 HACCP / Food Safety Plan$t$ then
    raise exception 'FSQM-017 Part 6 is not laid out as v3 left it.';
  end if;
  if position('REVISED 2026-09-11 — v3' in (select f17_rh from _ccp_before)) = 0
     or position('— v4' in (select f17_rh from _ccp_before)) > 0 then
    raise exception 'FSQM-017 revision history is not at v3.';
  end if;
  if r.s505 is distinct from 'active' or r.r505 is distinct from 'New' or r.n505 <> 8 then
    raise exception 'SOP-505 is %/% with % lines, expected active/New/8.', r.s505, r.r505, r.n505;
  end if;
  if r.c505->>'records' is distinct from $t$Oven temperature and bake time are recorded on the batch sheet for the run. Operator training sign-off is held in the training record. All retained per the record retention policy.$t$ or r.c505->>'form_references' is distinct from $t$Batch sheet — oven temperature, bake time, and steam setting per product.$t$
     or r.c505->'procedure'->>4 is distinct from $t$When it's done: at the alarm, open the damper to vent the steam, then open the door slowly and remove the rack with the lift — the rack, pans, and product are hot. Check the bake (even colour, fully baked). Record the oven temperature and bake time on the batch sheet.$t$ then
    raise exception 'SOP-505 does not carry the batch-sheet wording this revision replaces.';
  end if;
  if r.ccp->>'status' is distinct from 'planned' or r.ccp->>'description' is distinct from $t$Scheduled but not yet performed - the two CCPs in the site's HACCP plan, baking and vacuum sealing, are monitored but the monitoring is not recorded, and the plan is not under document control, so there is no record to review.$t$ then
    raise exception 'ccp_record_review is not the planned v3 row.';
  end if;
  if r.lim->>'status' is distinct from 'planned' or r.lim->>'description' is distinct from $t$Scheduled but not yet performed - the HACCP plan that identifies the site's two CCPs, baking and vacuum sealing, is not under document control, so no critical limit is established by a controlled document, and CCP monitoring is not recorded, so there is no record to re-validate against.$t$ then
    raise exception 'critical_limit_validation is not the planned v3 row.';
  end if;
  if r.taken <> 0 then
    raise exception 'ccp1_record_review or ccp2_record_review already exists.';
  end if;
  -- The rename is only safe because a planned activity never raised a reminder.
  if r.ccp_notes <> 0 then
    raise exception '% notification(s) reference a CCP activity key; renaming it would orphan them.', r.ccp_notes;
  end if;
  if r.named <> 0 then
    raise exception 'A document in this change names an individual.';
  end if;
end $$;

-- ── The voice-feature test entry ────────────────────────────────────────────────────────────────
-- The owner made one FRM-507 draft at 13:31 on 2026-09-11 while trying the voice command (lot 2123,
-- 375 F, 27 min, unsigned) and confirmed it was a test: "It was a test - remove it". Issuing the form
-- would otherwise leave it among the official CCP 1 records, and FRM-507 entries cannot be deleted in
-- the app. It is deleted only if FRM-507 still holds exactly that one untouched, unsigned draft.
do $$
declare r record;
begin
  select
    (select count(*) from public.sop_document_responses x join public.sop_documents d on d.id = x.document_id
      where d.sop_number = 'FRM-507')                                                          as n,
    (select count(*) from public.sop_document_responses x join public.sop_documents d on d.id = x.document_id
      where d.sop_number = 'FRM-507'
        and x.id = 'd2d46a40-eb9d-4def-a837-00cbf190d35e'
        and x.status = 'draft'
        and x.data->>'production_date' = '2026-09-11'
        and jsonb_array_length(x.data->'oven_loads') = 1
        and x.data->'oven_loads'->0->>'lot_code' = '2123'
        and x.data->'oven_loads'->0->>'oven_temp' = '375'
        and x.data->'oven_loads'->0->>'bake_time' = '27'
        and (x.data->'monitored_by'->>'name') is null
        and (x.data->'verified_by'->>'name') is null
        and jsonb_array_length(coalesce(x.attachments, '[]'::jsonb)) = 0)                    as test_entry
  into r;
  if r.n <> 1 or r.test_entry <> 1 then
    raise exception 'FRM-507 should hold exactly the one unsigned voice-test draft (entries %, matching %). It has changed, so it is not deleted blind.', r.n, r.test_entry;
  end if;
end $$;

delete from public.sop_document_responses
 where id = 'd2d46a40-eb9d-4def-a837-00cbf190d35e' and status = 'draft';

do $$
begin
  if exists (select 1 from public.sop_document_responses x join public.sop_documents d on d.id = x.document_id
              where d.sop_number = 'FRM-507') then
    raise exception 'FRM-507 still has an entry after removing the test draft.';
  end if;
end $$;

-- ── FRM-507 and FRM-606 ─────────────────────────────────────────────────────────────────────────
update public.sop_documents
   set status = 'active', approved_by = 'GJM', effective_date = '2026-09-11', revision = 'New'
 where sop_number in ('FRM-507', 'FRM-606') and status = 'draft';

-- ── The schedule ────────────────────────────────────────────────────────────────────────────────
update public.verification_schedule
   set activity_key = 'ccp1_record_review',
       activity = $t$CCP 1 baking monitoring record review$t$,
       description = $t$Weekly review of FRM-507 entries against the CCP 1 critical limits: every oven load recorded, every deviation actioned, the verification signed. The internal product temperature is not monitored, so it is not verified.$t$,
       status = 'active',
       evidence_kind = 'form_entry',
       evidence_document_number = 'FRM-507',
       pending_deliverable = null,
       first_due_on = date '2026-09-18',
       sqf_reference = '2.4.3.15, 2.5.2.1',
       sort_order = 72
 where activity_key = 'ccp_record_review' and status = 'planned';

insert into public.verification_schedule
  (activity_key, activity, description, frequency_unit, frequency_count, responsible_position,
   evidence_kind, evidence_document_number, owning_program, pending_deliverable, lead_days, grace_days,
   first_due_on, status, sort_order, sqf_reference)
values
  ('ccp2_record_review', $t$CCP 2 vacuum sealing monitoring record review$t$, $t$Weekly review of FRM-606 entries against the CCP 2 critical limits: set-up, hourly and end-of-run checks recorded, every deviation actioned, the verification signed. The vacuum level and seal width specification is not yet confirmed.$t$, 'week', 1, 'SQF Practitioner',
   'form_entry', 'FRM-606', null, null, 0, 3, date '2026-09-18', 'active', 74, '2.4.3.15, 2.5.2.1');

update public.verification_schedule
   set description = $t$Scheduled but not yet performed - the HACCP plan that identifies the site's two CCPs, baking and vacuum sealing, is not under document control, so no critical limit has been established by a controlled document or validated, and there is nothing yet to re-validate. CCP monitoring is recorded on FRM-507 and FRM-606.$t$
 where activity_key = 'critical_limit_validation' and status = 'planned';

-- ── FSQM-017 v4 ─────────────────────────────────────────────────────────────────────────────────
-- Remove the planned CCP line first (index 56), then insert the two active lines at 46 - both above
-- every other index touched, so Parts 3 and 5 keep their v3 positions.
update public.sop_documents
   set content = jsonb_set(jsonb_set(jsonb_set(jsonb_set(
                   jsonb_insert(jsonb_insert(content #- '{procedure,56}',
                     '{procedure,46}', to_jsonb($t$• CCP 2 vacuum sealing monitoring record review — Weekly — SQF Practitioner — FRM-606$t$::text)),
                     '{procedure,46}', to_jsonb($t$• CCP 1 baking monitoring record review — Weekly — SQF Practitioner — FRM-507$t$::text)),
                   '{procedure,22}', to_jsonb($t$> Both points are monitored and recorded by the production operator: CCP 1 on FRM-507 CCP 1 Baking Monitoring Record, and CCP 2 on FRM-606 CCP 2 Vacuum Sealing Monitoring Record - the controlled forms for what the plan calls the CCP 1 and CCP 2 Monitoring Forms. One limit is not yet monitored: the internal product temperature at CCP 1, because the product is not probed, and FRM-507 records that each production day rather than leaving the column blank. The plan names an approver on its cover, but it carries no document number, is not under document control, and its approval page is unsigned, so none of the limits above is yet established by a controlled document. Nor are they all settled: the vacuum level and seal width are stated only as the equipment specification, with typical values of 27 in. Hg and 5 mm that are not confirmed for this site's machine, and the plan recommends a lethality study to validate the bake rather than relying on one.$t$::text)),
                   '{procedure,23}', to_jsonb($t$> The rule therefore stands, and the annual review and re-validation of critical limits is carried on the schedule as not yet implemented rather than as a review somebody is failing to do: the monitoring is now recorded, but the limits it is checked against are not yet established by a controlled document, nor validated. The two cooling steps after the bake are not critical control points: the plan's hazard analysis table marks them as CCP 1, but its flow diagram and control chart do not, and set no limit or monitoring for them. That discrepancy is the plan's to correct when it is brought under document control.$t$::text)),
                   '{procedure,33}', to_jsonb($t$• The verification signature on the record IS the authorization required by 2.5.2.1. FRM-903, FRM-913, FRM-902, FRM-401, FRM-701, FRM-507 and FRM-606 each carry one, and it is not repeated anywhere else.$t$::text)),
                   '{procedure,37}', to_jsonb($t$> CRITICAL CONTROL POINTS ARE VERIFIED ON THEIR OWN RECORDS. The production operator records the monitoring of the two critical control points in the site's HACCP plan on FRM-507 for baking and FRM-606 for vacuum sealing. Each entry carries a required verification signature and is not submitted until the reviewer has checked it against the critical limits and confirmed that every deviation has a recorded action; that signature is the authorization 2.5.2.1 requires. The review is scheduled weekly in Part 6, one activity per record. What it cannot yet confirm is stated on the forms: the internal product temperature at CCP 1, which is not monitored, and the CCP 2 vacuum level and seal width against a specification not yet confirmed for this site's machine.$t$::text))
 where sop_number = 'FSQM-017' and status = 'active' and revision = 'v3';

update public.sop_documents
   set content = jsonb_set(jsonb_set(content,
                   '{form_references}', to_jsonb((content->>'form_references') || $t$; FRM-507 CCP 1 Baking Monitoring Record; FRM-606 CCP 2 Vacuum Sealing Monitoring Record$t$)),
                   '{revision_history}', to_jsonb((content->>'revision_history')
                          || chr(10) || chr(10)
                          || $t$REVISED 2026-09-11 — v4, approved GJM (Senior Site Management), effective 2026-09-11. THE CRITICAL CONTROL POINTS ARE NOW RECORDED.$t$
          || chr(10) || chr(10) || $t$FRM-507 CCP 1 Baking Monitoring Record and FRM-606 CCP 2 Vacuum Sealing Monitoring Record were issued on the same date. The production operator records every oven load and every sealing check on them, and each entry carries a required verification signature, so the monitoring that v2 and v3 recorded as unrecorded now has a record, and the verification 2.5.2.1 requires can be performed and authorized.$t$
          || chr(10) || chr(10) || $t$Part 3 now names the two forms and states the one limit still not monitored, the internal product temperature at CCP 1, which is not probed. Part 5's paragraph on critical control points describes the verification rather than its absence, and its list of records that carry a verification signature adds FRM-507 and FRM-606. Part 6 replaces the single not-yet-implemented CCP monitoring record review with two weekly activities, one per record, first due 18 September 2026. Each is in force from this date and raises its reminder like every other active activity.$t$
          || chr(10) || chr(10) || $t$WHAT THIS CHANGES ABOUT WHAT THE PROGRAM CLOSES. 2.5.2.1 is now in force for critical control points as well as for Good Manufacturing Practices and the other controls, with two limitations stated on the forms: the internal product temperature at CCP 1 is not monitored, so it cannot be verified, and the CCP 2 vacuum level and seal width are verified against an equipment specification not yet confirmed for this site's machine. The annual review and re-validation of critical food safety limits stays not yet implemented, because the limits are not yet established by a controlled document or validated. 2.5.1.1 remains met in part.$t$
          || chr(10) || chr(10) || $t$SOP-505 is revised on the same date so that oven temperature and bake time are recorded on FRM-507 rather than on the batch sheet, which never held them.$t$)),
       revision = 'v4',
       approved_by = 'GJM',
       effective_date = '2026-09-11'
 where sop_number = 'FSQM-017' and status = 'active' and revision = 'v3';

-- ── SOP-505 v2 ──────────────────────────────────────────────────────────────────────────────────
update public.sop_documents
   set content = jsonb_set(jsonb_set(jsonb_set(jsonb_set(content,
                   '{records}', to_jsonb($t$Oven temperature and bake time are recorded for every load on FRM-507 CCP 1 Baking Monitoring Record; baking is a critical control point. Operator training sign-off is held in the training record. All retained per the record retention policy.$t$::text)),
                   '{form_references}', to_jsonb($t$FRM-507 CCP 1 Baking Monitoring Record — oven temperature and bake time for every load. Batch sheet — the product's program: temperature, time and steam setting.$t$::text)),
                   '{procedure,4}', to_jsonb($t$When it's done: at the alarm, open the damper to vent the steam, then open the door slowly and remove the rack with the lift — the rack, pans, and product are hot. Check the bake (even colour, fully baked). Record the oven temperature and bake time for the load on FRM-507.$t$::text)),
                   '{revision_history}', to_jsonb((content->>'revision_history') || chr(10) || chr(10) || $t$v2 — 2026-09-11 — Oven temperature and bake time for every load are recorded on FRM-507 CCP 1 Baking Monitoring Record, not on the batch sheet: baking is CCP 1 in the site's HACCP plan, and no batch sheet held either reading. The records line, the form references and the unload step change; nothing else does. Approved GJM.$t$)),
       revision = 'v2',
       approved_by = 'GJM',
       effective_date = '2026-09-11'
 where sop_number = 'SOP-505' and status = 'active' and revision = 'New';

-- ── Post-guards ─────────────────────────────────────────────────────────────────────────────────
do $$
declare
  r record;
  heading int;
  prose int;
  doc_lines text[];
  table_lines text[];
begin
  select
    (select count(*) from public.sop_documents
      where sop_number in ('FRM-507', 'FRM-606') and status = 'active' and approved_by = 'GJM'
        and effective_date = date '2026-09-11' and revision = 'New')                          as forms_issued,
    (select md5(string_agg(content::text, '|' order by sop_number)) from public.sop_documents
      where sop_number in ('FRM-507', 'FRM-606')) = b.forms_content                           as forms_unchanged,
    d17.revision as r17, d17.approved_by as a17, d17.effective_date as e17,
    jsonb_array_length(d17.content->'procedure')                                               as n17,
    d17.content->'procedure'                                                                    as p17,
    md5((((((((d17.content->'procedure') - 47) - 46) - 37) - 33) - 23) - 22)::text) = b.f17_rest as f17_rest_same,
    md5((d17.content - 'procedure' - 'revision_history' - 'form_references')::text) = b.f17_keys as f17_keys_same,
    left(d17.content->>'revision_history', length(b.f17_rh)) = b.f17_rh                         as f17_rh_prefix,
    d17.content->>'revision_history'                                                            as f17_rh,
    d17.content->>'form_references' = b.f17_refs || $t$; FRM-507 CCP 1 Baking Monitoring Record; FRM-606 CCP 2 Vacuum Sealing Monitoring Record$t$                           as f17_refs_ok,
    (d17.content->'procedure')::text ilike '%neither is recorded%'
      or (d17.content->'procedure')::text ilike '%NOT YET VERIFIED%'
      or (d17.content->'procedure')::text ilike '%CCP monitoring record review — Weekly — SQF Practitioner — no record%' as f17_stale,
    d505.revision as r505, d505.approved_by as a505, d505.effective_date as e505,
    d505.content as c505,
    md5(((d505.content->'procedure') - 4)::text) = b.s505_rest                                  as s505_rest_same,
    md5((d505.content - 'procedure' - 'records' - 'form_references' - 'revision_history')::text) = b.s505_keys as s505_keys_same,
    left(d505.content->>'revision_history', length(b.s505_rh)) = b.s505_rh                      as s505_rh_prefix,
    position('batch sheet' in lower(d505.content->>'records')) = 0                              as s505_records_moved,
    (select md5(string_agg(to_jsonb(v)::text, '|' order by activity_key)) from public.verification_schedule v
      where activity_key not in ('ccp1_record_review', 'ccp2_record_review', 'critical_limit_validation')) = b.sched_rest as sched_rest_same,
    (select count(*) from public.verification_schedule where status = 'active') - b.n_active    as d_active,
    (select count(*) from public.verification_schedule where status = 'planned') - b.n_planned  as d_planned,
    (select count(*) from public.verification_schedule
      where (activity_key = 'ccp1_record_review' and evidence_document_number = 'FRM-507')
         or (activity_key = 'ccp2_record_review' and evidence_document_number = 'FRM-606'))      as ccp_rows,
    (select count(*) from public.verification_schedule
      where activity_key in ('ccp1_record_review', 'ccp2_record_review') and status = 'active'
        and evidence_kind = 'form_entry' and first_due_on = date '2026-09-18'
        and frequency_unit = 'week' and frequency_count = 1 and pending_deliverable is null)     as ccp_active,
    (select status from public.verification_schedule where activity_key = 'critical_limit_validation') as lim_status,
    (select count(*) from public.sop_documents where sop_number in ('FRM-507', 'FRM-606', 'FSQM-017', 'SOP-505')
        and lower(content::text) ~ 'diana|gabriela|samboni|juncos|christina|richard|pickett')                                               as named,
    (select count(*) from public.sop_documents where sop_number in ('FSQM-017', 'SOP-505')
        and position(chr(13) in content::text) > 0)                                            as crs
  into r
  from _ccp_before b,
       public.sop_documents d17,
       public.sop_documents d505
  where d17.sop_number = 'FSQM-017' and d505.sop_number = 'SOP-505';

  if r.forms_issued <> 2 or not r.forms_unchanged then
    raise exception 'FRM-507/FRM-606 not issued cleanly (issued=%, content unchanged=%).', r.forms_issued, r.forms_unchanged;
  end if;

  if r.r17 is distinct from 'v4' or r.a17 is distinct from 'GJM' or r.e17 is distinct from date '2026-09-11' or r.n17 <> 74 then
    raise exception 'FSQM-017 is %/%/% with % lines, expected v4/GJM/2026-09-11/74.', r.r17, r.a17, r.e17, r.n17;
  end if;
  if r.p17->>22 is distinct from $t$> Both points are monitored and recorded by the production operator: CCP 1 on FRM-507 CCP 1 Baking Monitoring Record, and CCP 2 on FRM-606 CCP 2 Vacuum Sealing Monitoring Record - the controlled forms for what the plan calls the CCP 1 and CCP 2 Monitoring Forms. One limit is not yet monitored: the internal product temperature at CCP 1, because the product is not probed, and FRM-507 records that each production day rather than leaving the column blank. The plan names an approver on its cover, but it carries no document number, is not under document control, and its approval page is unsigned, so none of the limits above is yet established by a controlled document. Nor are they all settled: the vacuum level and seal width are stated only as the equipment specification, with typical values of 27 in. Hg and 5 mm that are not confirmed for this site's machine, and the plan recommends a lethality study to validate the bake rather than relying on one.$t$ or r.p17->>23 is distinct from $t$> The rule therefore stands, and the annual review and re-validation of critical limits is carried on the schedule as not yet implemented rather than as a review somebody is failing to do: the monitoring is now recorded, but the limits it is checked against are not yet established by a controlled document, nor validated. The two cooling steps after the bake are not critical control points: the plan's hazard analysis table marks them as CCP 1, but its flow diagram and control chart do not, and set no limit or monitoring for them. That discrepancy is the plan's to correct when it is brought under document control.$t$
     or r.p17->>33 is distinct from $t$• The verification signature on the record IS the authorization required by 2.5.2.1. FRM-903, FRM-913, FRM-902, FRM-401, FRM-701, FRM-507 and FRM-606 each carry one, and it is not repeated anywhere else.$t$ or r.p17->>37 is distinct from $t$> CRITICAL CONTROL POINTS ARE VERIFIED ON THEIR OWN RECORDS. The production operator records the monitoring of the two critical control points in the site's HACCP plan on FRM-507 for baking and FRM-606 for vacuum sealing. Each entry carries a required verification signature and is not submitted until the reviewer has checked it against the critical limits and confirmed that every deviation has a recorded action; that signature is the authorization 2.5.2.1 requires. The review is scheduled weekly in Part 6, one activity per record. What it cannot yet confirm is stated on the forms: the internal product temperature at CCP 1, which is not monitored, and the CCP 2 vacuum level and seal width against a specification not yet confirmed for this site's machine.$t$ then
    raise exception 'FSQM-017 Parts 3/5 did not land as written.';
  end if;
  if r.p17->>45 is distinct from $t$• Dispatch and vehicle loading record review — Weekly — SQF Practitioner — FRM-801$t$ or r.p17->>46 is distinct from $t$• CCP 1 baking monitoring record review — Weekly — SQF Practitioner — FRM-507$t$
     or r.p17->>47 is distinct from $t$• CCP 2 vacuum sealing monitoring record review — Weekly — SQF Practitioner — FRM-606$t$ or r.p17->>48 is distinct from $t$• Glass and brittle plastic register check — Monthly — Production Supervisor — FRM-907$t$ then
    raise exception 'FSQM-017 Part 6 CCP lines are not between dispatch and glass.';
  end if;
  if not r.f17_rest_same or not r.f17_keys_same or not r.f17_rh_prefix or not r.f17_refs_ok then
    raise exception 'FSQM-017 changed beyond this revision (rest=%, keys=%, history prefix=%, refs=%).',
      r.f17_rest_same, r.f17_keys_same, r.f17_rh_prefix, r.f17_refs_ok;
  end if;
  if r.f17_rh not like '%REVISED 2026-09-11 — v4, approved GJM%' or r.f17_rh not like '%2.5.1.1 remains met in part.%'
     or r.f17_rh not like '%which never held them.' then
    raise exception 'FSQM-017 v4 revision block is missing or incomplete.';
  end if;
  if r.f17_stale then
    raise exception 'FSQM-017 still says CCPs are unrecorded or unverified.';
  end if;

  -- Part 6 must be the schedule table, line for line.
  select min(i) into heading from jsonb_array_elements_text(r.p17) with ordinality t(l, i)
   where l like 'The master verification schedule is set out below.%';
  select min(i) into prose from jsonb_array_elements_text(r.p17) with ordinality t(l, i)
   where i > heading and l like '> %';
  select array_agg(l order by i) into doc_lines from jsonb_array_elements_text(r.p17) with ordinality t(l, i)
   where i > heading and i < prose;
  select array_agg('• ' || activity || ' — ' || case when frequency_count = 1 then case frequency_unit when 'day' then 'Daily' when 'week' then 'Weekly' when 'month' then 'Monthly' when 'quarter' then 'Quarterly' when 'year' then 'Annually' end else 'Every ' || frequency_count || ' ' || frequency_unit || 's' end || ' — ' || responsible_position || ' — ' || case when evidence_kind = 'none' then 'no record; not yet performed' when evidence_kind = 'document_revision' then 'evidenced by the revision of ' || evidence_document_number else coalesce(evidence_document_number, 'no record') end || case when status = 'planned' then '. NOT YET IMPLEMENTED — awaiting ' || pending_deliverable else '' end order by sort_order) into table_lines
    from public.verification_schedule where status <> 'retired';
  if doc_lines is distinct from table_lines then
    raise exception 'FSQM-017 Part 6 does not match the schedule table. Document: % | Table: %', doc_lines, table_lines;
  end if;

  if r.r505 is distinct from 'v2' or r.a505 is distinct from 'GJM' or r.e505 is distinct from date '2026-09-11' then
    raise exception 'SOP-505 stamp is %/%/%, expected v2/GJM/2026-09-11.', r.r505, r.a505, r.e505;
  end if;
  if r.c505->>'records' is distinct from $t$Oven temperature and bake time are recorded for every load on FRM-507 CCP 1 Baking Monitoring Record; baking is a critical control point. Operator training sign-off is held in the training record. All retained per the record retention policy.$t$ or r.c505->>'form_references' is distinct from $t$FRM-507 CCP 1 Baking Monitoring Record — oven temperature and bake time for every load. Batch sheet — the product's program: temperature, time and steam setting.$t$
     or r.c505->'procedure'->>4 is distinct from $t$When it's done: at the alarm, open the damper to vent the steam, then open the door slowly and remove the rack with the lift — the rack, pans, and product are hot. Check the bake (even colour, fully baked). Record the oven temperature and bake time for the load on FRM-507.$t$ or not r.s505_records_moved then
    raise exception 'SOP-505 did not land as written.';
  end if;
  if not r.s505_rest_same or not r.s505_keys_same or not r.s505_rh_prefix
     or r.c505->>'revision_history' not like '%v2 — 2026-09-11 — Oven temperature and bake time%' then
    raise exception 'SOP-505 changed beyond this revision (rest=%, keys=%, history prefix=%).', r.s505_rest_same, r.s505_keys_same, r.s505_rh_prefix;
  end if;

  if not r.sched_rest_same then
    raise exception 'A schedule activity other than the CCP rows and critical_limit_validation changed.';
  end if;
  if r.d_active <> 2 or r.d_planned <> -1 or r.ccp_rows <> 2 or r.ccp_active <> 2 then
    raise exception 'Schedule counts wrong (active +%, planned %, ccp rows %, ccp active %); expected +2, -1, 2, 2.',
      r.d_active, r.d_planned, r.ccp_rows, r.ccp_active;
  end if;
  if r.lim_status is distinct from 'planned' then
    raise exception 'critical_limit_validation must stay planned.';
  end if;
  if r.named <> 0 then raise exception 'A document in this change names an individual.'; end if;
  if r.crs <> 0 then raise exception 'CR characters are present.'; end if;
end $$;

commit;
