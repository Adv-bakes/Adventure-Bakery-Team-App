-- FRM-606 CCP 2 Vacuum Sealing Monitoring Record: section 3 "If a limit was not met" starts collapsed.
--
-- Owner's request, 2026-10-09, to match FRM-507 (migration 20261009000007): the section is only
-- filled when a check fails or a limit is missed. It now carries `collapsed`: it shows as one line to tap, and opens by
-- itself whenever it holds an answer or one of its fields fails the check at Submit. Nothing
-- printed on the form changes, no field is added or removed, and the revision stays as it is.
--
-- Safe to run twice: a section that already carries the flag is left alone and nothing is
-- updated, so no second history snapshot is taken.

do $$
declare
  doc_id uuid;
  n_docs int;
  n_section int;
  already boolean;
  fields_before text;
  fields_after text;
begin
  select count(*) into n_docs from public.sop_documents where sop_number = 'FRM-606';
  if n_docs <> 1 then
    raise exception 'FRM-606: expected one document, found %', n_docs;
  end if;
  select id into doc_id from public.sop_documents where sop_number = 'FRM-606';

  select count(*) filter (where s->>'id' = 'deviation'),
         coalesce(bool_or(s->>'id' = 'deviation' and s->'collapsed' = 'true'::jsonb), false)
    into n_section, already
    from public.sop_documents d, jsonb_array_elements(d.content->'form_schema'->'sections') s
   where d.id = doc_id;
  if n_section <> 1 then
    raise exception 'FRM-606: expected one section deviation, found %', n_section;
  end if;

  select md5(string_agg((s->'fields')::text, '|' order by so)) into fields_before
    from public.sop_documents d, jsonb_array_elements(d.content->'form_schema'->'sections') with ordinality as y(s, so)
   where d.id = doc_id;

  if not already then
    update public.sop_documents d
       set content = jsonb_set(d.content, '{form_schema,sections}', (
             select jsonb_agg(
                      case when s->>'id' = 'deviation' then s || jsonb_build_object('collapsed', true) else s end
                      order by so)
               from jsonb_array_elements(d.content->'form_schema'->'sections') with ordinality as y(s, so)
           ))
     where d.id = doc_id;
  end if;

  select md5(string_agg((s->'fields')::text, '|' order by so)) into fields_after
    from public.sop_documents d, jsonb_array_elements(d.content->'form_schema'->'sections') with ordinality as y(s, so)
   where d.id = doc_id;
  if fields_after is distinct from fields_before then
    raise exception 'FRM-606: the fields changed, and this migration must not change them';
  end if;
  if not exists (select 1 from public.sop_documents d, jsonb_array_elements(d.content->'form_schema'->'sections') s
                  where d.id = doc_id and s->>'id' = 'deviation' and s->'collapsed' = 'true'::jsonb) then
    raise exception 'FRM-606: deviation does not carry collapsed after the update';
  end if;
end $$;
