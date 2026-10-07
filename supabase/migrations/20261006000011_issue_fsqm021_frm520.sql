-- ISSUE: FSQM-021 Product Identification and Traceability Program and FRM-520 Production Lot Record.
-- Approved GJM, effective 2026-10-06. First issue, so both keep revision "New".
--
-- This closes the writing for D-20 (SQF 2.6.1.1, 2.6.2.1, 2.8.1.8) and for the part of D-17 that was
-- open (2.6.1.2 start-up and changeover, 2.8.1.9 label accuracy), which was written into these two
-- documents on 2026-10-06 (migrations 20261006000008 to 20261006000010).
--
-- What the draft listed to confirm, as answered by the owner on 2026-10-06:
--   (1) a rack card with product and lot code is used on cooling racks - as written;
--   (2) syrup made ahead is kept in a labelled container - ONE LINE ADDED saying so, under
--       "Identification at every stage" (work in progress has to be identified, 2.6.1.1 i);
--   (3) the coder is set to the bake day's code when wrapping runs over - as written;
--   (4) every rum cake flavor matches the ingredient list printed on the box;
--   (5) the biscotti is wrapped in film printed per variety - written in by 20261006000010.
--
-- NOT changed here: the 'traceability_test' row of the verification schedule stays PLANNED. Its
-- record (FRM-012) belongs to the recall program, which is still a draft; a planned row is
-- activated when its program is issued, not before.
--
-- FRM-520 has one entry made while it was a draft (a draft lot record); it is not touched. The two
-- test entries for lot 6273 were removed on the owner's instruction before issue.
-- Guarded on each md5 as verified after 20261006000010. ONE UPDATE per document.

begin;

do $guard$
declare h1 text; h2 text;
begin
  select md5((content - 'attachments')::text) into h1 from public.sop_documents where sop_number = 'FSQM-021' and status = 'draft';
  select md5((content - 'attachments')::text) into h2 from public.sop_documents where sop_number = 'FRM-520' and status = 'draft';
  if h1 is distinct from 'e929fbcbb7fbd2ecfe3fffaf83e5e21d' then raise exception 'FSQM-021 is not the draft that was approved (md5 %).', h1; end if;
  if h2 is distinct from 'f72e529410fa0a4d1814801bc3ebeab1' then raise exception 'FRM-520 is not the draft that was approved (md5 %).', h2; end if;
  if (select content->'procedure'->>4 from public.sop_documents where sop_number = 'FSQM-021' and status = 'draft') not like '%Baked product cooling on racks%' then
    raise exception 'FSQM-021 line 4 is not the rack card line.';
  end if;
  if exists (select 1 from public.sop_documents where sop_number in ('FSQM-021','FRM-520') and status = 'active') then
    raise exception 'an active FSQM-021 or FRM-520 already exists.';
  end if;
end $guard$;

update public.sop_documents
   set content = jsonb_set(
                   jsonb_insert(content, '{procedure,4}', to_jsonb($t$• Syrup made ahead of the day it is used is kept in a container labelled with what it is and the date it was made (SQF 2.6.1.1 i).$t$::text)),
                   '{revision_history}', to_jsonb((content->>'revision_history') || $t$

ISSUED 2026-10-06, with FRM-520. What the draft listed to confirm (owner, 2026-10-06): (1) RACK CARD - a card with the product and lot code is used on racks of cooling product, as written. (2) SYRUP - syrup made ahead is kept in a labelled container; a line saying so is added under Identification at every stage. (3) CODER - when wrapping runs into the next day the coder is set to the bake day's code, as written. (4) and (5) were answered the same day and are recorded above. The record of the annual trace test arrives with the recall and withdrawal program, so the 'traceability test' row on the verification schedule stays planned until that program is issued.$t$)),
       status = 'active', approved_by = 'GJM', effective_date = date '2026-10-06'
 where sop_number = 'FSQM-021' and status = 'draft';

update public.sop_documents
   set status = 'active', approved_by = 'GJM', effective_date = date '2026-10-06'
 where sop_number = 'FRM-520' and status = 'draft';

do $verify$
declare c jsonb; n int;
begin
  select count(*) into n from public.sop_documents
   where sop_number in ('FSQM-021','FRM-520') and status = 'active' and revision = 'New'
     and approved_by = 'GJM' and effective_date = date '2026-10-06';
  if n <> 2 then raise exception 'expected FSQM-021 and FRM-520 active and stamped, found %.', n; end if;
  if exists (select 1 from public.sop_documents where sop_number in ('FSQM-021','FRM-520') and status = 'draft') then
    raise exception 'a draft copy is left behind.';
  end if;
  select content into c from public.sop_documents where sop_number = 'FSQM-021' and status = 'active';
  if jsonb_array_length(c->'procedure') <> 41 then raise exception 'FSQM-021 should have 41 procedure lines.'; end if;
  if c->'procedure'->>3 not like '%Production: ingredients are weighed%' or c->'procedure'->>4 not like '%Syrup made ahead%'
     or c->'procedure'->>5 not like '%Baked product cooling on racks%' or c->'procedure'->>31 <> 'Tracing' then
    raise exception 'FSQM-021 lines are not where they should be.';
  end if;
  if c->>'revision_history' not like '%ISSUED 2026-10-06, with FRM-520%' then raise exception 'the issue note is missing.'; end if;
  if c::text ~* '(Diana|Gabriela|Richard|Mercer|Botta)' then raise exception 'a controlled document names positions and products, not people or customers.'; end if;
  if (select md5((content - 'attachments')::text) from public.sop_documents where sop_number = 'FRM-520' and status = 'active') <> 'f72e529410fa0a4d1814801bc3ebeab1' then
    raise exception 'FRM-520 content must not change at issue.';
  end if;
  if (select status from public.verification_schedule where activity_key = 'traceability_test') <> 'planned' then
    raise exception 'the traceability test row must stay planned.';
  end if;
end $verify$;

commit;
