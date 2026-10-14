-- FRM-501 Formula Sheet & Batch Data: the lines of the ingredient table can be moved up and down.
--
-- Owner's request, 2026-10-13. The mixing screens of "Follow this lot" present the ingredients in
-- the order of this table, and so does the lot record (FRM-520) started from it. Until now the
-- order was whatever order the lines were typed in. The table now carries `reorder`, which gives
-- each line a Move up and a Move down button.
--
-- Nothing printed on the form changes and the revision stays as it is: every formula sheet is an
-- open draft pinned to that revision. Safe to run twice: a table that already carries the setting
-- is left alone, so no second history snapshot is taken.

do $$
declare
  doc_id uuid;
  n_docs int;
  cur jsonb;
  setting constant jsonb := '{"reorder": true}'::jsonb;
  ids_before text;
  ids_after text;
begin
  select count(*) into n_docs from public.sop_documents where sop_number = 'FRM-501' and status = 'active';
  if n_docs <> 1 then
    raise exception 'FRM-501: expected one active document, found %', n_docs;
  end if;
  select id into doc_id from public.sop_documents where sop_number = 'FRM-501' and status = 'active';

  select string_agg(f->>'id', ',' order by so, fo), (array_agg(f) filter (where f->>'id' = 'prototype_formulation_grid'))[1]
    into ids_before, cur
    from public.sop_documents d,
         jsonb_array_elements(d.content->'form_schema'->'sections') with ordinality as y(s, so),
         jsonb_array_elements(s->'fields') with ordinality as x(f, fo)
   where d.id = doc_id;

  -- Moving rows is only safe on a table whose rows are the filler's own (not a fixed checklist).
  if cur is null or cur->>'type' <> 'grid' or cur->'rows'->>'mode' <> 'dynamic' then
    raise exception 'FRM-501: the ingredient table is not the table this migration was written against';
  elsif cur @> setting then
    raise notice 'FRM-501: the ingredient table already carries the setting, left alone';
  else
    update public.sop_documents d
       set content = jsonb_set(d.content, '{form_schema,sections}', (
             select jsonb_agg(
                      jsonb_set(s, '{fields}', coalesce((
                        select jsonb_agg(case when f->>'id' = 'prototype_formulation_grid' then f || setting else f end order by fo)
                          from jsonb_array_elements(s->'fields') with ordinality as x(f, fo)
                      ), '[]'::jsonb))
                      order by so)
               from jsonb_array_elements(d.content->'form_schema'->'sections') with ordinality as y(s, so)
           ))
     where d.id = doc_id;
  end if;

  select string_agg(f->>'id', ',' order by so, fo) into ids_after
    from public.sop_documents d,
         jsonb_array_elements(d.content->'form_schema'->'sections') with ordinality as y(s, so),
         jsonb_array_elements(s->'fields') with ordinality as x(f, fo)
   where d.id = doc_id;
  if ids_after is distinct from ids_before then
    raise exception 'FRM-501: the list of fields changed, and this migration must not change it';
  end if;
end $$;
