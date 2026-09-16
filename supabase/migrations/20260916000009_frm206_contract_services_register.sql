-- D-10 Contract Services Register - FRM-206, seeded as a draft.
--
-- SQF 2.3.2.8: the description of services from a contract provider that affects product safety
-- shall be documented, CURRENT, include a full description of the services provided, and detail the
-- relevant training requirements of all contract personnel. Graded Minor - no such documentation
-- existed. The consultant's minimum was provider name, service description, address and contact;
-- the clause also asks for the training limb, which is the part most registers miss.
--
-- THE SITE HAS ONE CONTRACT SERVICE TODAY: PEST CONTROL. Confirmed by the owner, 2026-09-16.
-- Janitorial services were halted on cost and the site now restocks supplies itself. Nothing else
-- is contracted - no laundry, no waste haulage, no calibration house, no external laboratory
-- (which is consistent with D-15: the site inspects, it does not analyse).
--
-- SO THE REGISTER WILL HAVE ONE ENTRY, AND THAT IS THE CORRECT ANSWER. A register listing services
-- the site does not buy would be the same defect just removed from FRM-001 under D-06, where the
-- agenda asserted microbiological criteria and environmental swabbing that nobody performs. The
-- form offers the usual service types as options because the site may contract one later; it does
-- not pre-populate them as rows.
--
-- ONE ENTRY PER PROVIDER, not one entry holding a grid of them. Three reasons, and the first is the
-- one that decides it:
--   THE CONTRACT HAS TO BE ATTACHABLE. Attachments hang off an ENTRY, so a provider-per-entry form
--   puts each contract with its own provider. A single register entry would pile every contract
--   into one attachment list.
--   "CURRENT" IS PER PROVIDER. One provider changing its scope should revise one record.
--   THE ENTRIES LIST IS THE REGISTER. service_type, provider_name and status carry showInList, so
--   the list view already reads as a register without anything being built for it.
--
-- A DISCONTINUED SERVICE STAYS ON THE REGISTER, marked Discontinued with a date - which is why
-- `status` is a field rather than a reason to delete the entry. The janitorial arrangement can be
-- recorded that way if the site wants the history visible; nothing forces it.
--
-- IT DOES NOT DUPLICATE THE PROGRAMMES. Pest prevention (D-29) and chemical control (D-30) govern
-- how the site controls those activities; this register records who is contracted and for what.
-- Nothing in the document set names a contract provider today - "janitor" appears nowhere, so
-- there is no stale claim to correct, which was worth checking before writing this.
--
-- FRM-206 IS FREE: not live (202-205 are) and not reserved in the remediation workbook (201-204
-- are). FRM-201 is spoken for as the approved-supplier pattern and is left alone. The 200 block is
-- Sourcing & Supplier Approval in DOC_STAGES, which is where a contracted service belongs.
--
-- NO SCHEDULE ACTIVITY IS ADDED HERE. The entry carries its own `next_review` date, and adding a
-- verification activity would mean revising FSQM-017 for the fourth time today. Worth doing if the
-- site wants the review prompted rather than diarised - raise it rather than assume it.

begin;

do $guard$
begin
  if exists (select 1 from public.sop_documents where sop_number = 'FRM-206') then
    raise exception 'FRM-206 already exists.';
  end if;
  -- the visitor forms this register points contract personnel at have to exist
  if (select count(*) from public.sop_documents
       where sop_number in ('FRM-905', 'FRM-906') and status = 'active') <> 2 then
    raise exception 'FRM-905/FRM-906 are not both active; Section 4 would cite a document that is not issued.';
  end if;
end $guard$;

insert into public.sop_documents
  (sop_number, title, type, category, status, revision, sqf_reference, sqf_required, content)
values
  ('FRM-206', 'Contract Services Register', 'form', 'Module 2', 'draft', 'New',
   $sq$2.3.2.8$sq$, true, jsonb_build_object('form_schema', $j206${"schemaVersion": 1, "settings": {"attachmentsEnabled": true, "allowMultipleDrafts": true, "requireVerification": true, "instanceTitleTemplate": "{provider_name} — {service_type}"}, "sections": [{"id": "provider", "title": "1. The provider", "fields": [{"id": "how_this_works", "type": "info", "label": "How this register works", "text": "ONE ENTRY IS ONE CONTRACT SERVICE PROVIDER. The Entries list is the register - provider, service and whether it is current - and each entry carries the full description, the training its personnel must hold, and the contract itself as an attachment.\n\nWHAT 2.3.2.8 ASKS FOR. The description of services from a contract provider that affects product safety must be documented, CURRENT, give a full description of the services provided, and detail the relevant training requirements of all contract personnel. The auditor will ask to see a contract, which is why one is attached rather than referred to.\n\nA DISCONTINUED SERVICE STAYS ON THE REGISTER, marked Discontinued with the date. Deleting it would leave no record that the site ever used it, and \"current\" means the register says which services are live - not that it has been emptied of the ones that are not.\n\nTHIS REGISTER RECORDS WHO IS CONTRACTED AND FOR WHAT. It does not govern how the site controls the activity - pest prevention and chemical control are their own programmes. Two accounts of one activity is how a record stops being believed."}, {"id": "service_type", "type": "select", "label": "Service", "width": "half", "required": true, "showInList": true, "allowOther": true, "options": ["Pest control", "Chemical supply", "Laundry / workwear", "Waste haulage", "Calibration", "External laboratory", "Sanitation / janitorial", "Equipment maintenance", "Other"]}, {"id": "provider_name", "type": "text", "label": "Provider", "width": "half", "required": true, "showInList": true}, {"id": "status", "type": "select", "label": "Status", "width": "third", "required": true, "showInList": true, "options": ["Current", "Discontinued"]}, {"id": "engaged_from", "type": "date", "label": "Engaged from", "width": "third"}, {"id": "discontinued_on", "type": "date", "label": "Discontinued on", "width": "third", "help": "Only where the status above is Discontinued."}, {"id": "address", "type": "textarea", "label": "Address", "required": true}, {"id": "contact_name", "type": "text", "label": "Contact", "width": "third", "required": true}, {"id": "contact_phone", "type": "text", "label": "Telephone", "width": "third"}, {"id": "contact_email", "type": "text", "label": "Email", "width": "third"}]}, {"id": "services", "title": "2. Services provided (2.3.2.8)", "fields": [{"id": "services_info", "type": "info", "label": "What a full description means", "text": "\"A full description\" means what an auditor could check the provider against: what they do, where they do it, and how often. \"Pest control\" on its own is not a description of a service."}, {"id": "service_description", "type": "textarea", "label": "Full description of the services", "required": true, "help": "What the provider does for the site, in enough detail to check them against it."}, {"id": "frequency", "type": "text", "label": "How often they attend", "width": "half", "help": "For example \"monthly, plus call-outs\"."}, {"id": "areas", "type": "textarea", "label": "Areas of the site they access"}, {"id": "chemicals_used", "type": "textarea", "label": "Chemicals or materials they bring on site", "help": "Anything applied or left on site. Each is subject to the site's chemical control; record \"none\" where they bring nothing."}]}, {"id": "training", "title": "3. Training of contract personnel (2.3.2.8)", "fields": [{"id": "training_info", "type": "info", "label": "Whose training this is", "text": "THIS IS THE LIMB THE FINDING WAS ABOUT. 2.3.2.8 asks for the relevant training requirements of all contract personnel - not the site's training, theirs. For a pest control technician that is the state pesticide applicator licence; for a contract laboratory it is the method accreditation; for a sanitation contractor it is chemical handling and GMP.\n\nRECORD WHAT THEY MUST HOLD, AND WHETHER THE SITE HAS SEEN IT. \"Not required\" is an acceptable answer where it is true and justified - an unjustified blank is not."}, {"id": "training_requirements", "type": "textarea", "label": "Training and licences their personnel must hold", "required": true}, {"id": "evidence_held", "type": "select", "label": "Evidence held by the site", "width": "half", "required": true, "options": ["On file - attached to this entry", "On file - held elsewhere", "Requested, not yet received", "Not required - justified above"]}, {"id": "licence_reference", "type": "text", "label": "Licence / certificate reference", "width": "half"}, {"id": "licence_expiry", "type": "date", "label": "Expires", "width": "third"}]}, {"id": "controls", "title": "4. While they are on site", "fields": [{"id": "controls_info", "type": "info", "label": "They are visitors", "text": "Contract personnel are visitors for as long as they are on site: they sign in on FRM-905 and acknowledge the GMP rules on FRM-906, the same as anybody else who is not staff.\n\nANY CHEMICAL BROUGHT ON SITE is recorded in Section 2 and is subject to the site's chemical control - a provider's own product does not arrive pre-approved because the provider is approved."}, {"id": "signs_in", "type": "pass_fail", "label": "Signs in on FRM-905 and acknowledges GMP on FRM-906", "width": "half", "required": true}, {"id": "supervision", "type": "select", "label": "Supervision", "width": "half", "required": true, "options": ["Escorted at all times", "Unescorted in named areas only", "Attends when the site is not operating"]}, {"id": "records_left", "type": "textarea", "label": "Records they leave with the site", "help": "For example a service report per visit. These are site records once received."}]}, {"id": "contract", "title": "5. Contract and review", "fields": [{"id": "contract_info", "type": "info", "label": "The contract itself", "text": "ATTACH THE CONTRACT to this entry using the Attachments section at the bottom. \"Held elsewhere\" is acceptable if the location is named and somebody can produce it during an audit; \"no contract in place\" is a true answer for an informal arrangement and is better recorded than implied.\n\nSET A REVIEW DATE. 2.3.2.8 requires the description to be CURRENT, and a register nobody revisits stops being current the first time a provider changes what they do."}, {"id": "contract_on_file", "type": "select", "label": "Contract", "width": "half", "required": true, "options": ["Attached to this entry", "Held elsewhere - named below", "No written contract in place"]}, {"id": "contract_location", "type": "text", "label": "Where it is held", "width": "half"}, {"id": "contract_renewal", "type": "date", "label": "Contract renewal date", "width": "third"}, {"id": "next_review", "type": "date", "label": "Next review of this entry", "width": "third", "required": true, "help": "At least annually, and whenever the service changes."}, {"id": "reviewed_by", "type": "signature", "role": "verifier", "required": true, "label": "Reviewed and approved by the SQF Practitioner", "statement": "The description of services above is accurate and current, and the training requirements recorded are those this provider's personnel must hold."}]}]}$j206$::jsonb));

do $verify$
declare r record;
begin
  select status, revision, sqf_reference, sqf_required,
         jsonb_array_length(content->'form_schema'->'sections')                            as sections,
         (select count(*) from jsonb_array_elements(content->'form_schema'->'sections') s,
                               jsonb_array_elements(s->'fields') f)                        as fields,
         (select count(*) from jsonb_array_elements(content->'form_schema'->'sections') s,
                               jsonb_array_elements(s->'fields') f
           where (f->>'showInList')::boolean)                                              as listed,
         (select count(*) from jsonb_array_elements(content->'form_schema'->'sections') s,
                               jsonb_array_elements(s->'fields') f
           where f->>'type' = 'signature' and f->>'role' = 'verifier')                     as sigs
    into r
    from public.sop_documents where sop_number = 'FRM-206';

  if r.status <> 'draft' or r.revision <> 'New' or not r.sqf_required then
    raise exception 'FRM-206 wrong: %/%/%.', r.status, r.revision, r.sqf_required;
  end if;
  if r.sqf_reference <> '2.3.2.8' then
    raise exception 'FRM-206 sqf_reference is %.', r.sqf_reference;
  end if;
  if r.sections <> 5 then raise exception 'FRM-206 has % sections, expected 5.', r.sections; end if;
  if r.fields <> 30 then
    raise exception 'FRM-206 has % fields, expected 30.', r.fields;
  end if;
  if r.sigs <> 1 then raise exception 'FRM-206 needs one verifier signature, has %.', r.sigs; end if;

  -- the entries list IS the register, so those three fields must be surfaced on it
  if r.listed <> 3 then
    raise exception 'FRM-206 should surface exactly service, provider and status in the entries list, has %.',
      r.listed;
  end if;

  -- the training limb is the one the finding was about; it cannot be optional
  if not exists (select 1 from jsonb_array_elements(
                   (select content->'form_schema'->'sections' from public.sop_documents
                     where sop_number = 'FRM-206')) s, jsonb_array_elements(s->'fields') f
                  where f->>'id' = 'training_requirements' and (f->>'required')::boolean) then
    raise exception 'The training requirements field is not required; that is the limb 2.3.2.8 was raised on.';
  end if;
  -- and nothing may pre-populate services the site does not buy
  if (select (content->'form_schema')::text from public.sop_documents where sop_number = 'FRM-206')
     like '%"labels"%' then
    raise exception 'FRM-206 carries fixed rows; the register must not assert services the site does not use.';
  end if;

  raise notice 'FRM-206 seeded as a draft: 5 sections, % fields, entries list carries the register columns.',
    r.fields;
end $verify$;

commit;
