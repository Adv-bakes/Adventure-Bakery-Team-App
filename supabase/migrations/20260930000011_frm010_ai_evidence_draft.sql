-- FRM-010: "Draft from records" on Objective evidence seen (owner, 2026-09-30).
--
-- Opening a Findings row now offers a draft of the evidence (GridColumn.aiDraft = "audit_evidence",
-- edge function draft-audit-evidence). The function reads the row's Clause, finds the forms whose SQF
-- reference bears on it, and COMPUTES the facts from their last twelve months of submitted entries:
-- count, first and last, longest gap, failed checks, related CAPAs. The model only writes them up.
-- Owner's decisions: evidence only - it never proposes the Result; and the draft is PREVIEWED with the
-- records it came from, entering the cell only when the auditor taps Use.
-- The findings grid's help line is updated to say so. FRM-010 is still DRAFT (one test entry; no
-- column id changes, so its answers are untouched). Guarded on its md5 after 20260930000010
-- (attachments excluded).

begin;

do $guard$
declare h text; st text;
begin
  select md5((content - 'attachments')::text), status into h, st from public.sop_documents where sop_number = 'FRM-010';
  if st is distinct from 'draft' or h <> '25b2479703c59e8b6898b6f7903d1683' then
    raise exception 'FRM-010 is % or changed since review (md5 %).', st, h;
  end if;
end $guard$;

update public.sop_documents d
   set content = jsonb_set(d.content, '{form_schema,sections}', (
         select jsonb_agg(
                  jsonb_set(s, '{fields}', (
                    select jsonb_agg(
                             case when f->>'id' = 'findings' then
                               jsonb_set(f, '{columns}', (
                                 select jsonb_agg(case when c->>'id' = 'evidence'
                                                       then c || '{"aiDraft": "audit_evidence"}'::jsonb
                                                       else c end order by co)
                                   from jsonb_array_elements(f->'columns') with ordinality z(c, co)))
                               || jsonb_build_object('help', $t$One line per sub-section audited. Evidence = the record (form and date or lot), document, observation or person asked. Not applicable needs the reason. Open a line to use "Draft from records": it summarises the last twelve months of the forms that cover the clause - check it, then add what you saw on the floor.$t$::text)
                             else f end order by fo)
                      from jsonb_array_elements(s->'fields') with ordinality x(f, fo)))
                  order by so)
           from jsonb_array_elements(d.content->'form_schema'->'sections') with ordinality y(s, so)))
 where d.sop_number = 'FRM-010' and d.status = 'draft';

do $verify$
begin
  if (select string_agg(c->>'id' || ':' || coalesce(c->>'aiDraft', '-'), ',' order by o)
        from public.sop_documents d, jsonb_array_elements(d.content->'form_schema'->'sections') s,
             jsonb_array_elements(s->'fields') f, jsonb_array_elements(f->'columns') with ordinality w(c, o)
       where d.sop_number = 'FRM-010' and f->>'id' = 'findings')
     is distinct from 'clause:-,result:-,evidence:audit_evidence,capa_no:-' then
    raise exception 'FRM-010 findings columns are not as expected.';
  end if;
end $verify$;

commit;
