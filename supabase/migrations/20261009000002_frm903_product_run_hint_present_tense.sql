-- FRM-903 Daily Sanitation, Pre-Operation & Release Record: the hint under "Product / batch run"
-- is worded in the present tense.
--
-- Owner's request, 2026-10-09. The record is filled in before production starts, so "What was
-- produced today" asked about something that had not happened yet. It now reads "What is being
-- produced today". Only the hint changes: no field is added, removed or renamed, and the revision
-- stays as it is.
--
-- Safe to run twice: a hint that already reads as intended is left alone and nothing is updated,
-- so no second history snapshot is taken. Any other wording stops the migration.

do $$
declare
  doc_id uuid;
  n_docs int;
  cur text;
  old_text constant text := 'What was produced today (leave blank if no production)';
  new_text constant text := 'What is being produced today (leave blank if no production)';
  fields_before int;
  fields_after int;
begin
  select count(*) into n_docs from public.sop_documents where sop_number = 'FRM-903' and status = 'active';
  if n_docs <> 1 then
    raise exception 'FRM-903: expected one active document, found %', n_docs;
  end if;
  select id into doc_id from public.sop_documents where sop_number = 'FRM-903' and status = 'active';

  select count(*), max(f->>'help') filter (where f->>'id' = 'product_run')
    into fields_before, cur
    from public.sop_documents d,
         jsonb_array_elements(d.content->'form_schema'->'sections') s,
         jsonb_array_elements(s->'fields') f
   where d.id = doc_id;

  if cur = new_text then
    raise notice 'FRM-903: the hint already reads as intended, left alone';
  elsif cur = old_text then
    update public.sop_documents d
       set content = jsonb_set(d.content, '{form_schema,sections}', (
             select jsonb_agg(
                      jsonb_set(s, '{fields}', coalesce((
                        select jsonb_agg(
                                 case when f->>'id' = 'product_run'
                                      then jsonb_set(f, '{help}', to_jsonb(new_text))
                                      else f end
                                 order by fo)
                          from jsonb_array_elements(s->'fields') with ordinality as x(f, fo)
                      ), '[]'::jsonb))
                      order by so)
               from jsonb_array_elements(d.content->'form_schema'->'sections') with ordinality as y(s, so)
           ))
     where d.id = doc_id;
  else
    raise exception 'FRM-903: the Product / batch run hint is not the text this migration was written against';
  end if;

  select count(*) into fields_after
    from public.sop_documents d,
         jsonb_array_elements(d.content->'form_schema'->'sections') s,
         jsonb_array_elements(s->'fields') f
   where d.id = doc_id;
  if fields_after <> fields_before then
    raise exception 'FRM-903: field count changed from % to %', fields_before, fields_after;
  end if;
end $$;
