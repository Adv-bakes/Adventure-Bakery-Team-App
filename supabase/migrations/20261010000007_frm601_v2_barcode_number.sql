-- FRM-601 Label Review & Approval Form, New -> v2: the label's bar code number is recorded.
--
-- Owner's decision, 2026-10-10. The bar code identifies the pack that is sold, not the recipe, so
-- its number belongs with the label and not (only) on the formula sheet: Section 1 gains an
-- optional "Bar code number" field after Label Name. The first-pack check on the Production Lot
-- Record (FRM-520) reads it from the product's newest label review, and falls back to the formula
-- sheet's number while a product has no label review. Nothing else on the form changes.
--
-- Approved by GJM, effective 2026-10-10. Entries started at revision New keep their own layout.
--
-- Safe to run twice: at v2 with the section as intended nothing is updated, so no second history
-- snapshot is taken. Any other shape stops the migration.

do $$
declare
  d record;
  n_docs int;
  ids text;
  cur_field jsonb;
  field constant jsonb := $j1${"id": "barcode_number", "type": "text", "label": "Bar code number", "width": "half", "maxLength": 20, "help": "The number printed under the bar code on this label, digits only. Leave blank if the label carries no bar code. The first-pack check on the Production Lot Record (FRM-520) compares the pack with this number."}$j1$::jsonb;
  history_new constant jsonb := $j2$"v2 - 2026-10-10 - The label's bar code number is recorded.\n\nSection 1 gains an optional Bar code number field. The bar code identifies the pack that is sold, so it belongs with the label: a change of bar code is a label change, reviewed and approved here. The first-pack check on the Production Lot Record (FRM-520) compares the bar code on the pack with the number on the product's newest label review (owner's decision, 2026-10-10). Nothing else on the form changes."$j2$::jsonb;
begin
  select count(*) into n_docs from public.sop_documents where sop_number = 'FRM-601' and status = 'active';
  if n_docs <> 1 then
    raise exception 'FRM-601: expected one active document, found %', n_docs;
  end if;
  select * into d from public.sop_documents where sop_number = 'FRM-601' and status = 'active';

  select string_agg(f->>'id', ',' order by o), (array_agg(f order by o) filter (where f->>'id' = 'barcode_number'))[1]
    into ids, cur_field
    from jsonb_array_elements(d.content->'form_schema'->'sections'->0->'fields') with ordinality as x(f, o)
   where d.content->'form_schema'->'sections'->0->>'id' = 'section_1';

  if d.revision = 'v2' and ids = 'product_name,sku_item_no,label_artwork_version,linked_formula_version,date,customer_brand,label_name,barcode_number' and cur_field = field and d.content->'revision_history' = history_new then
    raise notice 'FRM-601: already at v2 as intended, left alone';
    return;
  end if;
  if d.revision <> 'New' or ids is distinct from 'product_name,sku_item_no,label_artwork_version,linked_formula_version,date,customer_brand,label_name' or coalesce(d.content->'revision_history', 'null'::jsonb) <> 'null'::jsonb then
    raise exception 'FRM-601 is not the form this migration was written against';
  end if;

  update public.sop_documents
     set content = jsonb_set(
           jsonb_set(content, '{form_schema,sections,0,fields}', (content->'form_schema'->'sections'->0->'fields') || field),
           '{revision_history}', history_new),
         revision = 'v2', effective_date = '2026-10-10', approved_by = 'GJM'
   where id = d.id;
end $$;
