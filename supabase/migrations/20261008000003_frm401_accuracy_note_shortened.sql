-- FRM-401 Temperature Monitoring Review: one sentence leaves the Device accuracy note.
--
-- Owner's request, 2026-10-08. The note ended "Open the month's FRM-705 and confirm below what it
-- shows." The entry now shows the last FRM-705 check of each unit in that place, and the link to
-- the FRM-705 entry is under the confirmation, so the sentence only repeated what is on screen.
-- No field is added or removed and the revision stays as it is.
--
-- Safe to run twice: a note that already ends without the sentence is left alone and nothing is
-- updated, so no second history snapshot is taken. Any other wording stops the migration.

do $$
declare
  doc_id uuid;
  n_docs int;
  cur text;
  old_text constant text := $t$The accuracy of the probe thermometer and of each unit's sensor is checked every month under FSQM-030 and recorded on FRM-705, with the site's other measuring devices. It is not recorded again here.$t$ || chr(10) || chr(10) || $t$Open the month's FRM-705 and confirm below what it shows.$t$;
  new_text constant text := $t$The accuracy of the probe thermometer and of each unit's sensor is checked every month under FSQM-030 and recorded on FRM-705, with the site's other measuring devices. It is not recorded again here.$t$;
  fields_before int;
  fields_after int;
begin
  select count(*) into n_docs from public.sop_documents where sop_number = 'FRM-401';
  if n_docs <> 1 then
    raise exception 'FRM-401: expected one document, found %', n_docs;
  end if;
  select id into doc_id from public.sop_documents where sop_number = 'FRM-401';

  select count(*), max(f->>'text') filter (where f->>'id' = 'accuracy_intro')
    into fields_before, cur
    from public.sop_documents d,
         jsonb_array_elements(d.content->'form_schema'->'sections') s,
         jsonb_array_elements(s->'fields') f
   where d.id = doc_id;

  if cur = new_text then
    raise notice 'FRM-401: the note already reads as intended, left alone';
  elsif cur = old_text then
    update public.sop_documents d
       set content = jsonb_set(d.content, '{form_schema,sections}', (
             select jsonb_agg(
                      jsonb_set(s, '{fields}', coalesce((
                        select jsonb_agg(
                                 case when f->>'id' = 'accuracy_intro'
                                      then jsonb_set(f, '{text}', to_jsonb(new_text))
                                      else f end
                                 order by fo)
                          from jsonb_array_elements(s->'fields') with ordinality as x(f, fo)
                      ), '[]'::jsonb))
                      order by so)
               from jsonb_array_elements(d.content->'form_schema'->'sections') with ordinality as y(s, so)
           ))
     where d.id = doc_id;
  else
    raise exception 'FRM-401: the Device accuracy note is not the text this migration was written against';
  end if;

  select count(*) into fields_after
    from public.sop_documents d,
         jsonb_array_elements(d.content->'form_schema'->'sections') s,
         jsonb_array_elements(s->'fields') f
   where d.id = doc_id;
  if fields_after <> fields_before then
    raise exception 'FRM-401: field count changed from % to %', fields_before, fields_after;
  end if;
end $$;
