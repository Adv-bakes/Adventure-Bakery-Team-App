-- D-20: the film lot on FRM-520 is optional (owner, 2026-09-30).
--
-- The owner: the boxes the sealed cakes are packed into carry no maker's lot. The box is outer packaging and
-- needs none. The FILM (vacuum bag) touches the cake and is food-contact packaging, which 2.6.2.1 ii traces
-- by its receipt date - FRM-301 already records that. So the film lot is written when the maker prints one,
-- and otherwise the date the film was received is written instead. Field id film_lot is unchanged, so the
-- one (test) entry already on FRM-520 keeps its answer. Both documents are still DRAFT.
-- Guarded on the md5 of both documents after 20260930000002 (attachments excluded) and on the exact old line.

begin;

do $guard$
declare h text; st text;
begin
  select md5((content - 'attachments')::text), status into h, st from public.sop_documents where sop_number = 'FSQM-021';
  if st is distinct from 'draft' or h <> 'b431ab434d50f69266e410b4acb0890d' then
    raise exception 'FSQM-021 is % or changed since review (md5 %).', st, h;
  end if;
  select md5((content - 'attachments')::text), status into h, st from public.sop_documents where sop_number = 'FRM-520';
  if st is distinct from 'draft' or h <> '8aa5cfe07a634f7b8ae9a08a5951eb80' then
    raise exception 'FRM-520 is % or changed since review (md5 %).', st, h;
  end if;
  if (select content->'procedure'->>16 from public.sop_documents where sop_number = 'FSQM-021')
     <> $t$• At wrapping, the sheet records the pack date, the number of units packed and the lot of the film roll used - the film is food-contact packaging (SQF 2.6.2.1 ii).$t$ then
    raise exception 'FSQM-021 procedure line 17 is not the text this migration replaces.';
  end if;
end $guard$;

update public.sop_documents
   set content = jsonb_set(content, '{procedure,16}', to_jsonb($t$• At wrapping, the sheet records the pack date and the number of units packed. The film or vacuum bag touches the cake and is food-contact packaging: its lot is written when the maker prints one, and when none is printed the date that film was received is written instead, which FRM-301 ties to its supplier. The boxes the sealed cakes go into are outer packaging and are not traced (SQF 2.6.2.1 ii).$t$::text))
 where sop_number = 'FSQM-021' and status = 'draft';

update public.sop_documents d
   set content = jsonb_set(d.content, '{form_schema,sections}', (
         select jsonb_agg(
                  jsonb_set(s, '{fields}', (
                    select jsonb_agg(case when f->>'id' = 'film_lot'
                                          then f || jsonb_build_object(
                                                 'label', 'Film / bag lot',
                                                 'required', false,
                                                 'help', 'The lot printed on the film roll or bag case. If none is printed, write "no lot - received" and the date it was received. Boxes need nothing.')
                                          else f end order by fo)
                      from jsonb_array_elements(s->'fields') with ordinality x(f, fo)))
                  order by so)
           from jsonb_array_elements(d.content->'form_schema'->'sections') with ordinality y(s, so)))
 where d.sop_number = 'FRM-520' and d.status = 'draft';

do $verify$
begin
  if (select f from public.sop_documents d, jsonb_array_elements(d.content->'form_schema'->'sections') s,
                    jsonb_array_elements(s->'fields') f
       where d.sop_number = 'FRM-520' and f->>'id' = 'film_lot')->>'required' <> 'false' then
    raise exception 'FRM-520 film_lot is still required.';
  end if;
  if (select count(*) from public.sop_documents d, jsonb_array_elements(d.content->'form_schema'->'sections') s,
                           jsonb_array_elements(s->'fields') f where d.sop_number = 'FRM-520') <> 13 then
    raise exception 'FRM-520 field count changed.';
  end if;
  if (select content->'procedure'->>16 from public.sop_documents where sop_number = 'FSQM-021') not like '%outer packaging%' then
    raise exception 'FSQM-021 procedure line 17 was not updated.';
  end if;
end $verify$;

commit;
