-- SOP-905 — correct the scope: carrier pans only, and no detergent.
--
-- The document described an operation the site does not run. Three claims were wrong:
--
--   purpose  "pots, pans, bowls, utensils, and sheet/baking pans come out clean and sanitized and
--             SAFE FOR FOOD USE"
--   scope    "Warewashing of FOOD-CONTACT ITEMS on the pot & pan washer"
--   step 1   "Detergent IS a non-foaming, non-caustic, aluminum-safe warewash detergent and the
--             automatic detergent feeder IS on and filled"
--
-- In fact the machine handles only the CARRIER PANS - the trays the molds sit on in the oven, which
-- have no direct food contact - and it runs with no detergent at all. The only chemical dosed is
-- Keystone Solid Brilliance rinse additive (Ecolab), whose SDS states its use as "Rinse additive":
-- a drying agent that breaks surface tension so water sheets off. It has no detergency function.
--
-- "Safe for food use" was the claim that mattered. An auditor tests it by asking what food-contact
-- ware goes through the machine and how the result is verified; the answer is "none", which means
-- the document was describing an operation that does not exist.
--
-- WITH THE SCOPE CORRECTED, THE MISSING DETERGENT STOPS NEEDING A JUSTIFICATION. Hot water and
-- mechanical action on non-food-contact carrier pans is a defensible clean. The earlier concern
-- about fat and sugar soils assumed the machine was doing food-contact ware. It is not.
--
-- What is deliberately KEPT: the wash/rinse temperature discipline and the per-shift record. Those
-- pans go into the oven carrying product-filled molds, so a soiled pan is an indirect route even
-- though it is not a food-contact surface. What changes is the framing - GMP hygiene rather than a
-- food-safety-critical verification - and the records section now says so rather than leaving the
-- reader to infer a criticality that is not there.
--
-- Scope also names the molds explicitly and points at SOP-906. "Pans" is used on the floor for both
-- the molds and the carrier trays; that ambiguity is exactly how this SOP came to describe the
-- wrong item, so both SOPs now define the two terms.
--
-- Troubleshooting is corrected too: "Not cleaning - check detergent level" pointed at a control
-- that does not exist, and "excess foam (wrong detergent)" is reframed - with no detergent dosed,
-- foam means a foaming chemical has got in where it should not be.
--
-- SOP-905 is ACTIVE: revision New -> v2, effective 2026-08-26 (the business day; the database's
-- current_date is a day ahead because it is past midnight UTC), in the same statement as the
-- content edit so the history snapshot captures a coherent prior version.

begin;

update public.sop_documents
set content = jsonb_set(jsonb_set(jsonb_set(
      replace(replace(replace(content::text,
        'Detergent is a non-foaming, non-caustic, aluminum-safe warewash detergent and the automatic detergent feeder is on and filled (this machine must be run with an automatic detergent feeder). If a chemical sanitizer feeder is fitted, it is on, filled, and delivering at the labeled concentration.',
        'This machine is run WITHOUT a detergent: the wash is hot water and mechanical action. The only chemical dosed is Keystone Solid Brilliance rinse additive (Ecolab) — a drying agent that helps the pans sheet-dry without spotting, not a cleaner. Check its dispenser is fitted and has product. No chemical sanitizer is dosed either; the ~190 °F rinse is the sanitizing step.'),
        'Not cleaning — check detergent level, wash temperature, water level, clogged jets, and that filters are clear.',
        'Not cleaning — check wash temperature, water level, clogged jets, and that filters are clear. There is no detergent to check. If pans come out soiled with the temperatures right, scrape or soak them by hand and tell the Supervisor.'),
        'check for excess foam (wrong detergent)',
        'check for excess foam — nothing foaming should be in this machine, which sees only the rinse additive')::jsonb,
      '{purpose}', to_jsonb($p$To run the pot & pan washer so the carrier pans come out clean and dry, ready to carry molds through the next bake.

The machine washes at about 150 °F and rinses at about 190 °F. Those temperatures are what make it work, so the rules below center on hitting and verifying them.$p$::text)),
      '{scope}', to_jsonb($s$The carrier pans — the trays the molds sit on in the oven — and the end-of-day cleaning of the washer itself.

These pans have no direct food contact: the product sits in the molds, and the molds sit on the pans.

The MOLDS are a different item and a direct food-contact surface. They do NOT go through this machine — they are scraped, wiped and re-greased between uses and washed by hand under SOP-906. "Pans" is used on the floor for both items; keep them apart.

Installation, gas/electrical work, pump lubrication, PC-board programming, spray-jet/heater/probe replacement, and repairs are Maintenance — not operators. Operators do not open the electrical panel (it is a live/hot panel).$s$::text)),
      '{records}', to_jsonb($r$Wash and rinse temperature checks are recorded per shift. Retained per the record retention policy.

The carrier pans are not a food-contact surface, so this check is GMP hygiene rather than a food-safety-critical verification. It is still taken seriously: the pans go into the oven carrying product-filled molds, so a soiled pan is an indirect route to product.$r$::text)),
    revision = 'v2',
    effective_date = date '2026-08-26'
where sop_number = 'SOP-905'
  and (revision is distinct from 'v2'
    or content->>'scope' like '%food-contact items%'
    or content::text like '%automatic detergent feeder is on and filled%');

do $$
declare
  bad text;
begin
  select string_agg(x, '; ') into bad from (
    select 'still claims food-contact items' as x from public.sop_documents
      where sop_number = 'SOP-905' and content->>'scope' like '%Warewashing of food-contact items%'
    union all
    select 'still claims safe for food use' from public.sop_documents
      where sop_number = 'SOP-905' and content->>'purpose' like '%safe for food use%'
    union all
    select 'still asserts a detergent feeder' from public.sop_documents
      where sop_number = 'SOP-905' and content::text like '%automatic detergent feeder is on and filled%'
    union all
    select 'still says to check detergent level' from public.sop_documents
      where sop_number = 'SOP-905' and content::text like '%check detergent level%'
    union all
    select 'still blames foam on the wrong detergent' from public.sop_documents
      where sop_number = 'SOP-905' and content::text like '%wrong detergent%'
    union all
    select 'rinse additive not named' from public.sop_documents
      where sop_number = 'SOP-905' and content::text not like '%Keystone Solid Brilliance%'
    union all
    select 'does not point at SOP-906' from public.sop_documents
      where sop_number = 'SOP-905' and content->>'scope' not like '%SOP-906%'
    union all
    select 'temperature discipline lost' from public.sop_documents
      where sop_number = 'SOP-905'
        and (content->>'records' not like '%temperature checks are recorded per shift%'
          or content::text not like '%190%')
    union all
    select 'revision not v2' from public.sop_documents
      where sop_number = 'SOP-905' and revision is distinct from 'v2'
  ) t;

  if bad is not null then
    raise exception 'SOP-905 scope correction did not apply cleanly: %', bad;
  end if;
end $$;

commit;
