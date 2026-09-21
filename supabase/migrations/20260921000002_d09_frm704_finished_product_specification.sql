-- D-09 task 9.8: FRM-704 Finished Product Specification, seeded as a draft.
--
-- SQF 2.3.2.9: finished product specifications documented, current, approved by the site and its
-- customer, accessible to relevant staff, and stating where applicable (i) microbiological, chemical
-- and physical limits, (ii) composition to meet label claims, (iii) labelling and packaging
-- requirements and (iv) storage conditions. The site holds none; FSQM-014 Part 5 and FSQM-020 both
-- carry that as an open item and state their criteria in terms instead.
--
-- A FORM, ONE ENTRY PER PRODUCT (owner, 2026-09-21), the FRM-207 pattern. The site makes rum cakes in
-- several flavours for Bahamas Rum Cake Factory and other customers' products besides, so a single
-- document would be revised every time a flavour is added; an entry per product is added instead,
-- and each carries its own attachments (customer approval, label, any test results). Sections 2-4
-- are the four limbs of 2.3.2.9, in the clause's order.
--
-- WHAT IT REFUSES TO PRETEND. The site performs no analysis (FSQM-014 Part 2) and has not measured
-- the product's water activity (D-16), so Section 3 asks for "Not tested" / "Not yet measured" in
-- words rather than a number, and names what IS controlled: the CCP limits on FRM-507 and FRM-606.
-- Customer approval is a required select with "Not yet requested" / "Requested - not yet received"
-- (owner: site approval only for now) - an entry says plainly that the customer has not approved it,
-- rather than looking approved.
--
-- Composition to meet label claims is a required confirmation that the formula and the label agree
-- and that every ingredient is approved on FRM-207 - the link between the two registers.
--
-- NUMBERING: FRM-704 is free; the 700 block is QC / hold & release, beside FRM-701 (release) and
-- FRM-703 (retention), which are what the specification is inspected and retained against. The
-- remediation workbook reserves no number for it.
--
-- NOT DONE HERE, deliberately: FSQM-014 Part 5 and FSQM-020 Part 4 say their criteria move to the
-- specification once it exists. They are revised once product entries are submitted - pointing
-- them at an empty form would repeat the defect. SOP-2.3.1 already says a finalized specification is
-- issued; FRM-704 is where it now goes.
--
-- sqf_reference 2.3.2.9 only. Draft, New - issued after the owner reviews it.

begin;

do $guard$
begin
  if exists (select 1 from public.sop_documents where sop_number = 'FRM-704') then
    raise exception 'FRM-704 already exists.';
  end if;
  if (select count(*) from public.sop_documents
       where sop_number in ('FRM-207', 'FRM-501', 'FRM-507', 'FRM-601', 'FRM-606', 'FRM-701', 'FSQM-014', 'SOP-2.3.1')
         and status = 'active') <> 8 then
    raise exception 'a document FRM-704 cites is missing or not active.';
  end if;
end $guard$;

insert into public.sop_documents
  (sop_number, title, type, category, status, revision, sqf_reference, sqf_required, content)
values
  ('FRM-704', 'Finished Product Specification', 'form', 'Module 2', 'draft', 'New',
   '2.3.2.9', true, jsonb_build_object('form_schema', $j704${"schemaVersion": 1, "settings": {"attachmentsEnabled": true, "allowMultipleDrafts": true, "requireVerification": true, "instanceTitleTemplate": "{product_name} — {customer_brand}"}, "sections": [{"id": "product", "title": "1. The product", "fields": [{"id": "how_this_works", "type": "info", "label": "How this specification works", "text": "ONE ENTRY IS ONE PRODUCT as it leaves the site: one flavour, in one pack. A new flavour or a new pack size is a new entry.\n\nWHAT 2.3.2.9 ASKS FOR. A finished product specification that is documented, current, approved by the site and by its customer, accessible to the staff who need it, and that states where applicable: microbiological, chemical and physical limits; the composition that supports the label; the labelling and packaging requirements; and the storage conditions. Sections 2 to 4 are those four things, in that order.\n\nWRITE WHAT IS TRUE TODAY. Where something has not been measured or agreed, say so in the field. A blank is not a specification, and a number nobody measured is worse than one.\n\nA DISCONTINUED PRODUCT STAYS ON THE LIST, marked Discontinued, so there is a record of what was specified while it was made."}, {"id": "product_name", "type": "text", "label": "Product", "width": "half", "required": true, "showInList": true, "help": "As it is named on the label, flavour included."}, {"id": "customer_brand", "type": "text", "label": "Customer / brand", "width": "half", "required": true, "showInList": true, "help": "Whose name is on the pack. Adventure Bakery for the site's own product."}, {"id": "status", "type": "select", "label": "Status", "width": "half", "required": true, "showInList": true, "options": ["Current", "Under review", "Discontinued"]}, {"id": "formula_ref", "type": "text", "label": "Formula reference", "width": "half", "required": true, "help": "The formula or batch sheet this product is made to, with its version (e.g. FRM-501). The formula itself stays there; it is not copied here."}, {"id": "description", "type": "textarea", "label": "Description", "required": true, "help": "What the product is and how it is made, in a sentence or two: e.g. baked, dipped in rum syrup, vacuum sealed in a pouch and boxed."}, {"id": "intended_use", "type": "textarea", "label": "Intended use and consumer", "required": true, "help": "Ready to eat or not, and anyone it is not intended for. Carry over what the food safety plan says, such as a caution because of the rum."}, {"id": "food_safety_plan", "type": "text", "label": "Food safety plan that covers it", "help": "The HACCP plan this product is made under. Blank means none does yet - say so instead."}]}, {"id": "composition", "title": "2. Composition", "fields": [{"id": "composition_info", "type": "info", "label": "The composition supports the label", "text": "Record the ingredient statement and allergens exactly as they appear on the approved label, and any claim the label makes. Then confirm that the formula and the label agree, ingredient by ingredient, and that every ingredient is approved on FRM-207 Material Specification Register. That check is what 2.3.2.9 means by composition to meet label claims."}, {"id": "ingredient_statement", "type": "textarea", "label": "Ingredient statement (as on the approved label)", "required": true}, {"id": "allergens", "type": "select", "label": "Contains", "required": true, "multiple": true, "options": ["Milk", "Egg", "Wheat", "Soy", "Peanut", "Tree nuts", "Sesame", "Fish", "Crustacean shellfish", "None of the major allergens"]}, {"id": "may_contain", "type": "textarea", "label": "May contain / precautionary statement", "help": "Word for word from the label. Blank where the label carries none."}, {"id": "claims", "type": "textarea", "label": "Label claims", "required": true, "help": "Every claim on the pack (e.g. no preservatives, made with real rum) and what in the formula supports it. Write None if the label makes no claim."}, {"id": "composition_checked", "type": "checkbox", "label": "The formula and the label agree ingredient by ingredient, and every ingredient is approved on FRM-207", "required": true}]}, {"id": "limits", "title": "3. Safety and quality limits", "fields": [{"id": "limits_info", "type": "info", "label": "What is controlled, and what is not measured", "text": "THE SITE DOES NOT TEST PRODUCT. Under FSQM-014 no microbiological or chemical analysis is performed or commissioned. Record what a customer or the food safety plan specifies, and write Not tested where nothing is measured. Do not state a limit as if it were checked.\n\nWHAT IS CONTROLLED is the process: the critical limits in the food safety plan, recorded on FRM-507 (baking) and FRM-606 (vacuum sealing), and the physical checks made at release on FRM-701.\n\nWATER ACTIVITY AND pH are what make a baked product shelf stable. Record a measured value with its date and who measured it. Where it has not been measured, write Not yet measured."}, {"id": "critical_limits", "type": "textarea", "label": "Critical limits (food safety plan)", "required": true, "help": "e.g. oven at least 350°F for at least 27 minutes; vacuum seal intact and passing the pull test."}, {"id": "water_activity_ph", "type": "text", "label": "Water activity / pH", "required": true, "help": "Measured value, date and who measured it - or Not yet measured."}, {"id": "micro_chem_limits", "type": "textarea", "label": "Microbiological and chemical limits", "required": true, "help": "Limits a customer or regulation sets for this product, or None specified - not tested."}, {"id": "physical_limits", "type": "textarea", "label": "Physical and quality criteria", "required": true, "help": "What is checked before release: appearance, seal, weight, no foreign material. Match FRM-701."}]}, {"id": "pack", "title": "4. Packaging, labelling and storage", "fields": [{"id": "net_weight", "type": "text", "label": "Net weight", "width": "half", "required": true, "showInList": false}, {"id": "pack", "type": "text", "label": "Pack", "width": "half", "required": true, "help": "e.g. vacuum-sealed pouch in an individual box."}, {"id": "case_config", "type": "text", "label": "Case and pallet configuration", "width": "half", "help": "Units per case, cases per pallet."}, {"id": "packaging_materials", "type": "textarea", "label": "Packaging materials", "required": true, "help": "Each material, with its FRM-207 entry. Anything that touches the product needs a food-contact certificate there."}, {"id": "label_ref", "type": "text", "label": "Approved label", "width": "half", "required": true, "help": "The FRM-601 approval and the artwork version."}, {"id": "coding", "type": "text", "label": "Date and lot coding", "width": "half", "required": true, "help": "What is printed and in what format, e.g. Lot: 6153 / Best By: July 2027."}, {"id": "storage", "type": "select", "label": "Storage", "width": "half", "required": true, "options": ["Ambient", "Chilled - at or below 40°F", "Frozen"]}, {"id": "storage_notes", "type": "text", "label": "Storage instructions on the label", "width": "half"}, {"id": "shelf_life", "type": "text", "label": "Shelf life", "width": "half", "required": true, "showInList": true, "help": "As printed, e.g. 12 months from production, coded as Best By month and year."}, {"id": "shelf_life_basis", "type": "textarea", "label": "How the shelf life was set", "required": true, "help": "Tested, validated by the customer, or recommended from the ingredients, process and pack (SOP-2.3.1). Say which, and when."}]}, {"id": "approval", "title": "5. Approval and review", "fields": [{"id": "approval_info", "type": "info", "label": "Approval by the site and by the customer", "text": "2.3.2.9 REQUIRES THE CUSTOMER'S APPROVAL as well as the site's, where the product is made for a customer. Until the customer has approved this specification, record it as not yet provided - do not leave it looking approved. Attach the customer's approval (an email or a signed copy) to this entry when it arrives.\n\nKEEP IT CURRENT. Review each entry at least annually and whenever the formula, an ingredient, the label, the pack or the shelf life changes. The review is recorded by updating the entry, signing it again and setting the next review date."}, {"id": "site_approval", "type": "signature", "label": "Approved for the site by the SQF Practitioner", "role": "verifier", "required": true, "statement": "This specification is current and describes the product as it is made, packed, labelled and stored."}, {"id": "customer_approval", "type": "select", "label": "Customer approval", "width": "half", "required": true, "showInList": true, "options": ["Approved - evidence attached", "Requested - not yet received", "Not yet requested", "Not applicable - site's own product"]}, {"id": "customer_approver", "type": "text", "label": "Approved by (customer)", "width": "half", "help": "Name and title."}, {"id": "customer_approval_date", "type": "date", "label": "Customer approval date", "width": "half"}, {"id": "next_review", "type": "date", "label": "Next review", "width": "half", "required": true}]}]}$j704$::jsonb));

do $verify$
declare r record; fs jsonb;
begin
  select status, revision, sqf_reference, sqf_required, content->'form_schema' as f into r
    from public.sop_documents where sop_number = 'FRM-704';
  fs := r.f;
  if (r.status, r.revision, r.sqf_reference) is distinct from ('draft', 'New', '2.3.2.9') or not r.sqf_required then
    raise exception 'FRM-704 wrong: %/%/%.', r.status, r.revision, r.sqf_reference;
  end if;
  if jsonb_array_length(fs->'sections') <> 5 then raise exception 'expected 5 sections.'; end if;
  if (select count(*) from jsonb_array_elements(fs->'sections') s, jsonb_array_elements(s->'fields') f) <> 35 then
    raise exception 'expected 35 fields.';
  end if;
  if (select count(*) from jsonb_array_elements(fs->'sections') s, jsonb_array_elements(s->'fields') f
       where f->>'id' in ('product_name', 'customer_brand', 'status', 'formula_ref', 'description', 'intended_use', 'ingredient_statement', 'allergens', 'claims', 'composition_checked', 'critical_limits', 'water_activity_ph', 'micro_chem_limits', 'physical_limits', 'net_weight', 'pack', 'packaging_materials', 'label_ref', 'coding', 'storage', 'shelf_life', 'shelf_life_basis', 'site_approval', 'customer_approval', 'next_review') and (f->>'required')::boolean) <> 25 then
    raise exception 'a field that must be answered is not required.';
  end if;
  if (select count(*) from jsonb_array_elements(fs->'sections') s, jsonb_array_elements(s->'fields') f
       where f->>'type' = 'signature' and f->>'role' = 'verifier') <> 1 then
    raise exception 'FRM-704 needs exactly one verifier signature.';
  end if;
  -- the customer's approval can be recorded as absent, never left to look given
  if not exists (select 1 from jsonb_array_elements(fs->'sections') s, jsonb_array_elements(s->'fields') f
                  where f->>'id' = 'customer_approval' and f->'options' ? 'Not yet requested'
                    and f->'options' ? 'Approved - evidence attached') then
    raise exception 'customer approval options wrong.';
  end if;
  if fs::text like '%"labels"%' then
    raise exception 'FRM-704 carries fixed rows; it lists only what the site makes.';
  end if;
  raise notice 'FRM-704 seeded as a draft: 5 sections, 35 fields.';
end $verify$;

commit;
