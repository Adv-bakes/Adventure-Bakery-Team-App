-- FSQM-011 Regulatory Awareness and Notification Program, New -> v2: the alcohol question is answered.
-- Approved GJM, effective 2026-10-06.
--
-- At issue (20261005000015) the program said the site holds no alcohol permit and that whether one
-- is needed was being confirmed. The owner obtained the answer on 2026-10-06: none is needed. Rum
-- used only as a food ingredient is outside Florida's Beverage Law - the Division of Alcoholic
-- Beverages and Tobacco said so in Declaratory Statement DBPR 2013-114 (2014).
--
-- Until now the alcohol note lived only in the revision history, so the procedure itself was silent
-- on it. This revision:
--   - inserts ONE paragraph under "Registrations and permits" (after the local business licence
--     line) stating that no alcoholic beverage licence is held or needed, why, and that a change in
--     how rum is used is assessed under FSQM-007;
--   - appends a v2 entry to the revision history. The entry written at issue is left as it was.
-- Nothing else changes: no new source, no new form, the same SQF references.
--
-- ONE UPDATE, so the history table gets one snapshot of the program as issued.
-- Guarded on the md5 of the content as it stands in production (read 2026-10-06).

begin;

do $guard$
declare h text; rev text;
begin
  select md5(content::text), revision into h, rev from public.sop_documents
   where sop_number = 'FSQM-011' and status = 'active';
  if rev is distinct from 'New' or h <> '9546b6f3e1a2169070ec26b912bcfe82' then
    raise exception 'FSQM-011 is % or changed (md5 %).', rev, h;
  end if;
  if (select content->'procedure'->>19 from public.sop_documents where sop_number = 'FSQM-011' and status = 'active')
       <> 'Telling SQFI and the certification body' then
    raise exception 'FSQM-011 procedure is not in the order this migration expects.';
  end if;
end $guard$;

update public.sop_documents
   set content = jsonb_set(
                   jsonb_insert(content, '{procedure,19}', to_jsonb($t$> No alcoholic beverage licence is held, and none is needed. The rum is used only as an ingredient, and the Florida Division of Alcoholic Beverages and Tobacco does not regulate alcohol used as a flavoring or ingredient in commercial food production (Declaratory Statement DBPR 2013-114). The rum cake is registered with the federal Alcohol and Tobacco Tax and Trade Bureau (TTB) as a food product. If rum is ever to be used or sold for anything but baking, that is a change and is assessed first (FSQM-007).$t$::text)),
                   '{revision_history}', to_jsonb($t$New - 2026-10-05 - DRAFT under D-12, for the Minor findings against 2.4.1.2, 2.4.1.3 and 2.6.3.4. The site had no regular source of news about food law and no written 24-hour notice for a regulatory warning.

NO NEW FORM. The monthly update (FRM-009) already has a row for changes affecting the SQF System, and that is where the month's news is reported, including a month with none. A regulatory warning is rare and already needs a corrective action, so the notice is attached to that FRM-007. The 24-hour notice in a recall (2.6.3.4) is already written in FSQM-023 and is only pointed to here.

ALCOHOL: the site holds no federal or state alcohol permit. The rum is supplied by the customer. Whether a permit is needed to hold it and bake with it is being confirmed; if one is, this program is revised and the alcohol regulator is added as a source.

ISSUED 2026-10-05. FRM-009 goes to v2 in the same change: its row "Changes affecting the SQF System" now names changes in food law, guidance and codes of practice, since that row is where the month's news is reported. What the draft listed to confirm: (1) SOURCES. The FDA and SQFI subscriptions were set up on 2026-10-05, and the FDACS food permit carries a current email address, which is where FDACS sends its notices. The subscriptions go to one address for now and a dedicated address is being set up; the procedure therefore names an address chosen by Senior Site Management, not a position's own mailbox. (2) ALCOHOL - see above. (3) RENEWALS. The FDACS permit and the local licence are each renewed before the date printed on them; the procedure says that and no longer says "every year". (4) CERTIFICATION BODY. None is contracted yet. Its own rule on what it must be told is added when one is.

v2 - 2026-10-06 - ALCOHOL CONFIRMED. The point left open at issue is answered: no Florida alcoholic beverage licence or permit is needed to store rum or to bake with it, because it is used only as a food ingredient. The basis is the Florida Division of Alcoholic Beverages and Tobacco's Declaratory Statement DBPR 2013-114 (2014), in which the Division declines to regulate alcohol used as a flavoring additive or ingredient in commercial food production. The rum cake is registered with the federal Alcohol and Tobacco Tax and Trade Bureau as a food product. One paragraph is added under Registrations and permits to say so; nothing else in the procedure changes, and no alcohol regulator is added as a source. A copy of the declaratory statement is kept with this program.$t$::text)),
       revision = 'v2', effective_date = date '2026-10-06', approved_by = 'GJM'
 where sop_number = 'FSQM-011' and status = 'active' and revision = 'New';

do $verify$
declare c jsonb; txt text;
begin
  select content into c from public.sop_documents
   where sop_number = 'FSQM-011' and status = 'active' and revision = 'v2'
     and approved_by = 'GJM' and effective_date = date '2026-10-06';
  if c is null then raise exception 'FSQM-011 was not stamped v2.'; end if;
  if jsonb_array_length(c->'procedure') <> 30 then
    raise exception 'FSQM-011 should have 30 procedure lines, has %.', jsonb_array_length(c->'procedure');
  end if;
  if c->'procedure'->>18 not like '%local business licence%'
     or c->'procedure'->>19 not like '> No alcoholic beverage licence is held%'
     or c->'procedure'->>20 <> 'Telling SQFI and the certification body' then
    raise exception 'the new paragraph is not where it should be.';
  end if;
  if c->>'revision_history' not like 'New - 2026-10-05%' or c->>'revision_history' not like '%v2 - 2026-10-06 - ALCOHOL CONFIRMED%' then
    raise exception 'the revision history was not extended.';
  end if;
  txt := c::text;
  if txt ~* '(Steven|Pickett|Gabriela|Richard|Mercer)' then
    raise exception 'a controlled document names positions, not people.';
  end if;
  if (select count(*) from public.sop_document_history h join public.sop_documents d on d.id = h.document_id
       where d.sop_number = 'FSQM-011' and h.revision = 'New') <> 1 then
    raise exception 'expected exactly one history snapshot of FSQM-011 as issued.';
  end if;
end $verify$;

commit;
