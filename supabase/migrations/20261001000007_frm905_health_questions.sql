-- FRM-905 v5: the health declaration is asked as questions.
--
-- v4 put it as a statement to agree with - "I have none of the following today: vomiting, ..." -
-- answered "Yes - none of these" or "No - I have one of these". On the first day at the door two
-- visitors out of two tapped "No", meaning "no, I have no symptoms", and were told they could not
-- come in. Both saw the warning and corrected it, so no record is wrong, but a health question that
-- healthy people answer the wrong way round is a broken question: sooner or later one will sign a
-- refusal they did not mean.
--
-- People answer "do you have symptoms?" with "no". So:
--   no_symptoms     "Do you have any of the following symptoms today: ...?"
--                   No, I have none of these  /  Yes, I have at least one of these
--   wounds_covered  "Do you have any cut or graze on your hands or exposed skin?"
--                   No cuts or grazes  /  Yes, and it is covered ...  /  Yes, and it is not covered
--
-- ONLY THE WORDING CHANGES. The field ids and the stored values do not: "pass" still means no
-- symptoms (or a covered cut), "fail" still means a symptom, "na" still means no cuts. Every v4
-- entry therefore reads the same, the sign-in screen's logic is untouched, and a "fail" on
-- no_symptoms is still what refuses entry (11.3.4.3).
--
-- FRM-906 is not touched, so no acknowledgement is invalidated.

begin;

do $$
declare
  r record;
begin
  select status, revision into r from public.sop_documents where sop_number = 'FRM-905';
  if r.status is distinct from 'active' or r.revision is distinct from 'v4' then
    raise exception 'Expected FRM-905 active at v4; found % / %. Re-derive before applying.', r.status, r.revision;
  end if;
end $$;

create temporary table _frm905_before on commit drop as
  select d.content->'attachments' as attachments,
         d.content->'form_schema' as form_schema,
         (select array_agg(f->>'id' order by f->>'id')
            from jsonb_array_elements(d.content->'form_schema'->'sections') s,
                 jsonb_array_elements(s->'fields') f) as field_ids
    from public.sop_documents d where d.sop_number = 'FRM-905';

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
            "pass": "No, I have none of these",
            "fail": "Yes, I have at least one of these"
          },
          "label": "Do you have any of the following symptoms today: vomiting, diarrhoea, jaundice, fever with sore throat, discharge from the eyes, ears or nose, or an infected wound, boil or sore?"
        },
        {
          "id": "wounds_covered",
          "type": "pass_fail",
          "width": "full",
          "required": true,
          "labels": {
            "na": "No cuts or grazes",
            "pass": "Yes, and it is covered with the dressing provided",
            "fail": "Yes, and it is not covered"
          },
          "label": "Do you have any cut or graze on your hands or exposed skin?"
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
       revision = 'v5',
       effective_date = date '2026-10-01'
 where sop_number = 'FRM-905'
   and status = 'active'
   and revision = 'v4';

do $$
declare
  r record;
begin
  select d.revision,
         (select array_agg(f->>'id' order by f->>'id')
            from jsonb_array_elements(d.content->'form_schema'->'sections') s,
                 jsonb_array_elements(s->'fields') f)                              as field_ids,
         (select f from jsonb_array_elements(d.content->'form_schema'->'sections') s,
                        jsonb_array_elements(s->'fields') f where f->>'id' = 'no_symptoms')    as symptoms,
         (select f from jsonb_array_elements(d.content->'form_schema'->'sections') s,
                        jsonb_array_elements(s->'fields') f where f->>'id' = 'wounds_covered') as wounds,
         -- every field other than the two reworded ones must be exactly as it was
         (select count(*)
            from jsonb_array_elements(d.content->'form_schema'->'sections') s,
                 jsonb_array_elements(s->'fields') f
           where f->>'id' not in ('no_symptoms', 'wounds_covered')
             and not exists (select 1 from jsonb_array_elements(b.form_schema->'sections') s0,
                                           jsonb_array_elements(s0->'fields') f0 where f0 = f))  as other_fields_changed,
         d.content->'form_schema'->'settings' is distinct from b.form_schema->'settings'     as settings_changed,
         d.content->'attachments' is distinct from b.attachments                             as attachments_changed,
         b.field_ids                                                                         as before_ids
    into r
    from public.sop_documents d, _frm905_before b
   where d.sop_number = 'FRM-905';

  if r.revision <> 'v5' then
    raise exception 'FRM-905 revision is %, expected v5.', r.revision;
  end if;
  if r.field_ids is distinct from r.before_ids then
    raise exception 'FRM-905 field ids changed; answers key on them.';
  end if;
  if r.symptoms->>'label' not like 'Do you have any of the following symptoms today:%'
     or r.symptoms->'labels'->>'pass' not like 'No,%' or r.symptoms->'labels'->>'fail' not like 'Yes,%'
     or (r.symptoms->>'naAllowed')::boolean is distinct from false
     or (r.symptoms->>'required')::boolean is distinct from true then
    raise exception 'FRM-905 symptoms question is not as intended: %', r.symptoms;
  end if;
  if r.wounds->>'label' not like 'Do you have any cut or graze%'
     or r.wounds->'labels'->>'na' not like 'No %' or r.wounds->'labels'->>'pass' not like 'Yes,%covered%'
     or r.wounds->'labels'->>'fail' not like 'Yes,%not covered%'
     or (r.wounds->>'required')::boolean is distinct from true then
    raise exception 'FRM-905 cuts question is not as intended: %', r.wounds;
  end if;
  if r.other_fields_changed <> 0 or r.settings_changed then
    raise exception 'FRM-905 changed beyond the two questions: % other field(s), settings changed=%.',
      r.other_fields_changed, r.settings_changed;
  end if;
  if r.attachments_changed then
    raise exception 'FRM-905 attachments changed.';
  end if;
end $$;

commit;
