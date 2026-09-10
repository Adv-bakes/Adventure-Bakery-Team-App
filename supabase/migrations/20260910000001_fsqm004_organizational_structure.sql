-- FSQM-004 Organizational Structure and Responsibilities. Seeded DRAFT.
-- Closes D-01 (SQF Food Safety Code: Food Manufacturing, Edition 9 - 2.1.1.3).
--
-- BY POSITION, NEVER BY PERSON. 2.1.1.3 asks for personnel to be identified by the
-- responsibilities they carry within the food safety management system. A document naming
-- individuals has to be reissued every time somebody changes, and this site has three people
-- holding eight posts, so it would be reissued often. The working draft in sop-drafts/ shows the
-- holders so the coverage argument can be checked; this document does not.
--
-- THE CLAUSE MAPPING IN THE REMEDIATION PLAN IS WRONG, and it is worth recording. The workbook
-- maps D-01 to "2.1.1.3, .4" and D-02 to "2.1.1.5". In this edition 2.1.1.4 is "designate a primary
-- and substitute SQF practitioner" and 2.1.1.5 is that practitioner's competency - both are D-02's
-- artifact. D-01 is 2.1.1.3 alone, and even that does not fully close until D-02 supplies the
-- substitute, because limb (ii) requires a backup for key personnel.
--
-- WHAT THIS DOCUMENT IS ACTUALLY FOR, beyond the org chart. Thirty-five active controlled documents
-- assign work to thirteen role names. Four of those names had no holder when this was written, and
-- the measurement that found them also nearly lost one: counting only Responsibility sections
-- showed "Supervisor" in four documents and made the layer look imaginary, while counting procedure
-- steps too showed 58 lines across 22 documents, assigning work that stands between an untrained
-- operator and a machine. The narrower count would have justified deleting a real control. Part 1
-- exists so that the next person to ask "who does this?" has a document to read instead of a count
-- to run.
--
-- TWO SEPARATION RULES ARE STATED POSITIONALLY, IN PART 4, AND THAT IS DELIBERATE. Naming people
-- would mean revising this document whenever the roster moves, and a rule that is revised often is
-- a rule nobody trusts. Written as positions they survive any roster and can always be satisfied
-- while three people are on site. The pre-operational rule in particular exists because the SQF
-- Practitioner is also an operator: without it the release would be signed by the person who
-- performed the work being released, every day.
--
-- SEEDED DRAFT with three items under OPEN BEFORE ISSUE. The one that matters is that this document
-- should be approved by SENIOR SITE MANAGEMENT rather than by the SQF Practitioner, even though
-- every other document from here on is the Practitioner's to approve - because 2.1.1.4 makes the
-- designation senior management's act, and a document appointing someone should not be approved by
-- the appointee.

begin;

do $$
declare n int;
begin
  select count(*) into n from public.sop_documents where sop_number = 'FSQM-004';
  if n <> 0 then
    raise exception 'FSQM-004 already exists.';
  end if;
  -- Every record and programme this structure points at must be in force.
  select count(*) into n from public.sop_documents
   where sop_number in ('FSQM-009','FSQM-014','FSQM-018','FSQM-020',
                        'FRM-301','FRM-701','FRM-703','FRM-903','SOP-2.9')
     and status = 'active';
  if n <> 9 then
    raise exception 'Only % of the 9 documents FSQM-004 references are active.', n;
  end if;
end $$;

insert into public.sop_documents
  (sop_number, title, type, category, status, revision, sqf_reference, sqf_required, content)
values (
  'FSQM-004',
  'Organizational Structure and Responsibilities',
  'fsqm',
  'Food Safety Quality Manual',
  'draft',
  'New',
  '2.1.1.3',
  true,
  $j004${"purpose": "This document sets out the site's reporting structure, describes the positions that carry specific responsibilities within the food safety management system, documents the job descriptions of key personnel, and names who covers each position in the absence of its holder. It satisfies 2.1.1.3 of the SQF Food Safety Code: Food Manufacturing, Edition 9.", "scope": "Every position at the site that carries a food safety responsibility, whether it is held by an employee or performed under contract.\n\nIt does not cover the designation of the primary and substitute SQF Practitioner or their competency, which are 2.1.1.4 and 2.1.1.5 and are recorded separately; the training programme itself, which is SOP-2.9; or terms of employment, which are not a food safety matter.", "definitions": "Position: a set of responsibilities within the food safety management system, described independently of whoever holds it. One person may hold several positions.\n\nKey personnel: those performing key process steps in the food safety management system. 2.1.1.3 requires a documented job description for each.\n\nCover: the position that carries out a key position's food safety responsibilities while its holder is absent. Naming a cover is a requirement of 2.1.1.3, not a courtesy.\n\nContracted service: work performed for the site by an external provider under the Contract Services Register rather than by a position on this structure.", "responsibility": "Senior Site Management — owns this document and the structure it describes. Designates the primary and substitute SQF Practitioner. Ensures departments and operations are staffed and organizationally aligned to meet food safety objectives, and provides the resources that requires.\nSQF Practitioner — maintains this document, and revises it when the structure changes.\nAll position holders — work to the responsibilities recorded here, and raise it where the document and the practice diverge.", "procedure": ["The site's reporting structure is recorded in this Part by position. Positions are described by the responsibilities they carry, and are not named after the people who hold them.", "> A controlled document that names individuals has to be reissued every time somebody changes role, joins or leaves. At this site three people hold eight positions, so it would be reissued often and would spend most of its life out of date. Describing positions instead means the structure is revised when the WORK changes, which is the thing an auditor is actually asking about.", "• Senior Site Management — accountable for food safety at the site. All other positions ultimately report to it.", "• SQF Practitioner, primary and substitute — owns the SQF System.", "• Production Supervisor — accountable for the production floor and for operator competence on the equipment.", "• Production Operator and Floor Operator — make and pack the product, and perform sanitation.", "• Receiving / Goods-In — accepts or rejects incoming material.", "• Administration — purchasing, supplier files and record keeping.", "• Maintenance — simple tasks are performed by Senior Site Management; chronic and specialist work is contracted, and each provider is listed on the Contract Services Register.", "The key personnel of this site, for whom 2.1.1.3 requires a documented job description, are the positions set out below. Each entry states what the position owns, the records it completes, and who covers it.", "• Senior Site Management — owns the food safety policy and the resources behind it; designates the primary and substitute SQF Practitioner; ensures the site is appropriately staffed; is notified where an inspection failure stops production or shipment. Records: the policy statement and the management review. Covered by the SQF Practitioner for day-to-day decisions only — the power to designate is not delegable.", "• SQF Practitioner — develops, implements, reviews and maintains the SQF System; approves controlled documents and their revisions; decides finished product release under FSQM-020 and signs the pre-operational release of the line; owns corrective and preventive action under FSQM-009; sets the inspection criteria and reviews the inspection records under FSQM-014; confirms at least annually that the documented programmes are what the floor performs. Records: FRM-701, FRM-007, FRM-903 and document approvals. Covered by the substitute SQF Practitioner.", "• Production Supervisor — trains operators on each machine and signs them off, and no one operates a machine without that sign-off; takes a machine out of service on a fault and releases it back; ensures staff on shift comply with the GMP programme and acts on non-compliance immediately; ensures assigned training is completed and competency verified. Records: operator sign-off, equipment out-of-service, and the per-machine pre-use releases. Covered by Senior Site Management.", "• Production Operator and Floor Operator — make the batch to the batch sheet and record the in-process inspection on it; confirm the pack, seal, date and lot code as the run proceeds; perform sanitation and complete FRM-903. Records: the batch sheet and FRM-903. Covered by the other operator, or by the Production Supervisor.", "• Receiving / Goods-In — inspects every delivery of raw material and packaging before it is accepted into stock, against FRM-301; rejects or places on Hold under FSQM-018 anything that fails; takes and logs retention samples on FRM-703. Records: FRM-301, FRM-702 and FRM-703. Covered by the Production Supervisor.", "• Maintenance — carries out planned and reactive maintenance of production and food-contact equipment, using food-grade lubricants wherever contact is possible, and returns equipment to production only after it has been cleaned and released. Records: the maintenance log and the post-maintenance release. Covered by the contracted provider.", "> The Production Supervisor is covered by Senior Site Management rather than by the SQF Practitioner. That looks like the longer route, and it is deliberate: those two positions are currently held by one person, so naming the Practitioner as the cover would leave the Supervisor with no cover at all. A cover that resolves to the absent holder is not a cover.", "No key position shall be left without a named cover. Where a position's cover is itself absent, the responsibility passes upward to Senior Site Management.", "> This is limb (ii) of 2.1.1.3 and it is the limb this site meets least well, because the substitute SQF Practitioner is a designation this document cannot make. Until that designation exists and its holder meets 2.1.1.5, the cover for the site's most loaded position is stated here but not yet in force.", "One person may hold several positions. Work and the verification of that work shall not be performed by the same person.", "> That single sentence is the reason this Part exists. Holding several positions is ordinary at a site of this size and is not a finding. What is a finding is a procedure that describes a hand-off between two positions the same person holds: a quorum of one is not a control, and writing it as one invites an auditor to test a separation of duties that does not exist.", "• The pre-operational release shall be signed by someone other than the person who performed the sanitation.", "• An operator shall be trained and signed off by someone other than themselves. Where the Production Supervisor is the operator to be signed off, Senior Site Management signs.", "• Equipment shall be released back to production by someone other than the person who performed the maintenance on it.", "> Each of these is written as a rule about positions rather than about people, so that it survives a change of roster without a revision of this document, and so that it can be satisfied in more than one way. While three people are on site all three rules can always be met.", "Where the structure recorded here and the work actually performed diverge, this document is wrong and shall be revised. It is not the floor that is wrong.", "> The reporting structure is the document most likely to drift, because it changes whenever somebody joins, leaves or takes on a new duty, and nothing on the floor stops working when it does. The SQF Practitioner reviews it at least annually and whenever a position is created, removed or reassigned."], "form_references": "FRM-903 Daily Sanitation, Pre-Operational Inspection & Release; FRM-701 Finished Product Release Record; FRM-301 Incoming Material Receiving & Inspection Log; FRM-703 Retention Sample Log; FRM-007 Corrective and Preventive Action Report", "records": "This document is itself the record 2.1.1.3 requires: the reporting structure, the job descriptions of key personnel, and the cover for each key position.\nThe designation of the primary and substitute SQF Practitioner, and the evidence of their competency, are recorded separately under 2.1.1.4 and 2.1.1.5.\nTraining and competency records for each position are held under SOP-2.9.\nContracted maintenance providers are recorded on the Contract Services Register.\nRetention: two years, or the shelf life of the product plus twelve months, whichever is longer, on the same basis as FSQM-009 Part 10.", "governing_reference": "SQF Food Safety Code: Food Manufacturing, Edition 9 — 2.1.1.3 Management Responsibility. The clause requires four things: that the reporting structure identify and describe site personnel with specific responsibilities within the food safety management system; that a backup be identified for the absence of key personnel; that job descriptions for key personnel be documented; and that departments and operations be appropriately staffed and organizationally aligned to meet food safety objectives.\n2.1.1.4 and 2.1.1.5 concern the designation and the competency of the primary and substitute SQF Practitioner and are recorded separately. This document names the positions; it does not make the designation.\nSOP-2.9 Training — the training and competency records for the positions described here.\nFSQM-020 Product Release Program, FSQM-014 Product Sampling, Inspection and Analysis Program, FSQM-018 Non-Conforming Product and Equipment, and FSQM-009 Corrective and Preventive Action Program — the programmes whose responsibilities this structure allocates.", "revision_history": "Rev New — written 2026-09-10 against SQF Food Safety Code: Food Manufacturing, Edition 9, 2.1.1.3 Management Responsibility. DRAFT. Not approved, not in force.\n\nWHY IT EXISTS. The gap assessment found no documented reporting structure, no documented job descriptions and no named cover for key personnel. Underneath those three findings sat a fourth, which is limb (iv) of the same clause: thirty-five active controlled documents assign work to thirteen role names, and when this was written four of those names had no holder at all.\n\nHOW THE ROLES WERE ESTABLISHED, AND A NEAR MISS WORTH RECORDING. The roles were counted rather than assumed. Counting only the Responsibility sections of active documents showed Supervisor in four documents and made the supervisory layer look like something inherited from another company's paperwork. Counting procedure steps as well showed 58 lines across 22 documents, assigning work that stands between an untrained operator and a machine — training sign-off, taking equipment out of service, signing the pre-use release. On the narrower count the layer would have been deleted as an artefact. It was not; the post is real and is recorded in Part 1 as Production Supervisor, the name the documents already used.\n\nQA and Quality Leader were confirmed as working shorthand for the SQF Practitioner rather than distinct posts, and are due to be normalised across the twelve active documents that use them. That is follow-on work and is not part of this document.\n\nTHE REMEDIATION PLAN'S CLAUSE MAPPING IS WRONG. It maps D-01 to 2.1.1.3 and 2.1.1.4, and D-02 to 2.1.1.5. In this edition 2.1.1.4 is the designation of a primary and substitute SQF Practitioner and 2.1.1.5 is that practitioner's competency; both belong to D-02. This document closes 2.1.1.3, and not even that in full — limb (ii) requires a backup for key personnel, and the backup for the site's most loaded position is a designation this document cannot make.\n\nOPEN BEFORE ISSUE — three things the site must settle:\n\n1. THIS DOCUMENT SHOULD BE APPROVED BY SENIOR SITE MANAGEMENT, not by the SQF Practitioner. From this document forward the SQF Practitioner approves controlled documents, which is a change from the arrangement under which every document to date was approved. This one is the exception: 2.1.1.4 makes the designation of the practitioner an act of senior site management, and a document that appoints somebody should not be approved by the appointee. Confirm before issue, because the approval block is the first place an auditor looks for that circularity.\n\n2. The substitute SQF Practitioner is named in Part 3 as the cover for the primary, but the designation itself and the competency evidence behind it are 2.1.1.4 and 2.1.1.5, which are D-02 and not yet complete. Until they are, limb (ii) of 2.1.1.3 is stated here but not in force. Note also that 2.1.1.5 requires a COMPLETED HACCP TRAINING COURSE specifically — practitioner training may or may not include a recognised HACCP module, and the wrong course closes nothing.\n\n3. The boundary in Part 5 between simple maintenance performed in-house and chronic or specialist work that is contracted is recorded as the site described it, but no contracted provider is yet listed on the Contract Services Register, which is D-10. Until that register exists the contracted half of Part 5 points at a document the site does not hold."}$j004$::jsonb
);

do $$
declare
  r record;
  rn text;
begin
  select status, revision, type, sqf_required, sqf_reference, category,
         content::text                                                                as all_text,
         (content->>'responsibility')                                                 as responsibility,
         jsonb_array_length(content->'procedure')                                     as lines,
         (select count(*) from jsonb_array_elements_text(content->'procedure') s
           where s like '• %')                                                        as bullets,
         (select count(*) from jsonb_array_elements_text(content->'procedure') s
           where s like '> %')                                                        as prose,
         -- The three separation rules are the operative content; without them this is an org chart.
         (content->'procedure')::text like '%signed by someone other than the person who performed the sanitation%'
                                                                                       as rule_sanitation,
         (content->'procedure')::text like '%trained and signed off by someone other than themselves%'
                                                                                       as rule_training,
         (content->'procedure')::text like '%released back to production by someone other than the person who performed the maintenance%'
                                                                                       as rule_maintenance,
         (content->'procedure')::text like '%No key position shall be left without a named cover%'
                                                                                       as cover_rule,
         (content->'procedure')::text like '%quorum of one is not a control%'          as quorum,
         (content->>'revision_history') like '%OPEN BEFORE ISSUE%'                      as open_items,
         (content->>'revision_history') like '%APPROVED BY SENIOR SITE MANAGEMENT%'     as approval_item,
         (content->>'revision_history') like '%58 lines across 22 documents%'           as supervisor_note
    into r
    from public.sop_documents where sop_number = 'FSQM-004';

  if r.status is distinct from 'draft' or r.revision is distinct from 'New' then
    raise exception 'FSQM-004 seeded as %/% , expected draft/New.', r.status, r.revision;
  end if;
  if r.type is distinct from 'fsqm' or r.category is distinct from 'Food Safety Quality Manual' then
    raise exception 'FSQM-004 typed %/% .', r.type, r.category;
  end if;
  if not r.sqf_required or r.sqf_reference is distinct from '2.1.1.3' then
    raise exception 'FSQM-004 SQF metadata wrong: required=%, ref=%.', r.sqf_required, r.sqf_reference;
  end if;
  if r.lines < 20 or r.bullets < 12 or r.prose < 6 then
    raise exception 'Body did not land intact: % lines, % bullets, % prose.', r.lines, r.bullets, r.prose;
  end if;
  if not (r.rule_sanitation and r.rule_training and r.rule_maintenance) then
    raise exception 'A separation rule is missing: sanitation=%, training=%, maintenance=%.',
      r.rule_sanitation, r.rule_training, r.rule_maintenance;
  end if;
  if not (r.cover_rule and r.quorum) then
    raise exception 'The cover rule or the quorum-of-one statement is missing (cover=%, quorum=%).',
      r.cover_rule, r.quorum;
  end if;
  if not (r.open_items and r.approval_item and r.supervisor_note) then
    raise exception 'Revision history wrong: open=%, approval=%, supervisor=%.',
      r.open_items, r.approval_item, r.supervisor_note;
  end if;
  -- A document that is BY POSITION must not name a person. These are the site's staff.
  foreach rn in array array['Gabriela','Diana','Christina','Juncos','Mercer']
  loop
    if position(rn in r.all_text) > 0 then
      raise exception 'FSQM-004 names an individual (%). This document is by position only.', rn;
    end if;
  end loop;
  -- Every role the procedure leans on must be defined in Responsibility.
  foreach rn in array array['Senior Site Management','SQF Practitioner','All position holders']
  loop
    if strpos(r.responsibility, rn) = 0 then
      raise exception 'Responsibility does not define the role %.', rn;
    end if;
  end loop;
end $$;

commit;
