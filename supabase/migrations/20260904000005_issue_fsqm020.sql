-- Issue FSQM-020 and FRM-701. Active, approved GJM, 2026-09-04. Closes Mandatory 2.4.7.
--
-- BOTH IN ONE TRANSACTION, and that is the point of the migration rather than a convenience.
-- FSQM-020 requires every release to be recorded on FRM-701. Activating the program while its
-- record was still draft would put an active controlled document in the position FSQM-022 was in
-- before D-07 - requiring a record that is not available - which is the exact finding this wave
-- exists to close. Either both are issued or neither is.
--
-- WHAT ISSUING ADOPTS. Three limbs of 2.4.7 are stated as NOT APPLYING to this site: positive
-- release on pathogen or chemical testing (Part 5), off-site and contract warehouses (Part 8), and
-- bulk or unlabeled supply (Part 6). Issuing adopts those as the site's position. That is a real
-- decision, not a formality, so each one names what would have to change first: Part 5 says the
-- procedure must be revised before tested product ships, and the other two describe the practice
-- they depend on - collection by the customer's carrier, and finished product leaving labelled in
-- its finished pack - so none can quietly stop being true without someone noticing.
--
-- NEITHER ANSWER WAS ASSUMED. Both were asked for and given by the site on 2026-09-04: no bulk or
-- unlabeled product ships, and the customer arranges collection with their own carrier. The second
-- corrected an answer this program had been drafted against the day before, which is why it was
-- worth asking rather than inferring from the tolling inventory tables.
--
-- ONE ITEM CARRIED FORWARD, AND IT IS NOT ABOUT THIS DOCUMENT. There is no documented product
-- sampling, inspection and analysis method (2.4.4.1) and no finished product specification in the
-- register beyond SOP-2.3.1. The release check points at "the customer's agreed specification" and
-- "the product's appearance and sensory standard", and an auditor will follow that pointer. That is
-- a gap in a different element, not a defect here, and this program does not claim 2.4.4.
--
-- REVISION STAYS AT New on both. First issue, not a revision - the same as FSQM-009 under
-- 20260902000010 and FSQM-018 under 20260902000016. Nothing is superseded and nothing archived.
-- Every document FSQM-020 references is asserted active below.
--
-- Only status, approved_by, effective_date and FSQM-020's revision_history are written. The DO
-- block hashes the rest of both rows' content, so the procedure, the form schema and every other
-- section are provably untouched by the issue.

begin;

do $$
declare
  r record;
begin
  select
    (select status from public.sop_documents where sop_number = 'FSQM-020')          as s20,
    (select status from public.sop_documents where sop_number = 'FRM-701')           as s701,
    (select revision from public.sop_documents where sop_number = 'FSQM-020')        as v20,
    (select revision from public.sop_documents where sop_number = 'FRM-701')         as v701,
    (select jsonb_array_length(content->'procedure') from public.sop_documents
      where sop_number = 'FSQM-020')                                                 as lines,
    (select count(*) from public.sop_documents d,
            jsonb_array_elements(d.content->'form_schema'->'sections') s,
            jsonb_array_elements(s->'fields') f
      where d.sop_number = 'FRM-701')                                                as fields,
    (select (content->>'revision_history') like '%OPEN BEFORE ISSUE%'
       from public.sop_documents where sop_number = 'FSQM-020')                      as open_head,
    (select count(*) from public.sop_documents
      where sop_number in ('FRM-702','FRM-903','FRM-601','REP-602','REP-603','FSQM-018',
                           'FSQM-009','SOP-2.3.2.3','SOP-2.3.2','SOP-2.3.1')
        and status = 'active')                                                       as refs_live
  into r;

  if r.s20 is distinct from 'draft' or r.s701 is distinct from 'draft' then
    raise exception 'Expected both draft; found FSQM-020=%, FRM-701=%.', r.s20, r.s701;
  end if;
  if r.v20 <> 'New' or r.v701 <> 'New' then
    raise exception 'Expected both at revision New; found %, %.', r.v20, r.v701;
  end if;
  if r.lines <> 27 or r.fields <> 20 then
    raise exception 'Bodies are not what 20260904000003/4 left: % lines, % fields.', r.lines, r.fields;
  end if;
  if not r.open_head then
    raise exception 'FSQM-020 does not carry the OPEN BEFORE ISSUE heading this migration rewrites.';
  end if;
  if r.refs_live <> 10 then
    raise exception 'Only % of the 10 documents FSQM-020 references are active.', r.refs_live;
  end if;
end $$;

create temporary table issue020_before on commit drop as
select sop_number,
       md5((content - 'revision_history')::text) as h
  from public.sop_documents where sop_number in ('FSQM-020','FRM-701');

update public.sop_documents
   set content = jsonb_set(content, '{revision_history}', $i20$"Rev New — written 2026-09-03 against SQF Food Safety Code: Food Manufacturing 2.4.7 Product Release, which is MANDATORY, and SQF Quality Code 2.4.7.1. DRAFT. Not approved, not in force.\n\nWHY IT EXISTS. FSQM-018 named a \"Positive Release Procedure\" as the authority for the final disposition of reworked material, and no document of that name existed anywhere in the register — a Compass Blending reference that survived the scan. That citation was removed on 2026-09-02 when FSQM-018 gained a release step of its own, but the gap underneath it was real: the site had no documented method for releasing finished product at all, against an element the Food Manufacturing code marks Mandatory.\n\nIT IS A PRODUCT RELEASE PROGRAM, NOT A POSITIVE RELEASE PROCEDURE, and the difference is deliberate. 2.4.7 has three limbs — release by authorised personnel after documented checks (2.4.7.1), confirmation that labels comply with food law (2.4.7.2), and positive release where testing gates it, plus off-site storage (2.4.7.3). A document written to the name FSQM-018 used would have closed the third limb and left the Mandatory element open.\n\nWHAT THE SITE ACTUALLY DOES, confirmed 2026-09-03. Before a batch ships, the batch sheet is reviewed, the label is checked, and the packaging and the product itself are looked at. That already covers most of what Quality Code 2.4.7.1 lists. This program writes down what is already done and adds only what the clause requires on top — a named authority, a record, and the off-site storage rule. It does not invent a control nobody performs, because a control nobody performs is a finding waiting to be made.\n\nNO POSITIVE RELEASE ON TESTING, AND THE DOCUMENT SAYS SO. No finished product is sent for laboratory testing before shipment and none is held pending a result. SQF 2.4.7.3 applies only where such testing gates release, so Part 5 states plainly that the practice is not used rather than leaving a reader to assume a gate exists. It also says what must happen before that changes: if finished-product testing is ever introduced — a gluten result for certified Gluten Free product being the likely first, since the site is GFCO certified — this procedure needs revising before that product ships, so the hold-pending-result step exists before it is needed rather than after.\n\nOFF-SITE STORAGE DOES NOT APPLY — CORRECTED 2026-09-04. This program was drafted on 2026-09-03 on the understanding that product went both from our own dock and into customer-owned or third-party storage, and Part 8 accordingly required a written instruction to each storage location, reissued on change and confirmed annually. The CEO and Operations Manager confirmed on 2026-09-04 that this is not how it works: the customer arranges collection with their own carrier, and responsibility for the product passes to the customer once it leaves the facility. The site uses no off-site or contract warehouse. Part 8 now says so, in the same form Part 5 uses for positive release on testing, and the written instruction it required — which was recorded here as a prerequisite to issue — is withdrawn as an open item because there is nobody to issue it to.\n\nWHAT THAT DOES NOT CHANGE, and it is worth saying because \"no longer our responsibility\" is easy to read more widely than it holds. Collection makes the timing of release SHARPER, not softer: the record has to be complete before the carrier arrives rather than before a transfer the site controls, because once product is loaded it has gone. And the passing of responsibility at the dock is a commercial fact about custody and risk, not a food-safety one — traceability, and any withdrawal or recall, still reach product after it has been collected. Neither is in this program's scope; both belong to the recall and withdrawal program, which does not yet exist.\n\nLABEL COMPLIANCE IS REFERENCED, NOT REPEATED. Labels are approved under SOP-2.3.2.3 on FRM-601, the approved version is held on REP-602, and changes are tracked on REP-603. Restating that here would create a second copy to drift, which is how FSQM-018 and FSQM-019 came to name different authorities for rework. The release check confirms that the label applied is the approved one; Part 6 confirms that the approved one is lawful.\n\nONE PERSON RELEASES. 2.4.7.1 requires release by authorised personnel, and here that is the SQF Practitioner alone. Naming a second signature that does not exist would be a control in name only.\n\nNO BULK OR UNLABELED PRODUCT, CONFIRMED 2026-09-04. The site was asked whether it ships any, because Part 7 required safe-use information to travel with such a consignment and a Part describing something that never happens is worse than no Part at all — it is the first thing an auditor tests and the first thing the floor learns to ignore. It ships none. Part 7 is therefore gone as a step and its clause limb is stated in prose under Part 6, with the labelling content it belongs with: all finished product leaves labelled and in its finished pack, so the second half of 2.4.7.2 does not arise. That is the same treatment Part 5 gives positive release on testing and Part 8 gives off-site storage — three limbs of 2.4.7 that do not apply here, each said so rather than left silent.\n\nISSUED 2026-09-04, approved GJM. Status active, revision New — a first issue, not a revision, so nothing is superseded and nothing is archived. FRM-701 Finished Product Release Record is activated in the SAME TRANSACTION: this program requires a release to be recorded on it, and an active procedure requiring a record that is not available is the finding this wave exists to close.\n\nSETTLED AT ISSUE. Both questions this document carried were answered by the site on 2026-09-04. It ships no bulk or unlabeled product, so Part 7 became a scope statement under Part 6. It uses no off-site or contract warehouse — the customer collects with their own carrier — so Part 8's written instruction, the one item that genuinely blocked issue, was withdrawn. Neither answer was assumed; both were asked for and given.\n\nWHAT ISSUING ADOPTS. Three limbs of 2.4.7 are stated as not applying here: positive release on pathogen or chemical testing (Part 5), off-site and contract warehouses (Part 8), and bulk or unlabeled supply (Part 6). Issuing this document adopts those three scope statements as the site's position. Each names what would have to change first — Part 5 in terms, and the other two by describing the practice they depend on — so none of them can quietly stop being true.\n\nSTILL OPEN AFTER ISSUE — one item, and it is not about this document:\n\n1. There is no documented product sampling, inspection and analysis method (SQF 2.4.4.1), and no finished product specification in the register beyond SOP-2.3.1 New Product and Specification Process. The release check reads \"the customer's agreed specification\" and \"the product's appearance and sensory standard\". Confirm where those live, because this procedure points at them and an auditor will follow the pointer.\n"$i20$::jsonb),
       status = 'active', approved_by = 'GJM', effective_date = date '2026-09-04'
 where sop_number = 'FSQM-020' and status = 'draft' and revision = 'New';

update public.sop_documents
   set status = 'active', approved_by = 'GJM', effective_date = date '2026-09-04'
 where sop_number = 'FRM-701' and status = 'draft' and revision = 'New';

do $$
declare
  r record;
  bad int;
begin
  select
    (select count(*) from public.sop_documents
      where sop_number in ('FSQM-020','FRM-701') and status = 'active'
        and approved_by = 'GJM' and effective_date = date '2026-09-04'
        and revision = 'New')                                                        as issued,
    (select jsonb_array_length(content->'procedure') from public.sop_documents
      where sop_number = 'FSQM-020')                                                 as lines,
    (select count(*) from public.sop_documents d,
            jsonb_array_elements(d.content->'form_schema'->'sections') s,
            jsonb_array_elements(s->'fields') f
      where d.sop_number = 'FRM-701')                                                as fields,
    (select (content->>'revision_history') like '%OPEN BEFORE ISSUE%'
       from public.sop_documents where sop_number = 'FSQM-020')                      as stale_head,
    (select (content->>'revision_history') like '%ISSUED 2026-09-04, approved GJM%'
       from public.sop_documents where sop_number = 'FSQM-020')                      as issue_note,
    (select (content->>'revision_history') like '%SETTLED AT ISSUE%'
       from public.sop_documents where sop_number = 'FSQM-020')                      as settled,
    (select (content->>'revision_history') like '%WHAT ISSUING ADOPTS%'
       from public.sop_documents where sop_number = 'FSQM-020')                      as adopts,
    (select (content->>'revision_history') like '%STILL OPEN AFTER ISSUE%'
       from public.sop_documents where sop_number = 'FSQM-020')                      as still_open,
    -- the three scope statements the issue adopts must all be present
    (select (content->'procedure')::text like '%does not use positive release based on pathogen or chemical testing%'
       from public.sop_documents where sop_number = 'FSQM-020')                      as limb_testing,
    (select (content->'procedure')::text like '%does not use off-site or contract warehouses%'
       from public.sop_documents where sop_number = 'FSQM-020')                      as limb_offsite,
    (select (content->'procedure')::text like '%supplies no product in bulk or unlabeled%'
       from public.sop_documents where sop_number = 'FSQM-020')                      as limb_bulk
  into r;

  select count(*) into bad
    from public.sop_documents d join issue020_before b on b.sop_number = d.sop_number
   where md5((d.content - 'revision_history')::text) is distinct from b.h;

  if r.issued <> 2 then
    raise exception 'Only % of the two documents issued as active/GJM/2026-09-04/New.', r.issued;
  end if;
  if r.lines <> 27 or r.fields <> 20 then
    raise exception 'A body changed during issue: % lines, % fields.', r.lines, r.fields;
  end if;
  if r.stale_head then
    raise exception 'FSQM-020 is active but still says OPEN BEFORE ISSUE.';
  end if;
  if not (r.issue_note and r.settled and r.adopts and r.still_open) then
    raise exception 'Revision history wrong: issued=%, settled=%, adopts=%, still open=%.',
      r.issue_note, r.settled, r.adopts, r.still_open;
  end if;
  if not (r.limb_testing and r.limb_offsite and r.limb_bulk) then
    raise exception 'A scope statement the issue adopts is missing: testing=%, off-site=%, bulk=%.',
      r.limb_testing, r.limb_offsite, r.limb_bulk;
  end if;
  if bad <> 0 then
    raise exception '% of the two rows changed outside revision_history. Rolled back.', bad;
  end if;
end $$;

commit;
