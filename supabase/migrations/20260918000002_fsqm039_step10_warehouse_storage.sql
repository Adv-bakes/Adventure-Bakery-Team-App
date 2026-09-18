-- FSQM-039: add step 10, packaged product out to warehouse storage.
--
-- The owner added the step to Sheet 3 while exporting it: after packaging, labelling, lot coding
-- and bulk packaging, product leaves the high-care area eastward into Unit 425 to warehouse
-- storage. The route now ends at storage rather than at the lot code, so the three places the
-- text states where the route ends are brought into line:
--   scope          "to the application of the lot code and bulk packaging"
--   definitions    Sheet 3
--   procedure[2]   what Sheet 3 carries
-- and the 2026-09-18 note in revision_history records it.
--
-- Still draft, still Rev New - an edit to an unissued draft, as 20260918000001 was.
-- Attachments are not touched; Sheet 3 is re-exported and replaced through the app.

begin;

do $guard$
declare c jsonb;
begin
  select content into c from public.sop_documents
   where sop_number = 'FSQM-039' and status = 'draft' and revision = 'New';
  if c is null then raise exception 'FSQM-039 is not the unissued draft.'; end if;
  if jsonb_array_length(c->'procedure') <> 30 then
    raise exception 'FSQM-039 is not the three-day text from 20260918000001.';
  end if;
  if c->>'scope' not like '%to the application of the lot code and bulk packaging.%'
     or c->>'definitions' not like '%lot coding and bulk packaging. The dunk station%'
     or c->'procedure'->>2 not like '%Sheet 3 carries steps 8 and 9, the sealed product hold and the lot code printer.%'
     or c->>'revision_history' not like '%inside HIGH CARE on Day 2; it does not.%' then
    raise exception 'FSQM-039 no longer carries the exact strings this edit replaces.';
  end if;
  if c::text like '%warehouse storage%' then
    raise exception 'FSQM-039 already mentions warehouse storage.';
  end if;
end $guard$;

update public.sop_documents
   set content = jsonb_set(
         content || jsonb_build_object(
           'scope', replace(content->>'scope',
             'to the application of the lot code and bulk packaging.',
             'to its transfer, packaged and coded, to warehouse storage.'),
           'definitions', replace(content->>'definitions',
             'lot coding and bulk packaging. The dunk station',
             'lot coding, bulk packaging and transfer to warehouse storage. The dunk station'),
           'revision_history', replace(content->>'revision_history',
             'inside HIGH CARE on Day 2; it does not.',
             'inside HIGH CARE on Day 2; it does not. Step 10, packaged product out of the high-care area to warehouse storage, was added to Sheet 3 the same day, so the route now ends at storage rather than at the lot code.')),
         '{procedure,2}',
         to_jsonb(replace(content->'procedure'->>2,
           'Sheet 3 carries steps 8 and 9, the sealed product hold and the lot code printer.',
           'Sheet 3 carries steps 8 to 10, the sealed product hold, the lot code printer and the route out to warehouse storage.')))
 where sop_number = 'FSQM-039';

do $verify$
declare c jsonb;
begin
  select content into c from public.sop_documents where sop_number = 'FSQM-039';
  if jsonb_array_length(c->'procedure') <> 30 then
    raise exception 'procedure length changed.';
  end if;
  if c->>'scope' not like '%to warehouse storage.%'
     or c->>'definitions' not like '%transfer to warehouse storage%'
     or c->'procedure'->>2 not like '%steps 8 to 10%'
     or c->>'revision_history' not like '%Step 10, packaged product%' then
    raise exception 'step 10 did not land in all four places.';
  end if;
  if c::text like '%steps 8 and 9%' or c::text like '%application of the lot code and bulk%' then
    raise exception 'a stale end-of-route statement survived.';
  end if;
  if jsonb_array_length(c->'attachments') <> 4
     or c->>'governing_reference' not like '%WHAT IT IS NOT%' then
    raise exception 'attachments or governing_reference were disturbed.';
  end if;
  raise notice 'FSQM-039: step 10 (warehouse storage) recorded.';
end $verify$;

commit;
