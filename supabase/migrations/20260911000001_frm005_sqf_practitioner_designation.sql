-- D-02 - FRM-005 SQF Practitioner Designation Record, seeded DRAFT.
--
-- WHAT 2.1.1.4 REQUIRES IS AN ACT, AND AN ACT NEEDS A RECORD. Senior site management designates a
-- primary and substitute SQF Practitioner. The gap assessment found the practitioner assigned by name
-- in FSQM-003 and no substitute at all. This form is where the designation is made and evidenced.
--
-- DOCUMENTS NAME POSITIONS; RECORDS NAME PEOPLE. The consultant's improvement note was to take
-- employee names out of documentation so that personnel changes do not force revisions, and FSQM-004
-- refuses by guard to name anyone. A designation is inherently about people, so the names live in this
-- form's ENTRIES - dated and signed - and never in its definition. The post-guard below refuses the
-- schema if it names a person, for the same reason FSQM-004's does. A change of personnel becomes a new
-- entry; the entries in order are the history of who held the authority, and when.
--
-- ONLY SENIOR SITE MANAGEMENT CAN SIGN THE DESIGNATION, and that is enforced rather than stated.
-- designated_by is a verifier-role signature, which SignatureFieldInput allows only for admin or owner,
-- and it is required - so an entry cannot be submitted until senior management has signed it.
--
-- THE ACKNOWLEDGEMENTS ARE DELIBERATELY NOT REQUIRED, and the reason is in the RLS rather than in the
-- Code. Response policy lets a staff login update only drafts it created; admin and owner can update
-- anything. So the primary starts the entry and signs, and senior management completes it. But if the
-- substitute were ever a second staff member, they could never sign an entry the primary began, and a
-- required acknowledgement would make that designation impossible to submit. A rule the site cannot
-- always follow is worse than a weaker one it can.
--
-- 2.1.1.5 IS ANSWERED LIMB BY LIMB, PER PERSON, WITH PENDING AS A FIRST-CLASS ANSWER. Neither
-- designee has yet completed a HACCP training course - both are to book one - so the first entry will
-- honestly read Pending on limb iii for both. The form says in terms that Pending is not a failure and
-- that writing Met to avoid it would be. Ten required selects rather than a grid: gridZod only enforces
-- a column's required on rows the filler started, so a grid would validate with a limb left blank.
--
-- THE CERTIFICATES ARE NOT FILED HERE. FRM-952 Training Competency Verification Record is already the
-- per-person competency record, and FRM-005 points at it. Two places to file one certificate would be
-- two accounts of one qualification - the reason FRM-008 was deleted before issue.

begin;

do $$
declare r record;
begin
  select
    (select count(*) from public.sop_documents where sop_number = 'FRM-005')             as exists_005,
    (select status from public.sop_documents where sop_number = 'FRM-952')               as s952,
    (select count(*) from public.sop_documents where content::text like '%FRM-005%')     as cited
  into r;
  if r.exists_005 <> 0 then
    raise exception 'FRM-005 already exists.';
  end if;
  -- The form sends people to FRM-952 for the certificate; it must be there to send them to.
  if r.s952 is distinct from 'active' then
    raise exception 'FRM-952 is %, expected active - FRM-005 points at it for the HACCP certificate.', r.s952;
  end if;
  if r.cited <> 0 then
    raise exception '% document(s) already cite FRM-005; the number is not free.', r.cited;
  end if;
end $$;

insert into public.sop_documents
  (sop_number, title, type, category, status, revision, sqf_reference, sqf_required, content)
values (
  'FRM-005',
  'SQF Practitioner Designation Record',
  'form',
  'Module 2',
  'draft',
  'New',
  '2.1.1.4, 2.1.1.5',
  true,
  jsonb_build_object('form_schema', $j05${"settings": {"deletable": false, "attachmentsEnabled": true, "allowMultipleDrafts": false, "requireVerification": true, "instanceTitleTemplate": "{effective_date} — {primary_name} / {substitute_name}"}, "sections": [{"id": "designation", "title": "1. Designation", "fields": [{"id": "how_this_works", "type": "info", "label": "How this record works", "text": "ONE ENTRY IS ONE DESIGNATION. Make a new entry whenever the primary or the substitute changes, and at least once a year to confirm the designation in force. Earlier entries are never edited: they are the history of who held the authority, and when.\n\nTHIS RECORD NAMES PEOPLE SO THE DOCUMENTS DO NOT HAVE TO. FSQM-004 and every other controlled document name the position, not the person. The individuals holding it are recorded here, so a change of personnel is a new entry rather than a document revision.\n\nWHO SIGNS WHAT. Each acknowledgement is signed by the person named, in their own login. Only senior site management can sign the designation itself, and the app enforces that. A staff login can edit only an entry it started, so the person designated primary should start this entry and sign first; senior site management then completes and submits it.\n\nSENIOR SITE MANAGEMENT MAY ALSO BE THE SUBSTITUTE. 2.1.1.4 makes the designation senior site management's act and does not stop it naming itself, and in a small site it often has to. Where that is the case the same person signs both, and the record should show it as it is."}, {"id": "effective_date", "type": "date", "width": "half", "required": true, "defaultToday": true, "showInList": true, "label": "Effective date"}, {"id": "reason", "type": "select", "width": "half", "required": true, "label": "Reason", "options": ["First designation", "Change of primary SQF Practitioner", "Change of substitute SQF Practitioner", "Annual confirmation - no change"]}, {"id": "primary_name", "type": "text", "width": "half", "required": true, "showInList": true, "label": "Primary SQF Practitioner"}, {"id": "primary_position", "type": "text", "width": "half", "required": true, "label": "Position held", "help": "The post in FSQM-004 this person holds."}, {"id": "substitute_name", "type": "text", "width": "half", "required": true, "showInList": true, "label": "Substitute SQF Practitioner"}, {"id": "substitute_position", "type": "text", "width": "half", "required": true, "label": "Position held", "help": "The post in FSQM-004 this person holds."}]}, {"id": "authority", "title": "2. Responsibility and authority (2.1.1.4)", "fields": [{"id": "authority_info", "type": "info", "label": "What is designated", "text": "The primary and the substitute SQF Practitioner are given the responsibility and authority to:\ni. oversee how the SQF System is developed, put in place, reviewed and kept up;\nii. act to protect the integrity of the SQF System; and\niii. make sure the people who need it are told what keeps the SQF System working.\n\nThe substitute holds the same responsibility and authority whenever the primary is absent. The duties of the post are set out in FSQM-004. This record confers the authority; it does not restate the job."}, {"id": "informed", "type": "pass_fail", "width": "half", "required": true, "label": "Both designees have been told of this responsibility and authority"}]}, {"id": "primary_qual", "title": "3. Primary SQF Practitioner - qualification (2.1.1.5)", "fields": [{"id": "p_info", "type": "info", "label": "How to answer", "text": "Answer each point for the person named as primary. PENDING IS AN HONEST ANSWER and is expected while training is outstanding - it is not a failure, and writing Met to avoid it would be.\n\nPoint iii means a recognised external HACCP course with a certificate. File the certificate on FRM-952 Training Competency Verification Record and note the reference below. The internal TRN-005 training module is awareness training for the floor and is not a HACCP course."}, {"id": "p_employed", "type": "select", "width": "half", "required": true, "label": "i. Employed by the site", "options": ["Met", "Pending"]}, {"id": "p_position", "type": "select", "width": "half", "required": true, "label": "ii. Holds a position of responsibility for managing the SQF System", "options": ["Met", "Pending"]}, {"id": "p_haccp", "type": "select", "width": "half", "required": true, "label": "iii. Has completed a HACCP training course", "options": ["Met", "Pending"]}, {"id": "p_competent", "type": "select", "width": "half", "required": true, "label": "iv. Competent to implement and maintain HACCP-based food safety plans", "options": ["Met", "Pending"]}, {"id": "p_code", "type": "select", "width": "half", "required": true, "label": "v. Understands the SQF Food Safety Code: Food Manufacturing as it applies here", "options": ["Met", "Pending"]}, {"id": "p_haccp_detail", "type": "text", "label": "HACCP course", "help": "Course name, provider, date completed and FRM-952 reference - or, while pending, when it is booked."}, {"id": "p_notes", "type": "textarea", "label": "Evidence for points iv and v, and anything pending", "help": "What shows the competency: experience, the course, how understanding of the Code was confirmed."}]}, {"id": "substitute_qual", "title": "4. Substitute SQF Practitioner - qualification (2.1.1.5)", "fields": [{"id": "s_info", "type": "info", "label": "How to answer", "text": "As Section 3, for the person named as substitute. The substitute must meet 2.1.1.5 in full, exactly as the primary does. It is the same qualification held in reserve, not a lesser one."}, {"id": "s_employed", "type": "select", "width": "half", "required": true, "label": "i. Employed by the site", "options": ["Met", "Pending"]}, {"id": "s_position", "type": "select", "width": "half", "required": true, "label": "ii. Holds a position of responsibility for managing the SQF System", "options": ["Met", "Pending"]}, {"id": "s_haccp", "type": "select", "width": "half", "required": true, "label": "iii. Has completed a HACCP training course", "options": ["Met", "Pending"]}, {"id": "s_competent", "type": "select", "width": "half", "required": true, "label": "iv. Competent to implement and maintain HACCP-based food safety plans", "options": ["Met", "Pending"]}, {"id": "s_code", "type": "select", "width": "half", "required": true, "label": "v. Understands the SQF Food Safety Code: Food Manufacturing as it applies here", "options": ["Met", "Pending"]}, {"id": "s_haccp_detail", "type": "text", "label": "HACCP course", "help": "Course name, provider, date completed and FRM-952 reference - or, while pending, when it is booked."}, {"id": "s_notes", "type": "textarea", "label": "Evidence for points iv and v, and anything pending", "help": "What shows the competency: experience, the course, how understanding of the Code was confirmed."}]}, {"id": "signatures", "title": "5. Signatures", "fields": [{"id": "primary_ack", "type": "signature", "role": "filler", "width": "half", "label": "Primary SQF Practitioner - acknowledgement", "statement": "I accept the designation above and the responsibility and authority it carries."}, {"id": "substitute_ack", "type": "signature", "role": "filler", "width": "half", "label": "Substitute SQF Practitioner - acknowledgement", "statement": "I accept the designation above and the responsibility and authority it carries."}, {"id": "designated_by", "type": "signature", "role": "verifier", "width": "half", "required": true, "label": "Designated by Senior Site Management", "statement": "As senior site management, I designate the primary and substitute SQF Practitioner named above, with the responsibility and authority in Section 2."}]}]}$j05$::jsonb)
);

do $$
declare r record;
begin
  select
    (select count(*) from public.sop_documents d,
            jsonb_array_elements(d.content->'form_schema'->'sections') s,
            jsonb_array_elements(s->'fields') f
      where d.sop_number = 'FRM-005')                                                    as fields,
    (select count(*) from public.sop_documents d,
            jsonb_array_elements(d.content->'form_schema'->'sections') s,
            jsonb_array_elements(s->'fields') f
      where d.sop_number = 'FRM-005' and f->>'type' = 'signature' and f->>'role' = 'verifier'
        and coalesce((f->>'required')::boolean, false))                                  as req_verifier,
    (select count(*) from public.sop_documents d,
            jsonb_array_elements(d.content->'form_schema'->'sections') s,
            jsonb_array_elements(s->'fields') f
      where d.sop_number = 'FRM-005' and f->>'type' = 'signature' and f->>'role' = 'filler'
        and not coalesce((f->>'required')::boolean, false))                              as optional_acks,
    (select count(*) from public.sop_documents d,
            jsonb_array_elements(d.content->'form_schema'->'sections') s,
            jsonb_array_elements(s->'fields') f
      where d.sop_number = 'FRM-005' and f->>'type' = 'select'
        and f->>'id' ~ '^[ps]_' and coalesce((f->>'required')::boolean, false))           as limb_selects,
    (select content->'form_schema'->'settings'->>'deletable' from public.sop_documents
      where sop_number = 'FRM-005')                                                      as deletable,
    (select content->'form_schema'->'settings'->>'allowMultipleDrafts' from public.sop_documents
      where sop_number = 'FRM-005')                                                      as multi,
    (select count(*) from public.sop_documents
      where sop_number = 'FRM-005'
        and lower(content::text) ~ '(diana|gabriela|samboni|juncos|christina)')          as names,
    (select status from public.sop_documents where sop_number = 'FRM-005')               as st,
    (select count(*) from public.sop_documents
      where sop_number = 'FRM-005' and position(chr(13) in content::text) > 0)           as crs
  into r;

  if r.fields <> 28 then
    raise exception 'FRM-005 has % fields, expected 28.', r.fields;
  end if;
  -- 2.1.1.4 is senior management's act; this is the one field that makes the form enforce it.
  if r.req_verifier <> 1 then
    raise exception 'FRM-005 needs exactly one required verifier-role signature; found %.', r.req_verifier;
  end if;
  if r.optional_acks <> 2 then
    raise exception 'Expected two optional acknowledgement signatures; found %.', r.optional_acks;
  end if;
  -- Five limbs of 2.1.1.5, per person, every one answered.
  if r.limb_selects <> 10 then
    raise exception 'Expected 10 required 2.1.1.5 limb selects; found %.', r.limb_selects;
  end if;
  if r.deletable is distinct from 'false' or r.multi is distinct from 'false' then
    raise exception 'Settings wrong (deletable=%, allowMultipleDrafts=%).', r.deletable, r.multi;
  end if;
  if r.names <> 0 then
    raise exception 'The FRM-005 definition names a person. Entries may; the form may not.';
  end if;
  if r.st is distinct from 'draft' then
    raise exception 'FRM-005 should be draft; found %.', r.st;
  end if;
  if r.crs <> 0 then raise exception 'CR characters are present in FRM-005.'; end if;
end $$;

commit;
