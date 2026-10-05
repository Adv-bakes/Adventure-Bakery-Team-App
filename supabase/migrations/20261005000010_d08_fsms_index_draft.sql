-- D-08 FSMS Index, DRAFT:
--   FSQM-010 Food Safety Management System Index
--
-- Two Minor findings: 2.2.1.1, 2.4.1.1. FSQM-010 is reserved in the remediation workbook.
--
-- The clause-to-document matrix the plan asked for is a page of the Team Portal (FSMS Index), read
-- live from each document's sqf_reference, so this document only says where each part of the system
-- is kept, how documents are numbered, which regulations apply, and how the index is reviewed yearly.
-- No new form: the yearly review is reported on FRM-001.
-- SOP-2.2.3 (active) and FSQM-008 (draft) are left untouched; which of them is the document control
-- procedure is decided at issue.

begin;

do $guard$
begin
  if exists (select 1 from public.sop_documents where sop_number in ('FSQM-010')) then
    raise exception 'FSQM-010 is already in use.';
  end if;
  if (select count(distinct sop_number) from public.sop_documents
       where sop_number in ('FSQM-002', 'FSQM-004', 'FSQM-005', 'FSQM-008', 'FSQM-011', 'FSQM-012', 'FSQM-013', 'FSQM-016', 'FSQM-020', 'FSQM-027', 'SOP-2.2.3', 'SOP-2.3.4', 'SOP-2.9', 'FRM-001', 'FRM-207', 'FRM-507', 'FRM-601', 'FRM-606', 'FRM-701', 'FRM-704') and status in ('active', 'draft')) <> 20 then
    raise exception 'a document D-08 names is missing: %', (
      select string_agg(n, ', ') from unnest(array['FSQM-002', 'FSQM-004', 'FSQM-005', 'FSQM-008', 'FSQM-011', 'FSQM-012', 'FSQM-013', 'FSQM-016', 'FSQM-020', 'FSQM-027', 'SOP-2.2.3', 'SOP-2.3.4', 'SOP-2.9', 'FRM-001', 'FRM-207', 'FRM-507', 'FRM-601', 'FRM-606', 'FRM-701', 'FRM-704']) n
       where not exists (select 1 from public.sop_documents d where d.sop_number = n and d.status in ('active', 'draft')));
  end if;
end $guard$;

insert into public.sop_documents
  (sop_number, title, type, category, status, revision, sqf_reference, sqf_required, content)
values
  ('FSQM-010', 'Food Safety Management System Index', 'fsqm', 'Food Safety Quality Manual', 'draft', 'New',
   '2.2.1.1, 2.4.1.1', true, $q${"purpose": "This document describes Adventure Bakery's food safety management system: what it is made of, where each part the SQF Code asks for is kept, how to find the document that answers any clause, and how the whole is reviewed each year.", "scope": "Every controlled document and record of the SQF System at this site.", "definitions": "FSMS: food safety management system - the SQF System of this site.\nFSMS Index: the Team Portal page that lists each clause of the SQF Code with the documents that cite it.\nSQF reference: the clause numbers recorded on a document as the ones it answers.", "responsibility": "SQF Practitioner - keeps each document's SQF reference correct, and reviews the FSMS Index each year. The substitute SQF Practitioner covers when the SQF Practitioner is away.\nSenior Site Management - approves the documents, and receives the yearly review at the management review.", "procedure": ["What the system is", "• The SQF System of this site is the set of controlled documents and records kept in the Team Portal. It is kept electronically; a printed copy is uncontrolled (SOP-2.2.3).", "• Every team member can read every current document in the SOPs Library, and training is assigned from it (SOP-2.9).", "Where each part is kept", "• The parts the Code asks for are kept here (SQF 2.2.1.1):", "◦ (i) a summary of the policies and the methods - this document, and the FSMS Index page;", "◦ (ii) the food safety policy and the organization chart - FSQM-002 and FSQM-004;", "◦ (iii) the products and processes in the scope of certification - the food safety plan, FSQM-016;", "◦ (iv) the regulations that apply - listed below;", "◦ (v) specifications - FRM-207 for ingredients and packaging, FRM-704 for finished products;", "◦ (vi) procedures, prerequisite programs and food safety plans - the FSQM and SOP documents, with the Good Manufacturing Practices in FSQM-012 and FSQM-013;", "◦ (vii) process controls that affect product safety - FSQM-016 and its critical control point records, FRM-507 and FRM-606;", "◦ (viii) everything else that supports the system - found through the FSMS Index and the Document Register.", "The clause index", "• The FSMS Index page of the Team Portal lists every clause of the Code with the documents that cite it. It is read from the SQF reference on each document, so it is current without anyone keeping it.", "• It marks each clause: an issued program cites it; only a draft does; only records or training do; or nothing does.", "• When a document is issued or revised, the SQF Practitioner checks its SQF reference as part of approving it. That is what keeps the index true.", "How documents are numbered", "• Manuals, forms, reports, policies and training modules carry a type and a three-digit number - FSQM, FRM, REP, POL, TRN. For forms and reports the hundreds digit is the stage of the process: 000 the food safety system, 100 new products, 200 suppliers, 300 receiving, 400 storage, 500 production, 600 packaging, 700 quality checks and release, 800 dispatch, 900 sanitation, 950 training.", "• Procedures (SOP) are numbered by the SQF clause they carry out, so SOP-2.3.4 is the procedure for clause 2.3.4. This is deliberate.", "• A number stays with its document for life. The revision is recorded on the document and is not part of the number.", "Regulations that apply", "• United States, the country of manufacture and of sale:", "◦ FDA 21 CFR Part 117 - current good manufacturing practice and preventive controls for human food;", "◦ FDA 21 CFR Part 101 - food labeling, with the allergen labeling law (FALCPA and the FASTER Act);", "◦ FDA food facility registration and the Reportable Food Registry.", "• Florida: the Florida Food Safety Act (Chapter 500, Florida Statutes) and Chapter 5K-4, Florida Administrative Code, under which the site holds its food permit.", "• Changes to these reach the system through FSQM-011.", "Product meets the law when it leaves", "• Finished product complies with the law at the time it is delivered to the customer because (SQF 2.4.1.1): its label is approved on FRM-601 before it is used; its ingredients and packaging are bought to specifications on FRM-207; its allergens are controlled under FSQM-027; and each lot is released on FRM-701 against its specification before dispatch (FSQM-020).", "The yearly review", "• Once a year, before the management review, the SQF Practitioner goes through the FSMS Index. Every clause that no issued program cites is given a document, a corrected reference, or a written reason why it does not apply (FSQM-013 for the Good Manufacturing Practices).", "• The result is reported in the management review on FRM-001, under changes to the system's documents (FSQM-005).", "Records", "• FRM-001 - the yearly review. The FSMS Index itself is not a record: it shows the documents as they are today."], "form_references": "FRM-001 - Management Review Record\nFRM-207 - Material Specification Register\nFRM-704 - Finished Product Specification\nFRM-601 - Label Review & Approval Form\nFRM-701 - Finished Product Release Record", "records": "• FRM-001 - the yearly review of the system and of the index", "governing_reference": "SQF Food Safety Code: Food Manufacturing, Edition 9 - 2.2.1.1 (the food safety management system, i to viii), 2.4.1.1 (finished product complies with legislation).\n\nSOP-2.2.3 Document and Record Control Program; SOP-2.9 Training & Recordkeeping.\nFSQM-002 Food Safety and Quality Policy; FSQM-004 Organizational Structure and Responsibilities; FSQM-005 Management Review Program; FSQM-011 Regulatory Awareness and Notification Program.\nFSQM-012 Good Manufacturing Practices Program; FSQM-013 Module 11 Applicability & Exemption Analysis; FSQM-016 Food Safety Plan (HACCP); FSQM-020 Product Release Program; FSQM-027 Allergen Management Program.", "revision_history": "New - 2026-10-05 - DRAFT under D-08, for the Minor findings against 2.2.1.1 and 2.4.1.1.\n\nA LIVE INDEX, NOT A TYPED MATRIX. The remediation plan asked for a matrix of every clause against the document that controls it. A typed matrix is out of date as soon as the next document is issued, so the matrix is a page of the Team Portal that reads each document's SQF reference. This document says where it is and how it is reviewed.\n\nTHE NUMBERING RULE is written here because the gap assessment read the two schemes - SOPs by clause, everything else by type and stage - as inconsistent. They are deliberate.\n\nTHIS DOCUMENT DOES NOT CLOSE 2.2.1.1 BY ITSELF. The finding was that programs were missing. It closes when the index shows an issued program against every clause that applies.\n\nAT ISSUE: decide which document is the document control procedure - SOP-2.2.3 (issued) or FSQM-008 (an unissued draft of the same subject) - and put the numbering rule and the retention period for retained samples in it.\n\nTO CONFIRM BEFORE ISSUE: (1) whether products made for other customers are in the scope of certification, since FSQM-016 covers one product; (2) every country the products are sold in; (3) where the net weight of a finished pack is checked and recorded; (4) the four references the FSMS Index lists as matching no clause are corrected on their documents."}$q$::jsonb);

do $verify$
declare p jsonb;
begin
  select content->'procedure' into p from public.sop_documents where sop_number = 'FSQM-010';
  if jsonb_array_length(p) <> 35 then raise exception 'FSQM-010 procedure is % lines, expected 35.', jsonb_array_length(p); end if;
  if (select count(*) from unnest(array['2.2.1.1)', '2.4.1.1)']) c where p::text like '%' || c || '%') <> 2 then
    raise exception 'FSQM-010 does not cite both clauses it answers.';
  end if;
  if (select count(*) from unnest(array['(i) ', '(ii) ', '(iii) ', '(iv) ', '(v) ', '(vi) ', '(vii) ', '(viii) ']) c
       where p::text like '%' || c || '%') <> 8 then
    raise exception 'FSQM-010 does not place all eight parts of 2.2.1.1.';
  end if;
  if exists (select 1 from public.sop_documents where sop_number in ('FSQM-010')
              and content::text ~* 'Diana|Gabriela|Christina|GJM|Mercer|Pillsbury|Amazon|Sysco|Bahamas') then
    raise exception 'FSQM-010 names a person, a supplier or a customer; controlled documents name positions.';
  end if;
end $verify$;

commit;
