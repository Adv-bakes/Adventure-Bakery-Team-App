-- D-12: issue FSQM-011 Regulatory Awareness and Notification Program. Approved GJM, effective 2026-10-05,
-- revision New (first issue). FRM-009 Monthly SQF Update Record New -> v2.
--
-- Three Minor findings: 2.4.1.2, 2.4.1.3, 2.6.3.4.
--
-- Changed from the draft, on what the owner confirmed on 2026-10-05:
--   - WHO RECEIVES THE SOURCES. The draft said the SQF Practitioner is signed up. The subscriptions go
--     to one address for now and a dedicated address is being set up, so the procedure names an
--     address chosen by Senior Site Management, with anything relevant passed to the SQF Practitioner
--     the same day. No address is written into the document.
--   - RENEWALS. "Renewed every year" was not confirmed for the FDACS permit or the local licence, so
--     both now read "renewed before the date printed on it", which is true whatever the period.
--   - ALCOHOL. The site holds no alcohol permit; whether one is needed is being confirmed. The note
--     no longer says that is settled.
--   - CERTIFICATION BODY. None is contracted; its own notice rule is added when one is.
--
-- FRM-009: the fixed row "Changes affecting the SQF System" gains "changes in food law, guidance or
-- codes of practice (FSQM-011)". A fixed row label only - answers are keyed by row position. Done in
-- ONE UPDATE together with the revision, so the history gets exactly one snapshot of FRM-009.
--
-- Guarded on the md5 of each document's content as it stands in production (read 2026-10-05).

begin;

do $guard$
declare h text; st text; rev text;
begin
  select md5(content::text), status into h, st from public.sop_documents where sop_number = 'FSQM-011';
  if st is distinct from 'draft' or h <> '96fe7d166a1c3f8e864849545ab34c29' then raise exception 'FSQM-011 is % or changed since review (md5 %).', st, h; end if;
  select md5(content::text), revision into h, rev from public.sop_documents where sop_number = 'FRM-009' and status = 'active';
  if rev is distinct from 'New' or h <> '9f55aa1af001540906750229cba02473' then raise exception 'FRM-009 is % or changed (md5 %).', rev, h; end if;
end $guard$;

update public.sop_documents
   set content = jsonb_set(jsonb_set(jsonb_set(jsonb_set(jsonb_set(content,
                   '{procedure,1}', to_jsonb($t$• The site is signed up to these sources, by email where one is offered. The emails go to an address Senior Site Management has named for this, and whoever receives them passes anything that could affect the site to the SQF Practitioner the same day:$t$::text)),
                   '{procedure,17}', to_jsonb($t$◦ FDACS food permit - renewed before the date printed on it;$t$::text)),
                   '{procedure,18}', to_jsonb($t$◦ local business licence - renewed before the date printed on it.$t$::text)),
                   '{responsibility}', to_jsonb($t$SQF Practitioner - reads what the sources send or what is passed on from them, acts on what affects the site, and reports each month. The substitute SQF Practitioner covers when the SQF Practitioner is away.
Senior Site Management - names the address the sources send to, keeps the registrations and permits current, and sees that SQFI and the certification body are told within 24 hours.$t$::text)),
                   '{revision_history}', to_jsonb($t$New - 2026-10-05 - DRAFT under D-12, for the Minor findings against 2.4.1.2, 2.4.1.3 and 2.6.3.4. The site had no regular source of news about food law and no written 24-hour notice for a regulatory warning.

NO NEW FORM. The monthly update (FRM-009) already has a row for changes affecting the SQF System, and that is where the month's news is reported, including a month with none. A regulatory warning is rare and already needs a corrective action, so the notice is attached to that FRM-007. The 24-hour notice in a recall (2.6.3.4) is already written in FSQM-023 and is only pointed to here.

ALCOHOL: the site holds no federal or state alcohol permit. The rum is supplied by the customer. Whether a permit is needed to hold it and bake with it is being confirmed; if one is, this program is revised and the alcohol regulator is added as a source.

ISSUED 2026-10-05. FRM-009 goes to v2 in the same change: its row "Changes affecting the SQF System" now names changes in food law, guidance and codes of practice, since that row is where the month's news is reported. What the draft listed to confirm: (1) SOURCES. The FDA and SQFI subscriptions were set up on 2026-10-05, and the FDACS food permit carries a current email address, which is where FDACS sends its notices. The subscriptions go to one address for now and a dedicated address is being set up; the procedure therefore names an address chosen by Senior Site Management, not a position's own mailbox. (2) ALCOHOL - see above. (3) RENEWALS. The FDACS permit and the local licence are each renewed before the date printed on them; the procedure says that and no longer says "every year". (4) CERTIFICATION BODY. None is contracted yet. Its own rule on what it must be told is added when one is.$t$::text)),
       status = 'active', approved_by = 'GJM', effective_date = date '2026-10-05'
 where sop_number = 'FSQM-011' and status = 'draft';

update public.sop_documents
   set content = jsonb_set(content, '{form_schema,sections,1,fields,1,rows,labels,4}', to_jsonb($t$Changes affecting the SQF System
Process, product, equipment, facility or personnel - and changes in food law, guidance or codes of practice (FSQM-011).$t$::text)),
       revision = 'v2', effective_date = date '2026-10-05', approved_by = 'GJM'
 where sop_number = 'FRM-009' and status = 'active' and revision = 'New';

do $verify$
declare n int; p jsonb; txt text; fs jsonb;
begin
  select count(*) into n from public.sop_documents
   where (sop_number, status, revision, approved_by, effective_date) in (
     ('FSQM-011', 'active', 'New', 'GJM', date '2026-10-05'), ('FRM-009', 'active', 'v2', 'GJM', date '2026-10-05'));
  if n <> 2 then raise exception 'FSQM-011 / FRM-009 were not both stamped (% of 2).', n; end if;

  select content->'procedure', content::text into p, txt from public.sop_documents where sop_number = 'FSQM-011';
  if jsonb_array_length(p) <> 29 then raise exception 'FSQM-011 procedure length changed.'; end if;
  if p->>1 not like '%address Senior Site Management has named%' or p::text like '%The SQF Practitioner is signed up%'
     or p::text like '%renewed every year%' then
    raise exception 'FSQM-011 sources or renewal lines not updated.';
  end if;
  if (select count(*) from unnest(array['2.4.1.2)', '2.4.1.3)', '2.6.3.4)']) c where p::text like '%' || c || '%') <> 3
     or p::text not like '%foodsafetycrisis@sqfi.com%' then
    raise exception 'FSQM-011 lost a clause citation or the SQFI address.';
  end if;
  if txt like '%TO CONFIRM BEFORE ISSUE%' or txt like '%AT ISSUE:%' or txt not like '%ISSUED 2026-10-05%'
     or txt like '%No alcohol regulator is listed as a source for that reason%' then
    raise exception 'FSQM-011 still carries the draft''s open items, or has no issue stamp.';
  end if;
  if txt ~* 'Diana|Gabriela|Christina|GJM|Mercer|Richard|gmail' then raise exception 'FSQM-011 names a person or a personal address.'; end if;

  select content->'form_schema' into fs from public.sop_documents where sop_number = 'FRM-009' and status = 'active';
  if jsonb_array_length(fs->'sections'->1->'fields'->1->'rows'->'labels') <> 6
     or fs->'sections'->1->'fields'->1->'rows'->'labels'->>4 not like 'Changes affecting the SQF System%codes of practice (FSQM-011).'
     or fs->'sections'->1->'fields'->1->'rows'->'labels'->>3 not like 'Audit and inspection findings%' then
    raise exception 'FRM-009 row not updated where expected.';
  end if;
end $verify$;

commit;
