-- D-20: FRM-520 records the expected and the actual quantity of every ingredient (owner, 2026-09-30).
--
-- The ingredient grid gains three columns after the supplier lot:
--   Expected qty per batch - the recipe quantity, as on the prep sheet's "Qty per batch" column;
--   Unit                   - lb, oz, g, kg, gal, fl oz or each;
--   Actual qty weighed     - the total weighed across all the day's batches.
-- Expected is per batch because it is the recipe: it stays the same whatever the number of batches, so
-- "Copy from a previous entry" carries it (and the unit) over and only the actual is blanked. A new header
-- field, Number of batches, is what turns the per-batch expected into the day's total.
-- None of the three is required - the pan spray has no weighed quantity. The quantity columns opt out of the
-- package-label scan (scanFact none), so a photographed bag's net weight never lands in them.
-- Existing entries (2, both tests) keep their answers: no field id changes. FRM-520 is still DRAFT.

begin;

do $guard$
declare h text; st text;
begin
  select md5((content - 'attachments')::text), status into h, st from public.sop_documents where sop_number = 'FRM-520';
  if st is distinct from 'draft' or h <> '47a8c8ffe91ae11573e17588d122cc30' then
    raise exception 'FRM-520 is % or changed since review (md5 %).', st, h;
  end if;
end $guard$;

update public.sop_documents d
   set content = jsonb_set(jsonb_set(d.content, '{form_schema,sections}', (
         select jsonb_agg(
                  jsonb_set(s, '{fields}', (
                    select jsonb_agg(f order by fo) from (
                      -- the ingredient grid: insert the quantity columns after supplier_lot
                      select case when x.f->>'id' = 'ingredients' then jsonb_set(x.f, '{columns}', (
                               select jsonb_agg(c order by co) from (
                                 select col as c, (ci * 10) as co
                                   from jsonb_array_elements(x.f->'columns') with ordinality y(col, ci)
                                 union all select '{"id": "expected_qty", "label": "Expected qty per batch", "type": "number", "width": 1, "scanFact": "none"}'::jsonb, 31
                                 union all select '{"id": "unit", "label": "Unit", "type": "select", "width": 0.8, "scanFact": "none", "options": ["lb", "oz", "g", "kg", "gal", "fl oz", "each"]}'::jsonb, 32
                                 union all select '{"id": "actual_qty", "label": "Actual qty weighed (all batches)", "type": "number", "width": 1, "scanFact": "none"}'::jsonb, 33
                               ) q))
                             else x.f end as f, (x.fo * 10) as fo
                        from jsonb_array_elements(s->'fields') with ordinality x(f, fo)
                      -- Number of batches, right after bake_date in the header
                      union all
                      select '{"id": "batches", "type": "number", "label": "Number of batches", "width": "third", "min": 1, "help": "Expected per batch x batches = the day''s expected total"}'::jsonb,
                             (select (x2.fo * 10) + 1 from jsonb_array_elements(s->'fields') with ordinality x2(f, fo) where x2.f->>'id' = 'bake_date')
                       where exists (select 1 from jsonb_array_elements(s->'fields') z where z->>'id' = 'bake_date')
                    ) g))
                  order by so)
           from jsonb_array_elements(d.content->'form_schema'->'sections') with ordinality y(s, so))),
         '{form_schema,settings,copyFrom,clear,ingredients}', '["supplier_lot", "actual_qty", "notes"]'::jsonb)
 where d.sop_number = 'FRM-520' and d.status = 'draft';

do $verify$
declare fs jsonb;
begin
  select content->'form_schema' into fs from public.sop_documents where sop_number = 'FRM-520';
  if (select string_agg(c->>'id', ',' order by ord)
        from jsonb_array_elements(fs->'sections') s, jsonb_array_elements(s->'fields') f,
             jsonb_array_elements(f->'columns') with ordinality w(c, ord)
       where f->>'id' = 'ingredients') <> 'ingredient,brand,supplier_lot,expected_qty,unit,actual_qty,notes' then
    raise exception 'FRM-520 ingredient columns are not in the expected order.';
  end if;
  if (select string_agg(f->>'id', ',' order by ord)
        from jsonb_array_elements(fs->'sections'->0->'fields') with ordinality w(f, ord)) <> 'how_this_works,product,lot_code,bake_date,batches' then
    raise exception 'FRM-520 header fields are not as expected.';
  end if;
  if fs->'settings'->'copyFrom'->'clear'->'ingredients' <> '["supplier_lot", "actual_qty", "notes"]'::jsonb then
    raise exception 'FRM-520 copyFrom does not blank the actual quantity.';
  end if;
end $verify$;

commit;
