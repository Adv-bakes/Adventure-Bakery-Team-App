-- SOP-2.9 — fix the record it points at, and add the competencies 2.9.2.1 asks for.
--
-- Three defects, all under clauses the gap assessment scored COMPLIANT (2.9.1.1, 2.9.1.2, 2.9.2.1).
-- See sop-drafts/compliant-rows-review.md.
--
-- 1. IT NAMES THE WRONG FORM. "FRM001 — Training Sign-In Sheet" appears four times. FRM-001 is the
--    MANAGEMENT REVIEW RECORD. The sign-in sheet is FRM-953. An auditor who pulls the form this SOP
--    names gets a management review minutes template, which reads as a system nobody follows. Same
--    family of defect as SOP-204 pointing at FRM-204.
--
-- 2. IT NAMES A RECORD WITHOUT A NUMBER. "Training Matrix" appears twice, unnumbered. FRM-951 is the
--    Training Matrix and is active — it just was not cited. FRM-952 Training Competency Verification
--    Record is also active and was not cited at all, though 2.9.2.3 wants competency verification
--    captured. Both are now named.
--
-- 3. IT HAS NONE OF 2.9.2.1'S EIGHT COMPETENCY AREAS. The clause requires the program to outline the
--    necessary competencies for specific duties, listing eight areas (i–viii). The SOP had four
--    generic sentences about new hires and refreshers. The consultant's own evidence conceded it
--    "meets this requirement at a high level overall" and scored it Compliant anyway. A high-level
--    statement is exactly what 2.9.2.1 is written to exclude.
--
-- The procedure array is replaced whole rather than patched step by step: steps are renumbered (the
-- number is baked into each string), and a sequence of independent replacements that half-applies
-- would leave the list misnumbered with no way to tell from the result.
--
-- WHAT THIS DELIBERATELY DOES NOT DO. It does not populate FRM-951. Listing which positions need
-- which competency is the site's decision about its own roles, and D-01 (job descriptions) has not
-- landed — writing a matrix now would guess at positions that are about to be defined. The SOP now
-- says the matrix carries that mapping, which is what makes the requirement auditable; filling it in
-- stays with D-24/D-01.
--
-- SOP-2.9 is active: v1 -> v2, effective 2026-08-27, approved GJM (unchanged), in one statement so
-- the history snapshot captures a coherent v1. governing_reference and revision_history were both
-- empty and are filled in — an active controlled document with no revision history is its own
-- finding under 2.2.2.1.

begin;

update public.sop_documents
set content = jsonb_set(jsonb_set(jsonb_set(jsonb_set(jsonb_set(content,
      '{procedure}', $p$[
"1. New hires receive food safety, GMP, and job-specific training before starting work.",
"2. Annual refresher training is conducted for all employees. Refresher needs are identified when the Training Matrix (FRM-951) is reviewed each year, and are assigned in the Adventure Bakery Team App.",
"3. Specialized training (e.g., allergens, sanitation, recall) occurs as required.",
"4. Assigned training is delivered and completed electronically through the Adventure Bakery Team App. Each employee, contractor, and temporary staff member completes their assigned training while logged in under their individual username; the system records the participant’s identity, the module completed, the completion date, and the quiz/competency result. A separate sign-in sheet is not required for app-based training.",
"5. Instructor-led or on-the-floor training that is not delivered in the app is documented on FRM-953 — Training Sign-In Sheet (topic, date, trainer, and attendee signatures).",
"6. The program covers at minimum the competencies below. FRM-951 — Training Matrix records which positions require each one and tracks completion; FRM-952 — Training Competency Verification Record captures the verification that competency was actually achieved, which is a separate question from attendance.\ni. HACCP principles — for staff who develop and maintain the food safety plans.\nii. Monitoring and corrective action at critical control points — for every person who monitors a CCP and for their named backup.\niii. Personal hygiene — for all staff who handle food or food-contact surfaces, including contractors and temporary staff.\niv. Good Manufacturing Practices and work instructions — for all staff engaged in food handling, processing, and equipment. Each machine’s operating and sanitation SOP is the work instruction for that station.\nv. Sampling and test methods — for staff who sample or test raw materials, packaging, work-in-progress, or finished product.\nvi. Environmental monitoring — for staff who take environmental samples.\nvii. Allergen management, food defense, and food fraud — for all relevant staff.\nviii. Any task identified as critical to the effective implementation and maintenance of the SQF System, as listed in the Training Matrix.",
"7. Training records are retained for a minimum of two (2) years."
]$p$::jsonb),
      '{records}', to_jsonb($r$• Electronic training records in the Adventure Bakery Team App (participant, module, completion date, and competency result)
• FRM-951 — Training Matrix (which positions require which training, and completion status)
• FRM-952 — Training Competency Verification Record (verification that competency was achieved)
• FRM-953 — Training Sign-In Sheet (instructor-led / on-the-floor training)$r$::text)),
      '{responsibility}', to_jsonb($s$• SQF Practitioner: oversees training content and frequency.
• Supervisors: ensure employees and contractors complete their assigned training, and verify competency on FRM-952 for the tasks they supervise.
• QA Admin: monitors training completion, maintains the Training Matrix (FRM-951), and files any FRM-953 sign-in sheets from instructor-led sessions.$s$::text)),
      '{form_references}', to_jsonb($f$FRM-951 — Training Matrix · FRM-952 — Training Competency Verification Record · FRM-953 — Training Sign-In Sheet$f$::text)),
      '{governing_reference}', to_jsonb($g$SQF Food Safety Code: Food Manufacturing, Edition 9 — 2.9.1.1 (responsibility for training needs defined and documented), 2.9.1.2 (training provided for tasks essential to the SQF System), 2.9.2.1 (documented training program covering the eight competency areas, plus refresher needs), 2.9.2.2 (materials and delivery in languages understood by staff), 2.9.2.3 (training records)
FDA 21 CFR Part 117.4 — Qualifications of individuals who manufacture, process, pack, or hold food$g$::text)),
    revision = 'v2',
    effective_date = date '2026-08-27'
where sop_number = 'SOP-2.9'
  and (revision is distinct from 'v2'
    -- revision_history is excluded from both FRM001 checks: it QUOTES the old wrong number on
    -- purpose ("the SOP named FRM001 in four places"), which is the point of a revision history.
    -- Matching on the whole document would make this guard permanently true and the assertion
    -- below permanently fail.
    or (content - 'revision_history')::text like '%FRM001%'
    or content->>'form_references' not like '%FRM-953%');

-- revision_history is set separately: it is a plain text field, and folding a multi-line literal
-- into the chain above only makes that statement harder to read.
update public.sop_documents
set content = jsonb_set(content, '{revision_history}', to_jsonb($h$v2 — 2026-08-27 — Corrected the record references and added the competency areas required by 2.9.2.1, approved GJM. The SOP named "FRM001 — Training Sign-In Sheet" in four places; FRM-001 is the Management Review Record and the sign-in sheet is FRM-953. The Training Matrix was referenced twice without a number and is FRM-951; FRM-952 Training Competency Verification Record was not referenced at all. None of 2.9.2.1's eight competency areas appeared in the document. Found during the review of clauses the gap assessment had scored Compliant.

v1 — 2025-04-28 — Initial issue, approved GJM.

Open: FRM-951 Training Matrix still has to be filled in with the position-to-competency mapping. That depends on D-01 (job descriptions), since the positions it maps are the ones D-01 defines.$h$::text))
where sop_number = 'SOP-2.9'
  and coalesce(content->>'revision_history', '') not like '%v2 — 2026-08-27%';

do $$
declare
  bad text;
begin
  select string_agg(x, '; ') into bad from (
    select 'still references FRM001' as x from public.sop_documents
      where sop_number = 'SOP-2.9' and (content - 'revision_history')::text like '%FRM001%'
    union all
    -- the three forms it should name, each of which exists and is active
    select 'does not name ' || f from public.sop_documents,
           unnest(array['FRM-951', 'FRM-952', 'FRM-953']) f
      where sop_number = 'SOP-2.9' and content::text not like '%' || f || '%'
    union all
    -- each roman numeral must start its own line. Without the newline anchor '%i. %' also matches
    -- inside 'viii. ', so a missing (i) would go undetected whenever (viii) was present.
    select 'competency area ' || n || ' missing' from public.sop_documents,
           unnest(array['i.', 'ii.', 'iii.', 'iv.', 'v.', 'vi.', 'vii.', 'viii.']) n
      where sop_number = 'SOP-2.9'
        and (content #>> '{procedure,5}') not like '%' || chr(10) || n || ' %'
    union all
    select 'procedure is not 7 steps' from public.sop_documents
      where sop_number = 'SOP-2.9' and jsonb_array_length(content -> 'procedure') <> 7
    union all
    -- the app-based delivery paragraph is the substance of 2.9.2.3 and must survive the rewrite
    select 'lost the app delivery step' from public.sop_documents
      where sop_number = 'SOP-2.9'
        and (content #>> '{procedure,3}') not like '%individual username%'
    union all
    select 'lost the retention step' from public.sop_documents
      where sop_number = 'SOP-2.9'
        and (content #>> '{procedure,6}') not like '%two (2) years%'
    union all
    select 'governing_reference still empty' from public.sop_documents
      where sop_number = 'SOP-2.9' and coalesce(content->>'governing_reference', '') = ''
    union all
    select 'revision_history still empty' from public.sop_documents
      where sop_number = 'SOP-2.9' and coalesce(content->>'revision_history', '') = ''
    union all
    select 'revision not v2' from public.sop_documents
      where sop_number = 'SOP-2.9' and revision is distinct from 'v2'
    union all
    select 'effective date not 2026-08-27' from public.sop_documents
      where sop_number = 'SOP-2.9' and effective_date is distinct from date '2026-08-27'
  ) t;

  if bad is not null then
    raise exception 'SOP-2.9 correction did not apply cleanly: %', bad;
  end if;
end $$;

commit;
