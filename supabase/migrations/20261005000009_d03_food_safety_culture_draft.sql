-- D-03 Food Safety Culture Plan, DRAFT:
--   FSQM-006 Food Safety Culture Plan
--
-- One Minor finding: 2.1.1.2. FSQM-006 is reserved in the remediation workbook.
--
-- No new form. The objectives are FSQM-003's, each measured from a record the site already keeps.
-- They are told to staff through Team Portal notices (migration 20261005000008), which keep the list
-- of who read each post. The plan also writes down what staff could already do - stop work and hold
-- product - and how a missed rule is handled, which was not written anywhere.
-- FSQM-005 (active) is left untouched here; one line of it is revised in the issue migration.

begin;

do $guard$
begin
  if exists (select 1 from public.sop_documents where sop_number in ('FSQM-006')) then
    raise exception 'FSQM-006 is already in use.';
  end if;
  if (select count(distinct sop_number) from public.sop_documents
       where sop_number in ('FSQM-002', 'FSQM-003', 'FSQM-004', 'FSQM-005', 'FSQM-007', 'FSQM-012', 'FSQM-017', 'FSQM-018', 'SOP-2.9', 'FRM-001', 'FRM-007', 'FRM-009', 'FRM-010', 'FRM-012', 'FRM-509', 'FRM-702', 'FRM-913', 'FRM-952', 'REP-003') and status in ('active', 'draft')) <> 19 then
    raise exception 'a document D-03 names is missing: %', (
      select string_agg(n, ', ') from unnest(array['FSQM-002', 'FSQM-003', 'FSQM-004', 'FSQM-005', 'FSQM-007', 'FSQM-012', 'FSQM-017', 'FSQM-018', 'SOP-2.9', 'FRM-001', 'FRM-007', 'FRM-009', 'FRM-010', 'FRM-012', 'FRM-509', 'FRM-702', 'FRM-913', 'FRM-952', 'REP-003']) n
       where not exists (select 1 from public.sop_documents d where d.sop_number = n and d.status in ('active', 'draft')));
  end if;
  if to_regclass('public.staff_notices') is null then
    raise exception 'the staff notices tables are missing; FSQM-006 relies on them (20261005000008).';
  end if;
  if not exists (select 1 from public.sop_documents where sop_number = 'FRM-001' and status = 'active'
                  and content->'form_schema' @? '$.sections[*].fields[*].rows.labels[*] ? (@ starts with "Food Safety Culture Performance")') then
    raise exception 'FRM-001 no longer has the culture row FSQM-006 names.';
  end if;
end $guard$;

insert into public.sop_documents
  (sop_number, title, type, category, status, revision, sqf_reference, sqf_required, content)
values
  ('FSQM-006', 'Food Safety Culture Plan', 'fsqm', 'Food Safety Quality Manual', 'draft', 'New',
   '2.1.1.2', true, $q${"purpose": "This plan states how Senior Site Management leads and supports a food safety culture at Adventure Bakery: the objectives and how they are measured, how the team is told, how people are held to the rules, and how everyone is expected and free to raise and act on a food safety problem.", "scope": "Everyone who works on the site, managers included.", "definitions": "Food safety culture: the shared habits and attitudes that decide whether the food safety rules are followed when nobody is checking.\nNotice: a post to the whole team in the Team Portal, which each team member acknowledges having read.", "responsibility": "Senior Site Management - sets the objectives, provides the resources, posts the notices, follows the rules it sets, and decides what follows a repeated or deliberate breach.\nSQF Practitioner - reports the measures each month and each year, records what staff raise, and retrains where a rule is missed.\nAll staff - follow the rules, read the notices, speak up, and act on a problem within their own work.", "procedure": ["Objectives and how they are measured", "• Senior Site Management sets the food safety objectives (FSQM-003) and confirms them each year at the management review (FSQM-005). Each one is measured from a record the site already keeps:", "◦ every team member completes the food safety training assigned to them - the Team Portal training records;", "◦ no Major finding at an internal or an outside audit - FRM-010 and the audit reports;", "◦ every lot traced, forward and back, in the yearly mock recall - FRM-012;", "◦ customer complaints at or under the target set on FRM-001 - REP-003;", "◦ no scheduled verification activity overdue at the end of a month - the verification schedule (FSQM-017).", "Telling the team", "• After each management review, Senior Site Management posts the objectives and the year's results as a notice in the Team Portal. Each team member taps \"I have read this\", and the notice keeps the list of who read it and when. That list is the record that the objectives were communicated (SQF 2.1.1.2 i).", "• A notice is posted the same way whenever the team needs to know something: a change to how the work is done (FSQM-007), a result from an audit, a complaint or a new rule.", "• A notice is written in English and in Spanish where a team member is trained in Spanish.", "Resources", "• What the site needs to meet its objectives - people, equipment, training or time - is raised in the monthly update (FRM-009, \"Anything needing a decision or a resource\") and decided there. The year's needs are decided at the management review (FRM-001) (SQF 2.1.1.2 ii).", "Knowing the job and being held to it", "• Each position's food safety duties are written in its job description (FSQM-004). Nobody works alone on a task until trained on it (SOP-2.9), and the food safety rules for everyone on the floor are in FSQM-012 (SQF 2.1.1.2 iii).", "• Following the food safety rules is a condition of working on the site, for managers the same as for everyone else. When a rule is missed (SQF 2.1.1.2 iv):", "◦ the first time, it is put right on the spot and the person is shown the right way;", "◦ if it happens again, the person is retrained and the retraining is recorded on FRM-952;", "◦ if it is repeated after that, or was done on purpose, Senior Site Management decides what follows.", "Speaking up", "• Every team member is required to tell the SQF Practitioner or Senior Site Management, straight away, about anything that is or could become a food safety problem (SQF 2.1.1.2 v).", "• Nobody is blamed or penalized for raising a problem or for stopping work in good faith, including when it turns out to be nothing.", "• What is raised is recorded where it belongs - a hold on FRM-702, a corrective action on FRM-007, a repair on FRM-509 - and the person who raised it is told what was done.", "Acting on a problem", "• Any team member may, without asking first: stop their own work; set product or material aside and tag it on hold (FSQM-018); refuse to use equipment that is dirty or damaged; and ask a visitor or a contractor to follow the site rules. They then tell the SQF Practitioner (SQF 2.1.1.2 vi).", "• Held product is released only by the SQF Practitioner (FSQM-018).", "Checking that it works", "• The monthly GMP inspection (FRM-913) shows whether practice on the floor matches the rules.", "• Once a year the management review answers the \"Food Safety Culture Performance\" row of FRM-001 from the measures above, from who read the notices, and from the problems staff raised during the year."], "form_references": "FRM-001 - Management Review Record\nFRM-009 - Monthly SQF Update Record\nFRM-913 - GMP / Food Safety Inspection Record\nFRM-952 - Training Competency Verification Record\nFRM-702 - Non-Conforming Material Hold & Tagging Record\nFRM-007 - Corrective & Preventive Action (CAPA) Report\nFRM-509 - Maintenance and Repair Record\nFRM-010 - Internal Audit Record\nFRM-012 - Withdrawal, Recall and Mock Recall Record\nREP-003 - Customer Complaint Log", "records": "• Team Portal notices, with who read each and when\n• FRM-001 - the yearly review of objectives and culture\n• FRM-009 - resources raised and decided each month\n• FRM-952 - retraining after a missed rule", "governing_reference": "SQF Food Safety Code: Food Manufacturing, Edition 9 - 2.1.1.2 (i to vi).\n\nFSQM-002 Food Safety and Quality Policy; FSQM-003 Management Responsibilities and Quality Objectives; FSQM-004 Organizational Structure and Responsibilities.\nFSQM-005 Management Review Program; FSQM-007 Change Management Program; FSQM-012 Good Manufacturing Practices Program; FSQM-017 Validation and Verification Program; FSQM-018 Non-Conforming Product and Equipment.\nSOP-2.9 Training & Recordkeeping.", "revision_history": "New - 2026-10-05 - DRAFT under D-03, for the Minor finding against 2.1.1.2. The policy (FSQM-002) and the objectives (FSQM-003) existed; what was missing was how the objectives are measured and told to staff, how staff are held to the rules, and the written right to raise and act on a problem.\n\nNO NEW FORM. Every measure is read from a record the site already keeps. Telling the team is done through notices in the Team Portal, built for this plan: a post that each team member acknowledges, with the list of who read it kept against the post. Until now staff were told by word of mouth when an issue arose.\n\nWHAT STAFF COULD ALREADY DO: stop work and hold product. This plan writes that down and adds that nobody is penalized for it.\n\nAT ISSUE: revise FSQM-005 Part 2 item (ii), which says no formal culture measures are set yet, to point here; post the first notice with the objectives.\n\nTO CONFIRM BEFORE ISSUE: (1) the complaint target - FSQM-003 says fewer than two quality complaints a year, FRM-001 says one a month or fewer; one of them is to be corrected; (2) that the three steps for a missed rule are how Senior Site Management wants it handled; (3) every team member has a Team Portal login to read notices."}$q$::jsonb);

do $verify$
declare p jsonb;
begin
  select content->'procedure' into p from public.sop_documents where sop_number = 'FSQM-006';
  if jsonb_array_length(p) <> 29 then raise exception 'FSQM-006 procedure is % lines, expected 29.', jsonb_array_length(p); end if;
  if (select count(*) from unnest(array['2.1.1.2 i)', '2.1.1.2 ii)', '2.1.1.2 iii)', '2.1.1.2 iv)', '2.1.1.2 v)', '2.1.1.2 vi)']) c
       where p::text like '%' || c || '%') <> 6 then
    raise exception 'FSQM-006 does not cite every part of 2.1.1.2.';
  end if;
  if exists (select 1 from public.sop_documents where sop_number in ('FSQM-006')
              and content::text ~* 'Diana|Gabriela|Christina|GJM|Mercer|Pillsbury|Amazon|Sysco|Bahamas') then
    raise exception 'FSQM-006 names a person, a supplier or a customer; controlled documents name positions.';
  end if;
end $verify$;

commit;
