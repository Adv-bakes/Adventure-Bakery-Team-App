-- FRM-507 CCP 1 Baking Monitoring Record, v2 -> v3: the last load is marked on the record.
--
-- Owner's decision, 2026-10-10. The oven loads table gains a "Last load" pick-list, filled only on
-- a final load: "Last load of this batch" (that product is finished for the day) or "Last load of
-- this lot" (all the day's baking is finished). The Today page reads it to show a product's baking
-- as done and to send the day's record for review. The table's help line says how to use it.
-- Nothing else on the form changes.
--
-- Approved by GJM, effective 2026-10-10. Entries filled at v2 keep their own layout.
--
-- Safe to run twice: at v3 with the table as intended nothing is updated, so no second history
-- snapshot is taken. Any other shape stops the migration.

do $$
declare
  d record;
  grid_old constant jsonb := $j1${"id": "oven_loads", "help": "One row per load, written when the load comes out of the oven, with the product that was in it. A rebake is a new row with the same product and lot code.", "rows": {"min": 1, "mode": "dynamic", "addLabel": "Add an oven load"}, "type": "grid", "label": "Oven loads", "columns": [{"id": "time_out", "type": "time", "label": "Time out of oven", "width": 1, "required": true, "defaultTo": "now"}, {"id": "product", "type": "text", "label": "Product", "width": 2, "pickFrom": {"form": "FRM-501", "field": "product_name", "drafts": true}, "required": true}, {"id": "lot_code", "type": "text", "label": "Lot / batch code", "width": 2, "required": true}, {"id": "oven_temp", "type": "number", "unit": "°F", "label": "Oven temperature", "width": 1, "required": true}, {"id": "bake_time", "type": "number", "unit": "min", "label": "Bake time", "width": 1, "required": true}, {"id": "internal_temp", "type": "number", "unit": "°F", "label": "Internal temperature, if probed", "width": 1}, {"id": "within_limits", "type": "pass_fail", "label": "Within critical limits", "width": 1, "required": true}, {"id": "initials", "type": "text", "label": "Initials", "width": 1, "required": true, "defaultTo": "currentUserInitials"}, {"id": "note", "type": "text", "label": "Note", "width": 2}], "required": true}$j1$::jsonb;
  grid_new constant jsonb := $j2${"id": "oven_loads", "help": "One row per load, written when the load comes out of the oven, with the product that was in it. A rebake is a new row with the same product and lot code. On the final load, say so under Last load: of this batch when that product is finished for the day, or of this lot when all the day's baking is finished.", "rows": {"min": 1, "mode": "dynamic", "addLabel": "Add an oven load"}, "type": "grid", "label": "Oven loads", "columns": [{"id": "time_out", "type": "time", "label": "Time out of oven", "width": 1, "required": true, "defaultTo": "now"}, {"id": "product", "type": "text", "label": "Product", "width": 2, "pickFrom": {"form": "FRM-501", "field": "product_name", "drafts": true}, "required": true}, {"id": "lot_code", "type": "text", "label": "Lot / batch code", "width": 2, "required": true}, {"id": "oven_temp", "type": "number", "unit": "°F", "label": "Oven temperature", "width": 1, "required": true}, {"id": "bake_time", "type": "number", "unit": "min", "label": "Bake time", "width": 1, "required": true}, {"id": "internal_temp", "type": "number", "unit": "°F", "label": "Internal temperature, if probed", "width": 1}, {"id": "within_limits", "type": "pass_fail", "label": "Within critical limits", "width": 1, "required": true}, {"id": "last_load", "type": "select", "label": "Last load", "width": 2, "options": ["Last load of this batch", "Last load of this lot"]}, {"id": "initials", "type": "text", "label": "Initials", "width": 1, "required": true, "defaultTo": "currentUserInitials"}, {"id": "note", "type": "text", "label": "Note", "width": 2}], "required": true}$j2$::jsonb;
  history_old constant jsonb := $j3$"v2 - 2026-10-09 - The product is recorded on each oven load.\n\nThe record had one Product field at the top, so a day on which two flavors were baked needed two records, and both flavors carry the same lot code for the day. Product is now a column of the oven loads table, filled for every load, and the field at the top is removed: one record covers the production day (owner's decision, 2026-10-09). The critical limits, the other columns and the sign-off are unchanged. Records filled before this revision keep the product at the top."$j3$::jsonb;
  history_new constant jsonb := $j4$"v3 - 2026-10-10 - The last load is marked on the record.\n\nA Last load column is added to the oven loads table, filled only on a final load: \"Last load of this batch\" when a product's baking is finished for the day, \"Last load of this lot\" when all of the day's baking is finished. It lets the operator state that baking is complete at the oven, and tells the reviewer the record is ready (owner's decision, 2026-10-10). No limit, no other column and no part of the sign-off changes.\n\nv2 - 2026-10-09 - The product is recorded on each oven load.\n\nThe record had one Product field at the top, so a day on which two flavors were baked needed two records, and both flavors carry the same lot code for the day. Product is now a column of the oven loads table, filled for every load, and the field at the top is removed: one record covers the production day (owner's decision, 2026-10-09). The critical limits, the other columns and the sign-off are unchanged. Records filled before this revision keep the product at the top."$j4$::jsonb;
  cur_grid jsonb;
  n_docs int;
  new_sections jsonb;
begin
  select count(*) into n_docs from public.sop_documents where sop_number = 'FRM-507';
  if n_docs <> 1 then
    raise exception 'FRM-507: expected one document, found %', n_docs;
  end if;
  select * into d from public.sop_documents where sop_number = 'FRM-507';

  select f into cur_grid
    from jsonb_array_elements(d.content->'form_schema'->'sections') s, jsonb_array_elements(s->'fields') f
   where f->>'id' = 'oven_loads';

  if d.revision = 'v3' and cur_grid = grid_new and d.content->'revision_history' = history_new then
    raise notice 'FRM-507: already at v3 as intended, left alone';
    return;
  end if;
  if d.revision <> 'v2' or cur_grid is distinct from grid_old or d.content->'revision_history' is distinct from history_old then
    raise exception 'FRM-507 is not the form this migration was written against';
  end if;

  select jsonb_agg(
           jsonb_set(s, '{fields}', (
             select jsonb_agg(case when f->>'id' = 'oven_loads' then grid_new else f end order by fo)
               from jsonb_array_elements(s->'fields') with ordinality as x(f, fo)
           ))
           order by so)
    into new_sections
    from jsonb_array_elements(d.content->'form_schema'->'sections') with ordinality as y(s, so);

  update public.sop_documents
     set content = jsonb_set(jsonb_set(content, '{form_schema,sections}', new_sections), '{revision_history}', history_new),
         revision = 'v3', effective_date = '2026-10-10', approved_by = 'GJM'
   where id = d.id;
end $$;
