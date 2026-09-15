-- FSQM-037 Facility Layout and Product Flow. Seeded DRAFT with ONE open item.
--
-- WHAT THIS DOCUMENT IS. A scaled drawing of the 415/425 production floor showing where equipment
-- stands, how the floor is zoned for hygiene, and the route product physically takes across it. It
-- is issued as two sheets because the floor runs a two-day rotation and the equipment on it is not
-- the same on both days: the depositor is in the room on Day 1 and is removed on Day 2, when the
-- dunk station is brought into the same bay.
--
-- WHAT IT IS NOT, AND WHY sqf_reference IS NULL. It is NOT the flow diagram 2.4.3.6 requires.
-- That clause asks for every step in the process, all raw materials, packaging, service inputs
-- (water, steam, gasses), scheduled process delays, and all process outputs INCLUDING WASTE AND
-- REWORK, verified on site. This drawing carries none of those: no inputs are enumerated, no
-- utilities are shown, no delays are marked, and neither waste nor rework appears on it. Citing
-- 2.4.3.6 here would close a Mandatory clause on a document that does not address it -- the same
-- failure FSQM-036 avoided by separating the vacuum seal from the vehicle seal, and FSQM-017
-- avoided by recording 2.5.1.1 as closing only in part.
--
-- NOR DOES ANY CLAUSE REQUIRE THIS DRAWING. Both code editions were searched for "site plan",
-- "floor plan" and "premises layout" and neither mandates one. This is a supporting document and is
-- seeded sqf_required = false. It is not a D-xx deliverable and closes no gap-assessment finding.
-- What it does is make the rotation's zoning defensible, which matters because the same floor area
-- is low risk on one day and high care on the next.
--
-- ONE OPEN ITEM, DELIBERATELY. An earlier draft of this record carried six, which misrepresented
-- the document as half-finished. Three of those were never caveats (attaching the files is a
-- procedure step; page size is cosmetic; the scale tolerance is a stated limitation, not a defect).
-- One was a decision the site had already made and which is now recorded as made. One -- personnel
-- flow, hand-wash points and allergen segregation -- is scoped OUT with a reason rather than listed
-- as absent, because a drawing is not incomplete for omitting what it never set out to show.
-- What remains is the only thing that genuinely gates issue: the SQF Practitioner confirming the
-- zone boundaries on the floor.
--
-- SEEDED DRAFT. No effective_date and no approved_by: both are set by the issue migration, which is
-- the pattern FSQM-036, FSQM-020 and FRM-507/606 all follow.
--
-- THE FILES ARE NOT ATTACHED BY THIS MIGRATION. SQL cannot write Supabase Storage. See the note at
-- the foot of this file.

begin;

do $$
declare n int;
begin
  select count(*) into n from public.sop_documents where sop_number = 'FSQM-037';
  if n <> 0 then
    raise exception 'FSQM-037 already exists.';
  end if;
  -- FSQM-013 (GMP) governs the premises this drawing depicts; if it is not active, the zoning on
  -- the drawing has no programme behind it.
  select count(*) into n from public.sop_documents
   where sop_number = 'FSQM-013' and status = 'active';
  if n <> 1 then
    raise exception 'FSQM-013 is not active; FSQM-037 Part 2 references it.';
  end if;
end $$;

insert into public.sop_documents
  (sop_number, title, type, category, status, revision, sqf_reference, sqf_required, content)
values (
  'FSQM-037',
  'Facility Layout and Product Flow',
  'fsqm',
  'Food Safety Quality Manual',
  'draft',
  'New',
  null,
  false,
  $j037${"purpose": "This document is the controlled drawing of the production floor at 415 and 425 Specialty Pt. It records where equipment stands, how the floor is divided into hygiene zones, and the route finished product takes across it. It exists so that the zoning the site works to is written down and can be pointed at, rather than being carried in people's heads.", "scope": "The production floor of units 415 and 425, and the movement of product across it from the receipt of ingredients at the weighing station to the application of the lot code. It covers both configurations of the two-day rotation and issues one sheet for each.\n\nDELIBERATELY OUT OF SCOPE, and not to be read as omissions:\n\nPersonnel flow, hand-wash points and allergen segregation. This drawing answers two questions — where does equipment stand, and where does product go. Personnel movement is a different question with a different audience and a different review cycle, and drawing three overlays on one sheet makes all three harder to read. Where personnel flow across the raw / high-care boundary needs to be controlled, that is a matter for the GMP programme, and a personnel flow drawing is the right home for it if one is later required.\n\nThe process itself, which is governed by the relevant SOPs.\n\nThe food safety plan and its hazard analysis, and the flow diagram required by 2.4.3.6 — which this drawing is not. See the governing reference.", "definitions": "Sheet 1 (Day 1): the floor as configured for mixing, depositing and baking. The depositor is in the room.\n\nSheet 2 (Day 2): the floor as configured for dunking, sealing, packaging and lot coding. The depositor has been removed and the dunk station occupies the same bay.\n\nDunk bay: the bay that holds the depositor on Day 1 and the dunk station on Day 2. Its hygiene status is not the same on the two days.\n\nScale: the drawing is to scale. One grid square is five feet.", "responsibility": "SQF Practitioner — owns this drawing. Confirms the hygiene zones, approves the drawing, and reviews it whenever the floor changes.\nSenior Site Management — approves the document and provides the resources any change to the floor requires.\nProduction Supervisor — works to the configuration shown for the day being run, and reports any difference between the drawing and the floor.\nProduction staff — follow the product route shown for the day being run.", "procedure": ["This drawing is issued as two sheets, one per day of the rotation, and both sheets are part of the same document at the same revision.", "> Issuing one sheet would misrepresent the floor. The equipment is not the same on the two days and neither is the zoning, so a single drawing would have to show either a configuration that exists for half the time or a composite that exists never.", "> Sheet 1 carries steps 1 to 5 and the depositor. Sheet 2 carries steps 6 to 9 and the dunk station. The sheet number and the day are printed on each.", "The floor is divided into six hygiene zones, and the kill step is the oven.", "• NON-PRODUCTION — offices and reception.", "• PACKAGING MATERIALS STORAGE.", "• RAW / PRE-BAKE [LOW RISK] — ingredients, weighing, mixing, and on Day 1 depositing.", "• BAKE [KILL STEP] — the two ovens.", "• COOLING [HIGH CARE] — the post-bake racks on the west wall.", "• HIGH CARE — assembly, filling, packaging and sealing.", "> Everything upstream of the oven is low risk and everything downstream of it is high care. That single division is what the zoning is for, and it is the thing an auditor will look for first.", "> The premises these zones divide are governed by FSQM-013.", "THE DUNK BAY CHANGES HYGIENE STATUS BETWEEN THE TWO DAYS. It holds raw batter on Day 1 and post-bake product on Day 2.", "> This is the consequence of the rotation and it is the most important thing on the drawing. The same floor area is low risk on one day and high care on the next, so what separates them is not a wall but the changeover clean performed between Day 1 and Day 2.", "> That places weight on the changeover being performed and recorded. A zoning that depends on a clean is only as good as the record that the clean happened.", "On Sheet 2 the weighing station sits within HIGH CARE, and this is a decision rather than an accident of where a line fell.", "> Nothing is weighed on Day 2. The weighing station is idle equipment standing in an area that has been cleaned for high-care use, and zoning describes the space rather than the day's activity. The alternative — carving a low-risk pocket around an idle machine — would put a raw-designated island inside a high-care area for no control benefit.", "> The RAW / PRE-BAKE zone on Sheet 2 is therefore the bottom strip holding the ingredients, and the boundary between the two runs above it.", "This drawing is not the flow diagram required by 2.4.3.6 and shall not be offered as one. See the governing reference.", "The drawing is to scale, and the scale, its basis and its tolerance are printed on both sheets.", "> The scale was derived from a dimension printed on the original architectural plan: two equal bays spanning 49.0 pixels are labelled 11 feet 8 inches, which gives 4.2 pixels per foot. A second reading agrees — at that scale the reception rooms compute to about 122 square feet against a printed label of about 125.", "> The tolerance is about three percent, which on this building is around two feet. That is immaterial for judging which zone a machine stands in, which is what this drawing is for. It is not adequate for construction, and both sheets are marked NOT FOR CONSTRUCTION accordingly.", "The overall building measures 75.8 feet by 67.1 feet, about 5,090 square feet, divided between the two units by a demising wall at the midpoint.", "The editable master and both issued sheets are held as attachments to this record.", "> The master is a draw.io file. A drawing that can only be reissued by redrawing it is not a controlled drawing, so the master travels with the PDFs.", "The SQF Practitioner shall review this drawing at least annually, and before that whenever equipment is moved, added or removed, whenever the rotation changes, and whenever the hygiene zoning is revised.", "> Equipment moving is the change most likely to happen and least likely to be reported, because moving a table does not feel like changing a controlled document."], "form_references": "None. This is a drawing and no record is completed against it.", "records": "No records are generated by this document.\n\nThe document itself is the record: three files are held as attachments to this entry — Sheet 1 (Day 1) as PDF, Sheet 2 (Day 2) as PDF, and the editable draw.io master from which both sheets are exported.\n\nSuperseded revisions are retained by the sop_document_history trigger, which snapshots the row whenever a watched field changes on a published document.", "governing_reference": "No clause of either SQF code requires a facility layout drawing, and this document does not close one. Both editions were searched for \"site plan\", \"floor plan\" and \"premises layout\" and neither mandates such a drawing. sqf_reference is null and sqf_required is false for that reason, and this document is not a D-xx deliverable.\n\nWHAT IT IS NOT: SQF Food Safety Code: Food Manufacturing, Edition 9, 2.4.3.6 requires the food safety team to develop and document a flow diagram covering the scope of each food safety plan, including every step in the process, all raw materials, packaging, service inputs such as water, steam and gasses, scheduled process delays, and all process outputs including waste and rework, each verified on site. This drawing carries none of those. It shows equipment placement, hygiene zoning and the physical route product takes. Offering it as a 2.4.3.6 flow diagram would close a Mandatory clause on a document that does not address it.\n\nWHAT IT SUPPORTS: when a food safety plan becomes a controlled document — it is not one today, as FSQM-017 Rev v3 records — this drawing is an input to the flow diagram that plan must carry, and the two should be read together. 2.4.3.3 requires the scope of each plan to document start and end points and all relevant inputs and outputs; the physical route shown here informs that but does not satisfy it.\n\nFSQM-013 governs the premises and the GMP controls applying to the areas this drawing divides, and is where any control over personnel movement across the raw / high-care boundary belongs.\nSOP-401 governs the temperature-controlled units shown on the drawing.\nThe Day 1 to Day 2 changeover clean, on which the dunk bay's change of hygiene status depends, is governed by the sanitation documents in the 900 series.", "revision_history": "Rev New — drawn 2026-09-15. DRAFT. Not approved, not in force.\n\nWHY IT EXISTS. No controlled document in the set described the layout of the production floor or the route product takes across it. Nothing referenced a site plan, a floor plan or a product flow diagram, so the zoning the site works to existed only as practice. That matters more here than it would at most sites, because the two-day rotation makes one floor area low risk on Monday and high care on Tuesday.\n\nHOW IT WAS BUILT. From the architectural floor plan for 415/425, traced to vector and set to a scale derived from a dimension printed on that plan. Equipment positions were measured from the marked-up plan rather than estimated, except for a small number of soft-edged label areas drawn as approximations and marked as such.\n\nTHE TWO-SHEET STRUCTURE IS THE POINT. The floor runs a two-day rotation and the equipment in the room differs between the days. Issuing a single sheet would show a floor that either exists half the time or never.\n\nOPEN BEFORE ISSUE — ONE ITEM:\n\nTHE ZONE BOUNDARIES ARE NOT YET CONFIRMED ON THE FLOOR. They were derived from the identity and position of the equipment rather than from a walk of the building. The division itself is not in doubt — the oven is the kill step, upstream is low risk, downstream is high care — but where exactly the lines fall between the cooling racks, the mixers and the ovens on the west wall is the kind of thing that is settled by standing in the room. The SQF Practitioner confirms or corrects them, and the drawing issues on that confirmation.\n\nDECIDED, AND NOT OPEN:\n\nThe weighing station sits within HIGH CARE on Sheet 2. Nothing is weighed on Day 2, so it is idle equipment in an area cleaned for high-care use, and carving a low-risk pocket around it would create a raw island inside a high-care zone for no control benefit. The RAW / PRE-BAKE zone on Sheet 2 is the bottom strip holding the ingredients.\n\nSCOPED OUT, AND NOT OMISSIONS:\n\nPersonnel flow, hand-wash points and allergen segregation. This drawing answers where equipment stands and where product goes. Personnel movement is a different question with a different review cycle, and three overlays on one sheet make all three harder to read. Control over personnel crossing the raw / high-care boundary belongs to the GMP programme, FSQM-013.\n\nSTATED LIMITATIONS, AND NOT DEFECTS:\n\nThe scale carries a tolerance of about three percent — around two feet on this building. That is immaterial for judging which zone a machine stands in and inadequate for construction, and both sheets are marked NOT FOR CONSTRUCTION. A single tape measurement of a known wall would remove it if the drawing is ever needed for another purpose.\n\nThe sheets are 11.31 by 12.61 inches, which is not a standard paper size and will scale if printed.", "attachments": []}$j037$::jsonb
);

do $$
declare r record;
begin
  select status, revision, type, category, sqf_required, sqf_reference,
         (content->>'governing_reference') like '%WHAT IT IS NOT%'               as disclaims_2436,
         (content->'procedure')::text like '%shall not be offered as one%'       as no_offer,
         (content->'procedure')::text like '%CHANGES HYGIENE STATUS BETWEEN THE TWO DAYS%' as dunk_bay,
         (content->>'revision_history') like '%OPEN BEFORE ISSUE — ONE ITEM%'    as one_open_item,
         (content->>'revision_history') like '%DECIDED, AND NOT OPEN%'           as decided_section,
         (content->>'revision_history') like '%SCOPED OUT, AND NOT OMISSIONS%'   as scoped_section,
         (content->>'scope') like '%DELIBERATELY OUT OF SCOPE%'                  as scope_excludes,
         (content->'procedure')::text like '%this is a decision rather than an accident%' as weigh_decided,
         jsonb_array_length(content->'attachments')                             as files,
         jsonb_array_length(content->'procedure')                               as lines
    into r
    from public.sop_documents where sop_number = 'FSQM-037';

  if r.status is distinct from 'draft' or r.revision is distinct from 'New' then
    raise exception 'FSQM-037 seeded as %/%, expected draft/New.', r.status, r.revision;
  end if;
  if r.type is distinct from 'fsqm' or r.category is distinct from 'Food Safety Quality Manual' then
    raise exception 'FSQM-037 typed %/%.', r.type, r.category;
  end if;
  -- The whole point of the null reference: this drawing must not appear to close a clause.
  if r.sqf_reference is not null or r.sqf_required is not false then
    raise exception 'FSQM-037 must carry no sqf_reference and sqf_required false; got %/%.',
      r.sqf_reference, r.sqf_required;
  end if;
  if not r.disclaims_2436 or not r.no_offer then
    raise exception 'FSQM-037 no longer disclaims 2.4.3.6; that disclaimer is why it may be issued.';
  end if;
  if not r.dunk_bay then
    raise exception 'FSQM-037 lost the dunk bay caveat, which is the reason the drawing exists.';
  end if;
  -- A document that drifts back to a long list of open items has stopped being a deliverable.
  if not r.one_open_item or not r.decided_section or not r.scoped_section
     or not r.scope_excludes or not r.weigh_decided then
    raise exception 'FSQM-037 lost the one-open-item structure (decided / scoped out / limitations).';
  end if;
  if r.files <> 0 then
    raise exception 'FSQM-037 attachments should seed empty; files are added through the drawer.';
  end if;
  raise notice 'FSQM-037 seeded draft: % procedure lines, no clause claimed, ONE open item.', r.lines;
end $$;

commit;

-- AFTER PUSHING, ATTACH THE THREE FILES (SQL cannot write Storage):
--   Team Portal -> Compliance -> SOPs Library -> FSQM-037 -> Reference Documents tab -> Upload
--     1. 415 425 SQF Facility Plan ROTATION 1.pdf   (Sheet 1 of 2 - Day 1)
--     2. 415 425 SQF Facility Plan ROTATION 2.pdf   (Sheet 2 of 2 - Day 2)
--     3. 415 425 SQF Facility Plan ROTATION.drawio  (editable master)
--   The drawer uploads to training-content/<id>/files/<name> and maintains content.attachments.
--   The .drawio has no web media type; if the picker rejects it, zip it first.
--
-- THEN: the SQF Practitioner walks the floor and confirms the zone boundaries. That is the only
-- thing standing between this draft and issue. The issue migration sets status active, revision
-- unchanged at New, approved_by GJM and the effective date, matching 20260910000010 for FSQM-036.
