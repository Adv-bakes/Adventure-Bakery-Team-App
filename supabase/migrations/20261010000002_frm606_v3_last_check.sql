-- FRM-606 CCP 2 Vacuum Sealing Monitoring Record, v2 -> v3: the last check is marked on the record.
--
-- Owner's decision, 2026-10-10, to match FRM-507 v3 (migration 20261010000001). The sealing checks
-- table gains a "Last check" pick-list, filled only on a final check: "Last check of this batch"
-- (that product's checks are finished for the day) or "Last check of this lot" (all the day's
-- checks are finished). The Today page reads it to show a product's sealing as done and to send
-- the records for review. The table's help line says how to use it. Nothing else changes.
--
-- Approved by GJM, effective 2026-10-10. Entries filled at v2 keep their own layout.
--
-- Safe to run twice: at v3 with the table as intended nothing is updated, so no second history
-- snapshot is taken. Any other shape stops the migration.

do $$
declare
  d record;
  grid_old constant jsonb := $j1${"id": "seal_checks", "help": "A row at Set-up, after any change or adjustment, and at the end of the run; In process rows may be added at any time. At boxing: a row for the pull test, and a row when every pouch has been looked at again.", "rows": {"min": 1, "mode": "dynamic", "addLabel": "Add a check"}, "type": "grid", "label": "Sealing checks", "columns": [{"id": "time", "type": "time", "label": "Time", "width": 1, "required": true, "defaultTo": "now"}, {"id": "check", "type": "select", "label": "Check", "width": 2, "options": ["Set-up", "In process", "After a change or adjustment", "End of run", "At boxing"], "required": true}, {"id": "vacuum_reading", "type": "number", "unit": "in. Hg", "label": "Vacuum gauge reading", "width": 1}, {"id": "visual", "type": "pass_fail", "label": "Every pouch since the last row: seal sound, no air in the pouch", "width": 2}, {"id": "pull_test", "type": "pass_fail", "label": "Pull test held (cooled pouch, at boxing)", "width": 1}, {"id": "rejected", "type": "number", "label": "Pouches rejected since the last row", "width": 1}, {"id": "seal_width", "type": "number", "unit": "mm", "label": "Seal width, if measured", "width": 1}, {"id": "initials", "type": "text", "label": "Initials", "width": 1, "required": true, "defaultTo": "currentUserInitials"}, {"id": "note", "type": "text", "label": "Note", "width": 2}], "required": true}$j1$::jsonb;
  grid_new constant jsonb := $j2${"id": "seal_checks", "help": "A row at Set-up, after any change or adjustment, and at the end of the run; In process rows may be added at any time. At boxing: a row for the pull test, and a row when every pouch has been looked at again. On the final check, say so under Last check: of this batch when that product's sealing and boxing checks are finished for the day, or of this lot when all the day's checks are finished.", "rows": {"min": 1, "mode": "dynamic", "addLabel": "Add a check"}, "type": "grid", "label": "Sealing checks", "columns": [{"id": "time", "type": "time", "label": "Time", "width": 1, "required": true, "defaultTo": "now"}, {"id": "check", "type": "select", "label": "Check", "width": 2, "options": ["Set-up", "In process", "After a change or adjustment", "End of run", "At boxing"], "required": true}, {"id": "vacuum_reading", "type": "number", "unit": "in. Hg", "label": "Vacuum gauge reading", "width": 1}, {"id": "visual", "type": "pass_fail", "label": "Every pouch since the last row: seal sound, no air in the pouch", "width": 2}, {"id": "pull_test", "type": "pass_fail", "label": "Pull test held (cooled pouch, at boxing)", "width": 1}, {"id": "rejected", "type": "number", "label": "Pouches rejected since the last row", "width": 1}, {"id": "seal_width", "type": "number", "unit": "mm", "label": "Seal width, if measured", "width": 1}, {"id": "last_check", "type": "select", "label": "Last check", "width": 2, "options": ["Last check of this batch", "Last check of this lot"]}, {"id": "initials", "type": "text", "label": "Initials", "width": 1, "required": true, "defaultTo": "currentUserInitials"}, {"id": "note", "type": "text", "label": "Note", "width": 2}], "required": true}$j2$::jsonb;
  history_old constant jsonb := $j3$null$j3$::jsonb;
  history_new constant jsonb := $j4$"v3 - 2026-10-10 - The last check is marked on the record.\n\nA Last check column is added to the sealing checks table, filled only on a final check: \"Last check of this batch\" when a product's checks are finished for the day, \"Last check of this lot\" when all of the day's checks are finished. It lets the operator state that the checks are complete, and tells the reviewer the record is ready (owner's decision, 2026-10-10, to match FRM-507 v3). No limit, no other column and no part of the sign-off changes.\n\n"$j4$::jsonb;
  cur_grid jsonb;
  n_docs int;
  new_sections jsonb;
begin
  select count(*) into n_docs from public.sop_documents where sop_number = 'FRM-606';
  if n_docs <> 1 then
    raise exception 'FRM-606: expected one document, found %', n_docs;
  end if;
  select * into d from public.sop_documents where sop_number = 'FRM-606';

  select f into cur_grid
    from jsonb_array_elements(d.content->'form_schema'->'sections') s, jsonb_array_elements(s->'fields') f
   where f->>'id' = 'seal_checks';

  if d.revision = 'v3' and cur_grid = grid_new and d.content->'revision_history' = history_new then
    raise notice 'FRM-606: already at v3 as intended, left alone';
    return;
  end if;
  if d.revision <> 'v2' or cur_grid is distinct from grid_old or coalesce(d.content->'revision_history', 'null'::jsonb) is distinct from history_old then
    raise exception 'FRM-606 is not the form this migration was written against';
  end if;

  select jsonb_agg(
           jsonb_set(s, '{fields}', (
             select jsonb_agg(case when f->>'id' = 'seal_checks' then grid_new else f end order by fo)
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
