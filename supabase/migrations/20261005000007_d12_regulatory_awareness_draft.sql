-- D-12 Regulatory Awareness and Notification, DRAFT:
--   FSQM-011 Regulatory Awareness and Notification Program
--
-- Three Minor findings: 2.4.1.2, 2.4.1.3, 2.6.3.4. FSQM-011 is reserved in the remediation workbook.
--
-- No new form. The month's news is reported on the monthly update (FRM-009), the yearly look at the
-- sources is in the management review (FRM-001), and a regulatory warning - rare, and already a
-- corrective action - carries its notice on that FRM-007. The 24-hour notice in a recall (2.6.3.4) is
-- already written in FSQM-023 and is pointed to, not repeated.
-- FRM-009 (active) is left untouched here; one row's wording is revised in the issue migration.

begin;

do $guard$
begin
  if exists (select 1 from public.sop_documents where sop_number in ('FSQM-011')) then
    raise exception 'FSQM-011 is already in use.';
  end if;
  if (select count(distinct sop_number) from public.sop_documents
       where sop_number in ('FSQM-003', 'FSQM-005', 'FSQM-007', 'FSQM-009', 'FSQM-018', 'FSQM-023', 'SOP-2.2.3', 'FRM-001', 'FRM-007', 'FRM-009', 'FRM-011') and status in ('active', 'draft')) <> 11 then
    raise exception 'a document D-12 names is missing: %', (
      select string_agg(n, ', ') from unnest(array['FSQM-003', 'FSQM-005', 'FSQM-007', 'FSQM-009', 'FSQM-018', 'FSQM-023', 'SOP-2.2.3', 'FRM-001', 'FRM-007', 'FRM-009', 'FRM-011']) n
       where not exists (select 1 from public.sop_documents d where d.sop_number = n and d.status in ('active', 'draft')));
  end if;
  if not exists (select 1 from public.sop_documents where sop_number = 'FRM-009' and status = 'active'
                  and content->'form_schema' @? '$.sections[*].fields[*].rows.labels[*] ? (@ starts with "Changes affecting the SQF System")') then
    raise exception 'FRM-009 no longer has the row FSQM-011 reports on.';
  end if;
end $guard$;

insert into public.sop_documents
  (sop_number, title, type, category, status, revision, sqf_reference, sqf_required, content)
values
  ('FSQM-011', 'Regulatory Awareness and Notification Program', 'fsqm', 'Food Safety Quality Manual', 'draft', 'New',
   '2.4.1.2, 2.4.1.3, 2.6.3.4', true, $q${"purpose": "This program states how Adventure Bakery keeps up with changes to food law, food safety knowledge and industry codes of practice, and how SQFI and the certification body are told within 24 hours of a regulatory warning or of a food safety event that needs public notification.", "scope": "The law, guidance and codes that apply to the products made on this site and to where they are sold, and every regulatory warning or event at this site.", "definitions": "Regulatory warning or event: a written warning or an enforcement step from a regulator - see the procedure.\nPublic notification: telling the public that a food may be unsafe, as in a recall.\nSQFI: the Safe Quality Food Institute, which owns the SQF Code.", "responsibility": "SQF Practitioner - is signed up to the sources, reads what arrives, acts on what affects the site, and reports each month. The substitute SQF Practitioner covers when the SQF Practitioner is away.\nSenior Site Management - keeps the registrations and permits current, and sees that SQFI and the certification body are told within 24 hours.", "procedure": ["What is watched", "• The SQF Practitioner is signed up to these sources, by email where one is offered:", "◦ FDA - recalls, market withdrawals and safety alerts, and news of new food rules and guidance;", "◦ the Florida Department of Agriculture and Consumer Services (FDACS), Division of Food Safety - notices to food permit holders;", "◦ SQFI - changes to the SQF Code, and its guidance and tip sheets, which carry the industry codes of practice and new food safety topics;", "◦ suppliers and the customer - a notice about a material, a specification or a requirement.", "• Where it is not clear what a change means for the site, a food safety consultant is asked (the contact is on FRM-011).", "What is done with it", "• Each notice is read when it arrives. Most do not affect this site, and those are not recorded one by one.", "• A notice that does affect the site is acted on the same day:", "◦ a recall or an alert naming a material the site holds - the material is put on hold (FSQM-018), and FSQM-023 starts if it went into product already sent out;", "◦ a new or changed rule, or a new food safety concern - it is assessed as a change under FSQM-007, and the documents it touches are revised.", "• Every month, in the monthly update (FRM-009, \"Changes affecting the SQF System\"), the SQF Practitioner reports what came in that affects the site, or that nothing did.", "• Once a year the management review (FSQM-005, FRM-001) asks whether these are still the right sources and whether anything was missed (SQF 2.4.1.2).", "Registrations and permits", "• Senior Site Management keeps them current:", "◦ FDA food facility registration - renewed between October 1 and December 31 of every even-numbered year;", "◦ FDACS food permit - renewed every year;", "◦ local business licence - renewed every year.", "Telling SQFI and the certification body", "• A regulatory warning or event is a written warning or an enforcement step from a regulator: an FDA warning letter, a stop-sale or stop-use order, product seized or detained, a permit or registration suspended, or a recall that a regulator asks for.", "• Within 24 hours of one, SQFI and the certification body are told in writing. SQFI is told by email at foodsafetycrisis@sqfi.com (SQF 2.4.1.3).", "• The same notice is given within 24 hours of identifying a food safety event that needs public notification, as FSQM-023 sets out (SQF 2.6.3.4).", "• The notice says what happened and when, the product and lots affected if any, and what the site is doing about it.", "• Senior Site Management sees that the notice is sent. The SQF Practitioner usually sends it (FSQM-003). The contacts are on FRM-011.", "• A corrective action is raised on FRM-007 under FSQM-009, and the notice as sent is attached to it. That is the record.", "• A routine inspection with ordinary findings is not a regulatory warning. Its findings are reported in the monthly update and corrected under FSQM-009.", "Records", "• FRM-009 each month, FRM-001 each year, and FRM-007 with the notice attached, kept as SOP-2.2.3 requires."], "form_references": "FRM-009 - Monthly SQF Update Record\nFRM-001 - Management Review Record\nFRM-007 - Corrective & Preventive Action (CAPA) Report\nFRM-011 - Recall and Crisis Contact List", "records": "• FRM-009 - the monthly report of what came in\n• FRM-001 - the yearly review of the sources\n• FRM-007 - a regulatory warning or event, with the notice attached", "governing_reference": "SQF Food Safety Code: Food Manufacturing, Edition 9 - 2.4.1.2 (keeping informed), 2.4.1.3 (notice of a regulatory warning or event), 2.6.3.4 (notice of an event needing public notification).\n\nFSQM-023 Product Withdrawal and Recall Program - the same 24-hour notice in a recall.\nFSQM-007 Change Management Program - how a changed rule reaches the SQF System.\nFSQM-005 Management Review Program; FSQM-009 CAPA Program; FSQM-018 Non-Conforming Product and Equipment; FSQM-003 Management Responsibilities and Quality Objectives.\nSOP-2.2.3 Document and Record Control Program.", "revision_history": "New - 2026-10-05 - DRAFT under D-12, for the Minor findings against 2.4.1.2, 2.4.1.3 and 2.6.3.4. The site had no regular source of news about food law and no written 24-hour notice for a regulatory warning.\n\nNO NEW FORM. The monthly update (FRM-009) already has a row for changes affecting the SQF System, and that is where the month's news is reported, including a month with none. A regulatory warning is rare and already needs a corrective action, so the notice is attached to that FRM-007. The 24-hour notice in a recall (2.6.3.4) is already written in FSQM-023 and is only pointed to here.\n\nALCOHOL: the site holds no federal or state alcohol permit. The rum is supplied by the customer. No alcohol regulator is listed as a source for that reason.\n\nAT ISSUE: reword the FRM-009 row \"Changes affecting the SQF System\" so that its second line names the law and codes of practice as well as process, product, equipment, facility and personnel.\n\nTO CONFIRM BEFORE ISSUE: (1) the SQF Practitioner is signed up to the FDA, FDACS and SQFI sources; (2) that no alcohol permit is needed to hold and bake with the customer's rum; (3) the renewal dates of the FDACS food permit and the local licence; (4) the certification body's own rule on what it must be told, once one is contracted."}$q$::jsonb);

do $verify$
declare p jsonb;
begin
  select content->'procedure' into p from public.sop_documents where sop_number = 'FSQM-011';
  if jsonb_array_length(p) <> 29 then raise exception 'FSQM-011 procedure is % lines, expected 29.', jsonb_array_length(p); end if;
  if (select count(*) from unnest(array['2.4.1.2)', '2.4.1.3)', '2.6.3.4)']) c where p::text like '%' || c || '%') <> 3 then
    raise exception 'FSQM-011 does not cite every clause it closes.';
  end if;
  if p::text not like '%foodsafetycrisis@sqfi.com%' then raise exception 'FSQM-011 does not give the SQFI address.'; end if;
  if exists (select 1 from public.sop_documents where sop_number in ('FSQM-011')
              and content::text ~* 'Diana|Gabriela|Christina|GJM|Mercer|Pillsbury|Amazon|Sysco|Bahamas') then
    raise exception 'FSQM-011 names a person, a supplier or a customer; controlled documents name positions.';
  end if;
end $verify$;

commit;
