-- D-09 task 1: FRM-207 Material Specification Register, seeded as a draft.
--
-- D-09 is "Specification Control Procedure + Spec Library" and carries six Minor findings, the
-- central one being 2.3.2.2: specifications for all raw materials and packaging - ingredients,
-- additives, processing aids, packaging, hazardous chemicals - documented and kept current. The
-- consultant found there were none. This is the library. The procedure for developing and approving
-- specifications (2.3.2.1), validation (2.3.2.4) and supplier change notification (2.3.2.5) follow.
--
-- WHY THE REGISTER COMES FIRST. SOP-2.3.4 v4 (issued today) approves a material bought through a
-- distributor as a named product from a named manufacturer, and checks the brand on every FRM-301
-- receipt "against the brand approved for that material". Until now that approved brand was written
-- down nowhere. The site buys almost everything through Sysco and Restaurant Depot (owner,
-- 2026-09-18), so this register is also what makes that receiving check possible.
--
-- ONE ENTRY PER MATERIAL, the FRM-206 pattern, for the same deciding reason: attachments hang off an
-- entry, so each material's spec sheet and allergen statement attach to that material's record. The
-- Entries list is the library - material, category, status and manufacturer carry showInList.
--
-- APPROVED AS A NAMED PRODUCT FROM A NAMED MANUFACTURER. Section 2 records the approved brand, and an
-- "Approved alternates" grid records other brands only once their allergens have been checked -
-- the substitution rule in SOP-2.3.4 v4. Section 2 opts into the package-label scan, so the
-- manufacturer, product name, item code and pack size are read off a photograph of the pack;
-- "Bought from" is pinned out of the scan, because the distributor is not on the pack.
--
-- ALLERGENS ARE A REQUIRED MULTI-SELECT with an explicit "None of the major allergens" and a "Not
-- applicable - not a food ingredient" option, so an entry can never be submitted with the question
-- unanswered - a blank there would read as "none". The nine are the US major food allergens.
--
-- NOTHING IS PRE-POPULATED. No fixed rows, no example materials - the register lists what the site
-- actually buys, entered one material at a time. (The FRM-001 lesson: a record asserting things the
-- site does not do is worse than an incomplete one.)
--
-- FRM-207 IS FREE. 202-206 are live; the remediation workbook references 201-204 and 206; nothing
-- reserves 207. The 200 block is Sourcing & Supplier Approval, beside FRM-202 and REP-201.
--
-- sqf_reference is 2.3.2.2 only: that is the clause this form answers. The others close with the
-- procedure, and claiming them here would overstate what a register does.

begin;

do $guard$
begin
  if exists (select 1 from public.sop_documents where sop_number = 'FRM-207') then
    raise exception 'FRM-207 already exists.';
  end if;
  if (select revision from public.sop_documents where sop_number = 'SOP-2.3.4') <> 'v4' then
    raise exception 'SOP-2.3.4 is not v4; this register implements its brand rule.';
  end if;
  if (select count(*) from public.sop_documents
       where sop_number in ('FRM-202', 'REP-201', 'FRM-301') and status = 'active') <> 3 then
    raise exception 'FRM-202, REP-201 and FRM-301 must all be active; the register cites them.';
  end if;
end $guard$;

insert into public.sop_documents
  (sop_number, title, type, category, status, revision, sqf_reference, sqf_required, content)
values
  ('FRM-207', 'Material Specification Register', 'form', 'Module 2', 'draft', 'New',
   '2.3.2.2', true, jsonb_build_object('form_schema', $j207${"schemaVersion": 1, "settings": {"attachmentsEnabled": true, "allowMultipleDrafts": true, "requireVerification": true, "instanceTitleTemplate": "{material_name} — {manufacturer}"}, "sections": [{"id": "material", "title": "1. The material", "fields": [{"id": "how_this_works", "type": "info", "label": "How this register works", "text": "ONE ENTRY IS ONE MATERIAL AS APPROVED: a named product from a named manufacturer. The Entries list is the specification library - material, category, manufacturer and whether it is current - and each entry carries the manufacturer's specification sheet and allergen statement as attachments.\n\nWHAT 2.3.2.2 ASKS FOR. Specifications for all raw materials and packaging that impact finished product safety - ingredients, additives, processing aids, packaging and hazardous chemicals - documented and kept current.\n\nWHY THE BRAND IS PART OF IT. SOP-2.3.4 approves a material bought through a distributor as a named product from a named manufacturer. The approved brand recorded here is what the Brand / Manufacturer column on FRM-301 is checked against at every delivery. A different brand is a new material: record it under Approved alternates only once its allergens have been checked.\n\nA DISCONTINUED MATERIAL STAYS ON THE REGISTER, marked Discontinued. Deleting it would leave no record of what was specified when it was in use."}, {"id": "material_name", "type": "text", "label": "Material", "width": "half", "required": true, "showInList": true, "help": "The site's own name for it, e.g. \"Creme cake base\", \"High-ratio cake flour\"."}, {"id": "category", "type": "select", "label": "Category", "width": "half", "required": true, "showInList": true, "options": ["Ingredient", "Additive / flavouring", "Processing aid", "Packaging - food contact", "Packaging - not food contact", "Hazardous chemical"]}, {"id": "status", "type": "select", "label": "Status", "width": "third", "required": true, "showInList": true, "options": ["Current", "Under review", "Discontinued"]}, {"id": "used_in", "type": "textarea", "label": "Where it is used", "help": "The products or process steps that use it."}]}, {"id": "source", "title": "2. Approved source", "scanLabel": true, "scanMode": "ingredient", "fields": [{"id": "source_info", "type": "info", "label": "Photograph the pack to fill this section", "text": "Use the camera on this section to photograph the product's label: the manufacturer, product name, item code and pack size are read off it. Check each value before saving.\n\nBOUGHT FROM is the distributor or supplier - Sysco, Restaurant Depot - and must be on the approved supplier register (FRM-202 / REP-201). THE MANUFACTURER is the brand on the pack."}, {"id": "manufacturer", "type": "text", "label": "Manufacturer / brand", "width": "half", "required": true, "showInList": true, "scanFact": "brand"}, {"id": "manufacturer_product", "type": "text", "label": "Manufacturer's product name", "width": "half", "required": true, "scanFact": "product_name"}, {"id": "item_code", "type": "text", "label": "Manufacturer / distributor item code", "width": "third", "scanFact": "item_code"}, {"id": "pack_size", "type": "text", "label": "Pack size", "width": "third", "scanFact": "pack_size"}, {"id": "bought_from", "type": "select", "label": "Bought from", "width": "third", "required": true, "multiple": true, "allowOther": true, "scanFact": "none", "options": ["Sysco", "Restaurant Depot"]}, {"id": "alternates", "type": "grid", "label": "Approved alternates", "help": "Other brands accepted for this material. A brand is added here only after its allergen declaration has been checked against Section 4; if its allergens differ, it needs the SQF Practitioner's review first, because the allergen statement on finished product may have to change.", "rows": {"mode": "dynamic", "addLabel": "Add alternate brand"}, "columns": [{"id": "brand", "type": "text", "label": "Manufacturer / brand", "width": 3}, {"id": "product", "type": "text", "label": "Product name / code", "width": 3}, {"id": "allergens_same", "type": "select", "label": "Allergens vs approved", "width": 2, "options": ["Same", "Different - reviewed"]}, {"id": "approved_on", "type": "date", "label": "Approved on", "width": 2}, {"id": "notes", "type": "text", "label": "Notes", "width": 3}]}]}, {"id": "specification", "title": "3. Specification (2.3.2.2)", "fields": [{"id": "spec_info", "type": "info", "label": "What the specification is", "text": "ATTACH THE MANUFACTURER'S SPECIFICATION SHEET to this entry - the Attachments section is at the bottom. For a branded product bought through a distributor this document takes the place of a certificate of analysis for each lot, which a distributor does not issue.\n\nWhere no specification exists - common for commodity items - record what the site specifies instead in the description below, and say so. A blank is not a specification."}, {"id": "spec_on_file", "type": "select", "label": "Manufacturer specification", "width": "half", "required": true, "options": ["Attached to this entry", "Held elsewhere - named below", "Requested, not yet received", "None issued - site specification below"]}, {"id": "spec_location", "type": "text", "label": "Where it is held", "width": "half"}, {"id": "spec_issue_date", "type": "date", "label": "Specification issue date", "width": "third", "help": "The date printed on the manufacturer's sheet, so a newer one can be recognised."}, {"id": "description", "type": "textarea", "label": "Description and key characteristics", "required": true, "help": "What the material is and what it must be - form, colour, key limits the manufacturer states."}, {"id": "storage", "type": "select", "label": "Storage", "width": "third", "required": true, "options": ["Ambient", "Chilled - at or below 40°F", "Frozen"]}, {"id": "shelf_life", "type": "text", "label": "Shelf life", "width": "third", "help": "Unopened, as stated by the manufacturer; and once opened, where it differs."}]}, {"id": "allergens", "title": "4. Allergens", "fields": [{"id": "allergen_info", "type": "info", "label": "Read the declaration, not the product name", "text": "Record what the manufacturer's allergen statement or ingredient list declares - including any \"may contain\" or \"made in a facility with\" statement. These are the figures an alternate brand is checked against at receipt, and they feed the allergen statement on finished product."}, {"id": "allergens_contains", "type": "select", "label": "Contains", "required": true, "multiple": true, "options": ["Milk", "Egg", "Wheat", "Soy", "Peanut", "Tree nuts", "Sesame", "Fish", "Crustacean shellfish", "None of the major allergens", "Not applicable - not a food ingredient"]}, {"id": "may_contain", "type": "textarea", "label": "May contain / precautionary statement", "help": "Word for word from the pack or statement. Write \"none\" where there is none."}, {"id": "allergen_statement", "type": "select", "label": "Allergen statement", "width": "half", "required": true, "options": ["Attached to this entry", "On the specification sheet", "Taken from the pack label - photo attached", "Not applicable - not a food ingredient"]}]}, {"id": "review", "title": "5. Review and approval", "fields": [{"id": "review_info", "type": "info", "label": "Keeping it current", "text": "2.3.2.2 requires specifications to be KEPT CURRENT. Review each entry at least annually and whenever the manufacturer issues a new sheet, changes the product, or a different brand is bought. Ask the supplier to tell the site of any change in composition - allergens especially - and record that it was asked."}, {"id": "change_notice", "type": "select", "label": "Supplier asked to notify changes in composition", "width": "half", "options": ["Yes - recorded", "Not yet"]}, {"id": "next_review", "type": "date", "label": "Next review of this entry", "width": "half", "required": true}, {"id": "approved_by", "type": "signature", "role": "verifier", "required": true, "label": "Reviewed and approved by the SQF Practitioner", "statement": "This specification is current, the manufacturer and product named are the ones approved for this material, and the allergens recorded match the manufacturer's declaration."}]}]}$j207$::jsonb));

do $verify$
declare r record; fs jsonb;
begin
  select status, revision, sqf_reference, sqf_required, content->'form_schema' as f into r
    from public.sop_documents where sop_number = 'FRM-207';
  fs := r.f;
  if (r.status, r.revision, r.sqf_reference) is distinct from ('draft', 'New', '2.3.2.2') or not r.sqf_required then
    raise exception 'FRM-207 wrong: %/%/%.', r.status, r.revision, r.sqf_reference;
  end if;
  if jsonb_array_length(fs->'sections') <> 5 then raise exception 'expected 5 sections.'; end if;
  if (select count(*) from jsonb_array_elements(fs->'sections') s, jsonb_array_elements(s->'fields') f) <> 27 then
    raise exception 'expected 27 fields.';
  end if;
  -- the entries list is the library
  if (select count(*) from jsonb_array_elements(fs->'sections') s, jsonb_array_elements(s->'fields') f
       where (f->>'showInList')::boolean) <> 4 then
    raise exception 'entries list should carry material, category, status and manufacturer.';
  end if;
  -- the approved brand and the allergen answer cannot be left blank
  if (select count(*) from jsonb_array_elements(fs->'sections') s, jsonb_array_elements(s->'fields') f
       where f->>'id' in ('manufacturer', 'allergens_contains', 'spec_on_file', 'description', 'storage')
         and (f->>'required')::boolean) <> 5 then
    raise exception 'manufacturer, allergens, specification, description and storage must be required.';
  end if;
  if (select count(*) from jsonb_array_elements(fs->'sections') s, jsonb_array_elements(s->'fields') f
       where f->>'type' = 'signature' and f->>'role' = 'verifier') <> 1 then
    raise exception 'FRM-207 needs exactly one verifier signature.';
  end if;
  -- scan: only the source section, and never the distributor
  if (select count(*) from jsonb_array_elements(fs->'sections') s where (s->>'scanLabel')::boolean) <> 1
     or (select f->>'scanFact' from jsonb_array_elements(fs->'sections') s, jsonb_array_elements(s->'fields') f
          where f->>'id' = 'bought_from') <> 'none' then
    raise exception 'label scan mis-configured.';
  end if;
  if fs::text like '%"labels"%' then
    raise exception 'FRM-207 carries fixed rows; the register must list only what the site buys.';
  end if;
  raise notice 'FRM-207 seeded as a draft: 5 sections, 27 fields.';
end $verify$;

commit;
