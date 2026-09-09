-- FSQM-014 Product Sampling, Inspection and Analysis Program. Seeded DRAFT.
-- Closes D-15 (SQF Food Safety Code: Food Manufacturing, Edition 9 - 2.4.4.1, .2, .5, .6).
--
-- WHY IT EXISTS. The consultant scored four Minors across 2.4.4: no documented method for
-- sampling, inspecting or analysing raw materials, work-in-progress or finished product
-- (2.4.4.1); no analysis methods named (2.4.4.2); no retention-sample position (2.4.4.5); and
-- no inspection or analysis records available for review (2.4.4.6). Underneath them sits a
-- live inconsistency: FSQM-020 Product Release Program is ACTIVE and its release check reads
-- "the customer's agreed specification" and "the product's appearance and sensory standard",
-- neither of which is documented anywhere. FSQM-020's own revision history carries that as
-- open item 1. An active procedure pointing at a document that does not exist is the finding
-- this wave exists to close, so this program closes the pointer as well as the clause.
--
-- THE SITE INSPECTS; IT DOES NOT ANALYSE. Confirmed by the owner 2026-09-09: there is no
-- on-site laboratory, no external laboratory is used, and no chemical, microbiological or
-- nutritional analysis is performed on anything - not even a supplier Certificate of Analysis
-- relied on at receiving. Part 2 says so plainly rather than leaving it silent, in the same
-- form FSQM-020 Part 5 uses for positive release. Three consequences follow and are stated:
-- 2.4.4.2's limbs govern how analyses are conducted and by whom, so where none are conducted
-- they do not arise; 2.4.4.3 and 2.4.4.4 govern an on-site laboratory, so they are recorded
-- Not Applicable; and the remediation plan's instruction for this deliverable - "appoint an
-- ISO/IEC 17025-accredited external laboratory" - does not fit the site and is not followed.
-- Part 2 names what must happen BEFORE that changes, so it cannot quietly stop being true.
--
-- IT NAMES EXISTING RECORDS, IT DOES NOT CREATE NEW ONES. The three inspections the site
-- performs already have records: FRM-301 at receiving, the batch sheet in process, FRM-701 at
-- release. Part 3 names them. Writing a fourth "inspection log" would be a second place to
-- record what is already recorded, which is how FSQM-018 and FSQM-019 came to disagree.
-- The ONE genuinely unrecorded thing is the retention sample - the site keeps samples nobody
-- requires - so FRM-703 is the only new record, and it is seeded separately.
--
-- PART 5 IS THE WORKAROUND, AND IT IS DELIBERATE. 2.4.4.1 requires inspection "to agreed
-- specifications". The site holds no finished product specification (D-09 owns building the
-- library). Rather than point at a specification that does not exist - the exact defect this
-- document is here to fix in FSQM-020 - Part 5 states the finished-product criteria explicitly
-- so the inspection is performable today, and says that they move to the specification once it
-- exists. That is why this migration does not, and cannot, close 2.4.4.1 outright.
--
-- SEEDED DRAFT with four items under OPEN BEFORE ISSUE. The second is the one that matters:
-- the site is GFCO certified and sells a Gluten Free claim, and with no analysis of any kind
-- nothing on site verifies the product meets the gluten threshold. FSQM-020's release check
-- confirms the LABEL's claim is correct for what was run; that is not the same as verifying
-- the PRODUCT. Do not issue this document until that is answered.

begin;

do $$
declare
  n int;
begin
  select count(*) into n from public.sop_documents where sop_number = 'FSQM-014';
  if n <> 0 then
    raise exception 'FSQM-014 already exists.';
  end if;
  -- Everything this program points at must exist and be in force. FRM-703 is deliberately
  -- NOT in this list: it is seeded by the sibling migration and this document may reference a
  -- record that is still draft while both are draft.
  select count(*) into n from public.sop_documents
   where sop_number in ('FRM-301','FRM-701','FRM-702','FRM-903',
                        'FSQM-018','FSQM-009','FSQM-020','SOP-2.3.1','SOP-2.3.2')
     and status = 'active';
  if n <> 9 then
    raise exception 'Only % of the 9 documents FSQM-014 references are active.', n;
  end if;
  -- Part 3 names FRM-301 as a FILLABLE record carrying the package-label scan. It was not
  -- fillable when this document was first drafted on 2026-09-09 and became so the same day, so
  -- this guard is pointed at the state Part 3 actually describes. If FRM-301 ever loses its
  -- schema, Part 3 is wrong again and this refuses rather than seeding a false statement.
  select count(*) into n from public.sop_documents
   where sop_number = 'FRM-301' and (content ? 'form_schema');
  if n <> 1 then
    raise exception 'FRM-301 carries no form_schema; Part 3 says it is a fillable record. Re-read Part 3.';
  end if;
end $$;

insert into public.sop_documents
  (sop_number, title, type, category, status, revision, sqf_reference, sqf_required, content)
values (
  'FSQM-014',
  'Product Sampling, Inspection and Analysis Program',
  'fsqm',
  'Food Safety Quality Manual',
  'draft',
  'New',
  '2.4.4.1, 2.4.4.2, 2.4.4.5, 2.4.4.6',
  true,
  $j014${"purpose": "This program states the methods, the responsibility and the criteria for sampling and inspecting raw materials, packaging, work-in-progress and finished product at Adventure Bakery, the intervals at which those inspections are carried out, and where each one is recorded. It satisfies the Product Sampling, Inspection and Analysis element of the SQF Food Safety Code: Food Manufacturing, Edition 9 (2.4.4).", "scope": "Every delivery of raw material and packaging received at the site, every production batch while it is being made, and every batch of finished product before it is released.\n\nIt does not cover the release decision itself, which is FSQM-020 Product Release Program; the disposition of anything that fails an inspection, which is FSQM-018 Non-Conforming Product and Equipment; the pre-operation inspection of a line, which is a sanitation control recorded on FRM-903; or the development and approval of specifications, which is SOP-2.3.1 New Product and Specification Process.", "definitions": "Inspection: examination against stated criteria by a person, using the senses together with simple measurement such as count, weight, temperature, date code, seal integrity and appearance. Every check this program requires is an inspection.\n\nAnalysis: a chemical, microbiological, nutritional or physical test carried out to a recognised method, whether in a laboratory on site or by an external laboratory. Adventure Bakery performs and commissions none — see Part 2.\n\nRetention sample: a unit of finished product kept after the batch has been released, so that a later question about that batch can be answered against the product itself.\n\nRepresentative: taken from the batch it is meant to speak for, and taken so that what is examined is typical of that batch rather than of one convenient corner of it.", "responsibility": "SQF Practitioner — owns this program. Sets the inspection criteria, reviews the inspection records, and decides release under FSQM-020. Confirms at least annually that the inspections described here are the inspections actually being performed.\nProduction staff — carry out the in-process inspections during the run and record them on the batch sheet.\nQuality Team — carries out the incoming inspection at receipt and records it on FRM-301; takes and stores retention samples and logs them on FRM-703; places on Hold anything that fails.\nAdmin — does not accept a delivery into stock without a completed incoming inspection.\nManagement team — provides the resources inspection requires, and is notified where an inspection failure stops production or shipment.", "procedure": ["Every delivery of raw material and packaging, every production batch while it runs, and every batch of finished product before release shall be inspected against stated criteria, and the result recorded.", "> SQF 2.4.4.1 asks for three things — the method, the responsibility and the criteria — documented and implemented, at regular intervals, to agreed specifications and legal requirements. Parts 3, 4 and 5 supply them. An inspection that happens but is not recorded satisfies none of it, which is why 2.4.4.6 was scored: at the gap assessment no inspection records were available to review.", "Adventure Bakery inspects. It does not analyse. There is no on-site laboratory, no external laboratory is used, and no chemical, microbiological or nutritional analysis is performed on or commissioned for any raw material, packaging, work-in-progress or finished product. No supplier Certificate of Analysis is relied upon as an acceptance test at receiving.", "> This is stated rather than left silent, for the reason FSQM-020 Part 5 states that positive release is not used: a document that implies a testing regime the site does not operate is worse than one that says plainly there is none, because the first thing an auditor does is ask to see the results.", "> Three things follow from it. SQF 2.4.4.2 governs how analyses are conducted, by what methods and by what laboratory; where none are conducted, its requirements do not arise. SQF 2.4.4.3 and 2.4.4.4 govern the siting, access control and waste handling of an on-site laboratory; there is none, so both are recorded as Not Applicable, and the GMP inspection under FSQM-012 records that there is no laboratory to inspect.", "> What must happen before this changes: if any analysis is ever introduced — a gluten result for certified Gluten Free product being the likely first — the method shall be named in this program, and any external laboratory shall be accredited to ISO/IEC 17025 or an equivalent international standard and listed on the contract services register before the first sample is sent to it. The method comes first, then the laboratory, then the sample.", "The site performs three inspections. Each already has its own record, and this program names them rather than creating a second place to write the same thing down.", "• Incoming raw material and packaging — inspected at receipt, before the delivery is accepted into stock, and recorded on FRM-301 Incoming Material Receiving & Inspection Log. Criteria: the material and quantity match the purchase order; the packaging is intact, clean and undamaged; the lot code and date are present, legible and within date; there is no sign of pest activity, water damage or foreign matter; and the vehicle it arrived in was fit to carry food.", "• Work-in-progress — inspected during the run against the batch sheet, and recorded on it. Criteria: the formula was followed; the process steps and process controls stayed within their stated limits; and the pack, seal, date and lot code are correct as the run proceeds.", "• Finished product — inspected before release against the checks listed in FSQM-020 Part 4, and recorded on FRM-701 Finished Product Release Record.", "> FRM-301 is an active controlled document and a fillable record in the Team Portal. Its Receiving Log carries a package-label scan on every row: the receiver photographs the material's own label and the supplier, the material description and the lot code are read from it into the row. That is the control worth having here — a lot code transcribed by hand at a loading dock is the entry most likely to be wrong, and it is the one every trace exercise afterwards depends on.", "Inspection is of every batch and every delivery, not of a sample of them. Where a unit or a portion is taken to be examined, it shall be taken from the batch it represents and be typical of it.", "> SQF 2.4.4.1 requires sampling and testing to be representative of the process batch. At this site's volumes every batch is inspected, which is the strongest form of that requirement and the simplest to evidence. The rule about how a unit is taken matters because the failure it guards against is real: a unit taken from the same corner of every pallet is not representative of anything.", "The criteria for finished product inspection are those listed in FSQM-020 Part 4, together with the product's approved label and its agreed pack and quantity configuration.", "> This states the criteria here, in terms, because the site does not yet hold a finished product specification. SQF 2.4.4.1 requires inspection to agreed specifications; SOP-2.3.1 describes how a specification is produced but the register holds none for finished product. Pointing this program at a specification that does not exist would repeat the defect it was written to fix — FSQM-020's release check already points at exactly that, and carries it as an open item.", "> When the specification library exists, the criteria in this Part move to the specification and this Part points at it instead. That work is a separate deliverable and is not done here.", "Retention samples are not required by any customer or by any regulation applying to this site. The site nonetheless retains samples of finished product, so the rule for them is stated.", "• A retained sample shall be identified with its product and its lot code, so it can be matched to the batch it came from.", "• It shall be stored under the product's normal storage conditions, so that what it shows later is what the product does rather than what the store did to it.", "• It shall be kept for the product's stated shelf life and then discarded.", "• Each retained sample shall be logged on FRM-703 Retention Sample Log, and its disposal recorded there.", "> SQF 2.4.4.5 sets this rule only where retention samples are required, and here none are. The practice exists anyway, and a sample an auditor finds in the building needs a stated basis, a storage condition and an end date — otherwise it is not a retention sample, it is old product, and the auditor is entitled to ask which.", "Anything that fails an inspection shall not be accepted, processed further or released.", "• A delivery that fails incoming inspection is rejected or placed on Hold under FSQM-018 Non-Conforming Product and Equipment and recorded on FRM-702.", "• A batch that fails an in-process or finished-product inspection is placed on Hold under FSQM-018 and dispositioned there; the release record ends at \"not released\".", "• A CAPA is raised under FSQM-009 Corrective and Preventive Action Program wherever its Part 3 requires one.", "The SQF Practitioner shall confirm at least annually that the inspections described in Part 3 are the inspections actually being performed, and shall revise this program where they are not.", "> This program's risk is not that it is wrong today but that the floor moves and it does not. The annual confirmation is the verification activity for 2.4.4 and belongs on the master verification schedule when that exists.", "Records are retained as set out in the Records section of this program."], "form_references": "FRM-301 Incoming Material Receiving & Inspection Log; FRM-701 Finished Product Release Record; FRM-703 Retention Sample Log; FRM-702 Non-Conforming Material Hold & Tagging Record; batch sheets", "records": "FRM-301 Incoming Material Receiving & Inspection Log — the incoming inspection of every delivery of raw material and packaging, kept in the Team Portal.\nBatch sheets — the in-process inspection of every batch, recorded as the batch is made.\nFRM-701 Finished Product Release Record — the finished product inspection, recorded as part of the release decision under FSQM-020.\nFRM-703 Retention Sample Log — every retention sample taken, where it is stored, and its disposal.\nFRM-702 Non-Conforming Material Hold & Tagging Record — where an inspection failure results in a hold.\nTogether these are the records of all inspections that SQF 2.4.4.6 requires. There are no records of analysis, because no analysis is performed — see Part 2.\nRetention: two years, or the shelf life of the product plus twelve months, whichever is longer. This is the period set by FSQM-009 Part 10, so an inspection, a hold arising from it and any investigation that follows are retained on the same basis.", "governing_reference": "SQF Food Safety Code: Food Manufacturing, Edition 9 — 2.4.4 Product Sampling, Inspection and Analysis. 2.4.4.1 methods, responsibility and criteria; 2.4.4.2 analysis methods and laboratory accreditation; 2.4.4.5 retention samples; 2.4.4.6 records.\n2.4.4.3 and 2.4.4.4 concern an on-site laboratory. Adventure Bakery has none, and both are recorded as Not Applicable on that basis.\nFSQM-020 Product Release Program — the release decision this program's finished-product inspection feeds, and whose release checks Part 5 adopts as the finished-product criteria.\nFSQM-018 Non-Conforming Product and Equipment — where anything that fails an inspection is held and dispositioned.\nFSQM-009 Corrective and Preventive Action (CAPA) Program — where an inspection failure meets one of its Part 3 triggers.\nSOP-2.3.2 Raw and Packaging Materials — the receipt and acceptance of incoming material, which this program's Part 3 inspection serves.\nSOP-2.3.1 New Product and Specification Process — how a specification is produced. The register holds none for finished product yet; see Part 5.", "revision_history": "Rev New — written 2026-09-09 against SQF Food Safety Code: Food Manufacturing, Edition 9, 2.4.4 Product Sampling, Inspection and Analysis. DRAFT. Not approved, not in force.\n\nWHY IT EXISTS. The gap assessment scored four Minors across 2.4.4: no documented method for sampling, inspecting or analysing raw materials, work-in-progress or finished product (2.4.4.1); no analysis methods named (2.4.4.2); no retention-sample position (2.4.4.5); and no inspection or analysis records available to review (2.4.4.6). Underneath them sat a live inconsistency — FSQM-020 Product Release Program is active, and its release check reads \"the customer's agreed specification\" and \"the product's appearance and sensory standard\", neither of which the register holds. FSQM-020 carries that as its own open item 1. This program closes the pointer as well as the clause.\n\nTHE SITE INSPECTS; IT DOES NOT ANALYSE, confirmed by the owner 2026-09-09. There is no on-site laboratory, no external laboratory is used, and no chemical, microbiological or nutritional analysis is performed on or commissioned for anything — not even a supplier Certificate of Analysis relied on at receiving. Part 2 states this plainly, in the form FSQM-020 Part 5 uses for positive release, and names what must happen before it changes: the method first, then an ISO/IEC 17025-accredited laboratory listed on the contract services register, then the sample. Three consequences are recorded rather than left for a reader to work out — 2.4.4.2's limbs do not arise where no analysis is conducted, 2.4.4.3 and 2.4.4.4 are Not Applicable for want of a laboratory, and the remediation plan's instruction for this deliverable (\"appoint an ISO/IEC 17025-accredited external laboratory\") does not fit this site and was not followed.\n\nIT NAMES EXISTING RECORDS RATHER THAN CREATING NEW ONES. The three inspections the site performs already have records: FRM-301 at receiving, the batch sheet in process, FRM-701 at release. A fourth general inspection log would be a second place to record what is already recorded, which is how FSQM-018 and FSQM-019 came to name different authorities for rework. The one genuinely unrecorded thing is the retention sample, so FRM-703 is the only new record this deliverable adds.\n\nPART 5 IS A WORKAROUND AND SAYS SO. 2.4.4.1 requires inspection to agreed specifications, and the site holds no finished product specification. Part 5 therefore states the finished-product criteria explicitly — FSQM-020's release checks, the approved label, and the agreed pack and quantity — so that the inspection is performable today, and records that those criteria move to the specification once the library exists. Building that library is a separate deliverable. This program does not claim to close 2.4.4.1 outright while the specification it inspects against does not exist.\n\nOPEN BEFORE ISSUE — four things the site must settle. The second is the one that matters:\n\n1. There is still no finished product specification. Part 5 works around it and names the workaround, but 2.4.4.1's \"to agreed specifications\" is not fully met until the specification library exists. Confirm that this deliverable is accepted as closing 2.4.4.1 on that basis, or hold it until the specifications exist.\n\n2. THE GLUTEN FREE CLAIM IS NOT VERIFIED BY ANY TEST. The site is GFCO certified and sells product carrying a Gluten Free claim. FSQM-020's release check confirms that the LABEL's claim is correct for what was actually run; nothing verifies that the PRODUCT meets the gluten threshold, because no analysis of any kind is performed. Confirm how the claim is verified — whether the GFCO certification scheme itself requires or performs testing, whether it rests on supplier documentation and segregation, or whether product testing is in fact done by someone. An auditor will ask, and the answer belongs in Part 2 of this program. Do not issue this document until it is answered, because Part 2 currently asserts that no analysis is performed anywhere and that assertion must be true.\n\n3. Retention samples: confirm what is actually retained (one unit per batch, per product, or per production day), where it is stored, and for how long, so that Part 6 and FRM-703 describe the real practice rather than a reasonable-sounding one. Part 6 currently sets the shelf life as the retention period, which is the rule 2.4.4.5 applies where retention is required.\n\n4. The consultant scored 2.4.4.5 Minor with NO evidence recorded in the assessment. Since the site is not required to hold retention samples at all, query that score with RDR Global Partners before accepting it."}$j014$::jsonb
);

do $$
declare
  r record;
  rn text;
begin
  select status, revision, type, sqf_required, sqf_reference, category,
         (content->>'responsibility')                                                as responsibility,
         jsonb_array_length(content->'procedure')                                    as lines,
         (select count(*) from jsonb_array_elements_text(content->'procedure') s
           where s like '• %')                                                       as bullets,
         (select count(*) from jsonb_array_elements_text(content->'procedure') s
           where s like '> %')                                                       as prose,
         (content->'procedure')::text like '%Adventure Bakery inspects. It does not analyse%'
                                                                                     as no_analysis,
         (content->'procedure')::text like '%no external laboratory is used%'         as no_ext_lab,
         (content->'procedure')::text like '%Not Applicable%'                         as lab_na,
         (content->'procedure')::text like '%FRM-301%'                                as names_receiving,
         (content->'procedure')::text like '%FRM-701%'                                as names_release,
         (content->'procedure')::text like '%FRM-703 Retention Sample Log%'           as names_retention,
         (content->'procedure')::text like '%placed on Hold under FSQM-018%'          as failure_path,
         (content->'procedure')::text like '%does not yet hold a finished product specification%'
                                                                                     as spec_gap_stated,
         (content->>'governing_reference') like '%2.4.4.3 and 2.4.4.4 concern an on-site laboratory%'
                                                                                     as gov_lab_na,
         (content->>'revision_history') like '%OPEN BEFORE ISSUE%'                    as open_items,
         (content->>'revision_history') like '%GLUTEN FREE CLAIM IS NOT VERIFIED%'    as gf_flag,
         (content->>'records') like '%Retention: two years%'                          as retention_rule
    into r
    from public.sop_documents where sop_number = 'FSQM-014';

  if r.status is distinct from 'draft' or r.revision is distinct from 'New' then
    raise exception 'FSQM-014 seeded as %/% , expected draft/New.', r.status, r.revision;
  end if;
  if r.type is distinct from 'fsqm' or r.category is distinct from 'Food Safety Quality Manual' then
    raise exception 'FSQM-014 typed %/% , expected fsqm/Food Safety Quality Manual.', r.type, r.category;
  end if;
  if not r.sqf_required or r.sqf_reference is distinct from '2.4.4.1, 2.4.4.2, 2.4.4.5, 2.4.4.6' then
    raise exception 'FSQM-014 SQF metadata wrong: required=%, ref=%.', r.sqf_required, r.sqf_reference;
  end if;
  if r.lines < 25 or r.bullets < 8 or r.prose < 8 then
    raise exception 'Body did not land intact: % lines, % bullets, % prose.', r.lines, r.bullets, r.prose;
  end if;
  -- The four positions this document exists to state. If any is missing the document says
  -- something different from what it was written to say.
  if not (r.no_analysis and r.no_ext_lab and r.lab_na and r.spec_gap_stated) then
    raise exception 'A scope statement is missing: no_analysis=%, no_ext_lab=%, lab_na=%, spec_gap=%.',
      r.no_analysis, r.no_ext_lab, r.lab_na, r.spec_gap_stated;
  end if;
  if not (r.names_receiving and r.names_release and r.names_retention and r.failure_path) then
    raise exception 'A record or the failure path is unnamed: FRM-301=%, FRM-701=%, FRM-703=%, hold=%.',
      r.names_receiving, r.names_release, r.names_retention, r.failure_path;
  end if;
  if not (r.gov_lab_na and r.open_items and r.gf_flag and r.retention_rule) then
    raise exception 'Governing ref / open items wrong: lab_na=%, open=%, gluten=%, retention=%.',
      r.gov_lab_na, r.open_items, r.gf_flag, r.retention_rule;
  end if;
  -- Every role the procedure leans on must be defined in Responsibility.
  foreach rn in array array['SQF Practitioner','Production staff','Quality Team','Admin','Management team']
  loop
    if strpos(r.responsibility, rn) = 0 then
      raise exception 'Responsibility does not define the role %.', rn;
    end if;
  end loop;
end $$;

commit;
