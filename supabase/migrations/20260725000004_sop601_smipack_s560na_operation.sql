-- SOP-601 (Operating the Smipack S560NA Shrink Wrapper) — create the SOP row.
--
-- Fourth piece of equipment, but the first PACKAGING machine, so it diverges from the mixer/depositor
-- pattern: it is NOT a food-contact wet-clean machine. There is only an operation SOP — no sanitation
-- SSOP and no fillable clean/pre-use log — because the operator confirmed the shrink wrapper needs no
-- cleaning document. Clearing film scraps off the heated blade / out of the shrink chamber is folded
-- into the operation SOP as a fire-safety + foreign-matter step (not a separate procedure).
--
-- Numbering: SOP-601 = stage-block 600s (Packaging & Labeling) — the first 600s SOP. Category is
-- 'Job-Specific Operations' so it groups in the SOPs Library with the other equipment operation SOPs
-- (SOP-501/502/503), the same way those did; the process stage lives in the number, not the category.
--
-- SQF refs verified against src/lib/sqfClauses.ts / sqfFoodClauses.ts:
--   2.3.2.6  — packaging that comes into DIRECT food contact must be certified/approved for the use
--     (letter of guarantee / certificate of conformance on file). The shrink film touches the baked
--     product directly (owner confirmed), so it is a food-contact material and must be food-grade.
--   11.7.3.1 — equipment free of potential contaminants; parts not deteriorated. Film scraps and worn
--     PTFE/blade debris are the foreign-matter hazard on the product.
--
-- Machine-specific hazards captured in the body: heated sealing blade + hot shrink chamber (burns,
-- and film on hot parts is a fire risk); electrical (power off before servicing); prohibited loads
-- (flammable/explosive/aerosol/loose powders). Blade/coolant/temperature/electrical detail is left to
-- Maintenance.
--
-- No Smipack record exists yet, so this INSERTs a new row. Body shape matches the Word importer /
-- SopBodyEditor (purpose, scope, responsibility, procedure[], form_references, records,
-- governing_reference, revision_history) so it renders in the Document tab and exports to PDF.
--
-- status stays 'draft'. Activating SOP-601 is an approval decision; a pre-activation item is
-- confirming the food-grade film's certificate / letter of guarantee is on file (the SOP requires it).
-- Since the row is draft, this does not fire the sop_documents_history snapshot (trigger is WHEN
-- old.status='active').
--
-- Idempotent: guarded on sop_number, so re-running is a no-op and won't clobber later edits.

begin;

insert into public.sop_documents
  (sop_number, title, type, category, status, revision, sqf_reference, sqf_required, content)
select
  'SOP-601',
  'Operating the Smipack S560NA Shrink Wrapper',
  'sop',
  'Job-Specific Operations',
  'draft',
  'New',
  '2.3.2.6, 11.7.3.1',
  true,
  $json$
{
  "purpose": "To run the Smipack S560NA safely and produce a clean, well-sealed shrink pack.\n\nTwo things drive the rules below. The machine has a heated sealing blade and a hot shrink chamber — they burn, and film left on them is a fire risk. And it puts food-grade film around the product, so loose film scraps and blade debris are a foreign-matter concern kept off the product.",
  "scope": "Production / packaging staff loading, running, and unloading the S560NA to shrink-wrap finished product.\n\nBlade replacement, coolant top-up, temperature calibration, and repairs are Maintenance — not operators. Clearing film off the blade and out of the chamber is part of running the machine (see the procedure); there is no separate cleaning SOP for this equipment.",
  "responsibility": "Operators — set up and run as written; stop and report bad seals, film on hot parts, or faults.\nSupervisor — trains and signs off operators; takes the machine out of service on a fault.\nMaintenance — blade, coolant, temperature settings, electrical, and repair, with the power off and the machine cool.",
  "procedure": [
    "Before you start — training: do not operate this machine unless the Supervisor has trained and signed you off.",
    "Pre-start checks: the sealing blade and shrink chamber are clear of film scraps (a fire risk and a foreign-matter source) and the netting is clean; the film reel is the approved food-grade film (this film touches the baked product directly), loaded and tracking correctly and undamaged; the emergency stop works and returns and guards/covers are in place; the coolant level is between min and max on the sight viewer; never load flammable, explosive, aerosol, or loose-powder / volatile products. Anything fails → don't run it; tag it and tell the Supervisor.",
    "Get yourself ready: sleeves down and secured, no dangling ties or lanyards, hair in a hairnet. Keep hands clear of the sealing blade and out of the shrink chamber — both are hot.",
    "Set the machine: from the batch / settings chart, set on the Flextron panel the sealing temperature (enough for a clean seal, no more), the shrink chamber temperature and shrink time (shrink the film tight without scorching or holing it), and the bell pressure, hood opening delay and discharge / conveyor speed as charted. Let the machine reach its set temperatures before running product; record the settings on the chart.",
    "Make a pack: feed the film so it's ready at the packaging plate; place the product on the netting leaving 1–2 cm of space from the sealing blade; the bell lowers automatically and the blade makes the L-seal, the pack passes into the chamber and shrinks, then discharges on the conveyor. Take finished packs off the conveyor and check the seal and the shrink on the first packs and periodically — a full continuous seal, film shrunk tight, no holes, tears or scorching.",
    "Watch the film and the hot parts: if film tears after sealing, adjust the shrink waiting time / temperature (or get Maintenance); if film builds up on the blade or in the chamber, stop and clear it but only once it has cooled (film on hot parts is a fire risk); a bad seal or a hole in the wrap is a reject — set it aside. The film touches the baked product directly, so film scraps or blade debris are foreign matter on the product — if a piece could have gone onto a baked product, segregate the affected packs and tell the Supervisor.",
    "Shut down: stop the machine and switch it off at the main switch, then let it cool. Once cool, clear any film from the sealing blade and the shrink chamber so none is left on the hot parts. Don't reach into the chamber or touch the blade until it's cool.",
    "If something goes wrong — Weak / incomplete seal: blade temperature too low or product too close to the blade (adjust per the chart); if it persists get Maintenance (blade / PTFE wear). Film not shrinking tight or scorching: adjust shrink temperature and time; check the film is the right type. Film tears after sealing: adjust the shrink waiting time; if it persists get Maintenance. Film on the blade or in the chamber: stop, let it cool, then clear it (fire risk). Machine won't cycle or a fault shows on the panel: check the E-stop is released and guards closed, read the panel message, get Maintenance. Smoke, burning smell or flame: E-stop, kill power at the main switch, and follow the fire procedure.",
    "Film is a direct food-contact material: the shrink film touches the baked product directly, so only the approved food-grade film may be used — film certified / approved for direct food contact, with the supplier's letter of guarantee or certificate of conformance on file (SQF 2.3.2.6); don't substitute an unapproved film. Because the film contacts the product, film scraps and blade debris are a foreign-matter hazard on the baked product — keep the blade and chamber clear and hold / segregate product if a fragment could have reached it (SQF 11.7.3.1).",
    "Cleaning: this machine has no dedicated cleaning SOP or record form — it is packaging equipment with no food-contact wet clean, and the operator confirmed none is required. Clearing film scraps off the sealing blade and out of the shrink chamber is done as part of operation (above), for fire safety and to keep film off the baked product. If a documented housekeeping frequency is wanted for audit, add the machine as a line on the FRM-901 Master Sanitation Schedule."
  ],
  "form_references": "Batch / settings chart for the product (film, sealing temp, shrink temp / time, bell pressure, discharge speed)",
  "records": "Machine settings go on the batch / settings chart. Operator training sign-off is held in the training record. There is no dedicated cleaning record — clearing film is part of operation. All retained per the record retention policy.",
  "governing_reference": "SQF Food Safety Code: Food Manufacturing, Edition 9 — 2.3.2.6 (packaging in direct food contact certified / approved for the use), 11.7.3.1 (equipment free of potential contaminants; parts not deteriorated).\nSmipack S.p.A. — S560NA Use and Maintenance Manual.\nOSHA 29 CFR 1910.147 — Control of Hazardous Energy (power off before servicing).",
  "revision_history": "New — 2026-07-25 — Initial issue from the Smipack S560NA Use and Maintenance Manual and vendor specifications; one page for floor use, blade / coolant / temperature detail left to Maintenance. No separate cleaning SOP/log (operator confirmed none required); film-clearing folded into operation. Film confirmed as direct food contact — food-grade film required."
}
$json$::jsonb
where not exists (
  select 1 from public.sop_documents where sop_number = 'SOP-601'
);

commit;
