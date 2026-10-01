-- FRM-905 / FRM-906 v3: sign the GMP acknowledgement once, not at every visit.
--
-- v2 (20260901000016) made both forms fillable, and in use that meant two long entries for every
-- arrival: the visitor re-read all ten rules each time, and the "Visitor" signature on both was the
-- stamp of whichever member of staff was logged in - a record of the wrong person.
--
-- WHAT CHANGES, AND WHERE EACH ANSWER NOW LIVES:
--   FRM-906 is signed on the FIRST visit and stays valid for twelve months, or until FRM-906 is
--           revised. It gains an optional phone number (or its last four digits) so a returning
--           visitor can find themselves. Its health declaration moves out - health is a fact about
--           today, not about the year.
--   FRM-905 is still one entry per visit. It now carries the health declaration (illness, cuts),
--           and records WHICH acknowledgement the visit relied on (ack_date, ack_response_id), so
--           "briefed" is a pointer to a signed record rather than a claim.
--
-- THE FOUR HOST PASS/FAILS BECOME ONE HOST CONFIRMATION. no_illness, jewellery_removed, ppe_issued
-- and entry_point are retired; the host signature's statement says the same four things against
-- the same clauses (11.3.4.2, .3, .4). One signed statement instead of four taps and a signature.
-- It opens "Where entry was permitted" because a refused visit is recorded too.
--
-- "Entry refused" IS A FOURTH ROUTE. A visitor who declares a symptom is not let in (11.3.4.3), and
-- that is worth a record: the entry is written with this route, a note, and time out = time in.
--
-- THE VISITOR SIGNATURE IS DRAWN (capture = "drawn"): typed name plus a finger-drawn signature,
-- with the logged-in user recorded as witness. The host lines stay the login stamp, because the
-- host really is the logged-in user.
--
-- BUMPING FRM-906 TO v3 MEANS EVERY VISITOR SIGNS ONCE MORE. Intended: an acknowledgement is valid
-- only at the current revision, and the v2 ones carry a staff stamp where the visitor should be.
--
-- EXISTING v2 ENTRIES ARE UNTOUCHED. The snapshot trigger keeps the v2 schema in
-- sop_document_history, and an entry pinned to v2 renders against it. Field ids that carry over
-- are unchanged.
--
-- Entries are created by the Visitor Sign-In page (/team/compliance/visitors), not by New Entry.

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
  if r.r905 is distinct from 'v2' or r.r906 is distinct from 'v2' then
    raise exception 'Expected both at revision v2; found FRM-905=%, FRM-906=%. Re-derive before applying.',
      r.r905, r.r906;
  end if;
end $$;

create temporary table _visitor_attachments on commit drop as
  select sop_number, content->'attachments' as attachments
    from public.sop_documents where sop_number in ('FRM-905', 'FRM-906');

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
      "title": "Entry — completed by the host",
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
          "width": "half",
          "required": true,
          "statement": "My health declaration above is true today, and I will follow the site's food safety and hygiene rules for the whole of my visit."
        },
        {
          "id": "host_signature",
          "type": "signature",
          "label": "Host",
          "width": "half",
          "required": true,
          "statement": "Where entry was permitted: this visitor showed no visible signs of illness (11.3.4.3), removed jewellery and loose objects (11.3.4.2), was issued and is wearing the protective clothing — hairnet, beard cover where applicable, lab coat, footwear — and entered by the staff entrance and washed their hands (11.3.4.4)."
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
       revision = 'v3',
       effective_date = date '2026-10-01'
 where sop_number = 'FRM-905'
   and status = 'active'
   and revision = 'v2';

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
          "text": "This acknowledgement is valid for twelve months from the date above, or until FRM-906 is revised. It is retained by QA for a minimum of twelve months after the last visit that relied on it (FSQM-012 Part 6)."
        }
      ]
    }
  ]
}
$j906$::jsonb),
       revision = 'v3',
       effective_date = date '2026-10-01'
 where sop_number = 'FRM-906'
   and status = 'active'
   and revision = 'v2';

do $$
declare
  r record;
begin
  select
    (select revision from public.sop_documents where sop_number = 'FRM-905') as r905,
    (select revision from public.sop_documents where sop_number = 'FRM-906') as r906,
    (select jsonb_array_length(content->'form_schema'->'sections')
       from public.sop_documents where sop_number = 'FRM-905')                as sec905,
    (select jsonb_array_length(content->'form_schema'->'sections')
       from public.sop_documents where sop_number = 'FRM-906')                as sec906,
    (select count(*) from public.sop_documents d,
                          jsonb_array_elements(d.content->'form_schema'->'sections') s,
                          jsonb_array_elements(s->'fields') f
      where d.sop_number = 'FRM-905' and f->>'type' = 'signature')            as sig905,
    (select count(*) from public.sop_documents d,
                          jsonb_array_elements(d.content->'form_schema'->'sections') s,
                          jsonb_array_elements(s->'fields') f
      where d.sop_number = 'FRM-906' and f->>'type' = 'signature')            as sig906,
    -- exactly one drawn signature per form, and it is the visitor's
    (select count(*) from public.sop_documents d,
                          jsonb_array_elements(d.content->'form_schema'->'sections') s,
                          jsonb_array_elements(s->'fields') f
      where d.sop_number in ('FRM-905', 'FRM-906')
        and f->>'capture' = 'drawn' and f->>'id' = 'visitor_signature')       as drawn,
    (select count(*) from public.sop_documents d,
                          jsonb_array_elements(d.content->'form_schema'->'sections') s,
                          jsonb_array_elements(s->'fields') f
      where d.sop_number in ('FRM-905', 'FRM-906') and f->>'capture' = 'drawn') as drawn_any,
    (select jsonb_array_length(f->'rows')
       from public.sop_documents d,
            jsonb_array_elements(d.content->'form_schema'->'sections') s,
            jsonb_array_elements(s->'fields') f
      where d.sop_number = 'FRM-906' and f->>'id' = 'rules_table')            as rules,
    (select jsonb_array_length(f->'options')
       from public.sop_documents d,
            jsonb_array_elements(d.content->'form_schema'->'sections') s,
            jsonb_array_elements(s->'fields') f
      where d.sop_number = 'FRM-905' and f->>'id' = 'entry_route')            as routes,
    -- the health declaration is on FRM-905 now, and gone from FRM-906
    (select count(*) from public.sop_documents d,
                          jsonb_array_elements(d.content->'form_schema'->'sections') s,
                          jsonb_array_elements(s->'fields') f
      where d.sop_number = 'FRM-905' and f->>'id' in ('no_symptoms', 'wounds_covered')) as health905,
    (select count(*) from public.sop_documents d,
                          jsonb_array_elements(d.content->'form_schema'->'sections') s,
                          jsonb_array_elements(s->'fields') f
      where d.sop_number = 'FRM-906' and f->>'id' in ('no_symptoms', 'wounds_covered')) as health906,
    (select content::text like '%11.3.4.2%' and content::text like '%11.3.4.3%'
            and content::text like '%11.3.4.4%'
       from public.sop_documents where sop_number = 'FRM-905')                as clauses,
    (select count(*) from public.sop_documents d
       join _visitor_attachments a on a.sop_number = d.sop_number
      where d.content->'attachments' is distinct from a.attachments)          as attachments_changed
  into r;

  if r.r905 <> 'v3' or r.r906 <> 'v3' then
    raise exception 'Revisions did not bump: FRM-905=%, FRM-906=%.', r.r905, r.r906;
  end if;
  if r.sec905 <> 4 or r.sec906 <> 3 then
    raise exception 'Section counts wrong: FRM-905=% (expected 4), FRM-906=% (expected 3).', r.sec905, r.sec906;
  end if;
  if r.sig905 <> 2 or r.sig906 <> 2 then
    raise exception 'Signature fields wrong: FRM-905=%, FRM-906=% (expected 2 each).', r.sig905, r.sig906;
  end if;
  if r.drawn <> 2 or r.drawn_any <> 2 then
    raise exception 'Expected exactly the two visitor signatures to be drawn; found % visitor, % in all.', r.drawn, r.drawn_any;
  end if;
  if r.rules <> 10 then
    raise exception 'FRM-906 carries % rules, expected 10.', r.rules;
  end if;
  if r.routes <> 4 then
    raise exception 'FRM-905 route options: % (expected 4).', r.routes;
  end if;
  if r.health905 <> 2 or r.health906 <> 0 then
    raise exception 'Health declaration misplaced: FRM-905 has %, FRM-906 has % (expected 2 and 0).', r.health905, r.health906;
  end if;
  if not r.clauses then
    raise exception 'FRM-905 no longer cites 11.3.4.2, 11.3.4.3 and 11.3.4.4.';
  end if;
  if r.attachments_changed <> 0 then
    raise exception 'Attachments changed on % visitor form(s).', r.attachments_changed;
  end if;
end $$;

commit;
