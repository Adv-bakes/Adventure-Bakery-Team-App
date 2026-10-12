-- FRM-009 Monthly SQF Update Record: Month covered is filled from the Date of the update.
--
-- Owner's request, 2026-10-12. The field is filled with the month the update's date falls in
-- ("October 2026" for 2026-10-12) and follows the date until somebody types over it (`derive`
-- with `as: "month_year"`). It is notation of the date, not a measurement, so it is filled
-- rather than only suggested; an update given early in a month for the month before is typed.
--
-- Nothing printed on the form changes, so the revision stays as it is. Safe to run twice: a
-- field that already reads as intended is left alone, so no second history snapshot is taken.
-- Any other shape stops the migration.

do $$
declare
  doc_id uuid;
  n_docs int;
  n_src int;
  cur jsonb;
  old_field constant jsonb := $j1${"id": "month_covered", "help": "For example \"September 2026\".", "type": "text", "label": "Month covered", "width": "third", "required": true, "showInList": true}$j1$::jsonb;
  new_field constant jsonb := $j2${"id": "month_covered", "help": "For example \"September 2026\".", "type": "text", "label": "Month covered", "width": "third", "required": true, "showInList": true, "derive": {"fromField": "update_date", "as": "month_year"}}$j2$::jsonb;
begin
  select count(*) into n_docs from public.sop_documents where sop_number = 'FRM-009' and status = 'active';
  if n_docs <> 1 then
    raise exception 'FRM-009: expected one active document, found %', n_docs;
  end if;
  select id into doc_id from public.sop_documents where sop_number = 'FRM-009' and status = 'active';

  -- The date this follows must be a field of the form, or the month would never be filled.
  select count(*) into n_src
    from public.sop_documents d, jsonb_array_elements(d.content->'form_schema'->'sections') s, jsonb_array_elements(s->'fields') f
   where d.id = doc_id and f->>'id' = 'update_date' and f->>'type' = 'date';
  if n_src <> 1 then
    raise exception 'FRM-009: expected the date field update_date, found %', n_src;
  end if;

  select f into cur
    from public.sop_documents d, jsonb_array_elements(d.content->'form_schema'->'sections') s, jsonb_array_elements(s->'fields') f
   where d.id = doc_id and f->>'id' = 'month_covered';

  if cur = new_field then
    raise notice 'FRM-009: the field already reads as intended, left alone';
    return;
  end if;
  if cur is distinct from old_field then
    raise exception 'FRM-009: Month covered is not the field this migration was written against';
  end if;

  update public.sop_documents d
     set content = jsonb_set(d.content, '{form_schema,sections}', (
           select jsonb_agg(
                    jsonb_set(s, '{fields}', (
                      select jsonb_agg(case when f->>'id' = 'month_covered' then new_field else f end order by fo)
                        from jsonb_array_elements(s->'fields') with ordinality as x(f, fo)
                    ))
                    order by so)
             from jsonb_array_elements(d.content->'form_schema'->'sections') with ordinality as y(s, so)
         ))
   where d.id = doc_id;
end $$;
