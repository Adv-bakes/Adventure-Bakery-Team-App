-- FRM-207 v2 - fill the whole entry from one photo of the pack.
--
-- Owner's request, 2026-09-18, with a Pillsbury Creme Cake Base bag as the sample. v1 already had a
-- scan on Section 2 (manufacturer, product name, item code, pack size). What the pack also carries -
-- and what a SPECIFICATION is mostly for - is the declarations: the ingredient statement, the
-- "Contains" line and the storage instruction. The scan was built never to read those.
--
-- THAT RULE STILL HOLDS FOR RECEIVING. It is kept, not reversed: for a DELIVERY an allergen
-- declaration comes off the spec sheet, not off whatever part of a panel is in frame. This adds a
-- third scan mode, "specification", used only here, where the printed label is itself the
-- manufacturer's regulated declaration and the photo stays on the entry as the evidence.
--
-- THE ALLERGEN BOXES ARE NOT THE MODEL'S JUDGEMENT. The model transcribes the Contains statement
-- word for word into its own field; which of the nine boxes are ticked is decided by deterministic
-- word matching on that text (supabase/functions/_shared/allergenStatement.ts, tested by
-- scripts/test-allergen-statement.mjs). No Contains statement -> no allergen answer, with a
-- warning; the scan never ticks "None of the major allergens". Storage is filled only when the pack
-- states an instruction - silence is not "ambient".
--
-- Changes (every existing field id kept, so the one draft entry keeps its answers):
--   Section 1  material_name pinned to the product name (editable; the site's own name).
--   Section 2  scanMode "specification", scanScope "form" - the one camera fills fields in other
--              sections that pin a scanFact; the instructions say so. pack_size relabelled
--              "Net weight / pack size" and pinned to net weight (a bag shows net weight, not a
--              case configuration).
--   Section 3  storage pinned to the scanned storage class.
--   Section 4  NEW ingredient_statement and contains_statement fields, verbatim, before the
--              Contains boxes; allergens_contains and may_contain pinned.
--
-- Revised to v2, GJM, 2026-09-18 - FRM-207 is issued, so a schema change is a revision and the
-- history trigger snapshots New. Guarded on the md5 of the issued schema.
--
-- NEEDS THE EDGE FUNCTION: extract-package-label must be redeployed with the specification mode.
-- Until it is, the old function treats the unknown mode as "ingredient" and fills Section 2 only,
-- exactly as v1 did - nothing breaks, the declarations just stay blank.

begin;

do $guard$
declare st text; rev text; h text;
begin
  select status, revision, md5((content->'form_schema')::text) into st, rev, h
    from public.sop_documents where sop_number = 'FRM-207';
  if (st, rev) is distinct from ('active', 'New') then
    raise exception 'FRM-207 is %/% - expected the issued New.', st, rev;
  end if;
  if h <> 'bcad26828d316f84c0bd8d004430d01e' then
    raise exception 'FRM-207 form_schema changed since this migration was written (md5 %).', h;
  end if;
end $guard$;

update public.sop_documents
   set content        = jsonb_set(content, '{form_schema}', $fs${"sections": [{"id": "material", "title": "1. The material", "fields": [{"id": "how_this_works", "text": "ONE ENTRY IS ONE MATERIAL AS APPROVED: a named product from a named manufacturer. The Entries list is the specification library - material, category, manufacturer and whether it is current - and each entry carries the manufacturer's specification sheet and allergen statement as attachments.\n\nWHAT 2.3.2.2 ASKS FOR. Specifications for all raw materials and packaging that impact finished product safety - ingredients, additives, processing aids, packaging and hazardous chemicals - documented and kept current.\n\nWHY THE BRAND IS PART OF IT. SOP-2.3.4 approves a material bought through a distributor as a named product from a named manufacturer. The approved brand recorded here is what the Brand / Manufacturer column on FRM-301 is checked against at every delivery. A different brand is a new material: record it under Approved alternates only once its allergens have been checked.\n\nA DISCONTINUED MATERIAL STAYS ON THE REGISTER, marked Discontinued. Deleting it would leave no record of what was specified when it was in use.", "type": "info", "label": "How this register works"}, {"id": "material_name", "help": "The site's own name for it. Filled from the pack's product name by the scan in Section 2 - change it if the site calls it something else.", "type": "text", "label": "Material", "width": "half", "required": true, "showInList": true, "scanFact": "product_name"}, {"id": "category", "type": "select", "label": "Category", "width": "half", "options": ["Ingredient", "Additive / flavouring", "Processing aid", "Packaging - food contact", "Packaging - not food contact", "Hazardous chemical"], "required": true, "showInList": true}, {"id": "status", "type": "select", "label": "Status", "width": "third", "options": ["Current", "Under review", "Discontinued"], "required": true, "showInList": true}, {"id": "used_in", "help": "The products or process steps that use it.", "type": "textarea", "label": "Where it is used"}]}, {"id": "source", "title": "2. Approved source", "fields": [{"id": "source_info", "text": "Use Scan pack on this section and photograph the label. One photo fills the whole entry where the pack shows it: the manufacturer, product name, item code and net weight here; the storage instruction in Section 3; and in Section 4 the ingredient statement, the Contains statement and any may-contain statement, word for word. The photo is kept on the entry as the evidence for what was transcribed.\n\nIF THE PANEL IS ON ANOTHER SIDE, scan that side too - each scan fills what it can read.\n\nCHECK EVERY VALUE BEFORE SAVING, the allergens above all. The allergen boxes are ticked only from the printed Contains statement, never guessed from the ingredient list; if no Contains statement was readable they are left blank and the scan says so.\n\nBOUGHT FROM is the distributor or supplier, chosen from the approved supplier register - it is not on the pack, so the scan never fills it.", "type": "info", "label": "Photograph the pack to fill this entry"}, {"id": "manufacturer", "type": "text", "label": "Manufacturer / brand", "width": "half", "required": true, "scanFact": "brand", "showInList": true}, {"id": "manufacturer_product", "type": "text", "label": "Manufacturer's product name", "width": "half", "required": true, "scanFact": "product_name"}, {"id": "item_code", "type": "text", "label": "Manufacturer / distributor item code", "width": "third", "scanFact": "item_code"}, {"id": "pack_size", "type": "text", "label": "Net weight / pack size", "width": "third", "scanFact": "net_weight"}, {"id": "bought_from", "help": "Only suppliers with a submitted FRM-202 approval (Approved or Conditionally Approved) can be chosen - the same list as REP-201.", "type": "select", "label": "Bought from", "width": "third", "options": [], "multiple": true, "required": true, "scanFact": "none", "optionsFrom": {"form": "FRM-202", "field": "supplier_name", "filters": [{"op": "in", "field": "supplier_status", "values": ["APPROVED – meets all documentation or recognized-distributor requirements.", "CONDITIONALLY APPROVED – lacks one or more documents but poses low food-safety risk (recognized distributor)."]}], "emptyText": "No supplier has a submitted approval yet. Approve the supplier on FRM-202 and submit it; it then appears here."}}, {"id": "alternates", "help": "Other brands accepted for this material. A brand is added here only after its allergen declaration has been checked against Section 4; if its allergens differ, it needs the SQF Practitioner's review first, because the allergen statement on finished product may have to change.", "rows": {"mode": "dynamic", "addLabel": "Add alternate brand"}, "type": "grid", "label": "Approved alternates", "columns": [{"id": "brand", "type": "text", "label": "Manufacturer / brand", "width": 3}, {"id": "product", "type": "text", "label": "Product name / code", "width": 3}, {"id": "allergens_same", "type": "select", "label": "Allergens vs approved", "width": 2, "options": ["Same", "Different - reviewed"]}, {"id": "approved_on", "type": "date", "label": "Approved on", "width": 2}, {"id": "notes", "type": "text", "label": "Notes", "width": 3}]}], "scanMode": "specification", "scanLabel": true, "scanScope": "form"}, {"id": "specification", "title": "3. Specification (2.3.2.2)", "fields": [{"id": "spec_info", "text": "ATTACH THE MANUFACTURER'S SPECIFICATION SHEET to this entry - the Attachments section is at the bottom. For a branded product bought through a distributor this document takes the place of a certificate of analysis for each lot, which a distributor does not issue.\n\nWhere no specification exists - common for commodity items - record what the site specifies instead in the description below, and say so. A blank is not a specification.", "type": "info", "label": "What the specification is"}, {"id": "spec_on_file", "type": "select", "label": "Manufacturer specification", "width": "half", "options": ["Attached to this entry", "Held elsewhere - named below", "Requested, not yet received", "None issued - site specification below"], "required": true}, {"id": "spec_location", "type": "text", "label": "Where it is held", "width": "half"}, {"id": "spec_issue_date", "help": "The date printed on the manufacturer's sheet, so a newer one can be recognised.", "type": "date", "label": "Specification issue date", "width": "third"}, {"id": "description", "help": "What the material is and what it must be - form, colour, key limits the manufacturer states.", "type": "textarea", "label": "Description and key characteristics", "required": true}, {"id": "storage", "type": "select", "label": "Storage", "width": "third", "options": ["Ambient", "Chilled - at or below 40°F", "Frozen"], "required": true, "scanFact": "storage"}, {"id": "shelf_life", "help": "Unopened, as stated by the manufacturer; and once opened, where it differs.", "type": "text", "label": "Shelf life", "width": "third"}]}, {"id": "allergens", "title": "4. Allergens", "fields": [{"id": "allergen_info", "text": "Record what the manufacturer declares - the ingredient statement and the Contains statement word for word, and any \"may contain\" or \"made in a facility with\" statement. These are what an alternate brand is checked against at receipt, and they feed the allergen statement on finished product.\n\nFROM A SCAN: the Contains boxes are ticked by matching the words of the printed Contains statement shown below them, so each ticked box can be traced to the pack. A scan never ticks \"None of the major allergens\" - only a person can decide there are none.", "type": "info", "label": "Read the declaration, not the product name"}, {"id": "ingredient_statement", "type": "textarea", "label": "Ingredient statement (as printed)", "scanFact": "ingredients", "help": "Word for word from the pack or specification sheet."}, {"id": "contains_statement", "type": "text", "label": "Contains statement (as printed)", "scanFact": "contains_statement", "help": "e.g. \"CONTAINS WHEAT, MILK, SOY AND EGG INGREDIENTS.\" Blank where the pack carries none."}, {"id": "allergens_contains", "type": "select", "label": "Contains", "options": ["Milk", "Egg", "Wheat", "Soy", "Peanut", "Tree nuts", "Sesame", "Fish", "Crustacean shellfish", "None of the major allergens", "Not applicable - not a food ingredient"], "multiple": true, "required": true, "scanFact": "allergens"}, {"id": "may_contain", "help": "Word for word from the pack or statement. Write \"none\" where there is none.", "type": "textarea", "label": "May contain / precautionary statement", "scanFact": "may_contain"}, {"id": "allergen_statement", "type": "select", "label": "Allergen statement", "width": "half", "options": ["Attached to this entry", "On the specification sheet", "Taken from the pack label - photo attached", "Not applicable - not a food ingredient"], "required": true}]}, {"id": "review", "title": "5. Review and approval", "fields": [{"id": "review_info", "text": "2.3.2.2 requires specifications to be KEPT CURRENT. Review each entry at least annually and whenever the manufacturer issues a new sheet, changes the product, or a different brand is bought. Ask the supplier to tell the site of any change in composition - allergens especially - and record that it was asked.", "type": "info", "label": "Keeping it current"}, {"id": "change_notice", "type": "select", "label": "Supplier asked to notify changes in composition", "width": "half", "options": ["Yes - recorded", "Not yet"]}, {"id": "next_review", "type": "date", "label": "Next review of this entry", "width": "half", "required": true}, {"id": "approved_by", "role": "verifier", "type": "signature", "label": "Reviewed and approved by the SQF Practitioner", "required": true, "statement": "This specification is current, the manufacturer and product named are the ones approved for this material, and the allergens recorded match the manufacturer's declaration."}]}], "settings": {"attachmentsEnabled": true, "allowMultipleDrafts": true, "requireVerification": true, "instanceTitleTemplate": "{material_name} — {manufacturer}"}, "schemaVersion": 1}$fs$::jsonb),
       revision       = 'v2',
       effective_date = date '2026-09-18',
       approved_by    = 'GJM'
 where sop_number = 'FRM-207';

do $verify$
declare fs jsonb; n int;
begin
  select content->'form_schema' into fs from public.sop_documents where sop_number = 'FRM-207';
  select count(*) into n from jsonb_array_elements(fs->'sections') s, jsonb_array_elements(s->'fields') f;
  if n <> 29 then raise exception 'expected 29 fields, found %.', n; end if;
  if (select count(*) from jsonb_array_elements(fs->'sections') s
       where s->>'scanMode' = 'specification' and s->>'scanScope' = 'form' and (s->>'scanLabel')::boolean) <> 1 then
    raise exception 'Section 2 is not a form-wide specification scan.';
  end if;
  -- each declaration has exactly one field pinned to it
  if (select count(*) from jsonb_array_elements(fs->'sections') s, jsonb_array_elements(s->'fields') f
       where f->>'scanFact' in ('ingredients', 'contains_statement', 'allergens', 'may_contain', 'storage')) <> 5 then
    raise exception 'declaration pins wrong.';
  end if;
  -- the allergen answer is still required, and a person still has to be able to say "none"
  if not exists (select 1 from jsonb_array_elements(fs->'sections') s, jsonb_array_elements(s->'fields') f
                  where f->>'id' = 'allergens_contains' and (f->>'required')::boolean
                    and f->'options' ? 'None of the major allergens') then
    raise exception 'allergens_contains lost its required flag or its None option.';
  end if;
  if (select f->>'scanFact' from jsonb_array_elements(fs->'sections') s, jsonb_array_elements(s->'fields') f
       where f->>'id' = 'bought_from') <> 'none' then
    raise exception 'Bought from must never be filled by a scan.';
  end if;
  if (select revision from public.sop_documents where sop_number = 'FRM-207') <> 'v2' then
    raise exception 'FRM-207 not revised to v2.';
  end if;
  raise notice 'FRM-207 v2: one photo fills the entry; 29 fields.';
end $verify$;

commit;
