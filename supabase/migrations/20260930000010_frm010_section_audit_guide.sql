-- FRM-010: an audit guide under "Sections audited" (owner, 2026-09-30).
--
-- The owner wants the form to show, for each section being audited, what to look at. Ticking a section now
-- opens a panel (SelectField.auditGuide, src/lib/auditGuide.ts) with:
--   - the Code's sub-sections (SQF Food Manufacturing, from sqfFoodClauses.ts) linked to the Code PDF;
--   - the site documents whose sqf_reference falls in the section, looked up LIVE - nothing is listed by
--     hand, so a newly issued program appears without anyone updating this form - grouped as programs and
--     procedures, records to sample, and training;
--   - beside each form, its submitted entries in the last 12 months (an active form with none is flagged);
--   - "Add to findings": one line per sub-section in the Findings table, clause filled in.
-- The instructions line is updated to say so. FRM-010 is still DRAFT with no entries.
-- Guarded on its md5 after 20260930000009 (attachments excluded).

begin;

do $guard$
declare h text; st text;
begin
  select md5((content - 'attachments')::text), status into h, st from public.sop_documents where sop_number = 'FRM-010';
  if st is distinct from 'draft' or h <> 'bfe1356462bde90b44d5552549648132' then
    raise exception 'FRM-010 is % or changed since review (md5 %).', st, h;
  end if;
end $guard$;

update public.sop_documents d
   set content = jsonb_set(d.content, '{form_schema,sections}', (
         select jsonb_agg(
                  jsonb_set(s, '{fields}', (
                    select jsonb_agg(
                             case f->>'id'
                               when 'sections' then f || '{"auditGuide": {"findingsGrid": "findings", "clauseColumn": "clause"}, "help": "Tick a section to see what the Code asks in it, the site documents and records that cover it, and to add its sub-sections to Findings."}'::jsonb
                               when 'how_this_works' then f || jsonb_build_object('text', $t$One entry per quarterly audit. Tick the sections being audited: each opens a guide to the Code's sub-sections and the site documents and records that cover them - open a document to read what it says, then check the records and the floor. Write one line per sub-section with the evidence you saw ("Add to findings" puts the lines in for you). A non-conformance gets its own line against the exact clause and goes on FRM-007.$t$::text)
                               else f end order by fo)
                      from jsonb_array_elements(s->'fields') with ordinality x(f, fo)))
                  order by so)
           from jsonb_array_elements(d.content->'form_schema'->'sections') with ordinality y(s, so)))
 where d.sop_number = 'FRM-010' and d.status = 'draft';

do $verify$
begin
  if (select f->'auditGuide' from public.sop_documents d, jsonb_array_elements(d.content->'form_schema'->'sections') s,
                                  jsonb_array_elements(s->'fields') f
       where d.sop_number = 'FRM-010' and f->>'id' = 'sections')
     is distinct from '{"findingsGrid": "findings", "clauseColumn": "clause"}'::jsonb then
    raise exception 'FRM-010 audit guide was not written.';
  end if;
  if (select count(*) from public.sop_documents d, jsonb_array_elements(d.content->'form_schema'->'sections') s,
                           jsonb_array_elements(s->'fields') f
       where d.sop_number = 'FRM-010') <> 15 then
    raise exception 'FRM-010 field count changed.';
  end if;
end $verify$;

commit;
