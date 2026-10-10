-- FRM-520 Production Lot Record: "First pack checked by" offers the team's names.
--
-- Owner's request, 2026-10-10. The field gains `teamPick`: it lists the team as a type-ahead while
-- still taking any name typed. (The app also writes the signed-in person's name there when they
-- answer "Code on the pack" - that is code, not a form setting.)
--
-- Nothing printed on the form changes, so the revision stays as it is. Safe to run twice: a field
-- that already carries the setting is left alone, so no second history snapshot is taken. Any
-- other shape stops the migration.

do $$
declare
  doc_id uuid;
  n_docs int;
  cur_field jsonb;
  field_old constant jsonb := $j1${"id": "code_checked_by", "help": "The name of the person who checked and approved the first pack.", "type": "text", "label": "First pack checked by", "required": true, "maxLength": 120}$j1$::jsonb;
  field_new constant jsonb := $j2${"id": "code_checked_by", "help": "The name of the person who checked and approved the first pack.", "type": "text", "label": "First pack checked by", "required": true, "maxLength": 120, "teamPick": {}}$j2$::jsonb;
begin
  select count(*) into n_docs from public.sop_documents where sop_number = 'FRM-520' and status = 'active';
  if n_docs <> 1 then
    raise exception 'FRM-520: expected one active document, found %', n_docs;
  end if;
  select id into doc_id from public.sop_documents where sop_number = 'FRM-520' and status = 'active';

  select f into cur_field
    from public.sop_documents d, jsonb_array_elements(d.content->'form_schema'->'sections') s, jsonb_array_elements(s->'fields') f
   where d.id = doc_id and f->>'id' = 'code_checked_by';

  if cur_field = field_new then
    raise notice 'FRM-520: the field already offers the team names, left alone';
    return;
  end if;
  if cur_field is distinct from field_old then
    raise exception 'FRM-520 is not the form this migration was written against';
  end if;

  update public.sop_documents d
     set content = jsonb_set(d.content, '{form_schema,sections}', (
           select jsonb_agg(
                    jsonb_set(s, '{fields}', (
                      select jsonb_agg(case when f->>'id' = 'code_checked_by' then field_new else f end order by fo)
                        from jsonb_array_elements(s->'fields') with ordinality as x(f, fo)
                    ))
                    order by so)
             from jsonb_array_elements(d.content->'form_schema'->'sections') with ordinality as y(s, so)
         ))
   where d.id = doc_id;
end $$;
