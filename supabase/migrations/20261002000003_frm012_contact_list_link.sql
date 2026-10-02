-- FRM-012: a link to the contact list under "Contact list (FRM-011)" in section 4 (owner, 2026-10-02).
--
-- The field asks whether the contact list was checked, and named FRM-011 without offering it. It now
-- carries linkTo {form: "FRM-011", latestEntry: true} (FieldLink in src/lib/formSchema.ts): a link under
-- the field to the newest FRM-011 entry - newest submitted, else newest draft, flagged - opening in a new
-- tab. One setting on one field; no id, type or option changes. FRM-012 is still DRAFT.
-- Guarded on its md5 after 20261002000002 (attachments excluded).

begin;

do $guard$
declare h text; st text;
begin
  select md5((content - 'attachments')::text), status into h, st from public.sop_documents where sop_number = 'FRM-012';
  if st is distinct from 'draft' or h <> '0686e939a9c56682a6b5e28433378cda' then
    raise exception 'FRM-012 is % or changed since review (md5 %).', st, h;
  end if;
end $guard$;

update public.sop_documents d
   set content = jsonb_set(d.content, '{form_schema,sections}', (
         select jsonb_agg(
                  jsonb_set(s, '{fields}', (
                    select jsonb_agg(
                             case when f->>'id' = 'contacts_checked'
                                  then f || '{"linkTo": {"form": "FRM-011", "latestEntry": true}}'::jsonb
                                  else f end order by fo)
                      from jsonb_array_elements(s->'fields') with ordinality x(f, fo)))
                  order by so)
           from jsonb_array_elements(d.content->'form_schema'->'sections') with ordinality y(s, so)))
 where d.sop_number = 'FRM-012' and d.status = 'draft';

do $verify$
begin
  if (select f->'linkTo' from public.sop_documents d, jsonb_array_elements(d.content->'form_schema'->'sections') s,
                              jsonb_array_elements(s->'fields') f
       where d.sop_number = 'FRM-012' and f->>'id' = 'contacts_checked')
     is distinct from '{"form": "FRM-011", "latestEntry": true}'::jsonb then
    raise exception 'FRM-012 contacts_checked link was not written.';
  end if;
  if (select count(*) from public.sop_documents d, jsonb_array_elements(d.content->'form_schema'->'sections') s,
                           jsonb_array_elements(s->'fields') f where d.sop_number = 'FRM-012') <> 27 then
    raise exception 'FRM-012 field count changed.';
  end if;
end $verify$;

commit;
