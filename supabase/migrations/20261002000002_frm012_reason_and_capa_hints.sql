-- FRM-012: two hints (owner, 2026-10-02, after trying the recall workspace).
--
--   reason   - the workspace's contact list now has an envelope beside each email address; it opens the
--              person's mail app with this record's Reason as the text. The hint says so, and that the text
--              can be changed in the email before it is sent.
--   capa_no  - "FRM-007 no." did not say what FRM-007 is. The hint names the CAPA Report.
-- Help text only: no field id, type or option changes, so the one existing (test) entry is untouched.
-- FRM-012 is still DRAFT. Guarded on its md5 after 20261002000001 (attachments excluded).

begin;

do $guard$
declare h text; st text;
begin
  select md5((content - 'attachments')::text), status into h, st from public.sop_documents where sop_number = 'FRM-012';
  if st is distinct from 'draft' or h <> 'bf6dec05a7066fd0c1bfab68de26eaf1' then
    raise exception 'FRM-012 is % or changed since review (md5 %).', st, h;
  end if;
end $guard$;

update public.sop_documents d
   set content = jsonb_set(d.content, '{form_schema,sections}', (
         select jsonb_agg(
                  jsonb_set(s, '{fields}', (
                    select jsonb_agg(
                             case f->>'id'
                               when 'reason' then f || jsonb_build_object('help', $t$Plain words: what is wrong, which product and lots, and what to do with the stock. This text is offered as the starting text when you email a contact from the workspace above - you can change it in the email before you send it.$t$::text)
                               when 'capa_no' then f || jsonb_build_object('label', 'CAPA Report no. (FRM-007)', 'help', $t$The number of the Corrective & Preventive Action (CAPA) Report raised on FRM-007 from this record.$t$::text)
                               else f end order by fo)
                      from jsonb_array_elements(s->'fields') with ordinality x(f, fo)))
                  order by so)
           from jsonb_array_elements(d.content->'form_schema'->'sections') with ordinality y(s, so)))
 where d.sop_number = 'FRM-012' and d.status = 'draft';

do $verify$
begin
  if (select count(*) from public.sop_documents d, jsonb_array_elements(d.content->'form_schema'->'sections') s,
                           jsonb_array_elements(s->'fields') f
       where d.sop_number = 'FRM-012'
         and ((f->>'id' = 'reason' and f->>'help' like '%email a contact%')
           or (f->>'id' = 'capa_no' and f->>'help' like '%CAPA%' and f->>'label' = 'CAPA Report no. (FRM-007)'))) <> 2 then
    raise exception 'FRM-012 hints were not written.';
  end if;
  if (select count(*) from public.sop_documents d, jsonb_array_elements(d.content->'form_schema'->'sections') s,
                           jsonb_array_elements(s->'fields') f where d.sop_number = 'FRM-012') <> 27 then
    raise exception 'FRM-012 field count changed.';
  end if;
end $verify$;

commit;
