-- FRM-903 — the site detergent changed from Dazzle to Dawn Professional.
--
-- Per the owner (2026-08-25), the plant switched to Dawn Professional Concentrated Dish Detergent
-- at the label rate: 1-2 oz per 10 gallons of water.
--
-- This is not a small edit to a default. Dazzle was recorded at 3 oz PER GALLON - 30 oz in a
-- ten-gallon sink. Dawn Professional is 1-2 oz for that same sink, roughly a twentieth of the
-- dose. Leaving a wrong figure in place would have staff confirming "within target" against a
-- number that is not the manufacturer's instruction, which is precisely what SQF 11.2.5.3 exists
-- to catch.
--
-- TWO CORRECTIONS THIS MIGRATION CARRIES, both found when the first attempt failed:
--
-- 1. The guard used to be `content::text like '%Dazzle%'`. The owner had already edited the
--    record by hand in the app, so Dazzle was gone, the UPDATE matched zero rows, and only the
--    closing assertion caught it. A guard keyed on the OLD value breaks the moment someone gets
--    there first. It now keys on the TARGET state instead - the statement is a no-op only when
--    the document already says exactly what it should, whatever it said before.
--
-- 2. That hand edit set the concentration to "1-2 oz. per 5 gallon". The label says 1-2 oz per
--    10 gallons, so as written the record specified about double the label rate. Confirmed with
--    the owner 2026-08-25: the label rate is correct and "5 gallon" was a slip.
--
-- Section 3 changes:
--   * detergent_used            -> Dawn Professional
--   * detergent_concentration   -> "1-2 oz per 10 gallons"; the help said "% or oz/gal", which is
--                                  not how this product is dosed
--   * detergent_test_method     -> gains a default and real guidance. There is no test strip for a
--                                  manual dish detergent, so verification is a MEASURED DOSE, not
--                                  a titration - the label states the Dawn Professional pump
--                                  delivers 1 oz per full stroke, which makes "count the strokes
--                                  per sink fill" the practical, auditable check. The old help
--                                  ("titration kit, test strip") pointed at a method that does not
--                                  exist for this chemical.
--   * the section DESCRIPTION now names both chemicals and their rates, because the printed blank
--     renders descriptions but NOT defaults or help (scripts/generate-form-blank.py). Without it,
--     someone filling the form on paper - which is how it is filled on the floor - sees two empty
--     boxes and no statement of what to use or how much. Guidance, not a pre-filled answer: the
--     boxes stay blank.
-- The sanitizer half of the section is unchanged.
--
-- The whole fields array is replaced via jsonb_set rather than patched by text substitution:
-- jsonb reorders object keys by (length, then bytes), so hand-matching a rendered field object is
-- guesswork. The path is guarded on the section id so a reshuffle fails instead of writing into
-- the wrong section.
--
-- FRM-903 is ACTIVE, so this is a controlled change: revision -> v3, effective 2026-08-25, in the
-- SAME statement as the content edit. content->'form_schema' and revision are both
-- snapshot-watched, so one UPDATE produces one coherent sop_document_history row. Note the hand
-- edit already produced its own snapshot (2026-08-25 18:48:30, prior value Dazzle) but did NOT
-- bump the revision - so for a few days two different schemas both carried the label "v2". This
-- migration closes that by giving the current content a revision of its own.
--
-- NOTE for whoever picks this up: Dawn Professional is a MANUAL, high-foaming dish detergent for
-- the three-compartment sink. It must NOT be used in the pot & pan washer (SOP-905), which
-- requires a non-foaming machine warewash detergent and lists excess foam as a fault symptom. The
-- warewasher's detergent is still unnamed and is a separate open item.

begin;

update public.sop_documents
set content = jsonb_set(jsonb_set(content, '{form_schema,sections,3,description}',
      to_jsonb('Confirm and record detergent and sanitizer concentration before use (SQF 11.2.5.3). Site chemicals: Dawn Professional detergent at 1-2 oz per 10 gallons of water; Noble Sani-512 sanitizer at the food-contact dilution of 1:512 (1 fl oz per 4 gallons, about 200 ppm quat).'::text)),
    '{form_schema,sections,3,fields}', $j$
[
  { "id": "detergent_used", "type": "text", "label": "Detergent used", "width": "third", "defaultValue": "Dawn Professional" },
  { "id": "detergent_concentration", "type": "text", "label": "Detergent concentration", "width": "third", "required": true, "help": "Per the manufacturer's instructions - Dawn Professional is 1-2 oz per 10 gallons of water", "defaultValue": "1-2 oz per 10 gallons" },
  { "id": "detergent_within_target", "type": "pass_fail", "label": "Detergent within target?", "width": "third", "required": true },
  { "id": "detergent_test_method", "type": "text", "label": "Detergent test method", "width": "full", "help": "How the dose was measured - pump strokes, measuring cup or proportioner. The Dawn Professional pump delivers 1 oz per full stroke.", "defaultValue": "Measured dose per sink fill" },
  { "id": "sanitizer_used", "type": "text", "label": "Sanitizer used", "width": "third", "defaultValue": "Noble Sani-512" },
  { "id": "concentration_ppm", "type": "text", "label": "Concentration (PPM)", "width": "third", "required": true, "defaultValue": "200 ppm" },
  { "id": "sanitizer_verified", "type": "pass_fail", "label": "Within target?", "width": "third", "required": true },
  { "id": "test_method", "type": "text", "label": "Test method (e.g. test strip)", "width": "full", "defaultValue": "Test strip" }
]
$j$::jsonb),
    revision = 'v3',
    effective_date = date '2026-08-25'
where sop_number = 'FRM-903'
  and content #>> '{form_schema,sections,3,id}' = 'sanitizer'
  -- Target-state guard: a no-op only when the document already says exactly this.
  and (revision is distinct from 'v3'
    or content #> '{form_schema,sections,3,fields}' is distinct from $g$
[
  { "id": "detergent_used", "type": "text", "label": "Detergent used", "width": "third", "defaultValue": "Dawn Professional" },
  { "id": "detergent_concentration", "type": "text", "label": "Detergent concentration", "width": "third", "required": true, "help": "Per the manufacturer's instructions - Dawn Professional is 1-2 oz per 10 gallons of water", "defaultValue": "1-2 oz per 10 gallons" },
  { "id": "detergent_within_target", "type": "pass_fail", "label": "Detergent within target?", "width": "third", "required": true },
  { "id": "detergent_test_method", "type": "text", "label": "Detergent test method", "width": "full", "help": "How the dose was measured - pump strokes, measuring cup or proportioner. The Dawn Professional pump delivers 1 oz per full stroke.", "defaultValue": "Measured dose per sink fill" },
  { "id": "sanitizer_used", "type": "text", "label": "Sanitizer used", "width": "third", "defaultValue": "Noble Sani-512" },
  { "id": "concentration_ppm", "type": "text", "label": "Concentration (PPM)", "width": "third", "required": true, "defaultValue": "200 ppm" },
  { "id": "sanitizer_verified", "type": "pass_fail", "label": "Within target?", "width": "third", "required": true },
  { "id": "test_method", "type": "text", "label": "Test method (e.g. test strip)", "width": "full", "defaultValue": "Test strip" }
]
$g$::jsonb);

do $$
declare
  bad text;
begin
  select string_agg(x, '; ') into bad from (
    select 'Dazzle still present' as x from public.sop_documents
      where sop_number = 'FRM-903' and content::text like '%Dazzle%'
    union all
    select 'the 5-gallon figure is still there' from public.sop_documents
      where sop_number = 'FRM-903' and content::text like '%5 gallon%'
    union all
    select 'Dawn Professional missing' from public.sop_documents
      where sop_number = 'FRM-903' and content::text not like '%Dawn Professional%'
    union all
    select 'concentration default not 1-2 oz per 10 gallons' from public.sop_documents
      where sop_number = 'FRM-903'
        and content #>> '{form_schema,sections,3,fields,1,defaultValue}'
            is distinct from '1-2 oz per 10 gallons'
    union all
    select 'test method default missing' from public.sop_documents
      where sop_number = 'FRM-903'
        and content #>> '{form_schema,sections,3,fields,3,defaultValue}'
            is distinct from 'Measured dose per sink fill'
    union all
    select 'chemicals not named in the printed description' from public.sop_documents
      where sop_number = 'FRM-903'
        and content #>> '{form_schema,sections,3,description}' not like '%Site chemicals:%'
    union all
    select 'revision not v3' from public.sop_documents
      where sop_number = 'FRM-903' and revision is distinct from 'v3'
    union all
    select 'sanitizer defaults disturbed' from public.sop_documents
      where sop_number = 'FRM-903'
        and (content::text not like '%Noble Sani-512%' or content::text not like '%200 ppm%')
  ) t;

  if bad is not null then
    raise exception 'FRM-903 detergent change did not apply cleanly: %', bad;
  end if;
end $$;

commit;
