-- FRM-501 Formula Sheet & Batch Data: the product's bar code number is recorded on the formula sheet.
--
-- Owner's request, 2026-10-10. Section 1 (Product & Trial Information) gains an optional
-- "Bar code number" field after Allergens in Formula. It is the number the first-pack check on the
-- Production Lot Record (FRM-520) compares the bar code on the pack with, when it is filled in.
--
-- The revision stays as it is, on purpose: every formula sheet is an open draft pinned to the
-- current revision, and a new revision would leave the field off the very sheets it has to be
-- entered on. Safe to run twice: a section that already has the field is left alone, so no second
-- history snapshot is taken. Any other shape stops the migration.

do $$
declare
  doc_id uuid;
  n_docs int;
  ids text;
  cur_field jsonb;
  field constant jsonb := $j${"id": "barcode_number", "type": "text", "label": "Bar code number", "width": "third", "maxLength": 20, "help": "The number printed under the bar code on this product's pack, digits only. Leave blank if the pack carries no bar code."}$j$::jsonb;
begin
  select count(*) into n_docs from public.sop_documents where sop_number = 'FRM-501' and status = 'active';
  if n_docs <> 1 then
    raise exception 'FRM-501: expected one active document, found %', n_docs;
  end if;
  select id into doc_id from public.sop_documents where sop_number = 'FRM-501' and status = 'active';

  select string_agg(f->>'id', ',' order by o), (array_agg(f order by o) filter (where f->>'id' = 'barcode_number'))[1]
    into ids, cur_field
    from public.sop_documents d,
         jsonb_array_elements(d.content->'form_schema'->'sections'->0->'fields') with ordinality as x(f, o)
   where d.id = doc_id
     and d.content->'form_schema'->'sections'->0->>'id' = 'product_trial_information';

  if ids = 'product_name,formula_version,trial_prototype_no,date,developed_by,linked_product_request_no,benchtop_batch_size,scaled_production_batch_size,allergens_in_formula,barcode_number' and cur_field = field then
    raise notice 'FRM-501: the bar code number field is already there, left alone';
    return;
  end if;
  if ids is distinct from 'product_name,formula_version,trial_prototype_no,date,developed_by,linked_product_request_no,benchtop_batch_size,scaled_production_batch_size,allergens_in_formula' then
    raise exception 'FRM-501 section 1 is not the section this migration was written against';
  end if;

  update public.sop_documents
     set content = jsonb_set(content, '{form_schema,sections,0,fields}', (content->'form_schema'->'sections'->0->'fields') || field)
   where id = doc_id;
end $$;
