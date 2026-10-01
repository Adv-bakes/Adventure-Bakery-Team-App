-- FRM-905 / FRM-906 v4: no host signature. The visitor signs in alone at the entrance tablet.
--
-- v3 (20261001000002) ended every sign-in with the host confirming, on a tablet the host was logged
-- into. Tried at the door on the day it went live, that step was the one that did not belong: it
-- needs a member of staff present and logged in for every arrival. The tablet now runs as a kiosk
-- account (20261001000005) and nobody from the site takes part in the sign-in.
--
-- WHAT MOVES WHERE:
--   - FRM-905 host_signature is removed. What the host attested - jewellery and loose objects
--     removed (11.3.4.2), protective clothing worn, staff entrance and handwashing (11.3.4.4) - is
--     now part of the statement the VISITOR signs, beside their health declaration (11.3.4.3).
--     The record rests on the visitor's own signed declaration.
--   - FRM-905 host stays, required: the visitor says who they are here to see.
--   - FRM-906 briefed_by is removed. The visitor reads the rules and signs for them; nobody
--     briefs them in person, and a signature line for somebody who is not there is not evidence.
--
-- Nothing else changes: same sections, same rules, same health questions, same field ids.
--
-- BUMPING FRM-906 MEANS THE v3 ACKNOWLEDGEMENTS ARE SIGNED ONCE MORE. v3 was live for a matter of
-- hours, so this is the handful of people who tried it that day.
--
-- Existing entries keep rendering against their own revision's snapshot in sop_document_history.

begin;

do $$
declare
  r record;
begin
  select
    (select status   from public.sop_documents where sop_number = 'FRM-905') as s905,
    (select status   from public.sop_documents where sop_number = 'FRM-906') as s906,
    (select revision from public.sop_documents where sop_number = 'FRM-905') as r905,
    (select revision from public.sop_documents where sop_number = 'FRM-906') as r906
  into r;

  if r.s905 is distinct from 'active' or r.s906 is distinct from 'active' then
    raise exception 'Expected both visitor forms active; found FRM-905=%, FRM-906=%.', r.s905, r.s906;
  end if;
  if r.r905 is distinct from 'v3' or r.r906 is distinct from 'v3' then
    raise exception 'Expected both at revision v3; found FRM-905=%, FRM-906=%. Re-derive before applying.',
      r.r905, r.r906;
  end if;
end $$;

create temporary table _visitor_before on commit drop as
  select d.sop_number, d.content->'attachments' as attachments,
         (select array_agg(f->>'id' order by f->>'id')
            from jsonb_array_elements(d.content->'form_schema'->'sections') s,
                 jsonb_array_elements(s->'fields') f) as field_ids
    from public.sop_documents d where d.sop_number in ('FRM-905', 'FRM-906');

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
          "required": true,
          "showInList": true,
          "options": [
            "Contractor / maintenance",
            "Audit or inspection",
            "Supplier",
            "Customer",
            "Pest control",
            "Delivery",
            "Other"
          ]
        },
        {
          "id": "host",
          "type": "text",
          "label": "Host (the employee the visitor is here to see, responsible for them on site)",
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
      "id": "health",
      "title": "Health declaration — every visit",
      "fields": [
        {
          "id": "health_info",
          "type": "info",
          "label": "Why we ask",
          "text": "SQF 11.3.4.3 requires that visitors showing visible signs of illness are not permitted into any area where food is handled or processed. The same rules apply to our own staff. This declaration is made at every visit."
        },
        {
          "id": "no_symptoms",
          "type": "pass_fail",
          "width": "full",
          "required": true,
          "naAllowed": false,
          "labels": {
            "pass": "Yes — none of these",
            "fail": "No — I have one of these"
          },
          "label": "I have none of the following today: vomiting, diarrhoea, jaundice, fever with sore throat, discharge from the eyes, ears or nose, or an infected wound, boil or sore"
        },
        {
          "id": "wounds_covered",
          "type": "pass_fail",
          "width": "full",
          "required": true,
          "labels": {
            "pass": "Yes — covered",
            "fail": "No — not covered",
            "na": "No cuts or grazes"
          },
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
      "id": "entry",
      "title": "Entry",
      "fields": [
        {
          "id": "entry_info",
          "type": "info",
          "label": "Before entry",
          "text": "11.3.4.1 gives two routes into a food handling area: the visitor is briefed on the site's food safety and hygiene rules, or the visitor is escorted at all times by an authorized employee. The briefing is the FRM-906 acknowledgement, signed on the first visit and valid for twelve months or until FRM-906 is revised. The acknowledgement this visit relies on is recorded below. A visitor without a valid acknowledgement is NOT left unaccompanied."
        },
        {
          "id": "ack_date",
          "type": "date",
          "label": "FRM-906 acknowledgement signed on",
          "width": "third"
        },
        {
          "id": "ack_response_id",
          "type": "text",
          "label": "FRM-906 entry reference",
          "width": "third"
        },
        {
          "id": "entry_route",
          "type": "select",
          "label": "Route under 11.3.4.1",
          "width": "third",
          "required": true,
          "options": [
            "Briefed — FRM-906 completed and signed",
            "Escorted at all times by an authorized employee",
            "Both",
            "Entry refused"
          ]
        },
        {
          "id": "escort_name",
          "type": "text",
          "label": "Escort, where escorted",
          "width": "half"
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
          "capture": "drawn",
          "label": "Visitor",
          "width": "full",
          "required": true,
          "statement": "My health declaration above is true today. If I am admitted: I have removed jewellery and loose objects (11.3.4.2); I will wear the protective clothing issued to me — hairnet, beard cover where applicable, lab coat, footwear; I will enter and leave by the staff entrance and wash my hands on entering (11.3.4.4); and I will follow the site's food safety and hygiene rules for the whole of my visit."
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
       revision = 'v4',
       effective_date = date '2026-10-01'
 where sop_number = 'FRM-905'
   and status = 'active'
   and revision = 'v3';

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
        },
        {
          "id": "phone",
          "type": "text",
          "label": "Phone number, or its last four digits (optional)",
          "width": "third",
          "maxLength": 30,
          "help": "Only used so you can find yourself at your next visit."
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
          "text": "Adventure Bakery makes food. Everything below exists to keep what we make safe for the people who eat it. Read these rules, ask your host if anything is unclear, and sign at the bottom to confirm you have understood them.\n\nThis briefing is what SQF 11.3.4.1 requires before a visitor enters a food handling area. You sign it on your first visit; it stays valid for twelve months, or until these rules are revised, and you will be asked to read and sign it again after that. If you have not been briefed, you must be escorted at all times instead."
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
              "Sign in on FRM-905 at every visit, before entering any food handling, processing or storage area."
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
              "Do not enter if you have any symptom of illness. You make a health declaration on FRM-905 at every visit."
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
      "id": "acknowledgement",
      "title": "Acknowledgement",
      "fields": [
        {
          "id": "ack_statement",
          "type": "info",
          "label": "Acknowledgement",
          "text": "I have read and understood the food safety and hygiene rules above. I will follow them on every visit while this acknowledgement is valid, and I will do what my host asks of me while I am on site. I understand that not following them means being asked to leave the production areas."
        },
        {
          "id": "visitor_signature",
          "type": "signature",
          "capture": "drawn",
          "label": "Visitor",
          "width": "full",
          "required": true
        },
        {
          "id": "retention_note",
          "type": "info",
          "label": "Retention",
          "text": "This acknowledgement is valid for twelve months from the date above, or until FRM-906 is revised. It is retained by QA for a minimum of twelve months after the last visit that relied on it (FSQM-012 Part 6)."
        }
      ]
    }
  ]
}
$j906$::jsonb),
       revision = 'v4',
       effective_date = date '2026-10-01'
 where sop_number = 'FRM-906'
   and status = 'active'
   and revision = 'v3';

do $$
declare
  r record;
begin
  select
    (select revision from public.sop_documents where sop_number = 'FRM-905') as r905,
    (select revision from public.sop_documents where sop_number = 'FRM-906') as r906,
    (select count(*) from public.sop_documents d,
                          jsonb_array_elements(d.content->'form_schema'->'sections') s,
                          jsonb_array_elements(s->'fields') f
      where d.sop_number in ('FRM-905', 'FRM-906') and f->>'type' = 'signature')     as signatures,
    (select count(*) from public.sop_documents d,
                          jsonb_array_elements(d.content->'form_schema'->'sections') s,
                          jsonb_array_elements(s->'fields') f
      where d.sop_number in ('FRM-905', 'FRM-906') and f->>'type' = 'signature'
        and f->>'id' = 'visitor_signature' and f->>'capture' = 'drawn'
        and (f->>'required')::boolean)                                                as visitor_signatures,
    -- the visitor's statement must carry what the host used to attest
    (select f->>'statement' like '%11.3.4.2%' and f->>'statement' like '%11.3.4.4%'
       from public.sop_documents d,
            jsonb_array_elements(d.content->'form_schema'->'sections') s,
            jsonb_array_elements(s->'fields') f
      where d.sop_number = 'FRM-905' and f->>'id' = 'visitor_signature')              as declares,
    (select (f->>'required')::boolean
       from public.sop_documents d,
            jsonb_array_elements(d.content->'form_schema'->'sections') s,
            jsonb_array_elements(s->'fields') f
      where d.sop_number = 'FRM-905' and f->>'id' = 'host')                           as host_required,
    (select jsonb_array_length(f->'rows')
       from public.sop_documents d,
            jsonb_array_elements(d.content->'form_schema'->'sections') s,
            jsonb_array_elements(s->'fields') f
      where d.sop_number = 'FRM-906' and f->>'id' = 'rules_table')                    as rules,
    -- exactly the two host signature fields went, and nothing else
    (select count(*) from _visitor_before b
       join public.sop_documents d on d.sop_number = b.sop_number
      where (select array_agg(x order by x) from unnest(b.field_ids) x
              where x not in ('host_signature', 'briefed_by'))
            is distinct from
            (select array_agg(f->>'id' order by f->>'id')
               from jsonb_array_elements(d.content->'form_schema'->'sections') s,
                    jsonb_array_elements(s->'fields') f))                             as fields_changed,
    (select count(*) from public.sop_documents d
       join _visitor_before b on b.sop_number = d.sop_number
      where d.content->'attachments' is distinct from b.attachments)                  as attachments_changed
  into r;

  if r.r905 <> 'v4' or r.r906 <> 'v4' then
    raise exception 'Revisions did not bump: FRM-905=%, FRM-906=%.', r.r905, r.r906;
  end if;
  if r.signatures <> 2 or r.visitor_signatures <> 2 then
    raise exception 'Expected one required drawn visitor signature per form and no other; found % signatures, % of them the visitor''s.',
      r.signatures, r.visitor_signatures;
  end if;
  if not r.declares then
    raise exception 'FRM-905: the visitor statement does not carry 11.3.4.2 and 11.3.4.4.';
  end if;
  if not r.host_required then
    raise exception 'FRM-905: host is no longer required.';
  end if;
  if r.rules <> 10 then
    raise exception 'FRM-906 carries % rules, expected 10.', r.rules;
  end if;
  if r.fields_changed <> 0 then
    raise exception 'Field ids changed beyond removing the two host signatures on % form(s).', r.fields_changed;
  end if;
  if r.attachments_changed <> 0 then
    raise exception 'Attachments changed on % visitor form(s).', r.attachments_changed;
  end if;
end $$;

commit;
