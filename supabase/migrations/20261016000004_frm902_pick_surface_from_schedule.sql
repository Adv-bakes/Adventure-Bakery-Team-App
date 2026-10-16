-- FRM-902 Sanitation Verification Log: "Area / surface tested" offers the surfaces of the form's own
-- Verification schedule, and a pick fills Method and Acceptable limit.
--
-- Owner's request, 2026-10-16. The results table asked for the surface, method and limit to be typed
-- although the schedule printed above it holds all three. The column gains pickFromTable
-- (GridColumn.pickFromTable, pickOptionsFromTable in src/lib/pickFrom.ts): the browser's own
-- drop-down of the schedule's surfaces, read live from the schedule, so the two cannot disagree. It is
-- an offer, never a closed list - anything can still be typed, and then nothing is filled - and a
-- pick fills a cell only while it is empty (pickFills), so a typed method or limit is never replaced.
--
-- Nothing printed on the form changes and the revision stays as it is. Safe to run twice: a column
-- already carrying exactly this setting is left alone, so no second history snapshot is taken.

do $$
declare
  doc_id uuid;
  n_docs int;
  grid jsonb;
  cur jsonb;
  setting constant jsonb := jsonb_build_object('pickFromTable', jsonb_build_object(
    'table', 'schedule_ref',
    'fill', jsonb_build_object('method', 'Method', 'accept_limit', 'Acceptable limit / standard')));
  ids_before text;
  ids_after text;
begin
  select count(*) into n_docs from public.sop_documents where sop_number = 'FRM-902' and status = 'active';
  if n_docs <> 1 then
    raise exception 'FRM-902: expected one active document, found %', n_docs;
  end if;
  select id into doc_id from public.sop_documents where sop_number = 'FRM-902' and status = 'active';

  select string_agg(f->>'id', ',' order by so, fo),
         (array_agg(f) filter (where f->>'id' = 'swabs'))[1]
    into ids_before, grid
    from public.sop_documents d,
         jsonb_array_elements(d.content->'form_schema'->'sections') with ordinality as y(s, so),
         jsonb_array_elements(s->'fields') with ordinality as x(f, fo)
   where d.id = doc_id;

  -- The table it reads and the columns it fills must be the ones this was written against.
  if not exists (
    select 1 from public.sop_documents d,
           jsonb_array_elements(d.content->'form_schema'->'sections') s,
           jsonb_array_elements(s->'fields') f
     where d.id = doc_id and f->>'id' = 'schedule_ref' and f->>'type' = 'reference_table'
       and f->'columns' = '["Area / Surface", "Method", "Frequency", "Acceptable limit / standard"]'::jsonb) then
    raise exception 'FRM-902: the verification schedule table is not the one this migration was written against';
  end if;
  if grid is null or grid->>'type' <> 'grid'
     or (select string_agg(c->>'id', ',' order by o) from jsonb_array_elements(grid->'columns') with ordinality as z(c, o))
        <> 'area_surface,method,result_reading,accept_limit,pass_fail,corrective_action,retest_result,verified_by' then
    raise exception 'FRM-902: the results table is not the one this migration was written against';
  end if;

  select c into cur from jsonb_array_elements(grid->'columns') as z(c) where c->>'id' = 'area_surface';
  if cur @> setting then
    raise notice 'FRM-902: Area / surface tested already carries the setting, left alone';
  elsif cur ? 'pickFromTable' or cur ? 'pickFrom' then
    raise exception 'FRM-902: Area / surface tested already carries a different pick setting';
  else
    update public.sop_documents d
       set content = jsonb_set(d.content, '{form_schema,sections}', (
             select jsonb_agg(
                      jsonb_set(s, '{fields}', coalesce((
                        select jsonb_agg(
                                 case when f->>'id' = 'swabs' then jsonb_set(f, '{columns}', (
                                   select jsonb_agg(case when c->>'id' = 'area_surface' then c || setting else c end order by o)
                                     from jsonb_array_elements(f->'columns') with ordinality as z(c, o)))
                                 else f end order by fo)
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
    raise exception 'FRM-902: the list of fields changed, and this migration must not change it';
  end if;
end $$;
