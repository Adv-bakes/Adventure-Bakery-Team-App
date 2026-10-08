-- FRM-401 Temperature Monitoring Review: "Manual readings and changes of state" starts collapsed.
--
-- Owner's request, 2026-10-08: that section is only filled in an exceptional case (a sensor was
-- down, or a unit changed state), and showing its two empty tables every month made the form look
-- longer than it is. The section now carries `collapsed`: it shows as one line to tap, and opens by
-- itself whenever it holds an entry. Nothing printed on the form changes, no field is added or
-- removed, and the revision stays as it is.
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
  select count(*) into n_docs from public.sop_documents where sop_number = 'FRM-401';
  if n_docs <> 1 then
    raise exception 'FRM-401: expected one document, found %', n_docs;
  end if;
  select id into doc_id from public.sop_documents where sop_number = 'FRM-401';

  select count(*) filter (where s->>'id' = 'manual_state'),
         coalesce(bool_or(s->>'id' = 'manual_state' and s->'collapsed' = 'true'::jsonb), false)
    into n_section, already
    from public.sop_documents d, jsonb_array_elements(d.content->'form_schema'->'sections') s
   where d.id = doc_id;
  if n_section <> 1 then
    raise exception 'FRM-401: expected one section manual_state, found %', n_section;
  end if;

  select md5(string_agg((s->'fields')::text, '|' order by so)) into fields_before
    from public.sop_documents d, jsonb_array_elements(d.content->'form_schema'->'sections') with ordinality as y(s, so)
   where d.id = doc_id;

  if not already then
    update public.sop_documents d
       set content = jsonb_set(d.content, '{form_schema,sections}', (
             select jsonb_agg(
                      case when s->>'id' = 'manual_state' then s || jsonb_build_object('collapsed', true) else s end
                      order by so)
               from jsonb_array_elements(d.content->'form_schema'->'sections') with ordinality as y(s, so)
           ))
     where d.id = doc_id;
  end if;

  select md5(string_agg((s->'fields')::text, '|' order by so)) into fields_after
    from public.sop_documents d, jsonb_array_elements(d.content->'form_schema'->'sections') with ordinality as y(s, so)
   where d.id = doc_id;
  if fields_after is distinct from fields_before then
    raise exception 'FRM-401: the fields changed, and this migration must not change them';
  end if;
  if not exists (select 1 from public.sop_documents d, jsonb_array_elements(d.content->'form_schema'->'sections') s
                  where d.id = doc_id and s->>'id' = 'manual_state' and s->'collapsed' = 'true'::jsonb) then
    raise exception 'FRM-401: manual_state does not carry collapsed after the update';
  end if;
end $$;
