-- FRM-704 Finished Product Specification, New -> v2: the empty packaging weight and the unit
-- weighed in are recorded on the specification.
--
-- Owner's decision, 2026-10-11. The release record (FRM-701) needs three figures for its net-weight
-- check: the net weight on the label, the weight of the empty packaging, and the unit the packs are
-- weighed in. The first was already on the specification; the other two were written only on each
-- release record, so a product's first release had nothing to start from. Section 4 gains
-- "Empty packaging weight" and "Unit weighed in" after Net weight. The release helper reads all
-- three from the product's specification (after its last release). Nothing else changes.
--
-- Approved by GJM, effective 2026-10-11. The form has no entries yet.
--
-- Safe to run twice: at v2 with the section as intended nothing is updated, so no second history
-- snapshot is taken. Any other shape stops the migration.

do $$
declare
  d record;
  n_docs int;
  sec_old constant jsonb := $j1${"id": "pack", "title": "4. Packaging, labelling and storage", "fields": [{"id": "net_weight", "type": "text", "label": "Net weight", "width": "half", "required": true, "showInList": false}, {"id": "pack", "help": "e.g. vacuum-sealed pouch in an individual box.", "type": "text", "label": "Pack", "width": "half", "required": true}, {"id": "case_config", "help": "Units per case, cases per pallet.", "type": "text", "label": "Case and pallet configuration", "width": "half"}, {"id": "packaging_materials", "help": "Each material, with its FRM-207 entry. Anything that touches the product needs a food-contact certificate there.", "type": "textarea", "label": "Packaging materials", "required": true}, {"id": "label_ref", "help": "The FRM-601 approval and the artwork version.", "type": "text", "label": "Approved label", "width": "half", "required": true}, {"id": "coding", "help": "What is printed and in what format, e.g. Lot: 6153 / Best By: July 2027.", "type": "text", "label": "Date and lot coding", "width": "half", "required": true}, {"id": "storage", "type": "select", "label": "Storage", "width": "half", "options": ["Ambient", "Chilled - at or below 40°F", "Frozen"], "required": true}, {"id": "storage_notes", "type": "text", "label": "Storage instructions on the label", "width": "half"}, {"id": "shelf_life", "help": "As printed, e.g. 12 months from production, coded as Best By month and year.", "type": "text", "label": "Shelf life", "width": "half", "required": true, "showInList": true}, {"id": "shelf_life_basis", "help": "Tested, validated by the customer, or recommended from the ingredients, process and pack (SOP-2.3.1). Say which, and when.", "type": "textarea", "label": "How the shelf life was set", "required": true}]}$j1$::jsonb;
  sec_new constant jsonb := $j2${"id": "pack", "title": "4. Packaging, labelling and storage", "fields": [{"id": "net_weight", "type": "text", "label": "Net weight", "width": "half", "required": true, "showInList": false}, {"id": "packaging_tare", "type": "number", "label": "Empty packaging weight", "min": 0, "width": "half", "help": "Everything a finished pack weighs besides the product (pouch, box, insert), weighed empty on a scale in the calibration program, in the unit below. The release record (FRM-701) takes it off each pack weighed to get the net weight."}, {"id": "net_weight_unit", "type": "select", "label": "Unit weighed in", "options": ["oz", "g", "lb"], "width": "half", "help": "The unit the scale shows when packs are weighed at release."}, {"id": "pack", "help": "e.g. vacuum-sealed pouch in an individual box.", "type": "text", "label": "Pack", "width": "half", "required": true}, {"id": "case_config", "help": "Units per case, cases per pallet.", "type": "text", "label": "Case and pallet configuration", "width": "half"}, {"id": "packaging_materials", "help": "Each material, with its FRM-207 entry. Anything that touches the product needs a food-contact certificate there.", "type": "textarea", "label": "Packaging materials", "required": true}, {"id": "label_ref", "help": "The FRM-601 approval and the artwork version.", "type": "text", "label": "Approved label", "width": "half", "required": true}, {"id": "coding", "help": "What is printed and in what format, e.g. Lot: 6153 / Best By: July 2027.", "type": "text", "label": "Date and lot coding", "width": "half", "required": true}, {"id": "storage", "type": "select", "label": "Storage", "width": "half", "options": ["Ambient", "Chilled - at or below 40°F", "Frozen"], "required": true}, {"id": "storage_notes", "type": "text", "label": "Storage instructions on the label", "width": "half"}, {"id": "shelf_life", "help": "As printed, e.g. 12 months from production, coded as Best By month and year.", "type": "text", "label": "Shelf life", "width": "half", "required": true, "showInList": true}, {"id": "shelf_life_basis", "help": "Tested, validated by the customer, or recommended from the ingredients, process and pack (SOP-2.3.1). Say which, and when.", "type": "textarea", "label": "How the shelf life was set", "required": true}]}$j2$::jsonb;
  history_new constant jsonb := $j3$"v2 - 2026-10-11 - The empty packaging weight and the unit weighed in are recorded.\n\nSection 4 gains two fields after Net weight: Empty packaging weight and Unit weighed in. They are facts about the pack, the same for every lot, and until now were written only on each release record. The release record (FRM-701) now takes them, with the net weight, from the product's specification, so the net-weight check at release starts from the specified figures (owner's decision, 2026-10-11). Nothing else on the form changes."$j3$::jsonb;
begin
  select count(*) into n_docs from public.sop_documents where sop_number = 'FRM-704' and status = 'active';
  if n_docs <> 1 then
    raise exception 'FRM-704: expected one active document, found %', n_docs;
  end if;
  select * into d from public.sop_documents where sop_number = 'FRM-704' and status = 'active';

  if d.revision = 'v2' and d.content->'form_schema'->'sections'->3 = sec_new and d.content->'revision_history' = history_new then
    raise notice 'FRM-704: already at v2 as intended, left alone';
    return;
  end if;
  if d.revision <> 'New' or d.content->'form_schema'->'sections'->3 is distinct from sec_old
     or coalesce(d.content->'revision_history', 'null'::jsonb) <> 'null'::jsonb then
    raise exception 'FRM-704 is not the form this migration was written against';
  end if;

  update public.sop_documents
     set content = jsonb_set(jsonb_set(content, '{form_schema,sections,3}', sec_new), '{revision_history}', history_new),
         revision = 'v2', effective_date = '2026-10-11', approved_by = 'GJM'
   where id = d.id;
end $$;
