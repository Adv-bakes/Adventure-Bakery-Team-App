-- FRM-903 Daily Sanitation, Pre-Operation & Release Record: "Shift" starts at 1st Shift.
--
-- Owner's request, 2026-10-09: the site works first shift almost every day, so a new entry now
-- starts with 1st Shift chosen. It can still be changed to 2nd or 3rd Shift.
--
-- The field keeps its id and its three choices, so entries already made keep their answer.
-- Nothing else on the form changes and the revision stays as it is.
--
-- Safe to run twice: a field that already reads as intended is left alone and nothing is updated,
-- so no second history snapshot is taken. Any other shape stops the migration.

do $$
declare
  doc_id uuid;
  n_docs int;
  cur jsonb;
  old_field constant jsonb := '{"id": "shift", "type": "select", "label": "Shift", "width": "third", "options": ["1st Shift", "2nd Shift", "3rd Shift"], "showInList": true}'::jsonb;
  new_field constant jsonb := old_field || '{"defaultValue": "1st Shift"}'::jsonb;
  ids_before text;
  ids_after text;
begin
  select count(*) into n_docs from public.sop_documents where sop_number = 'FRM-903' and status = 'active';
  if n_docs <> 1 then
    raise exception 'FRM-903: expected one active document, found %', n_docs;
  end if;
  select id into doc_id from public.sop_documents where sop_number = 'FRM-903' and status = 'active';

  select string_agg(f->>'id', ',' order by so, fo), (array_agg(f) filter (where f->>'id' = 'shift'))[1]
    into ids_before, cur
    from public.sop_documents d,
         jsonb_array_elements(d.content->'form_schema'->'sections') with ordinality as y(s, so),
         jsonb_array_elements(s->'fields') with ordinality as x(f, fo)
   where d.id = doc_id;

  if cur = new_field then
    raise notice 'FRM-903: the field already reads as intended, left alone';
  elsif cur = old_field then
    update public.sop_documents d
       set content = jsonb_set(d.content, '{form_schema,sections}', (
             select jsonb_agg(
                      jsonb_set(s, '{fields}', coalesce((
                        select jsonb_agg(case when f->>'id' = 'shift' then new_field else f end order by fo)
                          from jsonb_array_elements(s->'fields') with ordinality as x(f, fo)
                      ), '[]'::jsonb))
                      order by so)
               from jsonb_array_elements(d.content->'form_schema'->'sections') with ordinality as y(s, so)
           ))
     where d.id = doc_id;
  else
    raise exception 'FRM-903: Shift is not the field this migration was written against';
  end if;

  select string_agg(f->>'id', ',' order by so, fo) into ids_after
    from public.sop_documents d,
         jsonb_array_elements(d.content->'form_schema'->'sections') with ordinality as y(s, so),
         jsonb_array_elements(s->'fields') with ordinality as x(f, fo)
   where d.id = doc_id;
  if ids_after is distinct from ids_before then
    raise exception 'FRM-903: the list of fields changed, and this migration must not change it';
  end if;
end $$;
