-- FSQM-021 and FRM-520 (both still DRAFTS): the changeover Part now covers product wrapped in printed film.
--
-- The owner (2026-10-06) answered the two points left to confirm. Every rum cake flavor matches the
-- ingredient list printed on the box. And the only other product packed here is the biscotti:
-- baked on site, flow-wrapped (SOP-605) in film that is printed per variety with everything except
-- the lot code and best-by date, which the coder adds. The first pack is already looked at, but
-- not recorded.
--
-- That is the opposite case from the rum cake. For the rum cake the label is the coder message;
-- for the biscotti the label is the roll of film, and a wrong roll is a wrong allergen statement -
-- exactly what 2.8.1.9 is about. So:
--   - a prose line says so, after the one about the box;
--   - the first-pack check names the film for the variety, and is repeated when a new roll goes on;
--   - at changeover the previous variety's film comes off the wrapper;
--   - the formula-matches-the-print rule and the obsolete-packaging line cover printed film;
--   - obsolete packaging is "disposed of under FSQM-037" (not "destroyed"): that program decides
--     which printed packaging must be defaced, and bulk film carrying artwork only goes out whole.
-- FRM-520: the two help lines and one label say "first pack", and name the film.
--
-- No customer is named. ONE UPDATE per document, guarded on each md5 as verified after 20261006000009.

begin;

do $guard$
declare h1 text; h2 text; p jsonb;
begin
  select md5((content - 'attachments')::text), content->'procedure' into h1, p from public.sop_documents where sop_number = 'FSQM-021' and status = 'draft';
  select md5((content - 'attachments')::text) into h2 from public.sop_documents where sop_number = 'FRM-520' and status = 'draft';
  if h1 is distinct from 'ecd4223f471260bca67b402bc52fcdf2' then raise exception 'FSQM-021 is not the draft this migration was written against (md5 %).', h1; end if;
  if h2 is distinct from '84a9e96a8ba3cca0f1d68c39a8a3ca67' then raise exception 'FRM-520 is not the draft this migration was written against (md5 %).', h2; end if;
  if p->>19 <> 'Start-up, changeover and the label' or p->>20 not like '> Every rum cake is packed in the same box%'
     or p->>21 not like '%loads the coder message%' or p->>22 not like '%That first box is checked%' or p->>23 not like '%The check is made again%'
     or p->>24 not like '%Before the next product is packed%' or p->>25 not like '%No pre-printed label is issued by count%'
     or p->>26 not like '%goes into the printed box only if%' or p->>27 not like '%When the printed box or a coder message is replaced%' then
    raise exception 'FSQM-021 changeover Part is not in the order this migration expects.';
  end if;
end $guard$;

-- Lines 21-24, 26 and 27 are rewritten in place; then the film paragraph is inserted after line 20.
update public.sop_documents
   set content = jsonb_set(
                   jsonb_insert(
                     jsonb_set(jsonb_set(jsonb_set(jsonb_set(jsonb_set(jsonb_set(content,
                       '{procedure,21}', to_jsonb($t$• At the start of packing, and every time the product changes, the person packing loads the coder message for that product - and, where the product is wrapped in printed film, the roll for that variety - and makes one pack (SOP-603, SOP-604, SOP-605).$t$::text)),
                       '{procedure,22}', to_jsonb($t$• That first pack is checked against the Production Lot Record before packing carries on: the flavor or variety on the pack is the product being packed; on printed film, the film is the one for that variety, with its allergen statement; the lot code and best-by date are right; and any bar code scans. Production staff trained on the coder and the wrapper are authorized to approve it. The result and the name of the person who checked are written on FRM-520 (SQF 2.6.1.2, 2.8.1.9).$t$::text)),
                       '{procedure,23}', to_jsonb($t$• The check is made again whenever the coder is restarted or its message is edited, and whenever a new roll of film is loaded during the run.$t$::text)),
                       '{procedure,24}', to_jsonb($t$• Before the next product is packed, boxes already printed for the one before are taken off the packing table, the film of the variety before is taken off the wrapper and put back with its own kind, and any other packaging that belongs only to that product is removed (SQF 2.6.1.2).$t$::text)),
                       '{procedure,26}', to_jsonb($t$• A product goes into a printed box or a printed film only if the ingredients and allergens of its formula are the ones printed on it. That is checked on FRM-601 before a new or changed product is first packed, and the change is assessed first under FSQM-007 (SQF 2.8.1.9).$t$::text)),
                       '{procedure,27}', to_jsonb($t$• When a printed box, a printed film or a coder message is replaced, the old boxes or film are taken out of use, counted and disposed of under FSQM-037, and the old message is deleted from the coder. Both are noted on the FRM-601 for the new version (SQF 2.8.1.9).$t$::text)),
                     '{procedure,21}', to_jsonb($t$> Product wrapped in printed film - the biscotti - is different. Each variety has its own film, with its own ingredient list and allergen statement printed on it, and the coder adds only the lot code and the best-by date. There, putting the right label on the product means loading the right roll of film, and a wrong roll is a wrong allergen statement.$t$::text)),
                   '{revision_history}', to_jsonb((content->>'revision_history') || $t$

PRINTED FILM 2026-10-06 (owner). The two points listed to confirm are answered. (4) Every rum cake flavor's formula matches the one ingredient list printed on the box. (5) The only other product packed here is the biscotti, which is baked on site and flow-wrapped in printed film: each variety has its own film carrying everything but the lot code and best-by date, which the coder prints. The first pack is already looked at, unrecorded. The Part now covers printed film: the roll for the variety is part of the first-pack check, the check is repeated when a new roll is loaded, and the previous variety's film comes off the wrapper at changeover. Old packaging is 'disposed of under FSQM-037', not 'destroyed', because that program decides which printed packaging has to be defaced.$t$))
 where sop_number = 'FSQM-021' and status = 'draft';

update public.sop_documents
   set content = jsonb_set(jsonb_set(jsonb_set(content,
                   '{form_schema,sections,2,fields,5,help}', to_jsonb($t$Look at the first pack at the start, and again after every change of product or new roll of film: the flavor or variety (on printed film, that it is the film for this variety), the lot code, the best-by date, and that any bar code scans (FSQM-021).$t$::text)),
                   '{form_schema,sections,2,fields,6,label}', to_jsonb($t$First pack checked by$t$::text)),
                   '{form_schema,sections,2,fields,6,help}', to_jsonb($t$The name of the person who checked and approved the first pack.$t$::text))
 where sop_number = 'FRM-520' and status = 'draft';

do $verify$
declare c jsonb; f jsonb;
begin
  select content into c from public.sop_documents where sop_number = 'FSQM-021' and status = 'draft' and revision = 'New';
  if jsonb_array_length(c->'procedure') <> 40 then raise exception 'FSQM-021 should have 40 procedure lines.'; end if;
  if c->'procedure'->>20 not like '> Every rum cake is packed in the same box%' or c->'procedure'->>21 not like '> Product wrapped in printed film%'
     or c->'procedure'->>22 not like '%the roll for that variety%' or c->'procedure'->>23 not like '%That first pack is checked%'
     or c->'procedure'->>26 not like '%No pre-printed label is issued by count%' or c->'procedure'->>28 not like '%disposed of under FSQM-037%'
     or c->'procedure'->>30 <> 'Tracing' then
    raise exception 'FSQM-021 lines are not where they should be.';
  end if;
  if c::text ~* '(Diana|Gabriela|Richard|Mercer|Botta)' then raise exception 'a controlled document names positions and products, not people or customers.'; end if;
  select content->'form_schema'->'sections'->2->'fields' into f from public.sop_documents where sop_number = 'FRM-520' and status = 'draft';
  if f->5->>'id' <> 'code_check' or f->5->>'help' not like 'Look at the first pack%' or f->6->>'id' <> 'code_checked_by' or f->6->>'label' <> 'First pack checked by' then
    raise exception 'FRM-520 packing fields were not updated as intended.';
  end if;
end $verify$;

commit;
