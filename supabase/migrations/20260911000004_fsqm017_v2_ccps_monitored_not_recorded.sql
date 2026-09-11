-- D-18 - FSQM-017 v2. The site has five critical control points; they are monitored, not recorded.
--
-- WHAT WAS WRONG. FSQM-017 was issued on 2026-09-10 saying the site had "no critical control points
-- defined". That was established by searching the text of every controlled document, and the search
-- never opened attached files. The site's HACCP plan sits in the library as a PDF attached to an
-- unnumbered reference document, and it identifies five CCPs: baking, cooling from the oven, cooling
-- before covering, sealing, and sealing leak. It has no number and no approval, so "no HACCP plan
-- under document control" was true. "No CCPs defined" was not.
--
-- WHAT THE OWNER CONFIRMED, AND WHY IT MATTERS MORE THAN THE WORDING. All five are MONITORED and NONE
-- IS RECORDED. So FSQM-017 did not just misdescribe the plan: Part 5's rule that the monitoring of
-- critical control points "shall be verified, and the person responsible for verifying shall authorize
-- each verified record" was issued as though it were in force, and for CCPs it cannot be - there is no
-- record to verify or to sign. 2.5.2.1 is Mandatory. The workbook records D-18 as closing it in force;
-- that is now true for GMPs and the other controls and NOT for CCPs, and the revision history says so.
--
-- WHAT DOES NOT CHANGE. The two schedule activities that depend on CCP records stay 'planned'. Only
-- their descriptions are corrected. Activating either would have the notification job prompting a
-- weekly review of records that do not exist.
--
-- SIDE EFFECT, STATED. Changing revision and effective_date on an active document fires the
-- sop_document_history snapshot, and the annual programme review is evidenced by exactly that. So the
-- next programme review will be dated from today rather than from issue - a one-day move - even though
-- a correction is not the Part 10 review. The revision history says this too.
--
-- The existing revision history is not edited: item 4 of its settled block is what was said at issue,
-- and the correction is appended beneath it rather than rewriting history.

begin;

create temporary table _fsqm017_before on commit drop as
  select md5(((content->'procedure') - 19)::text)                   as proc_rest,
         md5((content - 'procedure' - 'revision_history')::text)    as other_keys,
         content->>'revision_history'                               as rh
    from public.sop_documents
   where sop_number = 'FSQM-017';

do $$
declare r record;
begin
  select
    (select count(*) from _fsqm017_before)                                          as n,
    d.status, d.revision, d.approved_by, d.effective_date,
    jsonb_array_length(d.content->'procedure')                                      as lines,
    d.content->'procedure'->>19                                                     as l19,
    d.content->'procedure'->>32                                                     as l32,
    d.content->'procedure'->>33                                                     as l33,
    d.content->>'revision_history'                                                  as rh,
    lower(d.content::text) ~ 'diana|gabriela|samboni|juncos|christina|richard'                                            as named,
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
  if r.status is distinct from 'active' or r.revision is distinct from 'New'
     or r.approved_by is distinct from 'GJM' or r.effective_date is distinct from date '2026-09-10' then
    raise exception 'FSQM-017 is %/%/%/%, expected the active New issued by 20260910000019.',
      r.status, r.revision, r.approved_by, r.effective_date;
  end if;
  if r.lines <> 68 then
    raise exception 'FSQM-017 is % lines, expected 68.', r.lines;
  end if;
  if r.l19 is distinct from $t$> WRITTEN CONDITIONALLY, AND ON PURPOSE. The limits this Part governs are those established by a food safety plan, and this site has no HACCP plan under document control and no critical control points defined. A search of every document for CCPs finds only training material and a competency list. The rule therefore stands and has nothing to bite on, and the activity is carried on the schedule as not yet implemented rather than as a review somebody is failing to do.$t$ then
    raise exception 'FSQM-017 procedure[19] is not the Part 3 paragraph this revision corrects.';
  end if;
  if r.l32 not like $t$> A verification that leaves no signature is indistinguishable from one that did not happen.$t$ || '%' or r.l33 not like $t$The master verification schedule is set out below.$t$ || '%' then
    raise exception 'FSQM-017 Part 5 / Part 6 boundary is not at lines 32/33; the insert would land in the wrong place.';
  end if;
  if position('REVISED 2026-09-11' in r.rh) > 0 then
    raise exception 'FSQM-017 already carries the 2026-09-11 revision.';
  end if;
  if r.named then
    raise exception 'FSQM-017 names an individual.';
  end if;
  if r.ccp_status is distinct from 'planned' or r.lim_status is distinct from 'planned' then
    raise exception 'CCP schedule rows are %/%, expected planned/planned.', r.ccp_status, r.lim_status;
  end if;
  if r.ccp_desc is distinct from $t$Scheduled but not yet performed - the site has no HACCP plan under document control and no CCPs are defined.$t$ or r.lim_desc is distinct from $t$Scheduled but not yet performed - the site has no food safety plan under document control, so no critical limits have been established to re-validate.$t$ then
    raise exception 'CCP schedule row descriptions are not the ones this revision corrects.';
  end if;
end $$;

update public.sop_documents
   set content = jsonb_set(
                   jsonb_insert(
                     jsonb_set(content, '{procedure,19}', to_jsonb($t$> WRITTEN CONDITIONALLY, AND ON PURPOSE. The limits this Part governs are those established by a food safety plan. The site's HACCP plan identifies five critical control points — baking, cooling from the oven, cooling before covering, sealing, and sealing leak — but the plan is not under document control, so no critical limit for any of them is established by a controlled document; and although the five points are monitored, the monitoring is not recorded, so there is no record to review a limit against. The rule therefore stands, and the activity is carried on the schedule as not yet implemented rather than as a review somebody is failing to do.$t$::text)),
                     '{procedure,33}', to_jsonb($t$> CRITICAL CONTROL POINTS ARE NOT YET VERIFIED, AND THIS PART DOES NOT CLAIM THEM. The five critical control points in the site's HACCP plan are monitored on the floor, but the monitoring is not recorded. Verification confirms a record and authorization signs one, so with no record neither can take place, and the verification of critical control point monitoring that 2.5.2.1 requires is not performed. It is carried on the schedule as not yet implemented, and becomes real when the food safety plan is brought under document control with a monitoring record for each point.$t$::text)),
                   '{revision_history}',
                   to_jsonb((content->>'revision_history')
                            || chr(10) || chr(10)
                            || $t$REVISED 2026-09-11 — v2, approved GJM (Senior Site Management), effective 2026-09-11. PART 3 WAS WRONG ABOUT CRITICAL CONTROL POINTS, AND PART 5 CLAIMED MORE THAN THE SITE DOES.$t$
          || chr(10) || chr(10) || $t$As issued, Part 3 said the site had no critical control points defined, and item 4 of the settled block above repeats it. That came from searching the text of every controlled document, and the search never opened attached files. The site's HACCP plan is held in the document library as an attached PDF on an unnumbered reference document, and it identifies five critical control points: baking, cooling from the oven, cooling before covering, sealing, and sealing leak. The plan has no document number and no approval, so it is not under document control, and that half of the statement stood. The other half did not.$t$
          || chr(10) || chr(10) || $t$THE FIVE POINTS ARE MONITORED BUT NOT RECORDED, confirmed on 2026-09-11. That changes two Parts. Part 3 now names the five points, and states that no critical limit for them is established by a controlled document and that there is no record to review a limit against. Part 5 gains a paragraph stating that the verification of critical control point monitoring required by 2.5.2.1 is not performed, because verification confirms a record and there is none. The two schedule activities that depend on it, CCP monitoring record review and the annual review and re-validation of critical food safety limits, stay not yet implemented, and their descriptions on the schedule are corrected to say why.$t$
          || chr(10) || chr(10) || $t$WHAT THIS CHANGES ABOUT WHAT THE PROGRAM CLOSES. At issue 2.5.2.1 was recorded as in force. It is in force for Good Manufacturing Practices and for the other food safety controls named in Part 1, and NOT for critical control points. Unlike the analytical limb of 2.5.1.1, this is an open action rather than a standing limitation: the points are already monitored, and what is missing is the record. It closes when the food safety plan is brought under document control with a monitoring record for each point. 2.5.1.1 remains met in part, as issued.$t$
          || chr(10) || chr(10) || $t$This revision is a correction, not the annual review of the program in Part 10, although the application records it as a revision and the schedule dates the next review from it.$t$)),
       revision       = 'v2',
       approved_by    = 'GJM',
       effective_date = '2026-09-11'
 where sop_number = 'FSQM-017'
   and status = 'active'
   and revision = 'New';

update public.verification_schedule
   set description = $t$Scheduled but not yet performed - the five CCPs in the site's HACCP plan are monitored but the monitoring is not recorded, and the plan is not under document control, so there is no record to review.$t$
 where activity_key = 'ccp_record_review' and status = 'planned';

update public.verification_schedule
   set description = $t$Scheduled but not yet performed - the HACCP plan that identifies the site's five CCPs is not under document control, so no critical limit is established by a controlled document, and CCP monitoring is not recorded, so there is no record to re-validate against.$t$
 where activity_key = 'critical_limit_validation' and status = 'planned';

do $$
declare r record;
begin
  select
    d.status, d.revision, d.approved_by, d.effective_date,
    jsonb_array_length(d.content->'procedure')                                      as lines,
    d.content->'procedure'->>19                                                     as l19,
    d.content->'procedure'->>33                                                     as l33,
    d.content->'procedure'->>34                                                     as l34,
    md5((((d.content->'procedure') - 33) - 19)::text) = b.proc_rest                 as rest_same,
    md5((d.content - 'procedure' - 'revision_history')::text) = b.other_keys        as keys_same,
    left(d.content->>'revision_history', length(b.rh)) = b.rh                       as rh_prefix_same,
    d.content->>'revision_history'                                                  as rh,
    (d.content->'procedure')::text ilike '%no critical control points defined%'   as stale_claim,
    lower(d.content::text) ~ 'diana|gabriela|samboni|juncos|christina|richard'                                            as named,
    position(chr(13) in d.content::text) > 0                                        as crs,
    (select count(*) from public.verification_schedule
      where activity_key in ('ccp_record_review', 'critical_limit_validation')
        and status = 'planned')                                                     as still_planned,
    (select count(*) from public.verification_schedule
      where (activity_key = 'ccp_record_review' and description = $t$Scheduled but not yet performed - the five CCPs in the site's HACCP plan are monitored but the monitoring is not recorded, and the plan is not under document control, so there is no record to review.$t$)
         or (activity_key = 'critical_limit_validation' and description = $t$Scheduled but not yet performed - the HACCP plan that identifies the site's five CCPs is not under document control, so no critical limit is established by a controlled document, and CCP monitoring is not recorded, so there is no record to re-validate against.$t$)) as descs
  into r
  from public.sop_documents d, _fsqm017_before b
  where d.sop_number = 'FSQM-017';

  if r.status is distinct from 'active' or r.revision is distinct from 'v2'
     or r.approved_by is distinct from 'GJM' or r.effective_date is distinct from date '2026-09-11' then
    raise exception 'FSQM-017 stamp is %/%/%/%, expected active/v2/GJM/2026-09-11.',
      r.status, r.revision, r.approved_by, r.effective_date;
  end if;
  if r.lines <> 69 then
    raise exception 'FSQM-017 is % lines, expected 69.', r.lines;
  end if;
  if r.l19 is distinct from $t$> WRITTEN CONDITIONALLY, AND ON PURPOSE. The limits this Part governs are those established by a food safety plan. The site's HACCP plan identifies five critical control points — baking, cooling from the oven, cooling before covering, sealing, and sealing leak — but the plan is not under document control, so no critical limit for any of them is established by a controlled document; and although the five points are monitored, the monitoring is not recorded, so there is no record to review a limit against. The rule therefore stands, and the activity is carried on the schedule as not yet implemented rather than as a review somebody is failing to do.$t$ or r.l33 is distinct from $t$> CRITICAL CONTROL POINTS ARE NOT YET VERIFIED, AND THIS PART DOES NOT CLAIM THEM. The five critical control points in the site's HACCP plan are monitored on the floor, but the monitoring is not recorded. Verification confirms a record and authorization signs one, so with no record neither can take place, and the verification of critical control point monitoring that 2.5.2.1 requires is not performed. It is carried on the schedule as not yet implemented, and becomes real when the food safety plan is brought under document control with a monitoring record for each point.$t$ then
    raise exception 'FSQM-017 corrected lines did not land at 19 and 33.';
  end if;
  if r.l34 not like $t$The master verification schedule is set out below.$t$ || '%' then
    raise exception 'The Part 6 heading is not immediately after the inserted paragraph.';
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
  if r.rh not like '%REVISED 2026-09-11 — v2, approved GJM%'
     or r.rh not like '%is in force for Good Manufacturing Practices%NOT for critical control points%'
     or r.rh not like '%schedule dates the next review from it.' then
    raise exception 'FSQM-017 revision block is missing or incomplete.';
  end if;
  if r.stale_claim then
    raise exception 'FSQM-017 procedure still says no critical control points are defined.';
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
