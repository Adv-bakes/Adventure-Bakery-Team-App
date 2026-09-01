-- D-13 task 13.3: make FRM-905 and FRM-906 fillable.
--
-- Both have been active since 2026-07-12 as Word and PDF attachments with no form_schema and zero
-- entries - documents the quality system names but nobody can fill in the app. FSQM-012 Part 6,
-- issued yesterday, requires every visitor to sign in on FRM-905 and to read and acknowledge the
-- rules on FRM-906 before entering. That requirement has had no working record behind it.
--
-- TWO FORMS, NOT ONE - THE OWNER'S CALL, AND IT COSTS FSQM-012 NOTHING. Merging them into a single
-- visitor record was the alternative and is what the remediation plan sketches, but FSQM-012 Part 6
-- names both forms and describes exactly this split; keeping them separate means the program issued
-- yesterday needs no revision, and nothing is archived. The cost is two entries per arrival.
--
-- WHAT EACH ONE IS FOR, since the split only works if the boundary is clean:
--   FRM-905 is the REGISTER - who was on site, when, with whom, and that the entry conditions were
--           met. Completed by the HOST, before the visitor enters.
--   FRM-906 is the BRIEFING AND WHAT WAS ACKNOWLEDGED - the rules themselves, a health declaration,
--           and the visitor's signature against them. Completed by the VISITOR.
--
-- ONE ENTRY PER VISIT, NOT A DAILY GRID. A paper sign-in sheet is a grid because paper is a page;
-- here the Entries list IS the log, and one entry per visitor gives each arrival its own signature,
-- its own health declaration and its own timestamps. A grid row cannot hold a signature field.
--
-- FRM-906 CARRIES THE RULES IT ASKS PEOPLE TO ACKNOWLEDGE. A signed acknowledgement that does not
-- show what was acknowledged is weak evidence, and 11.3.4.1 treats the briefing as the thing that
-- lets an unescorted visitor in at all. The ten rules are a reference_table drawn from FSQM-012
-- Part 6, so the program and the form cannot drift into saying different things - a visitor reads
-- them immediately above where they sign.
--
-- FRM-905 RECORDS WHICH ROUTE UNDER 11.3.4.1 WAS USED. The clause offers two - brief the visitor,
-- or escort them at all times - and a site must be able to say which applied to a given person on a
-- given day. "entry_route" is a required select with exactly those options plus Both, so the answer
-- is on the record rather than inferred from whether a 906 happens to exist.
--
-- The entry-condition checks map one to one onto the clauses: no visible signs of illness
-- (11.3.4.3), jewellery and loose objects removed (11.3.4.2), PPE issued and worn, and entry via
-- the staff entrance with handwashing (11.3.4.4). All four are required, so an incomplete entry
-- cannot be submitted.
--
-- ENTRY TITLES LEAD WITH LITERAL TEXT. A template of purely field tokens renders as an empty string
-- - or worse, as stray punctuation - on a draft nobody has typed into yet; "Visitor" and
-- "Acknowledgement" are what a half-started entry shows in the list. Tested both states.
--
-- Revisions bump New -> v2 with today's effective date on both. These are ACTIVE controlled forms
-- and their content is changing from an attachment to a fillable schema, which is exactly the drift
-- INT-14's report looks for when revision and content disagree. The Word and PDF attachments stay:
-- they are the printed originals, and nothing here removes them.
--
-- Written with jsonb_set on the form_schema key alone, so content->'attachments' is never in the
-- write path. Guarded on both forms being active at revision New with no schema and no entries -
-- adding a schema under existing entries would be a different and much more careful operation.

begin;

do $$
declare
  r record;
begin
  select
    (select status   from public.sop_documents where sop_number = 'FRM-905')          as s905,
    (select status   from public.sop_documents where sop_number = 'FRM-906')          as s906,
    (select revision from public.sop_documents where sop_number = 'FRM-905')          as r905,
    (select revision from public.sop_documents where sop_number = 'FRM-906')          as r906,
    (select (content ? 'form_schema') from public.sop_documents where sop_number = 'FRM-905') as f905,
    (select (content ? 'form_schema') from public.sop_documents where sop_number = 'FRM-906') as f906,
    (select count(*) from public.sop_document_responses p
       join public.sop_documents d on d.id = p.document_id
      where d.sop_number in ('FRM-905','FRM-906'))                                    as entries,
    (select jsonb_array_length(content->'attachments')
       from public.sop_documents where sop_number = 'FRM-905')                        as a905,
    (select jsonb_array_length(content->'attachments')
       from public.sop_documents where sop_number = 'FRM-906')                        as a906
  into r;

  if r.s905 is distinct from 'active' or r.s906 is distinct from 'active' then
    raise exception 'Expected both visitor forms active; found FRM-905=%, FRM-906=%.', r.s905, r.s906;
  end if;
  if r.r905 is distinct from 'New' or r.r906 is distinct from 'New' then
    raise exception 'Expected both at revision New; found FRM-905=%, FRM-906=%. Re-derive before applying.',
      r.r905, r.r906;
  end if;
  if r.f905 or r.f906 then
    raise exception 'A visitor form already has a form_schema: FRM-905=%, FRM-906=%.', r.f905, r.f906;
  end if;
  if r.entries <> 0 then
    raise exception 'The visitor forms have % entries. Adding a schema under existing entries is a different operation - stop and re-derive.', r.entries;
  end if;
  if r.a905 is null or r.a906 is null then
    raise exception 'A visitor form has no attachments list: FRM-905=%, FRM-906=%.', r.a905, r.a906;
  end if;
end $$;

update public.sop_documents
   set content = jsonb_set(content, '{form_schema}', $j905$
{
  "settings": {
    "attachmentsEnabled": true,
    "allowMultipleDrafts": true,
    "requireVerification": false,
    "instanceTitleTemplate": "Visitor — {visit_date} — {visitor_name}"
  },
  "sections": [
    {
      "id": "visit",
      "title": "Visit",
      "fields": [
        {
          "id": "visit_date",
          "type": "date",
          "label": "Date",
          "width": "third",
          "required": true,
          "showInList": true,
          "defaultToday": true
        },
        {
          "id": "visitor_name",
          "type": "text",
          "label": "Visitor name",
          "width": "third",
          "required": true,
          "showInList": true
        },
        {
          "id": "company",
          "type": "text",
          "label": "Company / organisation",
          "width": "third",
          "showInList": true
        },
        {
          "id": "purpose",
          "type": "select",
          "label": "Purpose of visit",
          "width": "half",
          "options": [
            "Contractor / maintenance",
            "Audit or inspection",
            "Supplier",
            "Customer",
            "Pest control",
            "Delivery",
            "Other"
          ],
          "required": true,
          "allowOther": true,
          "showInList": true
        },
        {
          "id": "host",
          "type": "text",
          "label": "Host (authorized employee responsible for this visitor)",
          "width": "half",
          "required": true
        },
        {
          "id": "areas",
          "type": "text",
          "label": "Areas entered",
          "width": "full",
          "help": "Production floor, packaging, storage, etc. Visitors remain within approved areas only."
        },
        {
          "id": "time_in",
          "type": "time",
          "label": "Time in",
          "width": "third",
          "required": true
        },
        {
          "id": "time_out",
          "type": "time",
          "label": "Time out",
          "width": "third"
        }
      ]
    },
    {
      "id": "entry_note",
      "title": "Before entry",
      "fields": [
        {
          "id": "entry_info",
          "type": "info",
          "label": "Before entry",
          "text": "11.3.4.1 gives two routes into a food handling area and the site must use one of them: the visitor is briefed on the site's food safety and hygiene rules, or the visitor is escorted at all times by an authorized employee. Record which applies. A visitor who has not completed the FRM-906 briefing is NOT left unaccompanied.\n\nThe host completes this section before the visitor enters, not afterwards."
        },
        {
          "id": "entry_route",
          "type": "select",
          "width": "half",
          "required": true,
          "label": "Route under 11.3.4.1",
          "options": [
            "Briefed — FRM-906 completed and signed",
            "Escorted at all times by an authorized employee",
            "Both"
          ]
        },
        {
          "id": "escort_name",
          "type": "text",
          "label": "Escort, where escorted",
          "width": "half"
        },
        {
          "id": "no_illness",
          "type": "pass_fail",
          "width": "half",
          "required": true,
          "label": "No visible signs of illness (11.3.4.3)"
        },
        {
          "id": "jewellery_removed",
          "type": "pass_fail",
          "width": "half",
          "required": true,
          "label": "Jewellery and loose objects removed (11.3.4.2)"
        },
        {
          "id": "ppe_issued",
          "type": "pass_fail",
          "width": "half",
          "required": true,
          "label": "PPE issued and worn — hairnet, beard cover where applicable, lab coat, footwear"
        },
        {
          "id": "entry_point",
          "type": "pass_fail",
          "width": "half",
          "required": true,
          "label": "Entered via the staff entrance and washed hands (11.3.4.4)"
        },
        {
          "id": "entry_notes",
          "type": "textarea",
          "label": "Notes",
          "width": "full",
          "help": "Anything refused, restricted, or worth recording about this visit"
        }
      ]
    },
    {
      "id": "signoff",
      "title": "Sign-off",
      "fields": [
        {
          "id": "visitor_signature",
          "type": "signature",
          "label": "Visitor",
          "width": "half",
          "required": true
        },
        {
          "id": "host_signature",
          "type": "signature",
          "label": "Host",
          "width": "half",
          "required": true
        },
        {
          "id": "retention_note",
          "type": "info",
          "label": "Retention",
          "text": "Completed visitor records are retained by QA for a minimum of twelve months (FSQM-012 Part 6)."
        }
      ]
    }
  ]
}
$j905$::jsonb),
       revision = 'v2',
       effective_date = date '2026-09-01'
 where sop_number = 'FRM-905'
   and status = 'active'
   and revision = 'New';

update public.sop_documents
   set content = jsonb_set(content, '{form_schema}', $j906$
{
  "settings": {
    "attachmentsEnabled": true,
    "allowMultipleDrafts": true,
    "requireVerification": false,
    "instanceTitleTemplate": "Acknowledgement — {ack_date} — {visitor_name}"
  },
  "sections": [
    {
      "id": "visitor",
      "title": "Visitor",
      "fields": [
        {
          "id": "ack_date",
          "type": "date",
          "label": "Date",
          "width": "third",
          "required": true,
          "showInList": true,
          "defaultToday": true
        },
        {
          "id": "visitor_name",
          "type": "text",
          "label": "Visitor name",
          "width": "third",
          "required": true,
          "showInList": true
        },
        {
          "id": "company",
          "type": "text",
          "label": "Company / organisation",
          "width": "third",
          "showInList": true
        }
      ]
    },
    {
      "id": "rules",
      "title": "Food Safety and Hygiene Rules",
      "fields": [
        {
          "id": "rules_intro",
          "type": "info",
          "label": "Please read before entering",
          "text": "Adventure Bakery makes food. Everything below exists to keep what we make safe for the people who eat it. Read these rules, ask your host if anything is unclear, and sign at the bottom to confirm you have understood them.\n\nThis briefing is what SQF 11.3.4.1 requires before a visitor enters a food handling area. If you have not been briefed, you must be escorted at all times instead."
        },
        {
          "id": "rules_table",
          "type": "reference_table",
          "label": "The rules",
          "columns": [
            "#",
            "Rule"
          ],
          "rows": [
            [
              "1",
              "Sign in on FRM-905 before entering any food handling, processing or storage area."
            ],
            [
              "2",
              "Remove jewellery and other loose objects. Plain wedding bands with no stones are the only exception. This applies to management staff equally."
            ],
            [
              "3",
              "Wear the protective clothing issued at entry — hairnet covering all hair with both ears covered, beard cover where applicable, lab coat, and shoe covers or dedicated footwear."
            ],
            [
              "4",
              "Wash your hands on entering a food handling or processing area, after using a toilet, after eating, drinking or smoking, and after touching anything that is not clean."
            ],
            [
              "5",
              "Enter and exit through the staff entrance points only."
            ],
            [
              "6",
              "Do not eat, drink, chew gum, smoke or spit anywhere product is made, stored or exposed."
            ],
            [
              "7",
              "Remain within the areas your host has approved."
            ],
            [
              "8",
              "Do not touch ingredients, packaging, product or equipment unless the SQF Practitioner has authorized you to."
            ],
            [
              "9",
              "Do not enter if you have any symptom of illness — see the health declaration below."
            ],
            [
              "10",
              "Contractors: agree your work area and its segregation with the SQF Practitioner or Supervisor before starting; account for all tools, parts and materials before and after the work; and if the work introduces glass or brittle plastic, it must be recorded on FRM-907 under SOP-11.7.3."
            ]
          ]
        }
      ]
    },
    {
      "id": "health",
      "title": "Health Declaration",
      "fields": [
        {
          "id": "health_info",
          "type": "info",
          "label": "Why we ask",
          "text": "SQF 11.3.4.3 requires that visitors showing visible signs of illness are not permitted into any area where food is handled or processed. The same rules apply to our own staff."
        },
        {
          "id": "no_symptoms",
          "type": "pass_fail",
          "width": "full",
          "required": true,
          "label": "I have none of the following today: vomiting, diarrhoea, jaundice, fever with sore throat, discharge from the eyes, ears or nose, or an infected wound, boil or sore"
        },
        {
          "id": "wounds_covered",
          "type": "pass_fail",
          "width": "half",
          "required": true,
          "label": "Any cut or graze on my hands or exposed skin is covered with the dressing provided"
        },
        {
          "id": "health_notes",
          "type": "textarea",
          "label": "Anything the host should know",
          "width": "full"
        }
      ]
    },
    {
      "id": "acknowledgement",
      "title": "Acknowledgement",
      "fields": [
        {
          "id": "ack_statement",
          "type": "info",
          "label": "Acknowledgement",
          "text": "I have read and understood the food safety and hygiene rules above. I will follow them for the whole of my visit, and I will do what my host asks of me while I am on site. I understand that not following them means being asked to leave the production areas."
        },
        {
          "id": "visitor_signature",
          "type": "signature",
          "label": "Visitor",
          "width": "half",
          "required": true
        },
        {
          "id": "briefed_by",
          "type": "signature",
          "label": "Briefed by (host)",
          "width": "half",
          "required": true
        },
        {
          "id": "retention_note",
          "type": "info",
          "label": "Retention",
          "text": "Completed visitor records are retained by QA for a minimum of twelve months (FSQM-012 Part 6)."
        }
      ]
    }
  ]
}
$j906$::jsonb),
       revision = 'v2',
       effective_date = date '2026-09-01'
 where sop_number = 'FRM-906'
   and status = 'active'
   and revision = 'New';

do $$
declare
  r record;
begin
  select
    (select revision from public.sop_documents where sop_number = 'FRM-905')          as r905,
    (select revision from public.sop_documents where sop_number = 'FRM-906')          as r906,
    (select jsonb_array_length(content->'form_schema'->'sections')
       from public.sop_documents where sop_number = 'FRM-905')                        as sec905,
    (select jsonb_array_length(content->'form_schema'->'sections')
       from public.sop_documents where sop_number = 'FRM-906')                        as sec906,
    (select jsonb_array_length(content->'attachments')
       from public.sop_documents where sop_number = 'FRM-905')                        as a905,
    (select jsonb_array_length(content->'attachments')
       from public.sop_documents where sop_number = 'FRM-906')                        as a906,
    -- the signatures are the point of both forms
    (select count(*) from public.sop_documents d,
                          jsonb_array_elements(d.content->'form_schema'->'sections') s,
                          jsonb_array_elements(s->'fields') f
      where d.sop_number = 'FRM-905' and f->>'type' = 'signature')                    as sig905,
    (select count(*) from public.sop_documents d,
                          jsonb_array_elements(d.content->'form_schema'->'sections') s,
                          jsonb_array_elements(s->'fields') f
      where d.sop_number = 'FRM-906' and f->>'type' = 'signature')                    as sig906,
    -- FRM-906 must carry the rules it asks people to acknowledge
    (select jsonb_array_length(f->'rows')
       from public.sop_documents d,
            jsonb_array_elements(d.content->'form_schema'->'sections') s,
            jsonb_array_elements(s->'fields') f
      where d.sop_number = 'FRM-906' and f->>'id' = 'rules_table')                    as rules,
    -- FRM-905 must record which route under 11.3.4.1 was used
    (select jsonb_array_length(f->'options')
       from public.sop_documents d,
            jsonb_array_elements(d.content->'form_schema'->'sections') s,
            jsonb_array_elements(s->'fields') f
      where d.sop_number = 'FRM-905' and f->>'id' = 'entry_route')                    as routes,
    (select content::text like '%Escorted at all times by an authorized employee%'
       from public.sop_documents where sop_number = 'FRM-905')                        as escort_option,
    (select content::text like '%11.3.4.3%'
       from public.sop_documents where sop_number = 'FRM-905')                        as illness_clause
  into r;

  if r.r905 <> 'v2' or r.r906 <> 'v2' then
    raise exception 'Revisions did not bump: FRM-905=%, FRM-906=%.', r.r905, r.r906;
  end if;
  if r.sec905 <> 3 or r.sec906 <> 4 then
    raise exception 'Section counts wrong: FRM-905=% (expected 3), FRM-906=% (expected 4).',
      r.sec905, r.sec906;
  end if;
  if r.sig905 <> 2 or r.sig906 <> 2 then
    raise exception 'Signature fields wrong: FRM-905=%, FRM-906=% (expected 2 each).', r.sig905, r.sig906;
  end if;
  if r.rules <> 10 then
    raise exception 'FRM-906 carries % rules, expected 10 - it must show what it asks people to acknowledge.', r.rules;
  end if;
  if r.routes <> 3 or not r.escort_option then
    raise exception 'FRM-905 does not record the 11.3.4.1 route: % options, escort option present=%.',
      r.routes, r.escort_option;
  end if;
  if not r.illness_clause then
    raise exception 'FRM-905 does not carry the 11.3.4.3 illness check.';
  end if;
  -- jsonb_set wrote only form_schema; the printed originals must be untouched
  if r.a905 <> 2 or r.a906 <> 2 then
    raise exception 'Attachments changed: FRM-905=% (expected 2), FRM-906=% (expected 2).',
      r.a905, r.a906;
  end if;
end $$;

commit;
