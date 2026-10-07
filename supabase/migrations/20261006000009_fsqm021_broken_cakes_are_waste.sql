-- FSQM-021 and FRM-520 (both still DRAFTS): a cake that breaks at depanning is waste, not held product.
--
-- The owner (2026-10-06): it is not uncommon for a cake to break into two or more pieces when it is
-- turned out of the pan. The pieces are set aside and counted as waste. The SQF Practitioner added
-- two more: a cake plainly too big or too small after baking, and a cake oversoaked at dunking. The draft's line "Held,
-- retained and rejected product is identified by its FRM-702 hold tag or FRM-703 retention entry"
-- read as though each of those had to be tagged, which is too common an event for that to be done
-- and was not what the line was for. A control heavier than the clause is a rule waiting to be
-- ignored.
--
--   - FSQM-021 procedure line 6 now covers held product and retention samples only.
--   - A new line 7 says these ordinary losses are set aside, counted, included in "not packed" on
--     FRM-520; the retention sample may be taken from them (never an oversoaked one) or from good
--     product, and the rest leave as food waste under FSQM-037 - no tag.
--   - The reconciliation line (added by 20261006000008) names breakage among the units not packed.
--   - FRM-520's "Not packed" help line names it first.
-- The count still accounts for every cake, which is what 2.6.1.2 asks.
--
-- ONE UPDATE per document. Guarded on each md5 as verified after 20261006000008.

begin;

do $guard$
declare h1 text; h2 text;
begin
  select md5((content - 'attachments')::text) into h1 from public.sop_documents where sop_number = 'FSQM-021' and status = 'draft';
  select md5((content - 'attachments')::text) into h2 from public.sop_documents where sop_number = 'FRM-520' and status = 'draft';
  if h1 is distinct from '6ee9bde3c319e49a0d2a684fcb8b3bd4' then raise exception 'FSQM-021 is not the draft this migration was written against (md5 %).', h1; end if;
  if h2 is distinct from 'ac50a1eb15750e25e68b3f4af4a211ca' then raise exception 'FRM-520 is not the draft this migration was written against (md5 %).', h2; end if;
  if (select content->'procedure'->>6 from public.sop_documents where sop_number = 'FSQM-021' and status = 'draft') <> $t$• Held, retained and rejected product is identified by its FRM-702 hold tag or FRM-703 retention entry, each carrying the lot code.$t$ then
    raise exception 'FSQM-021 line 6 is not the line this migration replaces.';
  end if;
  if (select content->'procedure'->>24 from public.sop_documents where sop_number = 'FSQM-021' and status = 'draft') not like '%No pre-printed label is issued by count%' then
    raise exception 'FSQM-021 line 24 is not the reconciliation line.';
  end if;
  if (select content->'form_schema'->'sections'->2->'fields'->3->>'id' from public.sop_documents where sop_number = 'FRM-520' and status = 'draft') <> 'not_packed' then
    raise exception 'FRM-520 packing field 3 is not not_packed.';
  end if;
end $guard$;

-- Line 24 is rewritten first, by its present index; then line 6 is replaced and line 7 inserted after it.
update public.sop_documents
   set content = jsonb_set(
                   jsonb_insert(
                     jsonb_set(
                       jsonb_set(content, '{procedure,24}', to_jsonb($t$• No pre-printed label is issued by count, so what is reconciled is the product. The cakes are counted when they go on the baking rack. At the end of packing that count is compared with the units packed plus the units not packed - broken at depanning, the wrong size, oversoaked, otherwise rejected or damaged, or kept as the retention sample - and all three figures are written on FRM-520. A difference that cannot be explained is settled before the lot is released, and raised on FRM-007 if it cannot be (SQF 2.6.1.2).$t$::text)),
                       '{procedure,6}', to_jsonb($t$• Product put on hold is identified by its FRM-702 hold tag, and a retention sample by its FRM-703 entry, each carrying the lot code.$t$::text)),
                     '{procedure,7}', to_jsonb($t$• A cake is taken out of the run, without a tag, when it breaks at depanning, is plainly too big or too small after baking, or is oversoaked in the syrup. These are ordinary losses in production, not held product. Each is set aside from good product, counted, and included in the units not packed on FRM-520. The lot's retention sample may be taken from them - a cake that is too big or too small will do, an oversoaked one will not - or from good product. Whichever it is, the sample is soaked and sealed like the rest of the lot and logged on FRM-703. Cakes not kept as a sample leave as food waste under FSQM-037. The hold tag is for product whose safety or quality is in question, not for these.$t$::text)),
                   '{revision_history}', to_jsonb((content->>'revision_history') || $t$

ORDINARY LOSSES 2026-10-06 (owner and SQF Practitioner): a cake often breaks into pieces at depanning; a cake that is plainly too big or too small after baking is removed; and a cake oversoaked at dunking is removed. They are set aside and counted as waste; tagging each one on FRM-702 is not reasonable and was never the intent. The retention sample MAY be one of them (an off-size cake, never an oversoaked one) or a good cake - it is a choice, not a rule - and is soaked and sealed like the rest of the lot either way; cakes not kept leave as food waste. The line that said rejected product is identified by a hold tag now covers held product and retention samples only, and a new line says these ordinary losses is counted as not packed on FRM-520 and leaves as food waste. FRM-520's 'Not packed' help line names them.$t$))
 where sop_number = 'FSQM-021' and status = 'draft';

update public.sop_documents
   set content = jsonb_set(content, '{form_schema,sections,2,fields,3,help}', to_jsonb($t$Broken at depanning, too big or too small, oversoaked, otherwise rejected or damaged, or kept as the retention sample. Write 0 if none.$t$::text))
 where sop_number = 'FRM-520' and status = 'draft';

do $verify$
declare c jsonb;
begin
  select content into c from public.sop_documents where sop_number = 'FSQM-021' and status = 'draft' and revision = 'New';
  if jsonb_array_length(c->'procedure') <> 39 then raise exception 'FSQM-021 should have 39 procedure lines.'; end if;
  if c->'procedure'->>6 not like '%Product put on hold is identified%' or c->'procedure'->>7 not like '%breaks at depanning%'
     or c->'procedure'->>8 <> 'The lot code' or c->'procedure'->>19 <> 'Start-up, changeover and the label'
     or c->'procedure'->>7 not like '%oversoaked in the syrup%' or c->'procedure'->>25 not like '%broken at depanning, the wrong size, oversoaked%' or c->'procedure'->>29 <> 'Tracing' then
    raise exception 'FSQM-021 lines are not where they should be.';
  end if;
  if c::text like '%Held, retained and rejected product is identified%' then raise exception 'the old line is still there.'; end if;
  if (select content->'form_schema'->'sections'->2->'fields'->3->>'help' from public.sop_documents where sop_number = 'FRM-520' and status = 'draft')
       not like 'Broken at depanning%' then
    raise exception 'FRM-520 help line was not updated.';
  end if;
end $verify$;

commit;
