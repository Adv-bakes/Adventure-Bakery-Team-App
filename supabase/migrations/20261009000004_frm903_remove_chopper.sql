-- FRM-903 Daily Sanitation, Pre-Operation & Release Record: the Chopper row is removed.
--
-- Owner, 2026-10-09: the site no longer has the chopper. It is taken off the pre-operation
-- cleanliness check, so a new entry no longer asks about it.
--
-- Entries already made are not touched: this table's rows carry their own label in each entry, so
-- an earlier record still shows its Chopper row and what was answered. The revision stays as it is.
--
-- Safe to run twice: a table that no longer lists the Chopper is left alone and nothing is updated,
-- so no second history snapshot is taken.

do $$
declare
  doc_id uuid;
  n_docs int;
  labels jsonb;
  kept jsonb;
  n_other int;
begin
  select count(*) into n_docs from public.sop_documents where sop_number = 'FRM-903' and status = 'active';
  if n_docs <> 1 then
    raise exception 'FRM-903: expected one active document, found %', n_docs;
  end if;
  select id into doc_id from public.sop_documents where sop_number = 'FRM-903' and status = 'active';

  select f->'rows'->'labels' into labels
    from public.sop_documents d,
         jsonb_array_elements(d.content->'form_schema'->'sections') s,
         jsonb_array_elements(s->'fields') f
   where d.id = doc_id and f->>'id' = 'surface_check';
  if labels is null or jsonb_typeof(labels) <> 'array' then
    raise exception 'FRM-903: the pre-operation table (surface_check) was not found';
  end if;
  -- The table must be the kind whose entries keep their own row labels, or removing a row would
  -- shift the answers of earlier entries.
  if not exists (select 1 from public.sop_documents d,
                        jsonb_array_elements(d.content->'form_schema'->'sections') s,
                        jsonb_array_elements(s->'fields') f
                  where d.id = doc_id and f->>'id' = 'surface_check'
                    and f->'rows'->>'mode' = 'fixed' and f->'rows'->'deletable' = 'true'::jsonb
                    and f->'rows'->'defaultValues' is null and f->'rows'->'guidance' is null) then
    raise exception 'FRM-903: surface_check is not the table this migration was written against';
  end if;

  select coalesce(jsonb_agg(l order by o), '[]'::jsonb), count(*) into kept, n_other
    from jsonb_array_elements(labels) with ordinality as t(l, o)
   where l <> '"Chopper"'::jsonb;

  if jsonb_array_length(labels) = n_other then
    raise notice 'FRM-903: no Chopper row, left alone';
  elsif jsonb_array_length(labels) = n_other + 1 then
    update public.sop_documents d
       set content = jsonb_set(d.content, '{form_schema,sections}', (
             select jsonb_agg(
                      jsonb_set(s, '{fields}', coalesce((
                        select jsonb_agg(
                                 case when f->>'id' = 'surface_check' then jsonb_set(f, '{rows,labels}', kept) else f end
                                 order by fo)
                          from jsonb_array_elements(s->'fields') with ordinality as x(f, fo)
                      ), '[]'::jsonb))
                      order by so)
               from jsonb_array_elements(d.content->'form_schema'->'sections') with ordinality as y(s, so)
           ))
     where d.id = doc_id;
  else
    raise exception 'FRM-903: more than one Chopper row found';
  end if;

  if exists (select 1 from public.sop_documents d,
                    jsonb_array_elements(d.content->'form_schema'->'sections') s,
                    jsonb_array_elements(s->'fields') f,
                    jsonb_array_elements(f->'rows'->'labels') l
              where d.id = doc_id and f->>'id' = 'surface_check' and l = '"Chopper"'::jsonb) then
    raise exception 'FRM-903: the Chopper row is still there after the update';
  end if;
  if (select jsonb_array_length(f->'rows'->'labels') from public.sop_documents d,
             jsonb_array_elements(d.content->'form_schema'->'sections') s,
             jsonb_array_elements(s->'fields') f
       where d.id = doc_id and f->>'id' = 'surface_check') <> n_other then
    raise exception 'FRM-903: the pre-operation table lost more than the Chopper row';
  end if;
end $$;
