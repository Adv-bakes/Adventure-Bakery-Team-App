# -*- coding: utf-8 -*-
"""Seed FSQM-017 Validation and Verification Program and FRM-008 Master Verification Schedule.

D-18. Two MANDATORY clauses - 2.5.1.1 Validation and Effectiveness, 2.5.2.1 Verification
Activities - plus 2.5.2.2's schedule.

  20260910000016  FSQM-017, draft. Ten Parts.
  20260910000017  FRM-008, draft. The printed schedule plus the activity record.

FRM-008'S SCHEDULE IS GENERATED FROM verification_schedule IN SQL, not hardcoded here. The
table is already the source of truth - the twice-daily job reads it - so printing a second
hand-maintained copy into the form would be two things that can disagree about what the site
has undertaken to do. Building it from a query means they cannot. The consequence is worth
stating on the document: the printed table is a snapshot as at issue, the Verification
Schedule page is live, and a change to the schedule needs an FRM-008 revision - which is
exactly what the annual programme review activity is for.

Refuses to overwrite either migration file.

Usage:  python scripts/build-fsqm017-and-frm008.py
"""
import io, json, os, sys

sys.stdout.reconfigure(encoding="utf-8", errors="replace")

OUT17 = "supabase/migrations/20260910000016_fsqm017_validation_verification.sql"
OUT08 = "supabase/migrations/20260910000017_frm008_verification_schedule_record.sql"
B, P = "• ", "> "

for f in (OUT17, OUT08):
    if os.path.exists(f):
        raise SystemExit("%s already exists - refusing to overwrite an applied migration." % f)


def dollar(v, tag):
    s = json.dumps(v, ensure_ascii=False)
    assert ("$%s$" % tag) not in s
    return "$%s$%s$%s$" % (tag, s, tag)


def like_check(sql, payload):
    """Every LIKE pattern asserting content must actually match the payload. LIKE is
    case-sensitive, and a mismatched capital failed a push once already."""
    import re
    blob = json.dumps(payload, ensure_ascii=False)
    bad = []
    for m in re.finditer(r"like '%([^%']{12,})%'", sql):
        if m.group(1) not in blob:
            bad.append(m.group(1))
    if bad:
        raise SystemExit("LIKE patterns that cannot match the payload:\n  " + "\n  ".join(bad))


# ══════════════════════════════════════════════════════════ FSQM-017

PROC = [
 # ---- Part 1
 "This program states how the site validates that its food safety controls achieve what they are"
 " meant to achieve, and how it verifies that those controls are being operated. It holds the"
 " master verification schedule required by 2.5.2.2.",

 P + "Validation and verification are different questions and this program keeps them apart."
     " Validation asks whether a control WOULD work: is the method capable of the result claimed"
     " for it. Verification asks whether it DID: was it carried out, by whom, and does the record"
     " show it. Monitoring is neither - it is the doing itself, and it lives in the programs"
     " below rather than here.",

 "This program schedules and verifies the controls that other programs define. It does not"
 " restate them.",
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
 B + "The review is recorded on FRM-008 as the activity Annual review and re-validation of"
     " critical food safety limits.",
 B + "A limit that is re-validated shall record the evidence relied on. A limit justified by"
     " reference to a regulatory standard shall record the standard.",
 B + "Where a limit changes, the change shall be assessed under Part 4 before it takes effect.",
 P + "WRITTEN CONDITIONALLY, AND ON PURPOSE. The limits this Part governs are those established"
     " by a food safety plan, and this site has no HACCP plan under document control and no"
     " critical control points defined. A search of every document for CCPs finds only training"
     " material and a competency list. So this Part states the rule and the rule stands, but it"
     " has nothing to bite on until the food safety plan is built and issued.",
 P + "Two limits are in force today and are reviewed under this Part in the meantime, because"
     " they are real whether or not a HACCP plan names them: the refrigerator and freezer limits"
     " held in temperature_limits and stated in SOP-401, and the sanitizer concentration stated"
     " in FRM-903 and the SSOPs. Neither is a CCP. Recording them as though they were would be"
     " the opposite error to ignoring them.",

 # ---- Part 4 (2.5.1.1 iii)
 "A change to a process or a procedure shall be assessed for its effect on food safety controls"
 " BEFORE it takes effect, and the assessment shall be recorded.",
 B + "The triggers are: a new or reformulated product; a change of process step, equipment,"
     " ingredient, supplier, packaging or label; a change to the layout of the site; and a change"
     " to who performs a monitoring or verification role.",
 B + "The assessment records what control the change touches, whether that control remains"
     " effective, and what was altered to keep it so.",
 B + "Where a dedicated record already governs the change it is used rather than duplicated:"
     " label changes are FRM-601 and REP-603, and a change arising out of a corrective action is"
     " recorded on its FRM-007. Otherwise the assessment is an FRM-008 entry.",
 P + "The order matters more than the paperwork. A control assessed after the change it exists to"
     " control has already failed to control it - the same reasoning FSQM-036 Part 3 applies to"
     " introducing temperature-controlled transport, and FSQM-014 Part 2 to introducing analysis.",

 # ---- Part 5 (2.5.2.1)
 "The monitoring of Good Manufacturing Practices, of critical control points and of other food"
 " safety controls shall be verified, and the person responsible for verifying shall authorize"
 " each verified record.",
 B + "Verification confirms that monitoring was carried out as required, that its results were"
     " within limits, and that anything outside limits was acted on.",
 B + "Where a record carries its own verification signature - FRM-903, FRM-913, FRM-902, FRM-401,"
     " FRM-701 - that signature IS the authorization required by 2.5.2.1 and is not repeated"
     " elsewhere.",
 B + "Where an activity has no such record of its own, it is recorded on FRM-008, whose Verified"
     " by signature is a verifier-role signature and carries the authorization.",
 B + "A person shall not verify their own monitoring where a second qualified person is"
     " available. Where one is not, the record shall say so.",
 P + "That last rule is written the way FSQM-004 had to be rewritten. An absolute separation"
     " requirement made a legitimate single-operator run non-compliant, and 11.2.5.7 asks for"
     " QUALIFIED personnel rather than independent ones. A rule the site cannot always follow is"
     " worse than a weaker one it can: the first thing that happens to it is that it is ignored.",
 P + "A verification that leaves no signature is indistinguishable from one that did not happen."
     " That is the whole reason 2.5.2.1 names authorization separately from verification, and it"
     " is why the schedule names a position against every activity rather than leaving it to"
     " whoever is free.",

 # ---- Part 6 (2.5.2.2)
 "One master verification schedule shall list every verification activity, the frequency at which"
 " it is completed, and the position responsible for it. That schedule is FRM-008.",
 B + "It is maintained in the Team Portal under Compliance, where it is the same record the"
     " reminder system reads. Adding, retiring or re-timing an activity is done there.",
 B + "An activity whose governing program has not yet been issued is listed with the status Not"
     " yet implemented and names the deliverable that will bring it into force. It is scheduled;"
     " it is not being performed; and nothing pretends otherwise.",
 B + "Seven activities carry that status at issue: equipment calibration, backflow prevention"
     " testing, potable water analysis, compressed air analysis, CCP monitoring record review,"
     " internal audit, and the traceability and recall test.",
 P + "Listing an activity the site is not yet performing is deliberate and is the harder of the"
     " two options. Omitting them would produce a schedule that looked complete and was not, and"
     " an auditor comparing it against the Code would find the gaps anyway - having also learned"
     " that the schedule does not show them. Stating them is the position that survives being"
     " read carefully.",

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
 "Records are retained as set out in the Records section of this program.",

 # ---- Part 10
 "The SQF Practitioner shall review this program at least annually, and whenever a program it"
 " schedules is issued, amended or withdrawn.",
 P + "The schedule is the part that goes stale, and it goes stale quietly: an activity keeps its"
     " place on the list long after the program that governed it changed. The annual review is"
     " also the occasion on which the Not yet implemented activities are re-examined, because"
     " each of them becomes real the day its deliverable is issued and nothing else will announce"
     " that to this document.",
]

FSQM017 = {
 "purpose":
   "To state the methods, responsibility and criteria by which the site validates that its food"
   " safety controls achieve the results required of them, and verifies that those controls are"
   " being operated; and to hold the master verification schedule listing every verification"
   " activity, its frequency and the position responsible for it. It satisfies the Validation and"
   " Effectiveness and Verification Activities elements of the SQF Food Safety Code: Food"
   " Manufacturing, Edition 9 (2.5.1 and 2.5.2), both of which are Mandatory.",

 "scope":
   "Every element of the SQF System operated at this site, and every activity by which the"
   " effectiveness of those elements is established or confirmed.\n\n"
   "It does not restate the controls it schedules. Good Manufacturing Practices are FSQM-012 and"
   " FSQM-022; sanitation is FRM-901, FRM-902 and FRM-903 with the machine SSOPs beneath them;"
   " temperature monitoring is SOP-401 and FRM-401; retention sampling is FSQM-014; product"
   " release is FSQM-020; dispatch is FSQM-036; corrective action is FSQM-009. This program"
   " supplies the method, the responsibility, the criteria and the schedule.",

 "definitions":
   "Validation: establishing that a control is capable of achieving the result claimed for it."
   " It asks whether the control WOULD work.\n\n"
   "Verification: confirming that a control was operated as required and that its records show"
   " it. It asks whether the control DID work.\n\n"
   "Monitoring: carrying out the control and recording the result at the time. Monitoring is"
   " neither validation nor verification, and it lives in the program that defines the control.\n\n"
   "Verification activity: one scheduled task on FRM-008, with a frequency and a responsible"
   " position.\n\n"
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
   "FRM-008 Master Verification Schedule and Activity Record; FRM-913 GMP / Food Safety"
   " Inspection Record; FRM-903 Daily Sanitation, Pre-Operation & Release Record; FRM-902"
   " Sanitation Verification Log; FRM-901 Master Sanitation Schedule; FRM-401 Temperature"
   " Monitoring Review; FRM-703 Retention Sample Log; FRM-701 Finished Product Release Record;"
   " FRM-801 Dispatch and Vehicle Loading Record; FRM-907 Glass & Brittle Plastic Register;"
   " FRM-007 Corrective & Preventive Action Report; FRM-002 Customer Complaint Report; FRM-001"
   " Management Review Record",

 "records":
   "FRM-008 Master Verification Schedule and Activity Record — the schedule itself, and one entry"
   " per verification activity performed where no other record covers it.\n"
   "The records of the activities this program schedules are held by the programs that define"
   " them, and are listed in Form References above. This program does not duplicate them.\n"
   "Retention: two years, or the shelf life of the product plus twelve months, whichever is"
   " longer, on the same basis as FSQM-009 Part 10.",

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
   " of verification are maintained — Part 6.\n"
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
   "THE SCHEDULE IS A TABLE THE SITE EDITS, and FRM-008 prints it. Section 1 of FRM-008 is"
   " generated from that table rather than hand-maintained, so the document and the machinery"
   " cannot disagree about what the site has undertaken to do. The consequence is that the"
   " printed schedule is a snapshot as at issue while the Verification Schedule page is live: a"
   " change to the schedule requires an FRM-008 revision, and the annual programme review"
   " activity is the occasion that catches it.\n\n"
   "SEVEN ACTIVITIES ARE LISTED AS NOT YET IMPLEMENTED — calibration, backflow testing, water"
   " analysis, compressed air analysis, CCP record review, internal audit, and the traceability"
   " and recall test. Each names the deliverable that will bring it into force. Listing them is"
   " the harder option and the right one: a schedule that omitted them would look complete and"
   " would not be, and an auditor comparing it against the Code would find the gaps anyway,"
   " having also learned that the schedule does not show them.\n\n"
   "OPEN BEFORE ISSUE — four things the site must settle:\n\n"
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
   "3. PART 3 HAS NOTHING TO BITE ON YET. Critical food safety limits are those a food safety plan"
   " establishes, and there is no HACCP plan under document control and no CCPs defined. The Part"
   " states the rule, names the two limits that are real today - the temperature limits in SOP-401"
   " and the sanitizer concentration - and says in terms that neither is a CCP.\n\n"
   "4. WHO APPROVES. This program appoints verification responsibilities across every position"
   " including the SQF Practitioner's own, so it should be approved by Senior Site Management"
   " rather than by the role it assigns work to - the same reasoning FSQM-004 records.",
}

SQL17 = """-- D-18 - FSQM-017 Validation and Verification Program, seeded DRAFT.
--
-- TWO MANDATORY CLAUSES. 2.5.1 Validation and Effectiveness and 2.5.2 Verification Activities are
-- both marked Mandatory in the Code, which is the class of finding that fails an audit outright
-- rather than accruing points. Nothing in the document set cited either before this.
--
-- IT SCHEDULES RATHER THAN RESTATES. Part 1 names every program whose controls it verifies -
-- FSQM-012 and FSQM-022 for GMPs, FRM-901/902/903 for sanitation, SOP-401 and FRM-401 for
-- temperature, FSQM-014, FSQM-020, FSQM-036, FSQM-009 - and defers to each. An umbrella that
-- restates the controls beneath it creates two versions of every rule, and the day they disagree
-- the document set stops being evidence of anything. FSQM-036 Part 7 took the same approach.
--
-- WHAT IT DOES NOT CLAIM. Part 2 states that confirming GMPs achieve their result normally rests
-- on measurement and that this site performs no analysis, so confirmation rests on inspection and
-- record review until the environmental monitoring programme is issued. Part 3 states that the
-- critical limits it governs are those a food safety plan establishes, and that this site has no
-- HACCP plan under document control and no CCPs - so the rule stands but has nothing to bite on
-- yet, and the two limits that ARE real today are named as not being CCPs. Writing either Part as
-- though the site were already there would close a Mandatory clause on evidence that does not
-- exist, which is worse than leaving it visibly open.
--
-- Seeded draft. Issue is a later migration, after the frequencies are confirmed.

begin;

do $$
begin
  if exists (select 1 from public.sop_documents where sop_number = 'FSQM-017') then
    raise exception 'FSQM-017 already exists.';
  end if;
  -- The programme is written around a schedule that must already be there.
  if to_regclass('public.verification_schedule') is null then
    raise exception 'verification_schedule does not exist; apply 20260910000012 first.';
  end if;
end $$;

insert into public.sop_documents
  (sop_number, title, type, category, status, revision, sqf_reference, sqf_required, content)
values (
  'FSQM-017',
  'Validation and Verification Program',
  'fsqm',
  'Food Safety Quality Manual',
  'draft',
  'New',
  '2.5.1.1, 2.5.2.1, 2.5.2.2',
  true,
  __CONTENT__::jsonb
);

do $$
declare r record;
begin
  select
    (select count(*) from public.sop_documents where sop_number = 'FSQM-017')          as n,
    (select jsonb_array_length(content->'procedure') from public.sop_documents
      where sop_number = 'FSQM-017')                                                   as lines,
    (select count(*) from public.sop_documents d,
            jsonb_array_elements_text(d.content->'procedure') l(line)
      where d.sop_number = 'FSQM-017' and l.line like '%authorize each verified record%') as auth_limb,
    (select count(*) from public.sop_documents d,
            jsonb_array_elements_text(d.content->'procedure') l(line)
      where d.sop_number = 'FSQM-017' and l.line like '%Not yet implemented%')          as planned_limb,
    (select count(*) from public.sop_documents d,
            jsonb_array_elements_text(d.content->'procedure') l(line)
      where d.sop_number = 'FSQM-017' and l.line like '%A NOTIFICATION IS A PROMPT, NOT A RECORD%') as prompt_limb,
    (select count(*) from public.sop_documents
      where sop_number = 'FSQM-017' and content->>'revision_history' like '%OPEN BEFORE ISSUE%') as open_items,
    (select status from public.sop_documents where sop_number = 'FSQM-017')            as st,
    (select count(*) from public.sop_documents
      where sop_number = 'FSQM-017' and position(chr(13) in content::text) > 0)        as crs
  into r;

  if r.n <> 1 then raise exception 'FSQM-017 was not inserted.'; end if;
  if r.lines <> __LINES__ then
    raise exception 'FSQM-017 procedure is % lines, expected __LINES__.', r.lines;
  end if;
  -- The limb most programmes drop. 2.5.2.1 names authorization separately from verification, and a
  -- programme that verifies without saying who signs has met half the clause.
  if r.auth_limb < 1 then
    raise exception 'Part 5 does not state the authorize-each-record limb of 2.5.2.1.';
  end if;
  -- The honesty guards: if either of these is ever edited out, the document starts claiming more
  -- than the site does.
  if r.planned_limb < 1 then
    raise exception 'Part 6 does not state that some scheduled activities are not being performed.';
  end if;
  if r.prompt_limb < 1 then
    raise exception 'Part 7 does not state that a notification is not a record.';
  end if;
  if r.open_items <> 1 then
    raise exception 'The open-before-issue items are missing from the revision history.';
  end if;
  if r.st is distinct from 'draft' then
    raise exception 'FSQM-017 should be draft; found %.', r.st;
  end if;
  if r.crs <> 0 then raise exception 'CR characters are present in FSQM-017.'; end if;
end $$;

commit;
"""

SQL17 = (SQL17
         .replace("__CONTENT__", dollar(FSQM017, "j17"))
         .replace("__LINES__", str(len(PROC))))
like_check(SQL17, FSQM017)
io.open(OUT17, "w", encoding="utf-8", newline="\n").write(SQL17)
print("wrote %s  (%d procedure lines)" % (OUT17, len(PROC)))


# ══════════════════════════════════════════════════════════ FRM-008

SCHEDULE_INFO = (
 "SECTION 1 IS THE SCHEDULE AS AT THE EFFECTIVE DATE OF THIS REVISION. It is generated from the "
 "verification schedule the site maintains in the Team Portal, so the two cannot disagree at the "
 "point this document was issued.\n\n"
 "The live schedule is at Compliance → Verification Schedule, and that is where an activity is "
 "added, retired or re-timed. A change there needs a revision of this form; the annual review of "
 "the Validation and Verification Programme is the occasion that catches it.\n\n"
 "Activities marked NOT YET IMPLEMENTED are scheduled but are not being performed — the "
 "programme that governs them has not been issued. They raise no reminders and no entry is "
 "expected against them."
)

RECORD_INFO = (
 "SECTION 2 IS ONE ENTRY PER VERIFICATION ACTIVITY PERFORMED, where no other record already "
 "covers it — for example the annual review of critical food safety limits, or an assessment of "
 "a change.\n\n"
 "WHERE THE ACTIVITY HAS ITS OWN RECORD, USE THAT RECORD AND NOT THIS ONE. The monthly GMP "
 "inspection is FRM-913; sanitation verification is FRM-902; the temperature review is FRM-401; "
 "the retention review is FRM-703. Filling in both would create two accounts of one activity.\n\n"
 "THE VERIFIED BY SIGNATURE IS THE AUTHORIZATION 2.5.2.1 REQUIRES. A verification that leaves no "
 "signature is indistinguishable from one that did not happen."
)

FRM008 = {
 "settings": {
   "deletable": False,
   "attachmentsEnabled": True,
   "allowMultipleDrafts": True,
   "requireVerification": True,
   "instanceTitleTemplate": "{date_performed} — {activity}",
 },
 "sections": [
  {"id": "schedule", "title": "1. The verification schedule", "fields": [
    {"id": "schedule_info", "type": "info", "label": "About this schedule", "text": SCHEDULE_INFO},
    {"id": "schedule_ref", "type": "reference_table",
     "label": "Master verification schedule",
     "help": "Every verification activity, its frequency and the position responsible (SQF 2.5.2.2).",
     "columns": ["Activity", "Frequency", "Responsible", "Record", "Status"],
     "rows": []},
  ]},
  {"id": "activity", "title": "2. Verification activity record", "fields": [
    {"id": "record_info", "type": "info", "label": "When to use this section", "text": RECORD_INFO},
    {"id": "activity", "type": "select", "label": "Activity", "width": "half",
     "required": True, "showInList": True,
     "help": "As named on the schedule above.",
     "options": []},
    {"id": "date_performed", "type": "date", "label": "Date performed", "width": "half",
     "required": True, "defaultToday": True, "showInList": True},
    {"id": "frequency_as_scheduled", "type": "text", "label": "Frequency as scheduled",
     "width": "half", "help": "Copy from the schedule above, so the record shows what was expected."},
    {"id": "period_covered", "type": "text", "label": "Period covered", "width": "half",
     "help": "For example September 2026, or week ending 2026-09-07."},
    {"id": "what_was_reviewed", "type": "textarea", "required": True,
     "label": "What was examined, and against what criteria",
     "help": "Records, areas, equipment or limits looked at, and what a satisfactory result would be."},
    {"id": "result", "type": "pass_fail", "label": "Result", "width": "half", "required": True,
     "help": "Fail means the control was not effective or was not carried out. Finding one is a success for the verification."},
    {"id": "findings", "type": "textarea", "label": "Findings",
     "help": "What was found. Record 'none' rather than leaving it blank."},
    {"id": "nonconformity_raised", "type": "select", "width": "half",
     "label": "Corrective action raised under FSQM-009?",
     "options": ["No - nothing found", "Yes - CAPA raised", "No - corrected on the spot"]},
    {"id": "capa_ref", "type": "text", "label": "FRM-007 reference", "width": "half",
     "help": "The CAPA number, where one was raised."},
    {"id": "performed_by", "type": "signature", "role": "filler", "width": "half",
     "label": "Performed by", "required": True,
     "statement": "I carried out this verification activity as recorded above."},
    {"id": "verified_by", "type": "signature", "role": "verifier", "width": "half",
     "label": "Verified by",
     "statement": "I have reviewed this record and authorize it."},
  ]},
 ],
}

# The frequency label has to be readable on paper, so it is spelled out here rather than printed as
# unit+count. This mirrors frequencyLabel() in _shared/verificationSchedule.ts; the two are only
# ever both wrong in a way a reader would spot immediately.
FREQ_SQL = """case when frequency_count = 1 then
         case frequency_unit
           when 'day' then 'Daily' when 'week' then 'Weekly' when 'month' then 'Monthly'
           when 'quarter' then 'Quarterly' when 'year' then 'Annually' end
       else 'Every ' || frequency_count || ' ' || frequency_unit || 's' end"""

SQL08 = """-- D-18 - FRM-008 Master Verification Schedule and Activity Record, seeded DRAFT.
--
-- SECTION 1 IS GENERATED FROM verification_schedule, NOT HARDCODED. The table is already the source
-- of truth - the twice-daily job reads it, and the Verification Schedule page renders it - so
-- printing a second hand-maintained copy into the form would create two things that can disagree
-- about what the site has undertaken to do, which is the whole failure this deliverable exists to
-- prevent. Building the printed table from a query means they cannot disagree at issue.
--
-- THE CONSEQUENCE IS STATED ON THE DOCUMENT rather than left for someone to discover: the printed
-- schedule is a snapshot as at this revision, the portal page is live, and a change to the schedule
-- needs a revision of this form. The annual programme review activity is the occasion that catches
-- it. That is ordinary document control, but only if it is written down.
--
-- SECTION 2 IS FOR ACTIVITIES WITH NO RECORD OF THEIR OWN - the annual limits review, a change
-- assessment. Where an activity already has a record, that record is used: filling in both would
-- create two accounts of one activity, and the info block says so in terms.
--
-- THE VERIFIED BY SIGNATURE IS A VERIFIER-ROLE SIGNATURE, which SignatureFieldInput restricts to
-- admin and owner. That is the mechanism by which this form discharges 2.5.2.1's requirement that
-- the person responsible for verifying monitoring AUTHORIZES each verified record - the limb most
-- programmes drop, because verification and its authorization read like the same thing until you
-- ask who signed.

begin;

do $$
declare n_sched int;
begin
  if exists (select 1 from public.sop_documents where sop_number = 'FRM-008') then
    raise exception 'FRM-008 already exists.';
  end if;
  if to_regclass('public.verification_schedule') is null then
    raise exception 'verification_schedule does not exist; apply 20260910000012 first.';
  end if;
  select count(*) into n_sched from public.verification_schedule where status <> 'retired';
  if n_sched = 0 then
    raise exception 'the verification schedule is empty; FRM-008 would print a blank table.';
  end if;
end $$;

insert into public.sop_documents
  (sop_number, title, type, category, status, revision, sqf_reference, sqf_required, content)
values (
  'FRM-008',
  'Master Verification Schedule and Activity Record',
  'form',
  'Module 2',
  'draft',
  'New',
  '2.5.1.1, 2.5.2.1, 2.5.2.2',
  true,
  jsonb_build_object('form_schema', __SCHEMA__::jsonb)
);

-- Print the schedule, and offer the same activities as the record's options. Both from the table,
-- ordered the way the portal orders them, so the paper and the screen read alike.
with sched as (
  select
    jsonb_agg(jsonb_build_array(
      activity,
      __FREQ__,
      responsible_position,
      case when evidence_kind = 'none' then '—'
           else coalesce(evidence_document_number, 'FRM-008') end,
      case status
        when 'active'  then 'In force'
        when 'planned' then 'NOT YET IMPLEMENTED — awaiting ' || pending_deliverable
        else status end
    ) order by sort_order) as rows,
    jsonb_agg(activity order by sort_order) filter (where status = 'active') as options
  from public.verification_schedule
  where status <> 'retired'
)
update public.sop_documents d
   set content = jsonb_set(
                   jsonb_set(d.content, '{form_schema,sections,0,fields,1,rows}', sched.rows),
                   '{form_schema,sections,1,fields,1,options}', sched.options)
  from sched
 where d.sop_number = 'FRM-008';

do $$
declare r record;
begin
  select
    (select count(*) from public.verification_schedule where status <> 'retired')        as n_sched,
    (select count(*) from public.verification_schedule where status = 'active')          as n_active,
    (select jsonb_array_length(content->'form_schema'->'sections'->0->'fields'->1->'rows')
       from public.sop_documents where sop_number = 'FRM-008')                           as n_printed,
    (select jsonb_array_length(content->'form_schema'->'sections'->1->'fields'->1->'options')
       from public.sop_documents where sop_number = 'FRM-008')                           as n_options,
    (select count(*) from public.sop_documents d,
            jsonb_array_elements(d.content->'form_schema'->'sections') s,
            jsonb_array_elements(s->'fields') f
      where d.sop_number = 'FRM-008')                                                    as fields,
    (select count(*) from public.sop_documents d,
            jsonb_array_elements(d.content->'form_schema'->'sections') s,
            jsonb_array_elements(s->'fields') f
      where d.sop_number = 'FRM-008' and f->>'type' = 'signature' and f->>'role' = 'verifier') as verifier,
    (select count(*) from public.sop_documents d,
            jsonb_array_elements(d.content->'form_schema'->'sections'->0->'fields'->1->'rows') rw
      where d.sop_number = 'FRM-008' and rw->>4 like 'NOT YET IMPLEMENTED%')              as printed_planned,
    (select status from public.sop_documents where sop_number = 'FRM-008')               as st,
    (select count(*) from public.sop_documents
      where sop_number = 'FRM-008' and position(chr(13) in content::text) > 0)           as crs
  into r;

  -- The document and the machinery must print the same schedule. This is the guard the whole
  -- generate-from-the-table approach exists to make possible.
  if r.n_printed is null or r.n_printed <> r.n_sched then
    raise exception 'FRM-008 prints % activities but the schedule holds %.', r.n_printed, r.n_sched;
  end if;
  if r.n_options is null or r.n_options <> r.n_active then
    raise exception 'FRM-008 offers % activities to record against but % are in force.',
      r.n_options, r.n_active;
  end if;
  -- A planned activity that printed as though it were in force would be the document claiming a
  -- control the site does not operate.
  if r.printed_planned <> r.n_sched - r.n_active then
    raise exception '% rows print as not-yet-implemented, expected %.',
      r.printed_planned, r.n_sched - r.n_active;
  end if;
  if r.fields <> __FIELDS__ then
    raise exception 'FRM-008 has % fields, expected __FIELDS__.', r.fields;
  end if;
  -- 2.5.2.1's authorization limb depends on this one field being a verifier-role signature.
  if r.verifier <> 1 then
    raise exception 'FRM-008 has % verifier signatures, expected 1.', r.verifier;
  end if;
  if r.st is distinct from 'draft' then
    raise exception 'FRM-008 should be draft; found %.', r.st;
  end if;
  if r.crs <> 0 then raise exception 'CR characters are present in FRM-008.'; end if;
end $$;

commit;
"""

n_fields = sum(len(s["fields"]) for s in FRM008["sections"])
SQL08 = (SQL08
         .replace("__SCHEMA__", dollar(FRM008, "j08"))
         .replace("__FREQ__", FREQ_SQL)
         .replace("__FIELDS__", str(n_fields)))
io.open(OUT08, "w", encoding="utf-8", newline="\n").write(SQL08)
print("wrote %s  (%d fields)" % (OUT08, n_fields))

# The schema JSON is kept beside the other drafts so generate-form-blank.py can render it once
# the printed rows have been filled in from production.
io.open("sop-drafts/FRM-008-verification-schedule-schema.json", "w",
        encoding="utf-8", newline="\n").write(json.dumps(FRM008, indent=2, ensure_ascii=False) + "\n")
print("wrote sop-drafts/FRM-008-verification-schedule-schema.json")
