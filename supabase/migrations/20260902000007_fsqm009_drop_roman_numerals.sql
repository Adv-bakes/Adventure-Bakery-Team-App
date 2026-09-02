-- FSQM-009: drop the roman numerals from the Part 3 and Part 8 lists. D-07, follow-up.
--
-- 20260902000006 gave each point its own line and kept the (i)...(x) numerals from the version
-- that had been one run-on paragraph. On the page that reads as two list markers doing one job:
-- every line already carries a bullet, and the numeral in front of it adds nothing but noise.
--
-- THE NUMERALS GO RATHER THAN THE BULLETS, because the bullets are not optional.
-- groupProcedureSteps() has exactly two levels - a plain line starts a new numbered Part, and a
-- line beginning with a bullet marker is a sub-bullet of the Part above it. A list item written
-- without the marker would not render unnumbered; it would become PART 11. Keeping the numerals
-- and dropping the bullets is therefore not a formatting choice available here, it is a change to
-- the parser, the on-screen renderer and the PDF exporter.
--
-- NOTHING CITES THEM. Every string in FSQM-009, FRM-007 and REP-007 was searched for a reference
-- to a numbered point inside a Part: zero hits. The documents cite whole Parts ("FSQM-009 Part 3",
-- "Part 10"), never an item within one. The single exception is a code comment in the already
-- applied 20260902000005, which reads "FSQM-009 Part 3 (vi)"; applied migrations are history and
-- are not edited, and the sixth trigger is still the sixth bullet, so that comment still points at
-- the right rule.
--
-- THE LIST IS STILL BOUNDED WITHOUT THEM. The lead-in bullet is bold and ends with a colon, and
-- the two bullets that follow the list open with bold text of their own ("A routine
-- non-conformance...", "When in doubt, open one."), so where the list stops is still legible.
--
-- Formatting only: 79 lines before and after, 10 Parts before and after, and not one word of the
-- requirements changes. Sixteen line-leading numerals are removed - ten triggers in Part 3, six
-- closure criteria in Part 8.
--
-- NO REVISION BUMP. FSQM-009 is still `draft` and has never been issued; a bump would invent an
-- approval history that did not happen. The guard fails loudly if it has been activated since.
--
-- Only content->'procedure' is written, and the DO block hashes everything except procedure before
-- and after, so the OPEN BEFORE ACTIVATION list and every other section are provably untouched.

begin;

do $$
declare
  r record;
begin
  select status, revision,
         jsonb_array_length(content->'procedure')                                     as lines,
         (select count(*) from jsonb_array_elements_text(content->'procedure') s
           where s like '• (%) %')                                           as numbered
    into r
    from public.sop_documents where sop_number = 'FSQM-009';

  if r is null then
    raise exception 'FSQM-009 does not exist.';
  end if;
  if r.status <> 'draft' then
    raise exception 'FSQM-009 is % - it has been issued, so a content change needs a revision bump. Stop and re-derive.',
      r.status;
  end if;
  if r.revision <> 'New' then
    raise exception 'FSQM-009 is at revision %, expected New.', r.revision;
  end if;
  if r.lines <> 79 then
    raise exception 'FSQM-009 has % procedure lines, expected the 79 left by 20260902000006.', r.lines;
  end if;
  if r.numbered <> 16 then
    raise exception 'FSQM-009 has % numeral-led lines, expected the 16 written by 20260902000006.',
      r.numbered;
  end if;
end $$;

do $$
declare
  before_hash text;
  after_hash  text;
  r           record;
begin
  select md5((content - 'procedure')::text) into before_hash
    from public.sop_documents where sop_number = 'FSQM-009';

  update public.sop_documents
     set content = jsonb_set(content, '{procedure}', $jproc$
[
  "PART 1 — WHAT RAISES A CORRECTIVE ACTION (SQF 2.5.3.1)",
  "• 2.5.3.1 names the sources a corrective and preventive action process shall serve: customer complaints, nonconformances raised at internal or external audits and inspections, non-conforming product and equipment, and withdrawals and recalls. This program serves all of them and the site's own additions, through one record.",
  "• **Customer and consumer complaints** — handled under SOP-2.1.3 and recorded on FRM-002. A complaint meeting Part 3 also opens a CAPA.",
  "• **Supplier non-conformances** — raised on FRM-205 (SCAR). The SCAR is the supplier's response; the CAPA is this site's own investigation of how the material reached the floor.",
  "• **Non-conforming raw material, packaging, work-in-progress or finished product** — held and tagged on FRM-702.",
  "• **Non-conforming equipment** — identified, tagged or segregated for repair or disposal, with the handling, corrective action and disposal recorded (11.1.7.9).",
  "• **Non-compliance with a critical food safety limit**, and any deviation at a CCP.",
  "• **Findings from internal audits**, and from external audits, certification body audits and regulatory inspections (2.5.4.1 iii, 2.5.4.4).",
  "• **Findings from GMP and pre-operational inspections** — the monthly site inspection on FRM-913 under FSQM-022, and the daily pre-operational check on FRM-903 (2.5.4.3 i).",
  "• **Environmental monitoring results** — a presumptive positive, an unsatisfactory result, or an adverse trend (2.4.8.3).",
  "• **Glass or brittle plastic breakage** — reported on FRM-908 under SOP-11.7.3.",
  "• **Withdrawals and recalls**, actual or from a recall test, and the root cause investigation into them (2.6.3.3).",
  "PART 2 — CORRECTION, CORRECTIVE ACTION AND PREVENTIVE ACTION ARE THREE DIFFERENT THINGS (SQF 2.5.3.1)",
  "• **Correction** is what is done to fix the thing observed — the pallet is removed, the surface is re-cleaned, the batch is held.",
  "• **Corrective action** is what is done so it does not happen again. It is written against the root cause of this non-conformance, not against the symptom.",
  "• **Preventive action** is what is done so the same cause cannot produce a non-conformance somewhere it has not yet occurred.",
  "• **The three are recorded separately on FRM-007.** A single “action taken” box conflates them, and that conflation is why findings repeat: the instance gets fixed and the cause does not.",
  "• A finding that recurs is telling you the correction was never followed by a corrective action. Repeats are flagged as repeats on FRM-007 and reviewed under Part 9.",
  "PART 3 — WHEN A CAPA IS OPENED (SQF 2.1.3.3, 2.5.3.1)",
  "• 2.1.3.3 requires corrective and preventive action to be implemented **based on the seriousness of the incident and the root cause analysis**. Escalation is therefore risk-based. Not every non-conformance becomes a CAPA; the ones below always do.",
  "• **A CAPA shall be opened for any of the following:**",
  "• Any non-conformance affecting product that has already been released, or that requires product to be held, reworked, downgraded or destroyed.",
  "• Any non-compliance with a critical food safety limit, or any deviation at a CCP.",
  "• Any complaint classified critical, and any complaint alleging illness, injury, foreign material or an undeclared allergen.",
  "• Any **repeat** — the same or substantially the same non-conformance within twelve months.",
  "• Any finding from an internal or external audit, a certification body audit, or a regulatory inspection.",
  "• Any finding at a GMP or pre-operational inspection that is not corrected on the spot, or that the person who found it cannot correct.",
  "• Any withdrawal or recall, actual or from a test.",
  "• Any presumptive-positive or adverse trend in environmental monitoring.",
  "• Any glass or brittle plastic breakage where product or a food-contact surface was exposed.",
  "• Anything the SQF Practitioner judges to warrant one.",
  "• **A routine non-conformance corrected on the spot, and not caught by the list above, is recorded on the form that found it and does not open a CAPA.** That record still states what was seen and what was done — a same-day fix is still a finding, and an inspection record showing only unresolved items misrepresents how the site runs.",
  "• **When in doubt, open one.** An unnecessary CAPA costs an hour. A missed one costs a repeat finding, discovered by an auditor rather than by this site.",
  "PART 4 — RAISING A CAPA, AND CONTAINMENT FIRST (SQF 2.5.3.1)",
  "• Any employee may raise a non-conformance and shall report it immediately to a supervisor or to the SQF Practitioner.",
  "• **Containment comes before investigation.** Before anything is analysed: make the product safe. Hold and tag affected material on FRM-702, stop the process where it is still running, isolate the area or the equipment, and determine whether product already released is affected. **If released product may be affected, the recall and withdrawal procedure is invoked immediately — it does not wait for the investigation to finish.**",
  "• The SQF Practitioner opens FRM-007 and assigns the number **CAPA-YYYY-NNN** — the calendar year and the next sequential number within that year, beginning at CAPA-2026-001. Numbers are never reused, and a CAPA that is later found to be unnecessary is closed with that reason rather than deleted.",
  "• **The number is written back onto the record that raised it** — the CAPA Ref field on FRM-002, the CAR Ref field on FRM-908, the CAPA No. column on FRM-913, and the equivalent reference on FRM-205 and FRM-702. That cross-reference is what lets an auditor trace in either direction: from a complaint to its investigation, or from the register back to what raised it.",
  "• What was contained, by whom and when is recorded on FRM-007 before the investigation begins.",
  "PART 5 — INVESTIGATION AND ROOT CAUSE (SQF 2.5.3.1, 2.1.3.2)",
  "• **Every CAPA has a documented root cause.** “Operator error” and “training issue” are not root causes. If an operator made an error, the question is why the process allowed that error to reach product undetected.",
  "• **The default method is Five Whys**, recorded on FRM-007 so the reasoning is visible and not just the conclusion. Where five whys is not adequate — a recurring failure, or one with several contributing causes — a cause-and-effect (fishbone) analysis is used and attached to the entry.",
  "• The investigation is carried out by a person **knowledgeable about the incident** (2.1.3.2) and, where practical, not the person whose work is under examination.",
  "• The investigation establishes: what happened; when it started; how much product and which lots are affected; why the control failed; and **why it was not detected sooner**. The last is a separate question from the first, and it is usually where the real corrective action lies — a control that failed and was caught is a different problem from one that failed and was not.",
  "PART 6 — CORRECTIVE AND PREVENTIVE ACTION (SQF 2.5.3.1, 2.5.4.4)",
  "• Actions are written against the root cause established in Part 5.",
  "• **Every action carries a named owner and a due date. An action without an owner and a date is not an action.** Both are recorded on FRM-007 when the action is agreed, not afterwards.",
  "• **Preventive action asks where else the same cause could bite** — another line, another product, another shift, another supplier, another piece of equipment with the same failure mode. Where the answer is nowhere, that is recorded as the answer.",
  "• Where an action changes a procedure, program, specification or form, the change is made under document control and the CAPA records the document and the revision it moved to.",
  "• Where an action requires training, the module is assigned in the Team Portal and the CAPA records the module and the people trained.",
  "• **Where a change arising from an internal audit affects the site's ability to deliver safe food, the applicable aspects of the SQF System are reviewed** (2.5.4.4, referring to 2.3.1.3), and that review is recorded on the CAPA.",
  "PART 7 — VERIFICATION OF EFFECTIVENESS (SQF 2.5.3.1)",
  "• 2.5.3.1 requires corrective and preventive actions to be determined, implemented **and verified**. Completing an action is not verification. **A CAPA is not closed because the work was done; it is closed because someone checked that it worked.**",
  "• **The verification method and date are set when the action is agreed, not after it is finished.** An action agreed without a verification plan will be closed on the day it is completed, which is the failure this Part exists to prevent.",
  "• The method is chosen to actually test the cause. Re-inspect the item at the next GMP inspection; review the next stated number of records or batches; re-test; re-audit the clause; watch the complaint category over the next quarter. **The verification date is at least one full cycle of whatever failed** — verifying a monthly check after one week proves nothing.",
  "• Verification is performed and signed by the SQF Practitioner or by a person independent of the action owner.",
  "• **If verification shows the action was not effective, the CAPA is not closed.** It is reopened: either the root cause was wrong or the action was insufficient, and the investigation resumes from Part 5. The failed verification stays on the record.",
  "PART 8 — CLOSURE (SQF 2.5.3.1)",
  "• A CAPA closes only when **all** of the following are true:",
  "• The correction is done and recorded.",
  "• The root cause is documented.",
  "• Every corrective and preventive action is complete.",
  "• Effectiveness has been verified and signed.",
  "• Any affected document, program or record has been updated.",
  "• The disposition of any affected product is resolved.",
  "• Closure is signed and dated by the SQF Practitioner on FRM-007.",
  "• **Open and overdue CAPAs are reviewed at least monthly** against REP-007. An overdue action is followed up with its owner and a revised date is recorded with the reason — a due date that silently moves is not a controlled record.",
  "PART 9 — TRENDING AND MANAGEMENT REVIEW (SQF 2.1.2.1 iv, 2.1.3.2, 2.4.8.3)",
  "• **REP-007 (CAPA Log) is the register** — every CAPA with its source, severity, root cause, owner, due date and status, projected live from the FRM-007 entries. It is the answer to “show me your open corrective actions”.",
  "• The SQF Practitioner reviews the register at least monthly for overdue actions, repeats, and sources that keep recurring.",
  "• **CAPA performance is a standing item at management review** (2.1.2.1 iv) and is minuted on FRM-001: the number opened and closed in the period, the breakdown by source, what is overdue, and what has repeated.",
  "• **Adverse trends in complaint data are investigated and their root cause established by personnel knowledgeable about the incidents** (2.1.3.2), even where no single complaint met the Part 3 threshold. Where the trend itself is the non-conformance, a CAPA is opened against the trend.",
  "• Where environmental monitoring results or trends are unsatisfactory, preventive action is implemented through this program (2.4.8.3).",
  "PART 10 — RECORDS AND RETENTION (SQF 2.5.3.2, 2.5.4.4, 2.6.3.3)",
  "• **Records of all investigation, root cause analysis and resolution of non-conformities, their corrections, and the implementation of preventive actions are maintained** on FRM-007 and in the REP-007 register (2.5.3.2).",
  "• Records of internal audits and inspections, and of any corrective and preventive action taken as a result of them, are recorded through this program (2.5.4.4).",
  "• Records of withdrawal and recall tests, of the root cause investigation into any actual withdrawal or recall, and of the corrective and preventive actions applied, are recorded through this program (2.6.3.3).",
  "• Supporting evidence — photographs, laboratory reports, supplier correspondence, updated documents, training records — is attached to the FRM-007 entry, so the investigation and its evidence are one record rather than two.",
  "• **Retention: a minimum of two years, or the shelf life of the affected product plus twelve months, whichever is longer.** A CAPA relating to a withdrawal or recall is retained permanently."
]
$jproc$::jsonb)
   where sop_number = 'FSQM-009' and status = 'draft';

  select md5((content - 'procedure')::text) into after_hash
    from public.sop_documents where sop_number = 'FSQM-009';

  if before_hash is distinct from after_hash then
    raise exception 'Something other than procedure[] changed on FSQM-009. Rolled back.';
  end if;

  select jsonb_array_length(content->'procedure')                                     as lines,
         (select count(*) from jsonb_array_elements_text(content->'procedure') s
           where s not like '• %')                                           as parts,
         (select count(*) from jsonb_array_elements_text(content->'procedure') s
           where s like '• (%) %')                                           as numbered,
         (select max(length(s)) from jsonb_array_elements_text(content->'procedure') s) as longest,
         -- the rule must survive the reformat: first trigger, last trigger, last closure criterion
         (content->'procedure')::text like '%Any non-conformance affecting product that has already been released%'
                                                                                      as first_trigger,
         (content->'procedure')::text like '%Anything the SQF Practitioner judges to warrant one%'
                                                                                      as last_trigger,
         (content->'procedure')::text like '%The disposition of any affected product is resolved%'
                                                                                      as last_closure,
         (content->'procedure')::text like '%A CAPA shall be opened for any of the following:%'
                                                                                      as lead_in,
         (content->'procedure')::text like '%When in doubt, open one%'                as in_doubt
    into r
    from public.sop_documents where sop_number = 'FSQM-009';

  -- formatting only: the shape must be exactly what it was, minus the numerals
  if r.lines <> 79 or r.parts <> 10 then
    raise exception 'FSQM-009 body wrong shape: % lines, % Parts (expected 79 / 10).',
      r.lines, r.parts;
  end if;
  if r.numbered <> 0 then
    raise exception '% line(s) still lead with a roman numeral.', r.numbered;
  end if;
  if r.longest > 700 then
    raise exception 'The longest procedure line is % characters - a run-on has reappeared.', r.longest;
  end if;
  if not (r.first_trigger and r.last_trigger and r.last_closure and r.lead_in and r.in_doubt) then
    raise exception 'Content was lost in the reformat: first trigger=%, tenth trigger=%, sixth closure criterion=%, lead-in=%, "when in doubt"=%.',
      r.first_trigger, r.last_trigger, r.last_closure, r.lead_in, r.in_doubt;
  end if;
end $$;

commit;
