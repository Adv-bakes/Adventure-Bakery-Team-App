-- FRM-903 Daily Sanitation, Pre-Operation & Release Record: a "Lot 6286" link to the right of
-- "Product / batch run".
--
-- Owner's request, 2026-10-13. The field now carries `lotLink`: the link shows the lot code of the
-- record's Date (today's while the date is blank), and a tap adds it to what is typed - "Rum Cake"
-- becomes "Rum Cake, Lot 6286". Nothing is added without the tap.
--
-- Nothing printed on the form changes and the revision stays as it is. Safe to run twice: a field
-- that already carries the setting is left alone, so no second history snapshot is taken.

do $$
declare
  doc_id uuid;
  n_docs int;
  cur jsonb;
  link constant jsonb := '{"lotLink": {"fromField": "inspection_date"}}'::jsonb;
  ids_before text;
  ids_after text;
begin
  select count(*) into n_docs from public.sop_documents where sop_number = 'FRM-903' and status = 'active';
  if n_docs <> 1 then
    raise exception 'FRM-903: expected one active document, found %', n_docs;
  end if;
  select id into doc_id from public.sop_documents where sop_number = 'FRM-903' and status = 'active';

  -- The date the lot code is read from must be a date field of this form.
  if not exists (select 1 from public.sop_documents d,
                        jsonb_array_elements(d.content->'form_schema'->'sections') s,
                        jsonb_array_elements(s->'fields') f
                  where d.id = doc_id and f->>'id' = 'inspection_date' and f->>'type' = 'date') then
    raise exception 'FRM-903 has no inspection_date date field';
  end if;

  select string_agg(f->>'id', ',' order by so, fo), (array_agg(f) filter (where f->>'id' = 'product_run'))[1]
    into ids_before, cur
    from public.sop_documents d,
         jsonb_array_elements(d.content->'form_schema'->'sections') with ordinality as y(s, so),
         jsonb_array_elements(s->'fields') with ordinality as x(f, fo)
   where d.id = doc_id;

  if cur is null or cur->>'type' <> 'text' then
    raise exception 'FRM-903: Product / batch run is not the field this migration was written against';
  elsif cur @> link then
    raise notice 'FRM-903: the field already carries the lot link, left alone';
  else
    update public.sop_documents d
       set content = jsonb_set(d.content, '{form_schema,sections}', (
             select jsonb_agg(
                      jsonb_set(s, '{fields}', coalesce((
                        select jsonb_agg(case when f->>'id' = 'product_run' then f || link else f end order by fo)
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
    raise exception 'FRM-903: the list of fields changed, and this migration must not change it';
  end if;
end $$;
