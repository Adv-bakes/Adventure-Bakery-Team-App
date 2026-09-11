-- D-18 - FSQM-017 v3. The HACCP plan defines TWO critical control points, not five.
--
-- WHAT v2 GOT WRONG. 20260911000004 listed five CCPs - baking, cooling from the oven, cooling before
-- covering, sealing, sealing leak - from a summary list rather than from the plan. The plan (HACCP
-- PLAN, version 1.0, issued 23 June 2026, the PDF attached to the unnumbered reference document) was
-- then read in full. Its flow diagram highlights exactly two steps and its control chart sets limits
-- and monitoring for exactly two: CCP 1 Baking and CCP 2 Vacuum sealing. "Sealing" and "sealing leak"
-- are the biological and physical hazard rows of one step. The two cooling steps are marked "YES -
-- CCP 1" in the hazard analysis table only, which contradicts the rest of the plan; FSQM-017 follows
-- the diagram and control chart and says so.
--
-- v2 ALSO SAID THE PLAN HAS "NO APPROVAL". The cover names an approver and version 1.0. It has no
-- document number, is not under document control, and its approval page is unsigned - so "no critical
-- limit is established by a controlled document" stands, and is now stated precisely.
--
-- WHAT DOES NOT CHANGE. 2.5.2.1 stays in force for GMPs and other controls and NOT for CCPs, because
-- both points are monitored and neither is recorded. Both schedule activities stay 'planned'.
--
-- No names: the plan's preparer and approver are people, and this is a controlled document.

begin;

create temporary table _fsqm017_v2 on commit drop as
  select md5((((content->'procedure') - 33) - 19)::text)            as proc_rest,
         md5((content - 'procedure' - 'revision_history')::text)    as other_keys,
         content->>'revision_history'                               as rh
    from public.sop_documents
   where sop_number = 'FSQM-017';

do $$
declare r record;
begin
  select
    (select count(*) from _fsqm017_v2)                                              as n,
    d.status, d.revision, d.approved_by, d.effective_date,
    jsonb_array_length(d.content->'procedure')                                      as lines,
    d.content->'procedure'->>19                                                     as l19,
    d.content->'procedure'->>20                                                     as l20,
    d.content->'procedure'->>33                                                     as l33,
    d.content->'procedure'->>34                                                     as l34,
    d.content->>'revision_history'                                                  as rh,
    lower(d.content::text) ~ 'diana|gabriela|samboni|juncos|christina|richard|pickett'                                            as named,
    (select status from public.verification_schedule where activity_key = 'ccp_record_review')          as ccp_status,
    (select description from public.verification_schedule where activity_key = 'ccp_record_review')     as ccp_desc,
    (select status from public.verification_schedule where activity_key = 'critical_limit_validation')  as lim_status,
    (select description from public.verification_schedule where activity_key = 'critical_limit_validation') as lim_desc
  into r
  from public.sop_documents d
  where d.sop_number = 'FSQM-017';

  if r.n <> 1 then
    raise exception 'Expected one FSQM-017.';
  end if;
  if r.status is distinct from 'active' or r.revision is distinct from 'v2'
     or r.approved_by is distinct from 'GJM' or r.effective_date is distinct from date '2026-09-11' then
    raise exception 'FSQM-017 is %/%/%/%, expected active/v2/GJM/2026-09-11 from 20260911000004.',
      r.status, r.revision, r.approved_by, r.effective_date;
  end if;
  if r.lines <> 69 then
    raise exception 'FSQM-017 is % lines, expected 69.', r.lines;
  end if;
  if r.l19 is distinct from $t$> WRITTEN CONDITIONALLY, AND ON PURPOSE. The limits this Part governs are those established by a food safety plan. The site's HACCP plan identifies five critical control points — baking, cooling from the oven, cooling before covering, sealing, and sealing leak — but the plan is not under document control, so no critical limit for any of them is established by a controlled document; and although the five points are monitored, the monitoring is not recorded, so there is no record to review a limit against. The rule therefore stands, and the activity is carried on the schedule as not yet implemented rather than as a review somebody is failing to do.$t$ then
    raise exception 'FSQM-017 procedure[19] is not the v2 Part 3 paragraph.';
  end if;
  if r.l33 is distinct from $t$> CRITICAL CONTROL POINTS ARE NOT YET VERIFIED, AND THIS PART DOES NOT CLAIM THEM. The five critical control points in the site's HACCP plan are monitored on the floor, but the monitoring is not recorded. Verification confirms a record and authorization signs one, so with no record neither can take place, and the verification of critical control point monitoring that 2.5.2.1 requires is not performed. It is carried on the schedule as not yet implemented, and becomes real when the food safety plan is brought under document control with a monitoring record for each point.$t$ then
    raise exception 'FSQM-017 procedure[33] is not the v2 Part 5 paragraph.';
  end if;
  if r.l20 not like ($t$> Two limits are in force today$t$ || '%') or r.l34 not like ($t$The master verification schedule is set out below.$t$ || '%') then
    raise exception 'FSQM-017 neighbours of lines 19/33 are not where v2 left them.';
  end if;
  if position('REVISED 2026-09-11 — v2' in r.rh) = 0 or position('— v3' in r.rh) > 0 then
    raise exception 'FSQM-017 revision history is not at v2.';
  end if;
  if r.named then
    raise exception 'FSQM-017 names an individual.';
  end if;
  if r.ccp_status is distinct from 'planned' or r.lim_status is distinct from 'planned' then
    raise exception 'CCP schedule rows are %/%, expected planned/planned.', r.ccp_status, r.lim_status;
  end if;
  if r.ccp_desc is distinct from $t$Scheduled but not yet performed - the five CCPs in the site's HACCP plan are monitored but the monitoring is not recorded, and the plan is not under document control, so there is no record to review.$t$ or r.lim_desc is distinct from $t$Scheduled but not yet performed - the HACCP plan that identifies the site's five CCPs is not under document control, so no critical limit is established by a controlled document, and CCP monitoring is not recorded, so there is no record to re-validate against.$t$ then
    raise exception 'CCP schedule descriptions are not the v2 wording.';
  end if;
end $$;

-- Order matters: set 33 and 19 while indexes are still v2's, then insert after 19 in forward order.
update public.sop_documents
   set content = jsonb_set(
                   jsonb_insert(jsonb_insert(jsonb_insert(jsonb_insert(
                     jsonb_set(
                       jsonb_set(content, '{procedure,33}', to_jsonb($t$> CRITICAL CONTROL POINTS ARE NOT YET VERIFIED, AND THIS PART DOES NOT CLAIM THEM. The two critical control points in the site's HACCP plan, baking and vacuum sealing, are monitored on the floor, but the monitoring is not recorded. Verification confirms a record and authorization signs one, so with no record neither can take place, and the verification of critical control point monitoring that 2.5.2.1 requires is not performed. It is carried on the schedule as not yet implemented, and becomes real when the food safety plan is brought under document control with a monitoring record for each point.$t$::text)),
                       '{procedure,19}', to_jsonb($t$> WRITTEN CONDITIONALLY, AND ON PURPOSE. The limits this Part governs are those established by a food safety plan. The site's HACCP plan, version 1.0 issued 23 June 2026, identifies two critical control points:$t$::text)),
                     '{procedure,20}', to_jsonb($t$• CCP 1 — Baking. Hazard: survival of Salmonella and other pathogens from the liquid egg. Critical limits: oven temperature at least 350°F, bake time at least 27 minutes, and internal product temperature at least 180°F at the end of the bake. Monitoring: oven temperature continuously, the timer every bake cycle, and internal product temperature on at least one unit per batch.$t$::text)),
                     '{procedure,21}', to_jsonb($t$• CCP 2 — Vacuum sealing in pouches. Hazard: loss of package integrity, which admits microbial contamination and ends shelf stability. Critical limits: vacuum level to the equipment specification; no visible leak, channel, wrinkle across the seal, or partial seal; and seal width to the equipment specification. Monitoring: the vacuum gauge every cycle, a visual check of every pouch, and a pull test at least hourly and at each set-up.$t$::text)),
                     '{procedure,22}', to_jsonb($t$> The plan requires a monitoring record for each point, the CCP 1 and CCP 2 Monitoring Forms, and neither is kept: both points are monitored, and neither is recorded, so there is no record to review a limit against. The plan names an approver on its cover, but it carries no document number, is not under document control, and its approval page is unsigned, so none of the limits above is yet established by a controlled document. Nor are they all settled: the vacuum level and seal width are stated only as the equipment specification, with typical values of 27 in. Hg and 5 mm that are not confirmed for this site's machine, and the plan recommends a lethality study to validate the bake rather than relying on one.$t$::text)),
                     '{procedure,23}', to_jsonb($t$> The rule therefore stands, and the activity is carried on the schedule as not yet implemented rather than as a review somebody is failing to do. The two cooling steps after the bake are not critical control points: the plan's hazard analysis table marks them as CCP 1, but its flow diagram and control chart do not, and set no limit or monitoring for them. That discrepancy is the plan's to correct when it is brought under document control.$t$::text)),
                   '{revision_history}',
                   to_jsonb((content->>'revision_history')
                            || chr(10) || chr(10)
                            || $t$REVISED 2026-09-11 — v3, approved GJM (Senior Site Management), effective 2026-09-11. THE v2 CORRECTION COUNTED THE CRITICAL CONTROL POINTS WRONGLY.$t$
                            || chr(10) || chr(10) || $t$v2 listed five critical control points: baking, cooling from the oven, cooling before covering, sealing, and sealing leak. That list was not taken from the plan's control chart, and the plan was read in full for this revision. It defines two: CCP 1, baking, and CCP 2, vacuum sealing in pouches. Sealing and sealing leak are the biological and the physical hazard of the same step, CCP 2.$t$
                            || chr(10) || chr(10) || $t$THE TWO COOLING STEPS ARE NOT CRITICAL CONTROL POINTS, although one table in the plan says they are. The plan's hazard analysis marks temperature control on the racks, and cooling to room temperature before covering, as CCP 1 and calls them kill steps. Its flow diagram marks only baking and vacuum sealing, and its control chart sets critical limits and monitoring only for those two. Cooling destroys nothing, and a step with no critical limit cannot be operated as a critical control point, so this program follows the diagram and the control chart and leaves the discrepancy to be corrected in the plan.$t$
                            || chr(10) || chr(10) || $t$v2 ALSO SAID THE PLAN HAS NO APPROVAL. Its cover names an approver and a version. It carries no document number, it is not under document control, and its approval page is unsigned, so the conclusion stood: no critical limit is established by a controlled document. Part 3 now says so precisely.$t$
                            || chr(10) || chr(10) || $t$PART 3 NOW LISTS BOTH POINTS with the hazard, critical limits and monitoring the plan states for each, and records the limits the plan has not settled: the vacuum level and seal width, given only as the equipment specification, and the validation of the bake, for which the plan recommends a lethality study rather than relying on one. Part 5 and the two schedule descriptions now say two points, not five. Nothing else changes: 2.5.2.1 remains in force for Good Manufacturing Practices and the other controls and not for critical control points, as v2 recorded, and both schedule activities stay not yet implemented.$t$)),
       revision       = 'v3',
       approved_by    = 'GJM',
       effective_date = '2026-09-11'
 where sop_number = 'FSQM-017'
   and status = 'active'
   and revision = 'v2';

update public.verification_schedule
   set description = $t$Scheduled but not yet performed - the two CCPs in the site's HACCP plan, baking and vacuum sealing, are monitored but the monitoring is not recorded, and the plan is not under document control, so there is no record to review.$t$
 where activity_key = 'ccp_record_review' and status = 'planned';

update public.verification_schedule
   set description = $t$Scheduled but not yet performed - the HACCP plan that identifies the site's two CCPs, baking and vacuum sealing, is not under document control, so no critical limit is established by a controlled document, and CCP monitoring is not recorded, so there is no record to re-validate against.$t$
 where activity_key = 'critical_limit_validation' and status = 'planned';

do $$
declare r record;
begin
  select
    d.status, d.revision, d.approved_by, d.effective_date,
    jsonb_array_length(d.content->'procedure')                                      as lines,
    d.content->'procedure'->>19 as l19, d.content->'procedure'->>20 as l20,
    d.content->'procedure'->>21 as l21, d.content->'procedure'->>22 as l22,
    d.content->'procedure'->>23 as l23, d.content->'procedure'->>24 as l24,
    d.content->'procedure'->>37 as l37, d.content->'procedure'->>38 as l38,
    md5((((((((d.content->'procedure') - 37) - 23) - 22) - 21) - 20) - 19)::text) = b.proc_rest as rest_same,
    md5((d.content - 'procedure' - 'revision_history')::text) = b.other_keys        as keys_same,
    left(d.content->>'revision_history', length(b.rh)) = b.rh                       as rh_prefix_same,
    d.content->>'revision_history'                                                  as rh,
    (d.content->'procedure')::text ilike '%five critical control points%'           as says_five,
    lower(d.content::text) ~ 'diana|gabriela|samboni|juncos|christina|richard|pickett'                                            as named,
    position(chr(13) in d.content::text) > 0                                        as crs,
    (select count(*) from public.verification_schedule
      where activity_key in ('ccp_record_review', 'critical_limit_validation')
        and status = 'planned')                                                     as still_planned,
    (select count(*) from public.verification_schedule
      where (activity_key = 'ccp_record_review' and description = $t$Scheduled but not yet performed - the two CCPs in the site's HACCP plan, baking and vacuum sealing, are monitored but the monitoring is not recorded, and the plan is not under document control, so there is no record to review.$t$)
         or (activity_key = 'critical_limit_validation' and description = $t$Scheduled but not yet performed - the HACCP plan that identifies the site's two CCPs, baking and vacuum sealing, is not under document control, so no critical limit is established by a controlled document, and CCP monitoring is not recorded, so there is no record to re-validate against.$t$)) as descs
  into r
  from public.sop_documents d, _fsqm017_v2 b
  where d.sop_number = 'FSQM-017';

  if r.status is distinct from 'active' or r.revision is distinct from 'v3'
     or r.approved_by is distinct from 'GJM' or r.effective_date is distinct from date '2026-09-11' then
    raise exception 'FSQM-017 stamp is %/%/%/%, expected active/v3/GJM/2026-09-11.',
      r.status, r.revision, r.approved_by, r.effective_date;
  end if;
  if r.lines <> 73 then
    raise exception 'FSQM-017 is % lines, expected 73.', r.lines;
  end if;
  if r.l19 is distinct from $t$> WRITTEN CONDITIONALLY, AND ON PURPOSE. The limits this Part governs are those established by a food safety plan. The site's HACCP plan, version 1.0 issued 23 June 2026, identifies two critical control points:$t$ or r.l20 is distinct from $t$• CCP 1 — Baking. Hazard: survival of Salmonella and other pathogens from the liquid egg. Critical limits: oven temperature at least 350°F, bake time at least 27 minutes, and internal product temperature at least 180°F at the end of the bake. Monitoring: oven temperature continuously, the timer every bake cycle, and internal product temperature on at least one unit per batch.$t$ or r.l21 is distinct from $t$• CCP 2 — Vacuum sealing in pouches. Hazard: loss of package integrity, which admits microbial contamination and ends shelf stability. Critical limits: vacuum level to the equipment specification; no visible leak, channel, wrinkle across the seal, or partial seal; and seal width to the equipment specification. Monitoring: the vacuum gauge every cycle, a visual check of every pouch, and a pull test at least hourly and at each set-up.$t$
     or r.l22 is distinct from $t$> The plan requires a monitoring record for each point, the CCP 1 and CCP 2 Monitoring Forms, and neither is kept: both points are monitored, and neither is recorded, so there is no record to review a limit against. The plan names an approver on its cover, but it carries no document number, is not under document control, and its approval page is unsigned, so none of the limits above is yet established by a controlled document. Nor are they all settled: the vacuum level and seal width are stated only as the equipment specification, with typical values of 27 in. Hg and 5 mm that are not confirmed for this site's machine, and the plan recommends a lethality study to validate the bake rather than relying on one.$t$ or r.l23 is distinct from $t$> The rule therefore stands, and the activity is carried on the schedule as not yet implemented rather than as a review somebody is failing to do. The two cooling steps after the bake are not critical control points: the plan's hazard analysis table marks them as CCP 1, but its flow diagram and control chart do not, and set no limit or monitoring for them. That discrepancy is the plan's to correct when it is brought under document control.$t$ then
    raise exception 'FSQM-017 Part 3 list did not land at lines 19-23 in order.';
  end if;
  if r.l24 not like ($t$> Two limits are in force today$t$ || '%') then
    raise exception 'The paragraph after the Part 3 list is not the one v2 had there.';
  end if;
  if r.l37 is distinct from $t$> CRITICAL CONTROL POINTS ARE NOT YET VERIFIED, AND THIS PART DOES NOT CLAIM THEM. The two critical control points in the site's HACCP plan, baking and vacuum sealing, are monitored on the floor, but the monitoring is not recorded. Verification confirms a record and authorization signs one, so with no record neither can take place, and the verification of critical control point monitoring that 2.5.2.1 requires is not performed. It is carried on the schedule as not yet implemented, and becomes real when the food safety plan is brought under document control with a monitoring record for each point.$t$ or r.l38 not like ($t$The master verification schedule is set out below.$t$ || '%') then
    raise exception 'FSQM-017 Part 5 paragraph did not land at 37, before the Part 6 heading.';
  end if;
  if not r.rest_same then
    raise exception 'Every other FSQM-017 procedure line must be unchanged, and one is not.';
  end if;
  if not r.keys_same then
    raise exception 'An FSQM-017 content key other than procedure and revision_history changed.';
  end if;
  if not r.rh_prefix_same then
    raise exception 'The existing FSQM-017 revision history was edited; it may only be appended to.';
  end if;
  if r.rh not like '%REVISED 2026-09-11 — v3, approved GJM%'
     or r.rh not like '%THE TWO COOLING STEPS ARE NOT CRITICAL CONTROL POINTS%'
     or r.rh not like '%v2 ALSO SAID THE PLAN HAS NO APPROVAL.%'
     or r.rh not like '%both schedule activities stay not yet implemented.' then
    raise exception 'FSQM-017 v3 revision block is missing or incomplete.';
  end if;
  if r.says_five then
    raise exception 'FSQM-017 procedure still says five critical control points.';
  end if;
  if r.named then raise exception 'FSQM-017 names an individual after revision.'; end if;
  if r.crs then raise exception 'CR characters are present in FSQM-017.'; end if;
  if r.still_planned <> 2 then
    raise exception 'A CCP schedule activity is no longer planned; nothing here should activate one.';
  end if;
  if r.descs <> 2 then
    raise exception 'CCP schedule descriptions were not corrected (% of 2).', r.descs;
  end if;
end $$;

commit;
