-- FSQM-027 (draft): no dedicated nut scoop, and the segregation check on nut days (owner, 2026-10-05).
--
-- The first draft gave nuts a dedicated, marked scoop and container. SQF 2.8.1.4 does not ask for that:
-- it asks for a clean that removes the allergen, and for separate equipment only where a clean is not
-- possible. The line now says a utensil used for nuts is washed, rinsed and sanitized before any other
-- use, as part of the changeover clean - and that sanitizer alone does not remove an allergen.
-- The segregation check (2.8.1.3) moves from every production day to the days nuts are handled, plus
-- the monthly GMP inspection: nuts are the only allergen that can cross between products here.
-- Two procedure lines and the revision history change; still 46 lines, still DRAFT.
-- Guarded on the md5 as pushed in 20261005000001 (attachments excluded).

begin;

do $guard$
declare h text;
begin
  select md5((content - 'attachments')::text) into h from public.sop_documents where sop_number = 'FSQM-027' and status = 'draft';
  if h is distinct from '49616b1b5634c1c45dde440e1282c9ea' then
    raise exception 'FSQM-027 is not the draft that was reviewed (md5 %).', h;
  end if;
end $guard$;

update public.sop_documents d
   set content = jsonb_set(
         jsonb_set(d.content, '{procedure}', (
           select jsonb_agg(case when l = to_jsonb($t$• Nuts have their own scoop and container, marked and used for nothing else. A spill is cleaned up at once.$t$::text) then to_jsonb($t$• A scoop, bowl or container that has been used for nuts is washed with detergent, rinsed and sanitized before it is used for anything else. It is part of the changeover clean. Sanitizer alone does not remove an allergen; the wash and rinse do. A spill is cleaned up at once.$t$::text)
                            when l = to_jsonb($t$• Segregation is checked every production day on FRM-903 ("Allergen controls / segregation followed") and every month in the GMP inspection on FRM-913 (SQF 2.8.1.3).$t$::text) then to_jsonb($t$• Segregation is checked on every day nuts are handled, on that day's FRM-903 ("Allergen controls / segregation followed"), and every month in the GMP inspection on FRM-913 (SQF 2.8.1.3).$t$::text) else l end order by lo)
             from jsonb_array_elements(d.content->'procedure') with ordinality z(l, lo))),
         '{revision_history}', to_jsonb(replace(d.content->>'revision_history', $t$(4) the nuts' own marked scoop and container, and their place on the allergen rack;$t$, $t$(4) the nuts' place on the allergen rack;$t$) || $t$

OWNER'S DECISION (2026-10-05): nuts do not have their own scoop. A utensil used for nuts is washed, rinsed and sanitized before any other use. SQF 2.8.1.4 asks for separate equipment only where a clean is not possible. The first draft's dedicated scoop went further than the clause.

OWNER'S DECISION (2026-10-05): segregation is checked on the days nuts are handled and in the monthly inspection, not on every production day. Tree nuts are the only allergen that can cross between products here, so a day without nuts has nothing to keep apart beyond the closed containers on the rack. SQF 2.8.1.3 asks for continual monitoring; monthly alone was judged too little.$t$))
 where d.sop_number = 'FSQM-027' and d.status = 'draft';

do $verify$
declare c jsonb;
begin
  select content into c from public.sop_documents where sop_number = 'FSQM-027';
  if jsonb_array_length(c->'procedure') <> 46
     or (select count(*) from jsonb_array_elements_text(c->'procedure') l where l like '%washed with detergent, rinsed and sanitized%') <> 1
     or (select count(*) from jsonb_array_elements_text(c->'procedure') l where l like '%on every day nuts are handled%') <> 1
     or (c->'procedure')::text like '%every production day%'
     or (c->'procedure')::text like '%their own scoop%'
     or c->>'revision_history' like '%own marked scoop%'
     or c->>'revision_history' not like '%do not have their own scoop%' then
    raise exception 'FSQM-027 scoop and segregation lines were not rewritten as intended.';
  end if;
end $verify$;

commit;
