-- D-09 task 9.7: SOP-11.1.7 Equipment and Utensil Specification and Purchasing, seeded as a draft.
--
-- SQF 11.1.7.1: "Specifications for equipment and utensils and procedures for purchasing equipment
-- shall be documented and implemented." Scored Non-Compliant - no specifications, no purchasing
-- procedure. The only Module 11 clause in D-09.
--
-- One page, in the SOP-11.x clause-numbered form (SOP-11.2.12, SOP-11.7.3). Step 1 is the
-- specification - food-contact materials, cleanability, no wood, glass only via FRM-907, food-grade
-- lubricants, a manual - written once for every item rather than one document per machine. Steps 2-3
-- are the purchasing route: approved by the SQF Practitioner before ordering, checked and entered
-- on FRM-004 before first use.
--
-- THE RECORD IS FRM-004 Equipment Register (active, New, 11.2.1.2). It does not yet have the columns
-- this procedure writes to - food-contact materials, the purchase check, a utensil list. Those are
-- added as FRM-004 v2 IN THE ISSUE MIGRATION, together with issuing this SOP, so an issued form never
-- points at a draft procedure. FRM-004's one entry is an unsubmitted draft; adding optional columns
-- keeps its answers.
--
-- Draft, New, for the owner's review.

begin;

do $guard$
begin
  if exists (select 1 from public.sop_documents where sop_number = 'SOP-11.1.7') then
    raise exception 'SOP-11.1.7 already exists.';
  end if;
  if (select count(*) from public.sop_documents
       where sop_number in ('FRM-004', 'FRM-907', 'SOP-11.7.3', 'FSQM-018', 'SOP-2.3.2') and status = 'active') <> 5 then
    raise exception 'a document SOP-11.1.7 names is missing or not active.';
  end if;
end $guard$;

insert into public.sop_documents
  (sop_number, title, type, category, status, revision, sqf_reference, sqf_required, content)
values
  ('SOP-11.1.7', 'Equipment and Utensil Specification and Purchasing', 'sop', 'Module 11', 'draft', 'New',
   '11.1.7.1', true, $q${"purpose": "To specify what equipment and utensils used in food handling areas must be made of and how they must be built, and to make sure nothing is bought for those areas until it has been checked against that specification.", "scope": "All equipment and utensils bought for, or brought into, the production, packaging and warewashing areas: machines, and small wares such as pans, molds, bowls, scrapers, spatulas, scoops, containers and racks. It covers new and second-hand items and replacement parts that touch food. Raw materials, packaging and chemicals are specified under SOP-2.3.2.", "definitions": "Food-contact surface: any surface that product, or packaging that touches product, comes into contact with, and any surface from which liquid or debris can drain or fall onto product.\nUtensil: a hand tool or small ware used to handle, hold or portion product.", "responsibility": "The SQF Practitioner approves every purchase of equipment or utensils for a food handling area against this specification before it is ordered, and keeps FRM-004 Equipment Register current.\nProduction staff do not bring equipment or utensils into a food handling area unless they have been approved, and report any that are damaged.", "procedure": ["Equipment and utensils used in food handling areas meet this specification:", "• food-contact surfaces are stainless steel, food-grade plastic or silicone, or another material the manufacturer states complies with FDA food-contact regulations (21 CFR 174–178) or is certified to an NSF/ANSI food equipment standard;", "• food-contact surfaces are smooth and non-absorbent, free of cracks, pits and flaking coatings, and can be cleaned and sanitised with the site's methods and Sani-512 without damage;", "• wood is not bought for food-contact use, and glass or brittle plastic only where it is listed on FRM-907 under SOP-11.7.3;", "• equipment can be taken apart, or is open enough, to be cleaned and inspected, with no hollow parts, dead ends or joints where product can collect out of reach;", "• lubricants and other fluids that could reach product are food grade (H1);", "• a machine comes with the manufacturer's manual, including its cleaning instructions.", "Nothing is bought for a food handling area until the SQF Practitioner has checked it against step 1 and approved it.", "• The check is made against the manufacturer's specification sheet, listing or manual. Where the material of a food-contact part cannot be confirmed, the item is not bought.", "• Second-hand equipment is checked the same way, and inspected in person for damage and cleanability before it is bought.", "Before new equipment is first used:", "• it is inspected for damage and to confirm it is what was approved;", "• it is cleaned and sanitised;", "• it is added to FRM-004 Equipment Register with its food-contact materials and the date of the purchase check, and its manual or specification sheet is attached to the register;", "• a machine is given an operating SOP and, where it touches food, a sanitation SOP, and the people who will use it are trained on them;", "• any glass or brittle plastic on it is added to FRM-907.", "Utensils are listed on FRM-004 by type, such as scrapers, spatulas, molds or sheet pans, with their material. Replacing a listed type like for like needs no new approval; a new type, or the same type in a different material, does.", "Equipment or utensils that are damaged, or no longer meet step 1, are taken out of use and repaired or replaced. A machine is marked Out of service on FRM-004 and handled under FSQM-018.", "> Equipment in use when this procedure was issued was not bought under it. Each item is checked against step 1 at the next review of FRM-004, and anything that does not meet it is recorded there with what will be done about it."], "form_references": "FRM-004 - Equipment Register (the equipment and utensil list, food-contact materials, purchase checks, manuals)\nFRM-907 - Glass & Brittle Plastic Register\nSOP-11.7.3 - Glass & Brittle Plastic Control\nFSQM-018 - Non-Conforming Product and Equipment\nSOP-2.3.2 - Raw and Packaging Materials (materials, packaging and chemicals)", "records": "• FRM-004 Equipment Register, with each machine's manual or specification sheet attached\n• FRM-907 Glass & Brittle Plastic Register", "governing_reference": "SQF Food Safety Code: Food Manufacturing, Edition 9 - 11.1.7.1", "revision_history": "New - 2026-09-21 - Drafted under D-09 for SQF 11.1.7.1, which the gap assessment scored Non-Compliant: no specifications for equipment and utensils, and no procedure for purchasing equipment.\n\nONE SPECIFICATION FOR THE CLASS, NOT ONE PER ITEM. A small site buys a mixer once a decade and scrapers every month. Step 1 is the specification every item is checked against, so each purchase needs a check, not a document of its own.\n\nTHE RECORD IS FRM-004, NOT A NEW FORM. The equipment register already lists every machine, what it touches and its SOPs. It gains the food-contact materials, the purchase check and the utensil list, and becomes the evidence that this procedure is followed."}$q$::jsonb);

do $verify$
declare r record; p jsonb;
begin
  select status, revision, type, sqf_reference, content into r from public.sop_documents where sop_number = 'SOP-11.1.7';
  p := r.content->'procedure';
  if (r.status, r.revision, r.type, r.sqf_reference) is distinct from ('draft', 'New', 'sop', '11.1.7.1') then
    raise exception 'SOP-11.1.7 wrong: %/%/%/%.', r.status, r.revision, r.type, r.sqf_reference;
  end if;
  if jsonb_array_length(p) <> 19 then raise exception 'procedure is % lines, expected 19.', jsonb_array_length(p); end if;
  if p::text not like '%21 CFR 174%' or p::text not like '%has checked it against step 1 and approved it%'
     or p::text not like '%added to FRM-004%' then
    raise exception 'the specification or the purchasing route is missing.';
  end if;
  raise notice 'SOP-11.1.7 seeded as a draft: % procedure lines.', jsonb_array_length(p);
end $verify$;

commit;
