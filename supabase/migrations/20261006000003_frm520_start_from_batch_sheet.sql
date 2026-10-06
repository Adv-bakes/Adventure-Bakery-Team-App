-- FRM-520 Production Lot Record: start an entry from the product's batch sheet.
--
-- The owner's question (2026-10-06): why keep a batch sheet and a production lot record that have
-- nothing to do with each other? They are different records - the batch sheet is the master
-- formula, the lot record is what went in on one bake day - but the lot record should take its
-- ingredient lines and expected quantities from the batch sheet instead of holding its own copy.
--
-- Two changes to the form, both additive (no existing field id changes, so answers are untouched):
--   1. A "Formula" text field in section 1, after "Number of batches". The app fills it with the
--      batch sheet version the entry was started from ("Batch sheet v1"), so a formula change is
--      visible in the lot history. Optional: an entry typed by hand leaves it blank.
--   2. settings.batchSheet, which names the fields the batch sheet fills. The behaviour is in the
--      app (src/lib/batchSheetFill.ts): product, ingredient, brand, expected quantity per batch and
--      unit come across; the lot on the container and the weighed quantities never do.
--
-- "Copy from a previous entry" (settings.copyFrom) stays, for a product with no batch sheet yet.
--
-- FRM-520 is still a draft, so no revision stamp and no history snapshot. Converges: a form that
-- already holds exactly this is left alone.

begin;

do $mig$
declare
  doc_id uuid;
  c jsonb;
  fields jsonb;
  new_fields jsonb;
  field constant jsonb := $j${"id": "formula_source", "type": "text", "label": "Formula", "width": "half", "help": "Filled in when the entry is started from the product's batch sheet. Leave blank if it was not."}$j$::jsonb;
  setting constant jsonb := $j${"productField": "product", "grid": "ingredients", "sourceField": "formula_source", "columns": {"ingredient": "ingredient", "brand": "brand", "expected": "expected_qty", "unit": "unit"}}$j$::jsonb;
  n_before int;
  n_after int;
  ids_before text;
  ids_after text;
begin
  select id, content into doc_id, c from public.sop_documents where sop_number = 'FRM-520' and status <> 'archived';
  if doc_id is null then raise exception 'FRM-520 not found.'; end if;
  if (select count(*) from public.sop_documents where sop_number = 'FRM-520' and status <> 'archived') <> 1 then
    raise exception 'more than one FRM-520.';
  end if;
  if c->'form_schema'->'sections'->0->>'id' <> 'lot' then raise exception 'FRM-520 section 1 is not "lot".'; end if;

  -- The fields this setting names must exist, with the grid columns it writes.
  if not exists (select 1 from jsonb_array_elements(c->'form_schema'->'sections'->0->'fields') f where f->>'id' = 'product')
     or (select count(*) from jsonb_array_elements(c->'form_schema'->'sections') s, jsonb_array_elements(s->'fields') f,
                              jsonb_array_elements(f->'columns') col
          where f->>'id' = 'ingredients' and col->>'id' in ('ingredient', 'brand', 'expected_qty', 'unit')) <> 4 then
    raise exception 'FRM-520 no longer has the fields the batch sheet fills.';
  end if;

  select count(*), string_agg(f->>'id', ',' order by so, fo) into n_before, ids_before
    from jsonb_array_elements(c->'form_schema'->'sections') with ordinality s(s, so),
         jsonb_array_elements(s->'fields') with ordinality f(f, fo);

  fields := c->'form_schema'->'sections'->0->'fields';
  if not exists (select 1 from jsonb_array_elements(fields) f where f->>'id' = 'formula_source') then
    -- After "batches", selected by id and not by position.
    select jsonb_agg(x order by o, k) into new_fields
      from (
        select f as x, o, 0 as k from jsonb_array_elements(fields) with ordinality q(f, o)
        union all
        select field, o, 1 from jsonb_array_elements(fields) with ordinality q(f, o) where f->>'id' = 'batches'
      ) t;
    if jsonb_array_length(new_fields) <> jsonb_array_length(fields) + 1 then
      raise exception 'FRM-520 has no "batches" field to place the new one after.';
    end if;
    c := jsonb_set(c, '{form_schema,sections,0,fields}', new_fields);
  end if;

  if c->'form_schema'->'settings'->'batchSheet' is distinct from setting then
    c := jsonb_set(c, '{form_schema,settings,batchSheet}', setting);
  end if;

  -- Skip the write when nothing changed, so a second run does not touch updated_at.
  update public.sop_documents set content = c where id = doc_id and content is distinct from c;

  select content into c from public.sop_documents where id = doc_id;
  select count(*), string_agg(f->>'id', ',' order by so, fo) into n_after, ids_after
    from jsonb_array_elements(c->'form_schema'->'sections') with ordinality s(s, so),
         jsonb_array_elements(s->'fields') with ordinality f(f, fo);

  if n_after not in (n_before, n_before + 1) then raise exception 'FRM-520 field count went from % to %.', n_before, n_after; end if;
  if replace(ids_after, ',formula_source', '') <> replace(ids_before, ',formula_source', '') then
    raise exception 'an existing FRM-520 field moved or was lost: % -> %', ids_before, ids_after;
  end if;
  if (select count(*) from jsonb_array_elements(c->'form_schema'->'sections'->0->'fields') f where f->>'id' = 'formula_source') <> 1 then
    raise exception 'FRM-520 should have exactly one "formula_source" field.';
  end if;
  if c->'form_schema'->'settings'->'batchSheet' is distinct from setting then raise exception 'settings.batchSheet was not set.'; end if;
  if c->'form_schema'->'settings'->'copyFrom' is null then raise exception 'settings.copyFrom was lost.'; end if;
end $mig$;

commit;
