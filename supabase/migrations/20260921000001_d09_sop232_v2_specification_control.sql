-- D-09: SOP-2.3.2 v2 - Raw and Packaging Materials becomes the specification control procedure.
--
-- Closes the procedural half of D-09: 2.3.2.1 (method + responsibility), 2.3.2.4 (validation before
-- first use), 2.3.2.5 (suppliers required to notify composition changes), 2.3.2.6 (certificate for
-- food-contact packaging) and 2.3.2.10 (review + the list). 2.3.2.2 closes as materials are entered
-- on FRM-207, which this procedure makes the record of every one of those steps - no new form.
--
-- REWRITTEN, NOT APPENDED (unlike SOP-2.3.4 v4). v1 contradicted documents issued since: a COA per
-- lot (SOP-2.3.4 v4 and FSQM-014 say distributors issue none), cleaning chemicals excluded (2.3.2.2
-- names hazardous chemicals), and QA / Quality Leader roles the site does not have. Leaving v1's
-- lines in place beside the new ones would have kept the contradiction in force.
--
-- NOT HERE: equipment and utensil specifications (11.1.7.1) - workbook task 9.7, its own SOP.
-- The finished product specification itself (task 9.8) - this names SOP-2.3.1 as where it is made.
--
-- Issued as v2, active, GJM, 2026-09-21. Guarded on the md5 of v1's content; the history trigger
-- snapshots v1.

begin;

do $guard$
declare st text; rev text; h text;
begin
  select status, revision, md5(content::text) into st, rev, h
    from public.sop_documents where sop_number = 'SOP-2.3.2';
  if (st, rev) is distinct from ('active', 'v1') then
    raise exception 'SOP-2.3.2 is %/% - expected active/v1.', st, rev;
  end if;
  if h <> 'ebc3b92af9cea5e7c7b7426be6044075' then
    raise exception 'SOP-2.3.2 content changed since this migration was written (md5 %).', h;
  end if;
  -- every document the new text names must exist and be in force
  if (select count(*) from public.sop_documents
       where sop_number in ('FRM-207', 'FRM-202', 'REP-201', 'FRM-301', 'FRM-702', 'FRM-204', 'FRM-205', 'FRM-206', 'SOP-2.3.1', 'SOP-2.3.4', 'FSQM-018') and status = 'active') <> 11 then
    raise exception 'a document SOP-2.3.2 v2 names is missing or not active.';
  end if;
  if not exists (select 1 from public.sop_documents
                  where title = 'Chemical Safety Data Sheets (SDS)' and status = 'active') then
    raise exception 'the Chemical Safety Data Sheets (SDS) reference document is missing.';
  end if;
  -- the FRM-207 fields the procedure records on
  if (select count(*) from public.sop_documents d,
        jsonb_array_elements(d.content->'form_schema'->'sections') s,
        jsonb_array_elements(s->'fields') f
       where d.sop_number = 'FRM-207'
         and f->>'id' in ('change_notice', 'next_review', 'approved_by', 'status', 'spec_on_file')) <> 5 then
    raise exception 'FRM-207 no longer has the fields SOP-2.3.2 v2 records on.';
  end if;
end $guard$;

update public.sop_documents
   set content = content || jsonb_build_object(
         'purpose',          $q$To define how specifications for raw materials, packaging, processing aids and chemicals are developed, approved, validated and kept current, and how those materials are received and controlled, so that only material fit for its intended use goes into the baked product.$q$::text,
         'scope',            $q$All ingredients, additives, flavourings, processing aids and packaging used in production, and the cleaning and sanitising chemicals used on food-contact surfaces. Finished product specifications are developed under SOP-2.3.1, and contract service specifications are held on FRM-206. Equipment and utensil specifications, and potable water, are outside this procedure.$q$::text,
         'responsibility',   $q$The SQF Practitioner develops, approves and keeps current every material specification on FRM-207, validates each new material before its first use, asks suppliers to notify changes in composition, obtains the certificate for food-contact packaging, and approves finished product specifications under SOP-2.3.1.
Production staff receive and inspect each delivery on FRM-301 against the approved brand, and hold any material that fails, or whose pack has changed, for the SQF Practitioner.$q$::text,
         'procedure',        $q$["Every material that can affect the safety of the baked product has a specification, recorded as one entry on FRM-207 Material Specification Register before the material is first used.", "• This covers ingredients, additives and flavourings, processing aids, packaging, and the cleaning and sanitising chemicals used on food-contact surfaces.", "• An entry is one material as approved: a named product from a named manufacturer, with the manufacturer's specification sheet or allergen statement attached and the ingredient and Contains statements transcribed word for word. Where the manufacturer issues no specification, as for some commodity items, the entry records what the site specifies instead.", "• For a chemical, the specification is its Safety Data Sheet, kept in the Chemical Safety Data Sheets reference document; its FRM-207 entry says so.", "> FRM-207 lists the material, packaging, processing-aid and chemical specifications, FRM-206 lists the contract service specifications, and finished product specifications are controlled documents approved under SOP-2.3.1. Together they are the site's list of specifications (SQF 2.3.2.10).", "A new material is validated before its first use. The SQF Practitioner confirms each of the following, and records it by signing the FRM-207 entry:", "• it is bought from a supplier approved on FRM-202;", "• it is a food-grade product intended for the use it will be put to, and labelled for sale in the United States;", "• its allergens are known from its Contains statement, and any allergen it would add to a product is on that product's allergen statement before the material is used;", "• for packaging that touches food, the certificate in step 4 is attached.", "> A material that changes a product's formula is also trialled under SOP-2.3.1 before production use. Materials already in use when this revision was issued are entered on FRM-207 as each is next received.", "Suppliers are required to notify the site of any change in a material's composition that could affect the product: allergens above all, and moisture, protein or contaminant levels that vary by crop or season. The request is made in writing when the supplier is approved on FRM-202, and recorded on each FRM-207 entry.", "• A distributor rarely hears of a manufacturer's reformulation before the pack changes, so the pack is checked as well. A pack that looks different at receipt, with a new design, \"new recipe\" or a changed Contains statement, is compared with its FRM-207 entry before use. A changed allergen declaration is held for the SQF Practitioner's review.", "Packaging that comes into direct contact with food is used only with a letter of guarantee, certificate of conformance or regulatory certificate stating that it meets FDA food-contact requirements, attached to its FRM-207 entry.", "• If the supplier cannot provide one, the packaging is not used until one is obtained, or until the SQF Practitioner has had migration testing done by an accredited laboratory and has attached the result.", "Specifications are kept current. Each FRM-207 entry is reviewed at least annually, by its Next review date, and whenever the manufacturer issues a new sheet, the product or its allergens change, a different brand is bought, or a supplier notifies a change.", "• The review is recorded on the entry: the SQF Practitioner updates it, signs and dates it again, and sets the next review date. A replaced specification sheet stays attached beside the new one, so the entry shows what was specified before.", "• A material no longer used is marked Discontinued, never deleted.", "Deliveries are received and inspected on FRM-301 under SOP-2.3.4, against the approved brand on FRM-207. A distributor does not issue a certificate of analysis for each lot; the manufacturer's specification on FRM-207 and the checks recorded on FRM-301 for every delivery take its place.", "Material that fails its receiving check is tagged HOLD – DO NOT USE on FRM-702 and dispositioned under FSQM-018. Approved material is stored so that it cannot be contaminated or deteriorate.", "Supplier performance is reviewed annually on FRM-204, and a supplier non-conformance is raised on FRM-205."]$q$::jsonb,
         'form_references',  $q$FRM-207 - Material Specification Register (one entry per material: specification, allergens, validation, review)
FRM-202 - Supplier Approval & Evaluation Record, and REP-201 - Approved Supplier Register
FRM-301 - Incoming Material Receiving & Inspection Log
FRM-702 - Non-Conforming Material Hold & Tagging Record
FRM-204 - Annual Supplier Performance Evaluation Checklist
FRM-205 - Supplier Non-Conformance & Corrective Action Report (SCAR)
FRM-206 - Contract Services Register (contract service specifications)
SOP-2.3.1 - New Product and Specification Process (finished product specifications, formula trials)
SOP-2.3.4 - Vendor Approval (supplier approval, receiving, brand substitution)
FSQM-018 - Non-Conforming Product and Equipment$q$::text,
         'records',          $q$• FRM-207 entries, each with its specification sheet or allergen statement, the photo of the pack, the food-contact packaging certificate where one applies, and superseded sheets kept beside the current one
• Chemical Safety Data Sheets (SDS) reference document
• REP-201 Approved Supplier Register and FRM-202 entries
• FRM-301 receiving records and FRM-702 hold records
• FRM-204 annual supplier evaluations and FRM-205 SCARs$q$::text,
         'revision_history', $q$v2 — 2026-09-21 — Specification control, under D-09.

Six Minor findings against the specification clauses: 2.3.2.1 (no method or responsibility for specifications), 2.3.2.2 (no specifications), 2.3.2.4 (no validation of materials as fit for purpose), 2.3.2.5 (suppliers not required to notify composition changes), 2.3.2.6 (no certificate for food-contact packaging) and 2.3.2.10 (no review of specifications and no list of them).

THE PROCEDURE WAS REWRITTEN, NOT EXTENDED, because v1 contradicted documents issued since. It required a certificate of analysis for every lot, which the distributors Adventure Bakery buys through do not issue; SOP-2.3.4 v4 and FSQM-014 already say that, and say what takes its place. It excluded cleaning chemicals, which 2.3.2.2 names. Its roles (QA, Quality Leader) are posts the site does not have; one person holds the SQF Practitioner role and approves every specification.

THE REGISTER IS THE LIST. FRM-207 was issued on 2026-09-18 as one entry per material, approved as a named product from a named manufacturer. This revision makes it the record of every step the clauses ask for: the specification (2.3.2.2), the validation before first use (2.3.2.4, the SQF Practitioner's signature), the change-notification request (2.3.2.5), the packaging certificate (2.3.2.6) and the review (2.3.2.10). No new form was needed.

A DISTRIBUTOR CANNOT PASS ON WHAT IT DOES NOT KNOW. Asking Sysco or Restaurant Depot to report a manufacturer's reformulation is what 2.3.2.5 requires, and it is done, but a distributor usually learns of a change when the pack changes. So the pack is also checked at receipt, and a changed allergen declaration is held.

Equipment and utensil specifications (11.1.7.1) are left to their own procedure.$q$::text),
       sqf_reference  = '2.3.2.1, 2.3.2.2, 2.3.2.4, 2.3.2.5, 2.3.2.6, 2.3.2.10, 2.1.1.6, 2.1.1.7, 2.3.4, 2.4.5, 2.4.7, 2.6.1',
       revision       = 'v2',
       effective_date = date '2026-09-21',
       approved_by    = 'GJM'
 where sop_number = 'SOP-2.3.2';

do $verify$
declare r record; p jsonb; t text;
begin
  select status, revision, effective_date, approved_by, content into r
    from public.sop_documents where sop_number = 'SOP-2.3.2';
  p := r.content->'procedure';
  t := p::text;
  if (r.status, r.revision, r.approved_by, r.effective_date) is distinct from
     ('active', 'v2', 'GJM', date '2026-09-21') then
    raise exception 'SOP-2.3.2 did not issue as v2: %/%/%/%.', r.status, r.revision, r.approved_by, r.effective_date;
  end if;
  if jsonb_array_length(p) <> 21 then
    raise exception 'procedure is % lines, expected 21.', jsonb_array_length(p);
  end if;
  -- v1's contradictions are gone
  if t ilike '%COA for every lot%' or r.content->>'scope' ilike '%managed under separate sanitation%'
     or t ilike '%Quality Leader%' or r.content->>'responsibility' ilike '%QA%' then
    raise exception 'v1 text survived the rewrite.';
  end if;
  -- one limb per clause
  if t not like '%FRM-207 Material Specification Register%'                  -- 2.3.2.1 / .2
     or t not like '%validated before its first use%'                          -- 2.3.2.4
     or t not like '%notify the site of any change in a material''s composition%'  -- 2.3.2.5
     or t not like '%letter of guarantee, certificate of conformance%'         -- 2.3.2.6
     or t not like '%migration testing%'                                       -- 2.3.2.6 fallback
     or t not like '%reviewed at least annually%'                              -- 2.3.2.10 review
     or t not like '%list of specifications%' then                            -- 2.3.2.10 list
    raise exception 'a clause limb is missing from the procedure.';
  end if;
  raise notice 'D-09: SOP-2.3.2 v2 issued - specification control, % procedure lines.', jsonb_array_length(p);
end $verify$;

commit;
