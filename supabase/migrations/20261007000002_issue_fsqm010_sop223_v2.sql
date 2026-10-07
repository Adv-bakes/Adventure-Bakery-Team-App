-- D-08 ISSUE: FSQM-010 Food Safety Management System Index (first issue) and SOP-2.2.3 Document and
-- Record Control Program v1 -> v2. Approved GJM, effective 2026-10-07.
--
-- FSQM-010 was drafted on 2026-10-05 and waited on four points and one decision.
--
-- THE DECISION (owner, 2026-10-07): SOP-2.2.3 stays the document control procedure - it is issued and
-- is the one every program cites. It is REWRITTEN as v2, because v1 named a "Quality Leader" (a
-- position the site does not have), said superseded versions were exported as PDF (the Team Portal
-- keeps a copy of each replaced revision by itself), and said production records were hard copies
-- (they are made on the forms in the Team Portal). v2 also carries the numbering rule, and its SQF
-- reference names the clauses (2.2.2.1, 2.2.3.1 to 2.2.3.3). Its attached PDF of v1 is kept.
-- The unissued draft FSQM-008, of the same subject, was removed by the owner on 2026-10-07 before
-- this migration; nothing here touches it, and the guard checks it is gone.
--
-- THE FOUR POINTS:
--   (1) scope - the certification covers the rum cake only (owner, 2026-10-07). The biscotti, baked
--       and packed on the same site, is exempt; FSQM-010 gains a Part "Scope of certification"
--       saying what an exemption requires and that the programs still apply where it could affect
--       the rum cake;
--   (2) countries - United States only; United Kingdom planned, assessed under FSQM-007 first;
--   (3) net weight - checked at release (20261005000013);
--   (4) the references that match no clause of the Food Manufacturing Code are corrected:
--       REP-003 and SOP-2.1.3 cited 2.1.3.4, SOP-2.3.1 cited 2.1.2.5, and a runbook carried 'N/A'.
--       These are corrections to the SQF reference only, not revisions of those documents.
--
-- FSQM-015, a draft, pointed to FSQM-008 for record retention; it now points to SOP-2.2.3.
--
-- NOT stated in SOP-2.2.3: that the database is backed up. The project showed no stored backups on
-- 2026-10-07, so the procedure does not claim one; it is raised with the owner separately.

begin;

do $guard$
declare h text; rev text;
begin
  select md5((content - 'attachments')::text) into h from public.sop_documents where sop_number = 'FSQM-010' and status = 'draft';
  if h is distinct from '2aad45140b72b0700633e156eb9e96a5' then raise exception 'FSQM-010 is not the draft that was approved (md5 %).', h; end if;
  select md5((content - 'attachments')::text), revision into h, rev from public.sop_documents where sop_number = 'SOP-2.2.3' and status = 'active';
  if rev is distinct from 'v1' or h <> '467878fe09d1746ce75c1b7b42dc393e' then raise exception 'SOP-2.2.3 is % or changed (md5 %).', rev, h; end if;
  if (select md5((content - 'attachments')::text) from public.sop_documents where sop_number = 'FSQM-015' and status = 'draft')
       is distinct from 'ce5cdabd4d898bea3e13fb5a6a0ee202' then
    raise exception 'FSQM-015 is not the draft this migration was written against.';
  end if;
  if exists (select 1 from public.sop_documents where sop_number = 'FSQM-008') then
    raise exception 'FSQM-008 still exists; this migration was written after it was removed.';
  end if;
  if (select sqf_reference from public.sop_documents where sop_number = 'REP-003' and status = 'active') <> '2.1.3.2, 2.1.3.4'
     or (select sqf_reference from public.sop_documents where sop_number = 'SOP-2.1.3' and status = 'active') <> '2.1.3.1, 2.1.3.2, 2.1.3.3, 2.1.3.4, 2.5.3.1'
     or (select sqf_reference from public.sop_documents where sop_number = 'SOP-2.3.1' and status = 'active') <> '2.3.1.1, 2.3.1.2, 2.3.2.5, 2.3.2.3, 2.6.1.1, 2.3.1.3, 2.2.3.1, 2.2.3.3, 2.1.2.5'
     or (select sqf_reference from public.sop_documents where id = '8d2b6816-ba5b-473e-a883-2a5c3675c7c5') <> 'N/A' then
    raise exception 'an SQF reference to be corrected is not what it was.';
  end if;
end $guard$;

-- SOP-2.2.3 v2: the body is replaced; the attachments are kept.
update public.sop_documents
   set content = jsonb_build_object('attachments', coalesce(content->'attachments', '[]'::jsonb)) || $j${"purpose": "How this site controls its documents and keeps its records, so that people work from the current version and every record can be found and trusted.", "scope": "Every controlled document of the SQF System - policies, programs (FSQM), procedures (SOP), forms (FRM), reports (REP) and training modules (TRN) - and every record made on them.", "definitions": "Controlled document: a document of the SQF System kept in the Team Portal with a number, a revision, an effective date and an approver.\nIssued: approved and in force; shown as active in the Team Portal.\nRecord: a completed entry on a form, or another document that shows an activity was done.", "responsibility": "SQF Practitioner - writes and revises documents, keeps each document's details correct, reviews records as the verification schedule sets out, and reviews the documents each year. The substitute SQF Practitioner covers when the SQF Practitioner is away.\nSenior Site Management - approves every controlled document before it is issued, and decides who may change documents.\nAll staff - work from the current document in the Team Portal and make their records on the current form.", "procedure": ["Documents", "• The controlled documents are kept in the Team Portal, in the SOPs Library. That copy is the only controlled one. A printed or downloaded copy is uncontrolled and is checked against the Team Portal before it is used (SQF 2.2.2.1).", "• Each document carries its number, title, revision, effective date, approver and the SQF clauses it answers. A document is a draft until Senior Site Management approves it; only then is it issued and in force.", "• Every team member can read every issued document. Only people Senior Site Management has authorized can change one.", "• A change to an issued document is a new revision: the revision goes up, a new effective date is set, and the reason is written in the document's revision history. The Team Portal keeps a copy of the version that was replaced, so an earlier version can always be produced (SQF 2.2.2.1).", "• An issued document that is no longer used is archived, not deleted. It leaves the list of current documents and is kept.", "• Staff are told of a new or changed document that affects their work by a notice in the Team Portal or by the training assigned for it (SOP-2.9).", "Numbering", "• Programs, forms, reports, policies and training modules carry a type and a three-digit number - FSQM, FRM, REP, POL, TRN. For forms and reports the hundreds digit is the stage of the process: 000 the food safety system, 100 new products, 200 suppliers, 300 receiving, 400 storage, 500 production, 600 packaging, 700 quality checks and release, 800 dispatch, 900 sanitation, 950 training.", "• Procedures (SOP) are numbered by the SQF clause they carry out, so SOP-2.3.4 is the procedure for clause 2.3.4. The two schemes are deliberate.", "• A number stays with its document for life. The revision is recorded on the document and is not part of the number. The Document Register in the Team Portal lists every document by number.", "Records", "• Records are made on the forms in the Team Portal as the work is done. Each entry carries who made it and when, and is signed by the person who did the check (SQF 2.2.3.2).", "• Where a paper sheet is used on the floor, it is entered in the Team Portal within one working day, and the paper is kept with the batch records.", "• A submitted record is not changed. If one has to be corrected, an authorized person reopens it, and the Team Portal records who did.", "• An entry stays tied to the revision of the form it was made on.", "• The SQF Practitioner reviews the records at the frequencies in the verification schedule (FSQM-017, Part 6) (SQF 2.2.3.1).", "Keeping records", "• Records are kept for at least two years, never less than the shelf life of the product, and longer where a customer or the law requires it (SQF 2.2.3.3).", "• Access to the Team Portal is by personal sign-in and is limited by role, so a record can be read by those who need it and changed only as set out above (SQF 2.2.3.3).", "• Retention samples are a separate matter and are kept as FSQM-014 sets out.", "• Each lot carries the four-digit lot code set out in FSQM-021: the last digit of the year and the three-digit day of the year on which the product was baked.", "Review", "• Once a year the SQF Practitioner reviews the documents through the FSMS Index (FSQM-010), and each program is reviewed as it states. The result is reported at the management review on FRM-001."], "records": "• The controlled documents, with their revision histories and the earlier versions the Team Portal keeps\n• The Document Register and the FSMS Index - pages of the Team Portal\n• FRM-001 - the yearly review", "form_references": "FRM-001 - Management Review Record", "governing_reference": "SQF Food Safety Code: Food Manufacturing, Edition 9 - 2.2.2.1 (document control), 2.2.3.1, 2.2.3.2 and 2.2.3.3 (records).\n\nFSQM-010 Food Safety Management System Index - where each part of the system is kept.\nFSQM-017 Validation and Verification Program - the schedule of record reviews.\nFSQM-014 Product Sampling, Inspection and Analysis Program - retention samples.\nFSQM-021 Product Identification and Traceability Program - the lot code.\nFSQM-005 Management Review Program; SOP-2.9 Training & Recordkeeping.", "revision_history": "v1 - 2025-10-28 - First issue.\n\nv2 - 2026-10-07 - REWRITTEN under D-08. The first issue named a Quality Leader, a position the site does not have; said superseded versions were exported as PDF, which the Team Portal now does by keeping a copy of every replaced revision; and said production records were kept as hard copies, when they are made on the forms in the Team Portal. The numbering rule, which the gap assessment read as inconsistent, is stated here: procedures by SQF clause, every other document by type and stage. The site chose this procedure as its document control procedure; an older unissued draft of the same subject, FSQM-008, was never issued and has been removed. The SQF reference now names the clauses: 2.2.2.1 and 2.2.3.1 to 2.2.3.3."}$j$::jsonb,
       sqf_reference = '2.2.2.1, 2.2.3.1, 2.2.3.2, 2.2.3.3',
       revision = 'v2', effective_date = date '2026-10-07', approved_by = 'GJM'
 where sop_number = 'SOP-2.2.3' and status = 'active' and revision = 'v1';

-- FSQM-010: issued.
update public.sop_documents
   set content = jsonb_set(jsonb_set(jsonb_set(content,
                   '{procedure}', $j$["What the system is", "• The SQF System of this site is the set of controlled documents and records kept in the Team Portal. It is kept electronically; a printed copy is uncontrolled (SOP-2.2.3).", "• Every team member can read every current document in the SOPs Library, and training is assigned from it (SOP-2.9).", "Scope of certification", "• The certification covers the rum cake, in all its flavors, from the receipt of ingredients and packaging to dispatch (FSQM-016).", "• The biscotti, which is also baked and packed on this site, is not in the scope. The exemption is asked for in writing from the certification body before the audit, the biscotti is named as exempt in the site description, and it is not sold or advertised as SQF certified.", "• The biscotti shares the building, the equipment and the people with the rum cake. Every program of this system applies to it wherever it could affect the rum cake - in particular allergens (FSQM-027), cleaning, and changeover and labeling (FSQM-021).", "Where each part is kept", "• The parts the Code asks for are kept here (SQF 2.2.1.1):", "◦ (i) a summary of the policies and the methods - this document, and the FSMS Index page;", "◦ (ii) the food safety policy and the organization chart - FSQM-002 and FSQM-004;", "◦ (iii) the products and processes in the scope of certification - stated below, with the food safety plan, FSQM-016;", "◦ (iv) the regulations that apply - listed below;", "◦ (v) specifications - FRM-207 for ingredients and packaging, FRM-704 for finished products;", "◦ (vi) procedures, prerequisite programs and food safety plans - the FSQM and SOP documents, with the Good Manufacturing Practices in FSQM-012 and FSQM-013;", "◦ (vii) process controls that affect product safety - FSQM-016 and its critical control point records, FRM-507 and FRM-606;", "◦ (viii) everything else that supports the system - found through the FSMS Index and the Document Register.", "The clause index", "• The FSMS Index page of the Team Portal lists every clause of the Code with the documents that cite it. It is read from the SQF reference on each document, so it is current without anyone keeping it.", "• It marks each clause: an issued program cites it; only a draft does; only records or training do; or nothing does.", "• When a document is issued or revised, the SQF Practitioner checks its SQF reference as part of approving it. That is what keeps the index true.", "How documents are numbered", "• Documents are numbered as SOP-2.2.3 sets out. Two schemes are used on purpose: a procedure (SOP) carries the number of the SQF clause it carries out, and every other document carries a type and a three-digit number whose hundreds digit is the stage of the process.", "Regulations that apply", "• United States, the country of manufacture and of sale:", "◦ FDA 21 CFR Part 117 - current good manufacturing practice and preventive controls for human food;", "◦ FDA 21 CFR Part 101 - food labeling, with the allergen labeling law (FALCPA and the FASTER Act);", "◦ FDA food facility registration and the Reportable Food Registry.", "• Florida: the Florida Food Safety Act (Chapter 500, Florida Statutes) and Chapter 5K-4, Florida Administrative Code, under which the site holds its food permit.", "• The products are sold only in the United States. Sale in the United Kingdom is planned: before any product is sold there, the food law that applies is added to this list and the change is assessed under FSQM-007.", "• Changes to these reach the system through FSQM-011.", "Product meets the law when it leaves", "• Finished product complies with the law at the time it is delivered to the customer because (SQF 2.4.1.1): its label is approved on FRM-601 before it is used; its ingredients and packaging are bought to specifications on FRM-207; its allergens are controlled under FSQM-027; and each lot is released on FRM-701 against its specification before dispatch, with the net weight of three packs checked against the label (FSQM-020).", "The yearly review", "• Once a year, before the management review, the SQF Practitioner goes through the FSMS Index. Every clause that no issued program cites is given a document, a corrected reference, or a written reason why it does not apply (FSQM-013 for the Good Manufacturing Practices).", "• The result is reported in the management review on FRM-001, under changes to the system's documents (FSQM-005).", "Records", "• FRM-001 - the yearly review. The FSMS Index itself is not a record: it shows the documents as they are today."]$j$::jsonb),
                   '{governing_reference}', to_jsonb($t$SQF Food Safety Code: Food Manufacturing, Edition 9 - 2.2.1.1 (the food safety management system, i to viii), 2.4.1.1 (finished product complies with legislation).

SOP-2.2.3 Document and Record Control Program; SOP-2.9 Training & Recordkeeping.
FSQM-002 Food Safety and Quality Policy; FSQM-004 Organizational Structure and Responsibilities; FSQM-005 Management Review Program; FSQM-011 Regulatory Awareness and Notification Program.
FSQM-012 Good Manufacturing Practices Program; FSQM-013 Module 11 Applicability & Exemption Analysis; FSQM-016 Food Safety Plan (HACCP); FSQM-020 Product Release Program; FSQM-027 Allergen Management Program.
FSQM-007 Change Management Program; FSQM-021 Product Identification and Traceability Program.$t$::text)),
                   '{revision_history}', to_jsonb($t$New - 2026-10-05 - DRAFT under D-08, for the Minor findings against 2.2.1.1 and 2.4.1.1.

A LIVE INDEX, NOT A TYPED MATRIX. The remediation plan asked for a matrix of every clause against the document that controls it. A typed matrix is out of date as soon as the next document is issued, so the matrix is a page of the Team Portal that reads each document's SQF reference. This document says where it is and how it is reviewed.

THE NUMBERING RULE is written here because the gap assessment read the two schemes - SOPs by clause, everything else by type and stage - as inconsistent. They are deliberate.

THIS DOCUMENT DOES NOT CLOSE 2.2.1.1 BY ITSELF. The finding was that programs were missing. It closes when the index shows an issued program against every clause that applies.

AT ISSUE: decide which document is the document control procedure - SOP-2.2.3 (issued) or FSQM-008 (an unissued draft of the same subject) - and put the numbering rule and the retention period for retained samples in it.

TO CONFIRM BEFORE ISSUE: (1) whether products made for other customers are in the scope of certification, since FSQM-016 covers one product; (2) every country the products are sold in; (3) where the net weight of a finished pack is checked and recorded; (4) the four references the FSMS Index lists as matching no clause are corrected on their documents.

ISSUED 2026-10-07. What the draft listed, as settled: DOCUMENT CONTROL - SOP-2.2.3 is the document control procedure; it is revised to v2 in the same change and now carries the numbering rule, so this document points to it. The older unissued draft FSQM-008 was never issued and has been removed. Retention samples stay with FSQM-014. (1) SCOPE - the certification covers the rum cake only; the biscotti is exempt, and a Part says what that requires. (2) COUNTRIES - sold only in the United States; sale in the United Kingdom is planned and is assessed before it starts. (3) NET WEIGHT - checked at release on three packs (FSQM-020 v3, FRM-701). (4) REFERENCES - the four references that matched no clause are corrected on their documents: 2.1.3.4 and 2.1.2.5 are not clauses of the Food Manufacturing Code, and a runbook carried 'N/A'.$t$::text)),
       status = 'active', approved_by = 'GJM', effective_date = date '2026-10-07'
 where sop_number = 'FSQM-010' and status = 'draft';

-- FSQM-015 (a draft) pointed to FSQM-008 for record retention; the document control procedure is SOP-2.2.3.
update public.sop_documents
   set content = jsonb_set(content, '{records}', to_jsonb(replace(content->>'records',
                   'Retention follows the record control requirements of FSQM-008.',
                   'Retention follows the record control requirements of SOP-2.2.3.')))
 where sop_number = 'FSQM-015' and status = 'draft';

-- References that match no clause.
update public.sop_documents set sqf_reference = '2.1.3.2' where sop_number = 'REP-003' and status = 'active';
update public.sop_documents set sqf_reference = '2.1.3.1, 2.1.3.2, 2.1.3.3, 2.5.3.1' where sop_number = 'SOP-2.1.3' and status = 'active';
update public.sop_documents set sqf_reference = '2.3.1.1, 2.3.1.2, 2.3.2.5, 2.3.2.3, 2.6.1.1, 2.3.1.3, 2.2.3.1, 2.2.3.3' where sop_number = 'SOP-2.3.1' and status = 'active';
update public.sop_documents set sqf_reference = null where id = '8d2b6816-ba5b-473e-a883-2a5c3675c7c5';

do $verify$
declare c jsonb; n int;
begin
  select content into c from public.sop_documents
   where sop_number = 'SOP-2.2.3' and status = 'active' and revision = 'v2' and approved_by = 'GJM' and effective_date = date '2026-10-07';
  if c is null then raise exception 'SOP-2.2.3 was not stamped v2.'; end if;
  if jsonb_array_length(c->'procedure') <> 24 or c->'procedure'->>0 <> 'Documents' or jsonb_array_length(c->'attachments') <> 1 then
    raise exception 'SOP-2.2.3 body or attachments not as intended.';
  end if;
  -- The history says what the first issue said; the body must not say it any more.
  if ((c->'procedure')::text || (c->>'responsibility')) ~ '(Quality Leader|hard copies)' then raise exception 'SOP-2.2.3 still carries the old wording.'; end if;
  if (select count(*) from public.sop_document_history h join public.sop_documents d on d.id = h.document_id
       where d.sop_number = 'SOP-2.2.3' and h.revision = 'v1') <> 1 then
    raise exception 'expected exactly one history snapshot of SOP-2.2.3 v1.';
  end if;
  select content into c from public.sop_documents
   where sop_number = 'FSQM-010' and status = 'active' and revision = 'New' and approved_by = 'GJM' and effective_date = date '2026-10-07';
  if c is null then raise exception 'FSQM-010 was not issued.'; end if;
  if jsonb_array_length(c->'procedure') <> 38 or c->'procedure'->>3 <> 'Scope of certification'
     or c->'procedure'->>7 <> 'Where each part is kept' or c::text not like '%Sale in the United Kingdom is planned%'
     or c::text not like '%net weight of three packs%' then
    raise exception 'FSQM-010 not as intended.';
  end if;
  if exists (select 1 from public.sop_documents where sop_number = 'FSQM-010' and status = 'draft') then
    raise exception 'a draft is left behind.';
  end if;
  select count(*) into n from public.sop_documents where status in ('active','draft') and content::text like '%FSQM-008%'
     and sop_number not in ('FSQM-010', 'SOP-2.2.3');
  if n <> 0 then raise exception '% document(s) still point to FSQM-008.', n; end if;
  select count(*) into n from public.sop_documents where status in ('active','draft')
     and (sqf_reference like '%2.1.3.4%' or sqf_reference like '%2.1.2.5%' or sqf_reference ilike '%N/A%');
  if n <> 0 then raise exception '% document(s) still cite a reference that matches no clause.', n; end if;
  for c in select content from public.sop_documents where sop_number in ('FSQM-010','SOP-2.2.3') and status = 'active' loop
    if c::text ~* '(Diana|Gabriela|Richard|Mercer|Botta)' then raise exception 'a controlled document names a person or a customer.'; end if;
  end loop;
end $verify$;

commit;
