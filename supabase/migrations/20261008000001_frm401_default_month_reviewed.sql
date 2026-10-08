-- FRM-401 Temperature Monitoring Review: a new entry starts with "Month reviewed" filled in.
--
-- Owner's request, 2026-10-08. An entry started from the SOPs Library opened with the month blank,
-- while one started from the temperature report ("Start FRM-401 Review") had it written in. The
-- field now carries defaultMonth, which writes the current month ("October 2026") into a NEW entry.
-- It stays editable. Existing entries are not touched, and nothing printed on the form changes, so
-- the revision stays as it is.
--
-- Safe to run twice: a field that already carries the flag is left alone and nothing is updated,
-- so no second history snapshot is taken.

do $$
declare
  doc_id uuid;
  n_docs int;
  n_field int;
  n_before int;
  n_after int;
  already boolean;
begin
  select count(*) into n_docs from public.sop_documents where sop_number = 'FRM-401';
  if n_docs <> 1 then
    raise exception 'FRM-401: expected one document, found %', n_docs;
  end if;
  select id into doc_id from public.sop_documents where sop_number = 'FRM-401';

  select count(*), count(*) filter (where f->>'id' = 'review_month' and f->>'type' = 'text'),
         coalesce(bool_or((f->>'id' = 'review_month') and (f->'defaultMonth' = 'true'::jsonb)), false)
    into n_before, n_field, already
    from public.sop_documents d,
         jsonb_array_elements(d.content->'form_schema'->'sections') s,
         jsonb_array_elements(s->'fields') f
   where d.id = doc_id;
  if n_field <> 1 then
    raise exception 'FRM-401: expected one text field review_month, found %', n_field;
  end if;

  if not already then
    update public.sop_documents d
       set content = jsonb_set(d.content, '{form_schema,sections}', (
             select jsonb_agg(
                      jsonb_set(s, '{fields}', coalesce((
                        select jsonb_agg(
                                 case when f->>'id' = 'review_month'
                                      then f || jsonb_build_object('defaultMonth', true)
                                      else f end
                                 order by fo)
                          from jsonb_array_elements(s->'fields') with ordinality as x(f, fo)
                      ), '[]'::jsonb))
                      order by so)
               from jsonb_array_elements(d.content->'form_schema'->'sections') with ordinality as y(s, so)
           ))
     where d.id = doc_id;
  end if;

  select count(*), count(*) filter (where f->>'id' = 'review_month' and f->'defaultMonth' = 'true'::jsonb)
    into n_after, n_field
    from public.sop_documents d,
         jsonb_array_elements(d.content->'form_schema'->'sections') s,
         jsonb_array_elements(s->'fields') f
   where d.id = doc_id;
  if n_after <> n_before then
    raise exception 'FRM-401: field count changed from % to %', n_before, n_after;
  end if;
  if n_field <> 1 then
    raise exception 'FRM-401: review_month does not carry defaultMonth after the update';
  end if;
end $$;
