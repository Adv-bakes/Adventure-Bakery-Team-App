-- FRM-520 Production Lot Record: take the formula from FRM-501, not from the batch sheets.
--
-- The owner's decision (2026-10-06, the same day 20261006000003 pointed the lot record at the
-- sales-side batch sheets): FRM-501 Formula Sheet & Batch Data is the source for a product's
-- formula for now. The batch sheets come out of the sales flow and are to be looked at later.
--
-- Two changes, neither touching a field id:
--   1. settings.batchSheet.source = "FRM-501". The app (src/lib/batchSheetFill.ts) then lists the
--      FRM-501 entries instead of the batch sheets. What it fills is unchanged: product,
--      ingredient, brand, expected quantity per batch and unit - never a lot, never a weight.
--   2. The "Formula" field's help line names FRM-501.
--
-- FRM-520 is still a draft, so no revision stamp and no history snapshot. Converges: a form that
-- already holds exactly this is left alone.

begin;

do $mig$
declare
  doc_id uuid;
  c jsonb;
  idx int;
  help constant text := 'Filled in when the entry is started from the product''s formula sheet (FRM-501). Leave blank if it was not.';
  n_before int; n_after int; ids_before text; ids_after text;
begin
  select id, content into doc_id, c from public.sop_documents where sop_number = 'FRM-520' and status <> 'archived';
  if doc_id is null then raise exception 'FRM-520 not found.'; end if;
  if c->'form_schema'->'settings'->'batchSheet' is null then
    raise exception 'FRM-520 has no settings.batchSheet - 20261006000003 has not run.';
  end if;
  if not exists (select 1 from public.sop_documents where sop_number = 'FRM-501' and status <> 'archived') then
    raise exception 'FRM-501 not found.';
  end if;

  select count(*), string_agg(f->>'id', ',' order by so, fo) into n_before, ids_before
    from jsonb_array_elements(c->'form_schema'->'sections') with ordinality s(s, so),
         jsonb_array_elements(s->'fields') with ordinality f(f, fo);

  -- The Formula field, found by id.
  select (o - 1)::int into idx
    from jsonb_array_elements(c->'form_schema'->'sections'->0->'fields') with ordinality q(f, o)
   where f->>'id' = 'formula_source';
  if idx is null then raise exception 'FRM-520 has no "formula_source" field.'; end if;

  c := jsonb_set(c, '{form_schema,settings,batchSheet,source}', '"FRM-501"'::jsonb);
  c := jsonb_set(c, array['form_schema', 'sections', '0', 'fields', idx::text, 'help'], to_jsonb(help));

  -- Skip the write when nothing changed, so a second run is a true no-op.
  update public.sop_documents set content = c where id = doc_id and content is distinct from c;

  select content into c from public.sop_documents where id = doc_id;
  select count(*), string_agg(f->>'id', ',' order by so, fo) into n_after, ids_after
    from jsonb_array_elements(c->'form_schema'->'sections') with ordinality s(s, so),
         jsonb_array_elements(s->'fields') with ordinality f(f, fo);
  if n_after <> n_before or ids_after <> ids_before then
    raise exception 'FRM-520 fields changed: % -> %', ids_before, ids_after;
  end if;
  if c->'form_schema'->'settings'->'batchSheet' is distinct from
     $j${"source": "FRM-501", "productField": "product", "grid": "ingredients", "sourceField": "formula_source", "columns": {"ingredient": "ingredient", "brand": "brand", "expected": "expected_qty", "unit": "unit"}}$j$::jsonb then
    raise exception 'settings.batchSheet is not as intended: %', c->'form_schema'->'settings'->'batchSheet';
  end if;
  if c->'form_schema'->'settings'->'copyFrom' is null then raise exception 'settings.copyFrom was lost.'; end if;
  if (select f->>'help' from jsonb_array_elements(c->'form_schema'->'sections'->0->'fields') f where f->>'id' = 'formula_source') <> help then
    raise exception 'the Formula help line was not updated.';
  end if;
end $mig$;

commit;
