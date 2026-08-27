-- SOP-906 — SSOP: Molds (Between-Use Care & Weekly Wash).
--
-- Closes a gap found 2026-08-25 while chasing an unrelated question about the pot & pan washer's
-- detergent. The washer turned out to handle only the CARRIER PANS - the trays the molds sit on,
-- which have no direct food contact. The MOLDS, which hold the product through the bake, are
-- handled by hand and had NO documented cleaning method at all. A search of sop_documents for
-- "sink", "mold" or "hand wash" returned only SOP-905 (matched on the word "pan") and a training
-- module. The non-food-contact item had a detailed SOP; the food-contact item had nothing. Direct
-- SQF 11.2.5.1 finding.
--
-- TWO FREQUENCIES, AND THE FIRST ONE IS THE REAL CONTROL. An earlier draft of this SOP described
-- only the weekly wash and implied a wash before every bake, which is not what happens. The molds
-- are scraped and wiped after every use and re-greased before every use; the full sink wash is
-- weekly. Washing greased bakeware every use degrades the release surface, which causes sticking
-- and MORE residue - so the weekly interval is a deliberate practice, not a shortcut, and the
-- document says so. Structuring it as between-use care plus a scheduled wash is what makes the
-- pre-operational check in 11.2.5.7 satisfiable: what is verified before each bake is a scraped,
-- wiped, freshly greased and undamaged mold, not a just-washed one.
--
-- The out-of-schedule triggers matter as much as the schedule. A weekly interval with no triggers
-- is indefensible; a weekly interval that yields immediately to allergen changeover, product
-- change, visible build-up or a failing release surface is a control.
--
-- Nothing in the wash procedure is invented: detergent, rinse, Sani-512 at 1:512, air dry, no
-- towel, strip check is already written three times in SOP-901/902/903, and Dawn Professional's own
-- label describes the same three-step process. What is specific to the molds is the pre-soak after
-- depanning, the between-use routine, the refrigerated holding between production days, and a
-- damage inspection (a chipped mold is a foreign-body route, the same logic as SOP-902's cut-off
-- wire and SOP-903's seals).
--
-- Records go to FRM-903, not a dedicated log like FRM-909-912. Those exist because each machine is
-- released before its own next run; molds are batch-washed on a schedule, so a per-machine log is
-- the wrong shape. Confirmed with the owner. FRM-903 does not yet carry a row for the molds - that
-- is left to the activation migration so the form never points at a draft procedure.
--
-- Scope names both items explicitly. "Pans" is used on the floor for both the molds and the carrier
-- trays, and that ambiguity has already caused confusion once in this project.
--
-- OPEN BEFORE ACTIVATION (in revision_history, not as a placeholder in the procedure text - a
-- "TO CONFIRM" note inside an active controlled document is worse than a question somebody owes an
-- answer to):
--   1. Whether the pre-soak uses a chemical, at what strength, and a typical soak time. Step 6 says
--      hot water only. A soak product would need naming and its SDS adding to the collection.
--   2. VALIDATION OF THE WEEKLY INTERVAL. SQF allows a risk-based frequency but expects evidence it
--      is effective - swabs or micro at the end of the interval, not at the start. The parent
--      facility in the Bahamas runs the same weekly cycle; if it holds validation data, that may be
--      adaptable. Until something supports it, "weekly" is a practice rather than a control.
--   3. Designated storage for the covered molds in the refrigerator, away from ingredients and
--      finished product (11.6.1 segregation).
--
-- Inserted as status='draft'. Idempotent: guarded on sop_number.

begin;

insert into public.sop_documents
  (sop_number, title, type, category, status, revision, sqf_reference, sqf_required, content)
select
  'SOP-906',
  'SSOP — Molds: Between-Use Care & Weekly Wash',
  'sop',
  'Module 11',
  'draft',
  'New',
  '11.2.5.1, 11.2.5.3, 11.2.5.7',
  true,
  $json$
{
  "purpose": "To keep the baking molds clean and fit for use — the scrape, wipe and re-grease done between every use, and the full wash in the three-compartment sink on schedule.",
  "scope": "Two different items are called \"pans\" on the floor. This SOP covers the first:\n\nMolds — the vessels the cake is baked in and depanned from. Direct food contact. Cared for between uses and washed by hand in the three-compartment sink. This SOP.\n\nCarrier pans — the trays the molds sit on in the oven. No direct food contact. Run through the pot & pan washer, SOP-905.\n\nAlso covered here: utensils, scoops and small parts washed by hand in the same sink.\n\nFrequency: molds are scraped, wiped and re-greased every use, and given a full wash weekly. They are NOT washed between every bake by design — repeated detergent washing strips the release surface, and a stripped mold sticks and leaves more residue, not less. The weekly interval yields immediately to the triggers in step 5.\n\nNot covered: machine parts, which are cleaned under their own SSOPs — SOP-901 (mixer), SOP-902 and SOP-903 (depositors), SOP-904 (kettle).",
  "responsibility": "Sanitation / Production staff — perform the between-use care and the weekly wash, and record the wash and the sanitizer strength on FRM-903.\nSupervisor — verifies the molds before they go back into service and signs the release on FRM-903.",
  "procedure": [
    "BETWEEN EVERY USE — scrape and wipe. As soon as the cakes are depanned, scrape out the loose crumb and wipe the mold down. Use a clean cloth kept for this job; a cloth carried over from another surface brings that surface's soil into the mold.",
    "BETWEEN EVERY USE — fresh release every time. Apply fresh grease or release spray to every mold before it is filled, whatever its position in the wash cycle. This is what keeps the surface working and is the reason the full wash can be weekly rather than daily.",
    "BETWEEN PRODUCTION DAYS — cover and refrigerate. Molds held over to the next production day are covered and kept in the refrigerator. Covered so nothing can fall into them; refrigerated so any residue left on them does not develop. Keep them in their designated place, not among ingredients or finished product.",
    "BEFORE EVERY USE — check the mold. It must be dry, free of visible residue or sticky build-up, and undamaged, with the release coat freshly applied. Record the check on FRM-903. Anything that fails goes for a full wash before it is used, whatever the schedule says.",
    "WASH SCHEDULE — weekly, and sooner whenever any of these happen: an allergen changeover (follow SOP-204); a change of product; visible residue or sticky build-up the wipe does not remove; a release surface that has gone patchy or is sticking; or any incident where a mold has been contaminated. The trigger always beats the schedule.",
    "WASH — pre-soak first. Heavy baked-on cake does not come off in a wash sink; it has to be softened. Fill the soak with hot water deep enough to cover the soiled surfaces and leave the molds until the residue lifts. Do not let molds dry out with cake baked on — once it hardens, the only way back is scrubbing hard enough to scratch the surface, and a scratched mold holds soil and stops releasing.",
    "WASH — scrape and empty. Lift out the softened residue and empty it to waste before the wash sink; soil carried into sink 1 spends the detergent.",
    "WASH — sink 1, wash. Dawn Professional at 1-2 oz per 10 gallons of hot water. Make up a fresh sink when the water is soiled or has gone cold.",
    "WASH — sink 2, rinse. Clean potable water. Rinse the detergent off completely; detergent carried into sink 3 weakens the sanitizer.",
    "WASH — sink 3, sanitize. Noble Sani-512 at the food-contact dilution of 1:512 (1 fl oz per 4 gallons of water, or 0.25 oz per gallon; about 200 ppm quat on a test strip). Immerse for at least 1 minute, then air dry on the rack. Sani-512 is a no-rinse sanitizer at this dilution — do not rinse it off, and do not towel the molds dry; either one undoes the sanitizing.",
    "WASH — check the sanitizer strength with a test strip before you wash, target about 200 ppm quat, and record the reading on FRM-903. If the strip reads below target, remake the solution; do not wash in weak sanitizer. Wear gloves and eye protection while you measure and pour the concentrate — undiluted Sani-512 is rated DANGER and causes severe skin burns and serious eye damage. Once it is mixed at 1:512 the working solution is not corrosive, so this is about making the solution up, not about using it.",
    "WASH — inspect every mold before it goes back into service. Look for chips, cracks, splits, flaking coating or deformation. A damaged mold is a foreign-body route into product — take it out of service and tell the Supervisor. Do not return it to the rack \"for now\". Re-grease before the next fill.",
    "Store molds clean, dry, covered and protected. Do not stack them wet.",
    "Before the molds go back into service after a wash, the Supervisor checks and signs the release on FRM-903 — molds clean, dry and undamaged; sanitizer strength recorded."
  ],
  "form_references": "FRM-903 — Daily Sanitation, Pre-Operation & Release Record (the before-use check, the wash, the sanitizer strength and the release)\nFRM-901 — Master Sanitation Schedule (carries the weekly mold wash as a scheduled line)\nSOP-204 — Allergen Cleaning Procedure (changeover between different allergens)\nSOP-905 — Operating the Pot & Pan Washer (the carrier pans the molds sit on)",
  "records": "The before-use check, the wash, the sanitizer strength and the release are recorded on FRM-903, retained per the record retention policy. The weekly wash is scheduled on FRM-901. Molds do not have a separate cleaning log: unlike the machines, they are batch-washed on a schedule rather than released per machine per run.",
  "governing_reference": "SQF Food Safety Code: Food Manufacturing, Edition 9 — 11.2.5.1 (documented cleaning method at a frequency that keeps food-contact surfaces clean), 11.2.5.3 (detergent and sanitizer concentration verified and recorded), 11.2.5.7 (inspection before production).\nDawn Professional Dish Detergent Concentrate — 1-2 oz per 10 gallons; wash, rinse with potable water, sanitize and air dry as a three-step process (manufacturer's use instructions).\nNoble Chemical Sani-512 (quaternary sanitizer) — food-contact use at 1:512 (1 fl oz per 4 gallons), about 200 ppm quat; no-rinse: wet the surface at least 1 minute and let it air dry. The SDS for the concentrate (Clark Core Services, revised 2021-07-15; EPA reg. 6836-266-65239) classifies it DANGER — H302 harmful if swallowed, H314 causes severe skin burns and eye damage, H318 causes serious eye damage — and requires gloves and eye/face protection when it is handled.\nFDA 21 CFR Part 117 Subpart B — Current Good Manufacturing Practice.",
  "revision_history": "New — 2026-08-25 — Initial issue. Closes the gap found when the pot & pan washer turned out to cover only the non-food-contact carrier pans, leaving the molds — a direct food-contact surface — with no documented cleaning method. Written as between-use care (scrape, wipe, fresh release) plus a weekly wash with out-of-schedule triggers, which is the process actually performed; the wash steps follow the sink process already described in SOP-901/902/903.\n\nOPEN BEFORE ACTIVATION:\n1. Pre-soak — confirm whether a chemical is used, at what strength, and a typical soak time. Step 6 currently says hot water only; a soak product would need naming here and its SDS adding to the Chemical Safety Data Sheets collection.\n2. Validation of the weekly interval — SQF allows a risk-based frequency but expects evidence that it works, taken at the END of the interval rather than the start. The parent facility runs the same weekly cycle and may hold data that can be adapted. Until something supports it, weekly is a practice rather than a validated control.\n3. Designated storage for the covered molds in the refrigerator, away from ingredients and finished product."
}
$json$::jsonb
where not exists (
  select 1 from public.sop_documents where sop_number = 'SOP-906'
);

do $$
declare
  r record;
begin
  select status, jsonb_array_length(content->'procedure') as steps,
         (content->>'scope' like '%weekly%') as has_frequency,
         (content->'procedure')::text like '%BETWEEN EVERY USE%' as has_between_use
    into r from public.sop_documents where sop_number = 'SOP-906';

  if r is null then
    raise exception 'SOP-906 was not created.';
  end if;
  if r.status is distinct from 'draft' or r.steps < 12
     or not r.has_frequency or not r.has_between_use then
    raise exception 'SOP-906 created wrong: status=%, steps=%, frequency=%, between-use=%',
      r.status, r.steps, r.has_frequency, r.has_between_use;
  end if;
end $$;

commit;
