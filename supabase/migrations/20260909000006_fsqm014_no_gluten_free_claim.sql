-- FSQM-014: settle the Gluten Free open item. The site makes no such claim.
--
-- WHAT CHANGED AND WHY. This document was seeded on 2026-09-09 carrying an OPEN BEFORE ISSUE
-- item that read "THE GLUTEN FREE CLAIM IS NOT VERIFIED BY ANY TEST" - the site being GFCO
-- certified, selling product with a Gluten Free claim, and performing no analysis that could
-- verify it. The owner checked with the Managing Partner the same day: Adventure Bakery makes
-- NO product carrying a Gluten Free claim, has never made one, and does not hold a current GFCO
-- certification. So the item was not an unanswered question; its premise was false.
--
-- The blocker therefore does not close, it DISSOLVES, and the difference matters for the audit
-- trail: nothing was verified, tested or fixed. A fact the document assumed turned out not to be
-- a fact. That is recorded here rather than quietly deleted, because the same wrong assumption
-- is why two ACTIVE documents (FSQM-018 and FSQM-020) describe a certification the site does not
-- hold - corrected by the sibling migrations 20260909000007 and 000008.
--
-- Part 2's forward-looking line loses its example rather than its rule. "If any analysis is ever
-- introduced, name the method, then the accredited laboratory, then send the sample" stands on
-- its own; naming a gluten result as the likely first test does not, and would have re-seeded the
-- same false premise into the issued document.
--
-- This document is still DRAFT, so there is no revision to bump and nothing to re-approve.

begin;

do $$
declare r record;
begin
  select status, revision,
         (content #>> '{procedure,5}') like '%a gluten result for certified Gluten Free product being the likely first%' as part2_example,
         (content->>'revision_history') like '%THE GLUTEN FREE CLAIM IS NOT VERIFIED BY ANY TEST%'                       as open_item,
         (content->>'revision_history') like '%OPEN BEFORE ISSUE — four things the site must settle. The second is the one that matters:%' as heading,
         (content->>'revision_history') like '%3. Retention samples:%'                                                    as item3,
         (content->>'revision_history') like '%4. The consultant scored 2.4.4.5 Minor%'                                   as item4,
         jsonb_array_length(content->'procedure')                                                                         as lines
    into r
    from public.sop_documents where sop_number = 'FSQM-014';

  if r.status is distinct from 'draft' or r.revision is distinct from 'New' then
    raise exception 'FSQM-014 is %/% , expected draft/New. An issued document is not amended this way.',
      r.status, r.revision;
  end if;
  if not (r.part2_example and r.open_item and r.heading and r.item3 and r.item4) then
    raise exception 'FSQM-014 is not the text this migration edits (part2=%, open=%, heading=%, i3=%, i4=%).',
      r.part2_example, r.open_item, r.heading, r.item3, r.item4;
  end if;
  if r.lines <> 29 then
    raise exception 'FSQM-014 procedure is % lines, expected 29.', r.lines;
  end if;
end $$;

create temporary table fsqm014_before on commit drop as
select md5((content - 'procedure' - 'revision_history')::text) as rest_h
  from public.sop_documents where sop_number = 'FSQM-014';

update public.sop_documents
   set content = jsonb_set(
         jsonb_set(content, '{procedure,5}', to_jsonb($p5$> What must happen before this changes: if any analysis is ever introduced, the method shall be named in this program, and any external laboratory shall be accredited to ISO/IEC 17025 or an equivalent international standard and listed on the contract services register before the first sample is sent to it. The method comes first, then the laboratory, then the sample.$p5$::text)),
         '{revision_history}',
         to_jsonb(
           replace(
             regexp_replace(
               replace(content->>'revision_history',
                 'OPEN BEFORE ISSUE — four things the site must settle. The second is the one that matters:',
                 $settled$NO GLUTEN FREE CLAIM — SETTLED 2026-09-09, AND ITS PREMISE WAS FALSE. This document was drafted carrying an open item that read "the Gluten Free claim is not verified by any test", on the understanding that the site was GFCO certified and sold product bearing that claim. The Managing Partner confirmed the same day that Adventure Bakery makes no product carrying a Gluten Free claim, has never made one, and holds no current GFCO certification. The item therefore does not close on evidence; it dissolves, because the thing it was about does not exist. Part 2's rule for introducing analysis stands unchanged — name the method, then an ISO/IEC 17025-accredited laboratory, then send the sample — and only its gluten example is gone, since repeating it would carry the same false premise into an issued document.

That assumption came from somewhere, and it is not confined to this document: FSQM-018 and FSQM-020 were both issued describing certified Gluten Free product and a current GFCO certification agreement, and are corrected by 20260909000008 and 20260909000007. The likeliest source is the Compass Blending hardcopies these documents were scanned from — the import rebrands the company name across every parsed string, but cannot know that the content itself belongs to a different business.

OPEN BEFORE ISSUE — three things the site must settle:$settled$),
               '2\. THE GLUTEN FREE CLAIM[\s\S]*?3\. Retention samples:',
               '2. Retention samples:'),
             '4. The consultant scored 2.4.4.5 Minor',
             '3. The consultant scored 2.4.4.5 Minor')
         )::jsonb)
 where sop_number = 'FSQM-014' and status = 'draft';

do $$
declare
  r record;
  drift int;
begin
  select jsonb_array_length(content->'procedure')                                        as lines,
         (content #>> '{procedure,5}') like '%gluten%'                                   as part2_gluten,
         (content #>> '{procedure,5}') like '%accredited to ISO/IEC 17025%'              as part2_rule,
         (content->>'revision_history') like '%THE GLUTEN FREE CLAIM IS NOT VERIFIED%'   as stale_item,
         (content->>'revision_history') like '%NO GLUTEN FREE CLAIM — SETTLED 2026-09-09%' as settled,
         (content->>'revision_history') like '%OPEN BEFORE ISSUE — three things the site must settle:%' as heading,
         (content->>'revision_history') like '%2. Retention samples:%'                   as item2,
         (content->>'revision_history') like '%3. The consultant scored 2.4.4.5 Minor%'  as item3,
         (content->>'revision_history') like '%4. %'                                     as leftover4,
         status, revision
    into r
    from public.sop_documents where sop_number = 'FSQM-014';

  if r.lines <> 29 then
    raise exception 'Procedure length changed to %.', r.lines;
  end if;
  if r.part2_gluten or not r.part2_rule then
    raise exception 'Part 2 wrong: still mentions gluten=%, keeps the ISO rule=%.', r.part2_gluten, r.part2_rule;
  end if;
  if r.stale_item or not (r.settled and r.heading and r.item2 and r.item3) then
    raise exception 'Revision history wrong: stale=%, settled=%, heading=%, i2=%, i3=%.',
      r.stale_item, r.settled, r.heading, r.item2, r.item3;
  end if;
  if r.leftover4 then
    raise exception 'A fourth numbered open item still remains; the renumber did not complete.';
  end if;
  if r.status is distinct from 'draft' or r.revision is distinct from 'New' then
    raise exception 'FSQM-014 status/revision moved during the amendment (%/%).', r.status, r.revision;
  end if;

  select count(*) into drift
    from public.sop_documents d, fsqm014_before b
   where d.sop_number = 'FSQM-014'
     and md5((d.content - 'procedure' - 'revision_history')::text) is distinct from b.rest_h;
  if drift <> 0 then
    raise exception 'FSQM-014 changed outside procedure and revision_history. Rolled back.';
  end if;
end $$;

commit;
