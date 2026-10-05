-- D-04: issue FSQM-007 Change Management Program and FRM-015 Change Assessment Record.
-- Approved GJM, effective 2026-10-05, revision New (first issue).
--
-- Four Minor findings: 2.1.1.7, 2.2.1.2, 2.3.1.4, 2.3.1.5.
--
-- Two issued documents pointed at this program before it existed, and are revised in the same change:
--   FSQM-017 v11 -> v12  Part 4 said "there is no general change-assessment record ... change
--                        management is its own deliverable and will define the record". It now names
--                        FSQM-007 and FRM-015 (procedure[29]) and lists FRM-202 and FRM-207 among the
--                        dedicated records (procedure[28]). The rule and the schedule are unchanged.
--   SOP-2.3.1 v1 -> v2   "Any changes follow the Management of Change Procedure" (procedure[9]) named a
--                        procedure that never existed. It now names FSQM-007 and FRM-015. The scope
--                        also loses "(e.g., Vital Blink)" at the owner's request. Nothing else changes.
--
-- The draft listed "the first real change recorded on FRM-015" as something to confirm BEFORE issue.
-- That was the wrong way round: the form is not used until the program is in force. The first change
-- is recorded when one arises, and D-04 stays WIP in the workbook until then.
--
-- Guarded on the md5 of each document's content as it stands in production (read 2026-10-05) and on
-- FRM-015 having no entries.

begin;

do $guard$
declare h text; st text; rev text;
begin
  select md5(content::text), status into h, st from public.sop_documents where sop_number = 'FSQM-007';
  if st is distinct from 'draft' or h <> '369c2290004ad4228a25f8f0dca7e318' then raise exception 'FSQM-007 is % or changed since review (md5 %).', st, h; end if;
  select md5(content::text), status into h, st from public.sop_documents where sop_number = 'FRM-015';
  if st is distinct from 'draft' or h <> 'f73d934733f981714c15c2bdc61b442c' then raise exception 'FRM-015 is % or changed since review (md5 %).', st, h; end if;
  select md5(content::text), status, revision into h, st, rev from public.sop_documents where sop_number = 'FSQM-017' and status = 'active';
  if rev is distinct from 'v11' or h <> '732d60f5d9ebdd8b35fba83bc3161dba' then raise exception 'FSQM-017 is %/% or changed (md5 %).', st, rev, h; end if;
  select md5(content::text), status, revision into h, st, rev from public.sop_documents where sop_number = 'SOP-2.3.1' and status = 'active';
  if rev is distinct from 'v1' or h <> '18dd7166c806104ac7beb59cbe6b436a' then raise exception 'SOP-2.3.1 is %/% or changed (md5 %).', st, rev, h; end if;
  if (select count(*) from public.sop_document_responses r join public.sop_documents d on d.id = r.document_id
       where d.sop_number = 'FRM-015') <> 0 then
    raise exception 'FRM-015 has entries before issue - check they are not test entries.';
  end if;
end $guard$;

update public.sop_documents
   set content = jsonb_set(content, '{revision_history}', to_jsonb($t$New - 2026-10-05 - DRAFT under D-04, for the Minor findings against 2.1.1.7, 2.2.1.2, 2.3.1.4 and 2.3.1.5. The site had no change management procedure; SOP-2.3.1 pointed at a "Management of Change Procedure" that did not exist.

MADE LIGHTER THE SAME DAY (owner, 2026-10-05). The first draft ran to 54 lines and a 20-field form, used FRM-015 for eight kinds of change, and added a handover record for every change of staff. The owner's reading: it would take a full-time person to keep up. The clauses ask for less - a change validated or justified before it is made with the reason recorded (2.2.1.2), the process reviewed and not only the recipe (2.3.1.4), process flows that prevent cross-contamination (2.3.1.5), and a system that keeps running when people change (2.1.1.7). So: FRM-015 is for three kinds of change only; a changed document carries its own reason in its revision history; a change of people is a line on FRM-009; the form went from 20 fields to 12.

BUILT ON WHAT EXISTS: FSQM-017 Part 4 (assess before the change), FSQM-004 (a cover for every key position), FSQM-005 and FRM-001 (the yearly review).

No verification schedule row: a change is assessed when it happens.

ISSUED 2026-10-05 with FRM-015. FSQM-017 Part 4 and SOP-2.3.1 are revised in the same change: FSQM-017 no longer carries an interim rule and names this program and FRM-015, and SOP-2.3.1's "Management of Change Procedure" now reads FSQM-007. The draft listed a first real change on FRM-015 as something to confirm before issue. That was the wrong way round - the form is not used until this program is in force - so the first change is recorded when one arises.$t$::text)),
       status = 'active', approved_by = 'GJM', effective_date = date '2026-10-05'
 where sop_number = 'FSQM-007' and status = 'draft';

update public.sop_documents
   set status = 'active', approved_by = 'GJM', effective_date = date '2026-10-05'
 where sop_number = 'FRM-015' and status = 'draft';

update public.sop_documents
   set content = jsonb_set(jsonb_set(jsonb_set(jsonb_set(content,
                   '{procedure,28}', to_jsonb($t$• Where a dedicated record governs the change it is used: label changes are FRM-601 and REP-603, a new supplier is FRM-202, a new material is FRM-207, and a change arising out of a corrective action is recorded on its FRM-007.$t$::text)),
                   '{procedure,29}', to_jsonb($t$> Every other change that can alter whether the product is safe - a new product or recipe, a changed process step or limit, new or modified equipment that touches the product - is assessed and approved on FRM-015 under FSQM-007 Change Management Program. That program also states which changes need no record beyond the revision of the document that describes them, and how a change of people is handled.$t$::text)),
                   '{form_references}', to_jsonb((content->>'form_references') || $t$; FRM-015 Change Assessment Record$t$)),
                   '{revision_history}', to_jsonb((content->>'revision_history') || $t$

v12 — 2026-10-05 — Part 4 revised under D-04. FSQM-007 Change Management Program and FRM-015 Change Assessment Record are issued, so Part 4 no longer says there is no general change-assessment record: it names them, and adds FRM-202 and FRM-207 to the dedicated records. The rule itself - assess before the change takes effect - is unchanged, and so is the schedule.$t$)),
       revision = 'v12', effective_date = date '2026-10-05', approved_by = 'GJM'
 where sop_number = 'FSQM-017' and status = 'active' and revision = 'v11';

update public.sop_documents
   set content = jsonb_set(jsonb_set(jsonb_set(content,
                   '{procedure,9}', to_jsonb($t$• Any change to a product, a recipe or a process is assessed and approved under FSQM-007 Change Management Program, on FRM-015, before it is made. The assessment covers the manufacturing process, not only the recipe, and whether the food safety plan has to be revised and validated first.$t$::text)),
                   '{scope}', to_jsonb($t$Applies to all new products, formulations, and packaging developed by Adventure Bakery—both customer-requested and internal brand items. Includes any change that may impact product safety, functionality, or labeling compliance.$t$::text)),
                   '{revision_history}', to_jsonb($t$v2 - 2026-10-05 - The step "Any changes follow the Management of Change Procedure" pointed at a procedure that did not exist. It now names FSQM-007 Change Management Program and FRM-015, issued the same day under D-04. The scope no longer names a brand as an example of an internal item. Nothing else in this procedure is changed by this revision.$t$::text)),
       revision = 'v2', effective_date = date '2026-10-05', approved_by = 'GJM'
 where sop_number = 'SOP-2.3.1' and status = 'active' and revision = 'v1';

do $verify$
declare n int; p jsonb; txt text;
begin
  select count(*) into n from public.sop_documents
   where (sop_number, status, revision, approved_by, effective_date) in (
     ('FSQM-007', 'active', 'New', 'GJM', date '2026-10-05'), ('FRM-015', 'active', 'New', 'GJM', date '2026-10-05'),
     ('FSQM-017', 'active', 'v12', 'GJM', date '2026-10-05'), ('SOP-2.3.1', 'active', 'v2', 'GJM', date '2026-10-05'));
  if n <> 4 then raise exception 'not all four documents were stamped (% of 4).', n; end if;

  select content->'procedure', content::text into p, txt from public.sop_documents where sop_number = 'FSQM-007';
  if jsonb_array_length(p) <> 29 then raise exception 'FSQM-007 procedure length changed.'; end if;
  if txt like '%TO CONFIRM BEFORE ISSUE%' or txt like '%AT ISSUE:%' or txt not like '%ISSUED 2026-10-05 with FRM-015%' then
    raise exception 'FSQM-007 still carries the draft''s open items, or has no issue stamp.';
  end if;
  if txt ~* 'Diana|Gabriela|Christina|GJM|Mercer|Richard' then raise exception 'FSQM-007 names a person.'; end if;

  if (select count(*) from public.sop_documents d, jsonb_array_elements(d.content->'form_schema'->'sections') s,
                           jsonb_array_elements(s->'fields') f where d.sop_number = 'FRM-015') <> 12 then
    raise exception 'FRM-015 field count changed.';
  end if;

  select content->'procedure', content::text into p, txt from public.sop_documents where sop_number = 'FSQM-017' and status = 'active';
  if jsonb_array_length(p) <> 76 then raise exception 'FSQM-017 procedure length changed.'; end if;
  if p->>29 not like '%FRM-015 under FSQM-007 Change Management Program%' or p->>28 not like '%FRM-202%FRM-207%FRM-007.' then
    raise exception 'FSQM-017 Part 4 not updated.';
  end if;
  if txt like '%There is no general change-assessment record%' or txt like '%will define the record%' then
    raise exception 'FSQM-017 still carries the interim rule.';
  end if;
  if txt not like '%FRM-015 Change Assessment Record%' or txt not like '%v12 % 2026-10-05 % Part 4 revised under D-04%' then
    raise exception 'FSQM-017 form references or v12 history line missing.';
  end if;
  if p->>25 not like 'A change to a process or a procedure shall be assessed%BEFORE it takes effect%' then
    raise exception 'FSQM-017 Part 4 rule moved or changed.';
  end if;

  select content->'procedure', content::text into p, txt from public.sop_documents where sop_number = 'SOP-2.3.1' and status = 'active';
  if jsonb_array_length(p) <> 21 or p->>9 not like '%FSQM-007 Change Management Program, on FRM-015%' then
    raise exception 'SOP-2.3.1 step not updated.';
  end if;
  if txt like '%Vital Blink%' or txt not like '%internal brand items. Includes any change%' then
    raise exception 'SOP-2.3.1 scope still names a brand.';
  end if;
  if p::text like '%Management of Change Procedure%' or txt not like '%v2 - 2026-10-05 - The step%' then
    raise exception 'SOP-2.3.1 still names the procedure that never existed.';
  end if;
end $verify$;

commit;
