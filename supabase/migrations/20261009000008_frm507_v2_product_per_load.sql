-- FRM-507 CCP 1 Baking Monitoring Record, New -> v2: the product is recorded on each oven load.
--
-- Owner's decision, 2026-10-09. The record had one Product field at the top, so two flavors baked
-- on one day needed two records, and both carry the day's lot code. Product becomes a column of
-- the oven loads table (required, offering the product names on the formula sheets, FRM-501, and
-- anything else can be typed) and the field at the top is removed. The opening note and the
-- table's help line say so. Nothing else on the form changes.
--
-- Approved by GJM, effective 2026-10-09. Entries filled at revision New keep their own layout
-- (the history snapshot taken by this update), so their product at the top stays readable.
--
-- Safe to run twice: at v2 with the fields as intended nothing is updated, so no second history
-- snapshot is taken. Any other shape stops the migration.

do $$
declare
  doc_id uuid;
  n_docs int;
  d record;
  info_old constant jsonb := $j1${"id": "how_this_works", "text": "ONE RECORD PER PRODUCTION DAY, for the product covered by the site's HACCP plan. Add a row for every oven load as it comes out, and write the readings at the oven rather than at the end of the shift. A critical control point that was checked and not written down was, as far as anyone else can tell, not checked.\n\nCCP 1 IS THE KILL STEP. The bake destroys pathogens that come in with the liquid egg, Salmonella among them. The critical limits below are the HACCP plan's.\n\nIF A LIMIT IS NOT MET, the load is not released. Section 3 says what happens to it.\n\nWHEN THE DAY IS DONE, sign Section 4 and leave the entry as a draft. It is reviewed, the verification is signed, and the reviewer submits it.", "type": "info", "label": "Before you start"}$j1$::jsonb;
  info_new constant jsonb := $j2${"id": "how_this_works", "text": "ONE RECORD PER PRODUCTION DAY, whatever is baked that day. Add a row for every oven load as it comes out, naming the product in that load, and write the readings at the oven rather than at the end of the shift. A critical control point that was checked and not written down was, as far as anyone else can tell, not checked.\n\nCCP 1 IS THE KILL STEP. The bake destroys pathogens that come in with the liquid egg, Salmonella among them. The critical limits below are the HACCP plan's.\n\nIF A LIMIT IS NOT MET, the load is not released. Section 3 says what happens to it.\n\nWHEN THE DAY IS DONE, sign Section 4 and leave the entry as a draft. It is reviewed, the verification is signed, and the reviewer submits it.", "type": "info", "label": "Before you start"}$j2$::jsonb;
  prod_old constant jsonb := $j3${"id": "product", "help": "The product covered by the HACCP plan.", "type": "text", "label": "Product", "width": "half", "required": true, "showInList": true}$j3$::jsonb;
  grid_old constant jsonb := $j4${"id": "oven_loads", "help": "One row per load, written when the load comes out of the oven. A rebake is a new row with the same lot code.", "rows": {"min": 1, "mode": "dynamic", "addLabel": "Add an oven load"}, "type": "grid", "label": "Oven loads", "columns": [{"id": "time_out", "type": "time", "label": "Time out of oven", "width": 1, "required": true, "defaultTo": "now"}, {"id": "lot_code", "type": "text", "label": "Lot / batch code", "width": 2, "required": true}, {"id": "oven_temp", "type": "number", "unit": "°F", "label": "Oven temperature", "width": 1, "required": true}, {"id": "bake_time", "type": "number", "unit": "min", "label": "Bake time", "width": 1, "required": true}, {"id": "internal_temp", "type": "number", "unit": "°F", "label": "Internal temperature, if probed", "width": 1}, {"id": "within_limits", "type": "pass_fail", "label": "Within critical limits", "width": 1, "required": true}, {"id": "initials", "type": "text", "label": "Initials", "width": 1, "required": true, "defaultTo": "currentUserInitials"}, {"id": "note", "type": "text", "label": "Note", "width": 2}], "required": true}$j4$::jsonb;
  grid_new constant jsonb := $j5${"id": "oven_loads", "help": "One row per load, written when the load comes out of the oven, with the product that was in it. A rebake is a new row with the same product and lot code.", "rows": {"min": 1, "mode": "dynamic", "addLabel": "Add an oven load"}, "type": "grid", "label": "Oven loads", "columns": [{"id": "time_out", "type": "time", "label": "Time out of oven", "width": 1, "required": true, "defaultTo": "now"}, {"id": "product", "type": "text", "label": "Product", "width": 2, "required": true, "pickFrom": {"form": "FRM-501", "field": "product_name", "drafts": true}}, {"id": "lot_code", "type": "text", "label": "Lot / batch code", "width": 2, "required": true}, {"id": "oven_temp", "type": "number", "unit": "°F", "label": "Oven temperature", "width": 1, "required": true}, {"id": "bake_time", "type": "number", "unit": "min", "label": "Bake time", "width": 1, "required": true}, {"id": "internal_temp", "type": "number", "unit": "°F", "label": "Internal temperature, if probed", "width": 1}, {"id": "within_limits", "type": "pass_fail", "label": "Within critical limits", "width": 1, "required": true}, {"id": "initials", "type": "text", "label": "Initials", "width": 1, "required": true, "defaultTo": "currentUserInitials"}, {"id": "note", "type": "text", "label": "Note", "width": 2}], "required": true}$j5$::jsonb;
  history constant jsonb := $j6$"v2 - 2026-10-09 - The product is recorded on each oven load.\n\nThe record had one Product field at the top, so a day on which two flavors were baked needed two records, and both flavors carry the same lot code for the day. Product is now a column of the oven loads table, filled for every load, and the field at the top is removed: one record covers the production day (owner's decision, 2026-10-09). The critical limits, the other columns and the sign-off are unchanged. Records filled before this revision keep the product at the top."$j6$::jsonb;
  cur_info jsonb; cur_prod jsonb; cur_grid jsonb;
  new_sections jsonb;
  ids_after text;
begin
  select count(*) into n_docs from public.sop_documents where sop_number = 'FRM-507';
  if n_docs <> 1 then
    raise exception 'FRM-507: expected one document, found %', n_docs;
  end if;
  select * into d from public.sop_documents where sop_number = 'FRM-507';
  doc_id := d.id;

  -- The column offers FRM-501's product names: that field must exist, or the list is quietly empty.
  if not exists (select 1 from public.sop_documents x,
                        jsonb_array_elements(x.content->'form_schema'->'sections') s,
                        jsonb_array_elements(s->'fields') f
                  where x.sop_number = 'FRM-501' and x.status = 'active' and f->>'id' = 'product_name') then
    raise exception 'FRM-501 has no product_name field';
  end if;

  select (array_agg(f) filter (where f->>'id' = 'how_this_works'))[1],
         (array_agg(f) filter (where f->>'id' = 'product'))[1],
         (array_agg(f) filter (where f->>'id' = 'oven_loads'))[1]
    into cur_info, cur_prod, cur_grid
    from jsonb_array_elements(d.content->'form_schema'->'sections') s, jsonb_array_elements(s->'fields') f;

  if d.revision = 'v2' and cur_info = info_new and cur_prod is null and cur_grid = grid_new then
    raise notice 'FRM-507: already at v2 as intended, left alone';
    return;
  end if;
  if d.revision <> 'New' or cur_info is distinct from info_old or cur_prod is distinct from prod_old
     or cur_grid is distinct from grid_old then
    raise exception 'FRM-507 is not the form this migration was written against';
  end if;

  select jsonb_agg(
           jsonb_set(s, '{fields}', (
             select jsonb_agg(case f->>'id' when 'how_this_works' then info_new when 'oven_loads' then grid_new else f end order by fo)
               from jsonb_array_elements(s->'fields') with ordinality as x(f, fo)
              where f->>'id' <> 'product'
           ))
           order by so)
    into new_sections
    from jsonb_array_elements(d.content->'form_schema'->'sections') with ordinality as y(s, so);

  update public.sop_documents
     set content = jsonb_set(jsonb_set(content, '{form_schema,sections}', new_sections), '{revision_history}', history),
         revision = 'v2', effective_date = '2026-10-09', approved_by = 'GJM'
   where id = doc_id;

  select string_agg(f->>'id', ',' order by so, fo) into ids_after
    from public.sop_documents x,
         jsonb_array_elements(x.content->'form_schema'->'sections') with ordinality as y(s, so),
         jsonb_array_elements(s->'fields') with ordinality as z(f, fo)
   where x.id = doc_id;
  if ids_after is distinct from (
       select string_agg(f->>'id', ',' order by so, fo)
         from jsonb_array_elements(d.content->'form_schema'->'sections') with ordinality as y(s, so),
              jsonb_array_elements(s->'fields') with ordinality as z(f, fo)
        where f->>'id' <> 'product') then
    raise exception 'FRM-507: unexpected list of fields after the update: %', ids_after;
  end if;
end $$;
