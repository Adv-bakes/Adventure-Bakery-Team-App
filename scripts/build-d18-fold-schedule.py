# -*- coding: utf-8 -*-
"""Fold the verification schedule into FSQM-017 and delete FRM-008.

FRM-008 WAS REDUNDANT AND THE OWNER SAW IT. Its record section existed for two activities out
of thirteen, and checking both dissolved them: no active FSQM programme records its annual
review on a form - the revision is the evidence, in all eight of them - and the annual
re-validation of critical food safety limits belongs with the food safety plan that establishes
those limits, which does not exist. Correct both and the section served nothing, leaving a form
with a printed schedule and nowhere to write.

2.5.2.2 asks the PROGRAMME to have a verification schedule. So the schedule moves into FSQM-017
as Part 6, generated from verification_schedule the same way FRM-008 printed it, and FRM-008 is
deleted. One document instead of two, and nothing to keep in step.

A NEW EVIDENCE KIND, document_revision, so the annual programme review can still be prompted
and still be evidenced the way every other programme evidences it: by the document being
revised. sop_document_history already records that, so the job derives last-completed from it.

  20260910000018  evidence_kind gains document_revision and loses frm008; the two activities are
                  re-pointed; FSQM-017's content is rewritten with the schedule folded in;
                  FRM-008 is deleted.

Refuses to overwrite the migration file.

Usage:  python scripts/build-d18-fold-schedule.py
"""
import io, json, os, sys

sys.stdout.reconfigure(encoding="utf-8", errors="replace")

OUT = "supabase/migrations/20260910000018_fold_schedule_into_fsqm017.sql"
B, P = "• ", "> "
SCHEDULE_PLACEHOLDER = "@@SCHEDULE@@"

if os.path.exists(OUT):
    raise SystemExit("%s already exists - refusing to overwrite an applied migration." % OUT)


def dollar(v, tag):
    s = json.dumps(v, ensure_ascii=False)
    assert ("$%s$" % tag) not in s
    return "$%s$%s$%s$" % (tag, s, tag)


PROC = [
 # ---- Part 1
 "This program states how the site validates that its food safety controls achieve what they are"
 " meant to achieve, and how it verifies that those controls are being operated. It holds the"
 " master verification schedule required by 2.5.2.2, which is set out in Part 6.",

 P + "Validation and verification are different questions and this program keeps them apart."
     " Validation asks whether a control WOULD work: is the method capable of the result claimed"
     " for it. Verification asks whether it DID: was it carried out, by whom, and does the record"
     " show it. Monitoring is neither - it is the doing itself, and it lives in the programs"
     " below rather than here.",

 "This program schedules and verifies the controls that other programs define. It does not"
 " restate them, and it does not create a record of its own where one already exists.",
 B + "Good Manufacturing Practices are defined by FSQM-012 and monitored under FSQM-022, whose"
     " monthly full-site inspection is recorded on FRM-913.",
 B + "Sanitation is scheduled by FRM-901, confirmed daily on FRM-903 and verified on FRM-902,"
     " with the machine SSOP logs FRM-909 to FRM-912 beneath them.",
 B + "Temperature monitoring is SOP-401, and its monthly review on FRM-401 is already written as"
     " the verification that the automatic monitoring worked.",
 B + "Retention sampling is FSQM-014 and FRM-703; product release is FSQM-020 and FRM-701;"
     " dispatch is FSQM-036 and FRM-801; glass and brittle plastic is FRM-907.",
 B + "Corrective and preventive action is FSQM-009, recorded on FRM-007.",
 P + "Naming them rather than absorbing them is the point. An umbrella program that restates the"
     " controls beneath it creates two versions of every rule, and the day they disagree is the"
     " day the document set stops being evidence of anything. What this program adds is the"
     " method, the responsibility, the criteria and the schedule.",
 P + "The same reasoning governs the records. Every activity on the schedule in Part 6 is recorded"
     " on the form named against it, and this program issues no general-purpose verification form"
     " of its own. A catch-all record beside a purpose-built one produces two accounts of a single"
     " activity, and is weaker evidence than either.",

 # ---- Part 2 (2.5.1.1 i)
 "Good Manufacturing Practices shall be confirmed to achieve the results required of them, and"
 " the confirmation shall be recorded.",
 B + "The monthly site inspection on FRM-913 examines each Module 11 subsection against the Code"
     " and records what was found, not merely that a look was taken.",
 B + "Sanitation verification on FRM-902 confirms that cleaning achieved its result rather than"
     " that cleaning was performed, which is what FRM-903 already confirms.",
 B + "Where an inspection or a verification finds a practice that is not achieving its result,"
     " the finding is raised under FSQM-009 and the practice is changed. A finding closed without"
     " a change is a finding that was not believed.",
 P + "WHAT THIS SITE CANNOT CURRENTLY DO, stated plainly rather than implied. Confirming a"
     " hygiene practice by measurement - environmental swabbing, ATP, indicator organisms -"
     " requires analysis, and this site performs none: FSQM-014 records that there is no on-site"
     " laboratory, no external laboratory and no reliance on supplier certificates of analysis."
     " Confirmation here therefore rests on inspection and on record review.",
 P + "That is a real limit and it is not closed by wording it carefully. The deliverable that"
     " changes it is the environmental monitoring program for ready-to-eat product, which"
     " introduces sampling, pathogen and indicator selection, and trending. When it is issued,"
     " this Part is revised to cite it and the analytical limb of 2.5.1.1 i is met properly."
     " Until then this program does not claim more than inspection can support.",

 # ---- Part 3 (2.5.1.1 ii)
 "Critical food safety limits shall be reviewed at least annually, and re-validated or justified"
 " against a regulatory standard whenever they change or whenever the process they control"
 " changes.",
 B + "A limit that is re-validated shall record the evidence relied on. A limit justified by"
     " reference to a regulatory standard shall record the standard.",
 B + "Where a limit changes, the change shall be assessed under Part 4 before it takes effect.",
 P + "WRITTEN CONDITIONALLY, AND ON PURPOSE. The limits this Part governs are those established"
     " by a food safety plan, and this site has no HACCP plan under document control and no"
     " critical control points defined. A search of every document for CCPs finds only training"
     " material and a competency list. The rule therefore stands and has nothing to bite on, and"
     " the activity is carried on the schedule as not yet implemented rather than as a review"
     " somebody is failing to do.",
 P + "Two limits are in force today and are governed by the programs that state them, because"
     " they are real whether or not a HACCP plan names them: the refrigerator and freezer limits"
     " in SOP-401, reviewed monthly on FRM-401, and the sanitizer concentration stated in FRM-903"
     " and the SSOPs. NEITHER IS A CRITICAL CONTROL POINT. Recording them as though they were"
     " would be the opposite error to ignoring them, and would put a CCP in the document set that"
     " no hazard analysis ever identified.",

 # ---- Part 4 (2.5.1.1 iii)
 "A change to a process or a procedure shall be assessed for its effect on food safety controls"
 " BEFORE it takes effect, and the assessment shall be recorded.",
 B + "The triggers are: a new or reformulated product; a change of process step, equipment,"
     " ingredient, supplier, packaging or label; a change to the layout of the site; and a change"
     " to who performs a monitoring or verification role.",
 B + "The assessment records what control the change touches, whether that control remains"
     " effective, and what was altered to keep it so.",
 B + "Where a dedicated record governs the change it is used: label changes are FRM-601 and"
     " REP-603, and a change arising out of a corrective action is recorded on its FRM-007.",
 P + "There is no general change-assessment record, and this program does not invent one. Change"
     " management is its own deliverable and will define the record; until it is issued, an"
     " assessment with no dedicated home is recorded on the FRM-007 of the action that prompted"
     " it, or in the revision history of the document being changed. Creating a form here that"
     " would be superseded in a few months is how a document set accumulates records nobody"
     " maintains.",
 P + "The order matters more than the paperwork. A control assessed after the change it exists to"
     " control has already failed to control it - the same reasoning FSQM-036 Part 3 applies to"
     " introducing temperature-controlled transport, and FSQM-014 Part 2 to introducing analysis.",

 # ---- Part 5 (2.5.2.1)
 "The monitoring of Good Manufacturing Practices, of critical control points and of other food"
 " safety controls shall be verified, and the person responsible for verifying shall authorize"
 " each verified record.",
 B + "Verification confirms that monitoring was carried out as required, that its results were"
     " within limits, and that anything outside limits was acted on.",
 B + "The verification signature on the record IS the authorization required by 2.5.2.1."
     " FRM-903, FRM-913, FRM-902, FRM-401 and FRM-701 each carry one, and it is not repeated"
     " anywhere else.",
 B + "A person shall not verify their own monitoring where a second qualified person is"
     " available. Where one is not, the record shall say so.",
 P + "That last rule is written the way FSQM-004 had to be rewritten. An absolute separation"
     " requirement made a legitimate single-operator run non-compliant, and 11.2.5.7 asks for"
     " QUALIFIED personnel rather than independent ones. A rule the site cannot always follow is"
     " worse than a weaker one it can: the first thing that happens to it is that it is ignored.",
 P + "A verification that leaves no signature is indistinguishable from one that did not happen."
     " That is why 2.5.2.1 names authorization separately from verification, and why the schedule"
     " names a position against every activity rather than leaving it to whoever is free.",

 # ---- Part 6 (2.5.2.2)
 "The master verification schedule is set out below. It states every verification activity, the"
 " frequency at which it is completed, the position responsible for it, and the record that"
 " evidences it.",
 SCHEDULE_PLACEHOLDER,
 P + "The schedule is maintained in the Team Portal under Compliance, where it is the same record"
     " the reminder system reads. Adding, retiring or re-timing an activity is done there, and the"
     " list above is this program's copy of it as at the effective date of this revision. A change"
     " to the schedule is therefore a revision of this program, and the annual review in Part 10 is"
     " the occasion that catches it.",
 P + "AN ACTIVITY MARKED NOT YET IMPLEMENTED IS SCHEDULED AND IS NOT BEING PERFORMED, because the"
     " program that governs it has not been issued. Each names the deliverable that will bring it"
     " into force, no reminder is raised for it, and no record is expected against it.",
 P + "Listing activities the site is not yet performing is deliberate and is the harder of the two"
     " options. Omitting them would produce a schedule that looked complete and was not, and an"
     " auditor comparing it against the Code would find the gaps anyway - having also learned that"
     " the schedule does not show them. Stating them is the position that survives being read"
     " carefully.",

 # ---- Part 7
 "Verification activities that have fallen due shall be raised to the whole team within the Team"
 " Portal, labelled with the position responsible for each.",
 B + "The prompt is raised twice each working day from the schedule. Nothing is routed to an"
     " individual: the schedule names the responsible position, and the notification carries that"
     " label.",
 B + "A prompt is cleared for the whole team by whoever acts on it, and the clearing records who"
     " and when.",
 P + "A NOTIFICATION IS A PROMPT, NOT A RECORD. Clearing one does not perform the activity and is"
     " not evidence that it was performed. The record is the entry on the form the notification"
     " links to. The name and time against a cleared prompt show only that somebody took the"
     " prompt, and this program does not treat them as verification.",
 P + "The distinction is worth defending because the failure it prevents is quiet. A feed that"
     " feels like a checklist becomes one that gets ticked, and a system whose evidence is a list"
     " of dismissals has replaced the work with the reminder about the work.",

 # ---- Part 8
 "Where a verification activity finds that a control is not effective, or was not carried out,"
 " the finding shall be raised under FSQM-009 and its corrective action recorded on FRM-007.",
 B + "The activity that found it is still recorded as completed. A verification that finds a"
     " problem has succeeded, not failed.",
 P + "Recording the failure and the verification separately keeps both true. Marking a"
     " verification incomplete because it found something would mean the schedule showed the"
     " activity as outstanding, which would raise it again the next morning and lose the finding"
     " in the noise.",

 # ---- Part 9
 "Records of verification activities are the records named against each activity in Part 6, held"
 " and retained by the programs that define them. This program creates no record of its own.",

 # ---- Part 10
 "The SQF Practitioner shall review this program at least annually, and whenever a program it"
 " schedules is issued, amended or withdrawn. The review is evidenced by the revision of this"
 " document.",
 P + "That is how every program in this document set evidences its annual review, and it is why"
     " this one does not carry a review form. The schedule is the part that goes stale, and it"
     " goes stale quietly: an activity keeps its place on the list long after the program that"
     " governed it changed. The annual review is also the occasion on which the not yet"
     " implemented activities are re-examined, because each becomes real the day its deliverable"
     " is issued and nothing else will announce that to this document.",
]

CONTENT = {
 "purpose":
   "To state the methods, responsibility and criteria by which the site validates that its food"
   " safety controls achieve the results required of them, and verifies that those controls are"
   " being operated; and to hold the master verification schedule listing every verification"
   " activity, its frequency, the position responsible for it and the record that evidences it."
   " It satisfies the Validation and Effectiveness and Verification Activities elements of the SQF"
   " Food Safety Code: Food Manufacturing, Edition 9 (2.5.1 and 2.5.2), both of which are"
   " Mandatory.",

 "scope":
   "Every element of the SQF System operated at this site, and every activity by which the"
   " effectiveness of those elements is established or confirmed.\n\n"
   "It does not restate the controls it schedules, and it does not duplicate their records. Good"
   " Manufacturing Practices are FSQM-012 and FSQM-022; sanitation is FRM-901, FRM-902 and"
   " FRM-903 with the machine SSOPs beneath them; temperature monitoring is SOP-401 and FRM-401;"
   " retention sampling is FSQM-014; product release is FSQM-020; dispatch is FSQM-036;"
   " corrective action is FSQM-009. This program supplies the method, the responsibility, the"
   " criteria and the schedule.",

 "definitions":
   "Validation: establishing that a control is capable of achieving the result claimed for it."
   " It asks whether the control WOULD work.\n\n"
   "Verification: confirming that a control was operated as required and that its records show"
   " it. It asks whether the control DID work.\n\n"
   "Monitoring: carrying out the control and recording the result at the time. Monitoring is"
   " neither validation nor verification, and it lives in the program that defines the control.\n\n"
   "Verification activity: one scheduled task in Part 6, with a frequency, a responsible position"
   " and a named record.\n\n"
   "Not yet implemented: the status of a scheduled activity whose governing program has not been"
   " issued. The activity is listed and is not being performed.",

 "responsibility":
   "SQF Practitioner — owns this program and the schedule. Performs or assigns each verification"
   " activity, authorizes verified records, and raises findings under FSQM-009.\n"
   "Production Supervisor — performs the verification activities assigned to that position, and"
   " ensures monitoring is carried out so that there is something to verify.\n"
   "Production staff — carry out the monitoring that these activities verify, and complete the"
   " records that are its evidence.\n"
   "Admin — maintains the records and their retention.\n"
   "Senior Site Management — provides the resources the schedule requires, reviews the system"
   " under 2.1.2, and is the authority for any decision to change an activity's frequency.",

 "procedure": PROC,

 "form_references":
   "FRM-913 GMP / Food Safety Inspection Record; FRM-903 Daily Sanitation, Pre-Operation &"
   " Release Record; FRM-902 Sanitation Verification Log; FRM-901 Master Sanitation Schedule;"
   " FRM-401 Temperature Monitoring Review; FRM-703 Retention Sample Log; FRM-701 Finished"
   " Product Release Record; FRM-801 Dispatch and Vehicle Loading Record; FRM-907 Glass &"
   " Brittle Plastic Register; FRM-007 Corrective & Preventive Action Report; FRM-002 Customer"
   " Complaint Report; FRM-001 Management Review Record",

 "records":
   "This program creates no record of its own. The record of each verification activity is the"
   " form named against it in Part 6, held and retained by the program that defines that form.\n"
   "The schedule itself is a record, and it is Part 6 of this document. It is amended by revising"
   " this document.\n"
   "The annual review of this program is evidenced by its revision, as it is for every program in"
   " this document set.\n"
   "Retention of the activity records: as set by each owning program; none is shorter than two"
   " years, or the shelf life of the product plus twelve months, whichever is longer, on the"
   " basis FSQM-009 Part 10 states.",

 "governing_reference":
   "SQF Food Safety Code: Food Manufacturing, Edition 9.\n"
   "2.5.1 Validation and Effectiveness (MANDATORY). 2.5.1.1 requires documented and implemented"
   " methods, responsibility and criteria for ensuring the effectiveness of all applicable"
   " elements of the SQF System, validating that (i) Good Manufacturing Practices achieve the"
   " required results, (ii) critical food safety limits are reviewed annually and re-validated or"
   " justified when changes occur, and (iii) changes to processes or procedures are assessed for"
   " continued control. Parts 2, 3 and 4 respectively.\n"
   "2.5.2 Verification Activities (MANDATORY). 2.5.2.1 requires documented and implemented"
   " methods, responsibility and criteria for verifying the monitoring of GMPs, critical control"
   " points and other food safety controls, and requires that the personnel responsible for"
   " verifying monitoring authorize each verified record — Part 5. 2.5.2.2 requires a verification"
   " schedule stating the activities, their frequency and the person responsible, and that records"
   " of verification are maintained — Part 6 is the schedule, and Part 9 states where the records"
   " are held.\n"
   "2.5.3 Corrective and Preventative Action, and FSQM-009 — where a failed verification goes."
   " This program routes to it and does not restate it.\n"
   "2.5.4.3 Regular inspections of site and equipment, and FSQM-022 — the monthly Module 11"
   " inspection this program schedules and relies on, but does not define.\n"
   "2.1.2 Management Review — the annual review this program schedules on FRM-001.",

 "revision_history":
   "Rev New — written 2026-09-10 against SQF Food Safety Code: Food Manufacturing, Edition 9,"
   " 2.5.1 Validation and Effectiveness and 2.5.2 Verification Activities. DRAFT. Not approved,"
   " not in force.\n\n"
   "WHY IT EXISTS. The gap assessment scored 2.5.1.1, 2.5.2.1 and 2.5.2.2 and no controlled"
   " document covered validation or verification as a subject. Individual programs verified"
   " themselves - FSQM-022's monthly inspection, FRM-401's monthly review - but nothing held the"
   " schedule 2.5.2.2 requires or stated the method 2.5.1.1 and 2.5.2.1 require. Both clauses are"
   " Mandatory.\n\n"
   "IT SCHEDULES RATHER THAN RESTATES. Part 1 names every program whose controls this one"
   " verifies and defers to each. An umbrella that restates the controls beneath it creates two"
   " versions of every rule, and the day they disagree the document set stops being evidence."
   " FSQM-036 Part 7 took the same approach to unloading, pointing back at FRM-301 rather than"
   " building a second receiving form.\n\n"
   "AMENDED 2026-09-10, BEFORE ISSUE — FRM-008 WAS REDUNDANT AND HAS BEEN DELETED. This program"
   " was first drafted with a companion form: FRM-008, carrying the printed schedule and a"
   " general-purpose verification activity record. The owner questioned whether that record was"
   " doing any work, and it was not. Eleven of the thirteen active activities already record on"
   " their own form. The two that did not dissolved on inspection: no active FSQM programme in"
   " this document set records its annual review on a form - the revision is the evidence, in all"
   " eight of them - and the annual re-validation of critical food safety limits belongs with the"
   " food safety plan that establishes those limits, which does not exist, so that activity is now"
   " carried as not yet implemented alongside CCP record review for the same reason.\n\n"
   "With the record section serving nothing, what remained was a form with a printed table and"
   " nowhere to write. 2.5.2.2 asks the PROGRAMME to have a verification schedule, so the schedule"
   " became Part 6 of this document and FRM-008 was deleted. One document instead of two, and no"
   " second copy of the schedule to keep in step. FRM-008 returns to being an unused number.\n\n"
   "The general-purpose record was also the wrong shape on its own terms. A catch-all beside a"
   " purpose-built record produces two accounts of one activity, and invites being filled in"
   " alongside the real form rather than instead of it. Part 1 now says so in terms.\n\n"
   "THE ANNUAL REVIEW OF THIS PROGRAM is evidenced by its revision, which is both how every other"
   " programme here does it and something the application already records in sop_document_history."
   " The schedule reads that history to know when the review last happened, so the activity is"
   " still prompted without a form existing to carry it.\n\n"
   "OPEN BEFORE ISSUE — three things the site must settle:\n\n"
   "1. EVERY FREQUENCY IS A PROPOSAL, NOT A DETERMINATION. Weekly retention review, weekly"
   " sanitation record review, monthly GMP inspection, monthly CAPA review and the rest were"
   " seeded to give the schedule a working shape. They are the SQF Practitioner's to confirm or"
   " correct before issue. Seeding a plausible cadence and letting it harden into fact is the"
   " error FRM-004 avoided by setting every pm_frequency to Not yet set.\n\n"
   "2. THE ANALYTICAL LIMB OF 2.5.1.1 i CANNOT BE MET TODAY. Confirming that GMPs achieve their"
   " result normally rests on measurement, and this site performs no analysis at all - no"
   " laboratory, no external laboratory, no reliance on supplier certificates. Part 2 states this"
   " and rests the confirmation on inspection and record review. The environmental monitoring"
   " program for ready-to-eat product is the deliverable that changes it, and Part 2 is revised"
   " when that is issued.\n\n"
   "3. WHO APPROVES. This program appoints verification responsibilities across every position"
   " including the SQF Practitioner's own, so it should be approved by Senior Site Management"
   " rather than by the role it assigns work to - the same reasoning FSQM-004 records.",
}

FREQ_SQL = """case when frequency_count = 1 then
           case frequency_unit
             when 'day' then 'Daily' when 'week' then 'Weekly' when 'month' then 'Monthly'
             when 'quarter' then 'Quarterly' when 'year' then 'Annually' end
         else 'Every ' || frequency_count || ' ' || frequency_unit || 's' end"""

SQL = """-- D-18 - fold the verification schedule into FSQM-017 and delete FRM-008.
--
-- FRM-008 WAS REDUNDANT AND THE OWNER SAW IT. Its record section existed for two activities out of
-- thirteen, and checking both dissolved them. No active FSQM programme in this document set records
-- its annual review on a form - the revision is the evidence, in all eight of them - so the annual
-- review of FSQM-017 never needed one. And the annual re-validation of critical food safety limits
-- belongs with the food safety plan that establishes those limits, which does not exist; that
-- activity is now carried as not yet implemented alongside CCP record review, for the same reason
-- and with the same honesty.
--
-- With the record section serving nothing, what was left was a form with a printed table and
-- nowhere to write. 2.5.2.2 asks the PROGRAMME to have a verification schedule, so the schedule
-- becomes Part 6 of FSQM-017, generated from verification_schedule exactly as FRM-008 printed it,
-- and FRM-008 is deleted. One document instead of two, and no second copy to keep in step.
--
-- A CATCH-ALL RECORD IS WEAKER THAN THE FORM IT SITS BESIDE. That is the general lesson and Part 1
-- now states it: an unused general-purpose record invites being filled in ALONGSIDE the real one,
-- producing two accounts of a single activity, which is worse evidence than either alone.
--
-- document_revision IS A NEW EVIDENCE KIND, so the annual programme review can still be prompted
-- while being evidenced the way every other programme evidences it. sop_document_history already
-- records revisions of a published document, so the job reads last-completed from there. frm008 is
-- dropped from the allowed kinds in the same statement - nothing uses it once the two rows move,
-- and leaving it would leave a way to point an activity at a document that no longer exists.
--
-- FRM-008 is a draft and has no entries; the guard refuses to delete it if either stops being true,
-- because document_id is ON DELETE RESTRICT and a form with entries must be archived, not removed.

begin;

do $$
declare r record;
begin
  select
    (select status from public.sop_documents where sop_number = 'FRM-008')            as s008,
    (select status from public.sop_documents where sop_number = 'FSQM-017')           as s017,
    (select count(*) from public.sop_document_responses rr
       join public.sop_documents dd on dd.id = rr.document_id
      where dd.sop_number = 'FRM-008')                                                as entries,
    (select count(*) from public.verification_schedule
      where evidence_kind = 'frm008')                                                 as frm008_rows,
    (select count(*) from public.verification_schedule)                               as n
  into r;

  if r.s017 is distinct from 'draft' then
    raise exception 'FSQM-017 is %, expected draft; its content is replaced wholesale here.', r.s017;
  end if;
  if r.s008 is distinct from 'draft' then
    raise exception 'FRM-008 is %, expected draft. An issued form is archived, not deleted.', r.s008;
  end if;
  if r.entries <> 0 then
    raise exception 'FRM-008 has % entries and must be archived rather than deleted.', r.entries;
  end if;
  if r.frm008_rows <> 2 then
    raise exception 'Expected 2 activities pointing at FRM-008; found %.', r.frm008_rows;
  end if;
  if r.n <> 20 then
    raise exception 'verification_schedule holds % rows, expected 20.', r.n;
  end if;
end $$;

-- ---------------------------------------------------------------- evidence kinds
alter table public.verification_schedule
  drop constraint if exists verification_schedule_evidence_kind_check;

update public.verification_schedule
   set evidence_kind = 'document_revision',
       evidence_document_number = 'FSQM-017',
       description = 'Reviews this schedule itself: are the activities right, the frequencies right, the owners right. Evidenced by the revision of FSQM-017.'
 where activity_key = 'program_review';

update public.verification_schedule
   set status = 'planned',
       evidence_kind = 'none',
       evidence_document_number = null,
       owning_program = null,
       pending_deliverable = 'D-14 HACCP / Food Safety Plan',
       description = 'Scheduled but not yet performed - the site has no food safety plan under document control, so no critical limits have been established to re-validate.'
 where activity_key = 'critical_limit_validation';

alter table public.verification_schedule
  add constraint verification_schedule_evidence_kind_check
  check (evidence_kind in ('form_entry', 'document_revision', 'none'));

-- ---------------------------------------------------------------- FSQM-017
update public.sop_documents
   set content = __CONTENT__::jsonb
 where sop_number = 'FSQM-017';

-- Splice the schedule in where the placeholder sits. Fractional ordinals keep the generated lines
-- in schedule order between the two lines that surround them, without assuming any index.
with anchor as (
  select e.ord as at
    from public.sop_documents d,
         jsonb_array_elements(d.content->'procedure') with ordinality e(elem, ord)
   where d.sop_number = 'FSQM-017' and e.elem #>> '{}' = '__PLACEHOLDER__'
), sched as (
  select row_number() over (order by sort_order) as n,
         '• ' || activity
             || ' — ' || __FREQ__
             || ' — ' || responsible_position
             || ' — ' || case when evidence_kind = 'none' then 'no record; not yet performed'
                              when evidence_kind = 'document_revision'
                                then 'evidenced by the revision of ' || evidence_document_number
                              else coalesce(evidence_document_number, 'no record') end
             || case when status = 'planned'
                     then '. NOT YET IMPLEMENTED — awaiting ' || pending_deliverable
                     else '' end as line
    from public.verification_schedule
   where status <> 'retired'
), merged as (
  select e.ord::numeric as ord, e.elem
    from public.sop_documents d,
         jsonb_array_elements(d.content->'procedure') with ordinality e(elem, ord)
   where d.sop_number = 'FSQM-017' and e.elem #>> '{}' <> '__PLACEHOLDER__'
  union all
  select (select at from anchor) + (sched.n / 1000.0), to_jsonb(sched.line) from sched
)
update public.sop_documents d
   set content = jsonb_set(d.content, '{procedure}',
                   (select jsonb_agg(m.elem order by m.ord) from merged m))
 where d.sop_number = 'FSQM-017';

-- ---------------------------------------------------------------- FRM-008
delete from public.sop_documents where sop_number = 'FRM-008';

do $$
declare r record;
begin
  select
    (select count(*) from public.sop_documents where sop_number = 'FRM-008')           as still_there,
    (select jsonb_array_length(content->'procedure') from public.sop_documents
      where sop_number = 'FSQM-017')                                                   as lines,
    (select count(*) from public.sop_documents d,
            jsonb_array_elements_text(d.content->'procedure') l(line)
      where d.sop_number = 'FSQM-017' and l.line like '%__PLACEHOLDER__%')              as placeholder_left,
    (select count(*) from public.sop_documents d,
            jsonb_array_elements_text(d.content->'procedure') l(line)
      where d.sop_number = 'FSQM-017'
        and l.line like '• %NOT YET IMPLEMENTED — awaiting %')                          as printed_planned,
    (select count(*) from public.verification_schedule where status = 'planned')        as n_planned,
    (select count(*) from public.verification_schedule where status <> 'retired')       as n_sched,
    (select count(*) from public.sop_documents d,
            jsonb_array_elements_text(d.content->'procedure') l(line)
      where d.sop_number = 'FSQM-017' and l.line like '%FRM-008%')                      as mentions_frm008,
    (select count(*) from public.sop_documents
      where sop_number = 'FSQM-017' and content->>'form_references' like '%FRM-008%')   as refs_frm008,
    (select count(*) from public.verification_schedule where evidence_kind = 'frm008')  as stale_kind,
    (select count(*) from public.sop_documents
      where sop_number = 'FSQM-017' and position(chr(13) in content::text) > 0)         as crs
  into r;

  if r.still_there <> 0 then raise exception 'FRM-008 was not deleted.'; end if;
  if r.placeholder_left <> 0 then
    raise exception 'the schedule placeholder is still in the procedure; the splice did not run.';
  end if;
  -- Every activity on the schedule must be printed in the programme, or the document understates
  -- what the site has undertaken to do.
  if r.lines <> __LINES__ - 1 + r.n_sched then
    raise exception 'FSQM-017 is % lines; expected % base lines plus % schedule rows.',
      r.lines, __LINES__ - 1, r.n_sched;
  end if;
  if r.printed_planned <> r.n_planned then
    raise exception '% lines print as not-yet-implemented but % activities are planned.',
      r.printed_planned, r.n_planned;
  end if;
  -- The document must not still point at a form that no longer exists.
  if r.mentions_frm008 <> 0 or r.refs_frm008 <> 0 then
    raise exception 'FSQM-017 still references FRM-008 (%s in procedure, %s in form references).',
      r.mentions_frm008, r.refs_frm008;
  end if;
  if r.stale_kind <> 0 then
    raise exception '% schedule rows still use the frm008 evidence kind.', r.stale_kind;
  end if;
  if r.crs <> 0 then raise exception 'CR characters are present in FSQM-017.'; end if;
end $$;

commit;
"""

SQL = (SQL
       .replace("__CONTENT__", dollar(CONTENT, "j17b"))
       .replace("__PLACEHOLDER__", SCHEDULE_PLACEHOLDER)
       .replace("__FREQ__", FREQ_SQL)
       .replace("__LINES__", str(len(PROC))))
io.open(OUT, "w", encoding="utf-8", newline="\n").write(SQL)
print("wrote %s  (%d base lines, schedule spliced at the placeholder)" % (OUT, len(PROC)))

if os.path.exists("sop-drafts/FRM-008-verification-schedule-schema.json"):
    os.remove("sop-drafts/FRM-008-verification-schedule-schema.json")
    print("removed sop-drafts/FRM-008-verification-schedule-schema.json")
