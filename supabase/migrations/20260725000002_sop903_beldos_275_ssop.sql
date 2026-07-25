-- SOP-903 (SSOP — Beldos 275 Depositor) — create the SOP row.
--
-- The sanitation SSOP for the Beldos 275 pneumatic depositor. Pairs with SOP-503 (operation,
-- 20260725000001) and FRM-911 (clean/pre-use log, 20260725000003).
--
-- Numbering: SOP-903 uses the stage-block scheme (900s = Sanitation & GMP), NOT the SQF-clause SOP
-- scheme — SOP-901 is the mixer SSOP and SOP-902 the KEK depositor SSOP, so this is the next. Every
-- machine needs its own sanitation SOP; they would all collide on 11.2.5 under the clause scheme.
-- Cross-reference to SQF is via sqf_reference (renders as clause chips). Clauses verified against
-- src/lib/sqfFoodClauses.ts: 11.2.5.1 (documented cleaning method), 11.2.5.3 (mixed sanitizer
-- concentration correct + recorded), 11.2.5.7 (pre-op inspection before production).
--
-- Records: SOP-903 points at FRM-911. The plant forms FRM-901/902 are Word attachments (not fillable)
-- and FRM-903 is a glass check, so none could hold the depositor's record — same reasoning as the
-- mixer's FRM-909 and the KEK's FRM-910.
--
-- Process reflects the daily full disassembly this seal-based machine requires: all product-contact
-- parts and the seals washed in the sink; the air cylinders / machine body wiped only, never
-- submerged; every seal inspected for wear and greased with food-approved grease on reassembly.
--
-- status stays 'draft'. Activating SOP-903 (with SOP-503/FRM-911) is an approval decision.
-- Idempotent: guarded on sop_number, so re-running is a no-op and won't clobber later edits.

begin;

insert into public.sop_documents
  (sop_number, title, type, category, status, revision, sqf_reference, sqf_required, content)
select
  'SOP-903',
  'SSOP — Beldos 275 Depositor',
  'sop',
  'Module 11',
  'draft',
  'New',
  '11.2.5.1, 11.2.5.3, 11.2.5.7',
  true,
  $json$
{
  "purpose": "To clean and sanitize the Beldos 275 depositor after production so it is safe and ready for the next run.",
  "scope": "The depositor and its product-contact parts — nozzle, hopper, rotation cylinder, hopper block, product cylinder, piston, and all seals / O-rings — washed in the sink. The air cylinders and the machine body are wiped only, never submerged. Cleaning is done at the end of every production day the machine is used, and a full clean again between products (always when the allergens differ).\n\nOperating the depositor is SOP-503. The seal-replacement schedule, air system and repairs are Maintenance, not sanitation.",
  "responsibility": "Sanitation / Production staff — perform the cleaning, inspect the seals, and record it on FRM-911.\nSupervisor — checks the machine before the next run and signs the release on FRM-911.\n\nThe clean and its pre-use release are recorded on FRM-911 because the plant sanitation forms cannot hold them: FRM-901 Master Sanitation Schedule and FRM-902 Sanitation Verification Log are Word-document attachments (not fillable), and FRM-903 GMP Pre-Operation Inspection is scoped to the glass dial cover / MIG thermometer check. The depositor should still be listed on the FRM-901 Master Sanitation Schedule for its cleaning frequency.",
  "procedure": [
    "Two rules before you start: (1) turn the machine OFF, then disconnect the air line and bleed off the pressure before you touch anything — nothing comes apart until the air is off; (2) never submerge the air cylinders or the machine body in water — wipe them only; water in the air cylinders will damage the machine (the manufacturer's own warning).",
    "Disassemble: take the depositor fully apart — nozzle, then hopper (and its seal), then rotation cylinder (release the hook), then hopper block and pin, then product cylinder, then piston. Then remove every seal / O-ring from the pistons, cylinders and spouts — they all come off for a proper clean. Scrape/empty any product left in the parts before washing.",
    "Wash the parts in the sink: the product-contact parts and all the seals are washed in the sink — lukewarm water + soft detergent, rinse, sanitizing solution at label strength, then onto the drying rack to air dry. Don't towel them dry; that undoes the sanitizing. Store clean, dry and protected. Check the sanitizer strength with a test strip and record the reading on FRM-911.",
    "The machine body (wipe only): wipe the base, the air cylinders and the outside of the machine with a damp cloth. Never submerge them. Nothing wet goes near the air fittings.",
    "Inspect the seals — wear and foreign matter: every seal/O-ring is rubber that wears, and a worn seal both spoils the deposits and can shed rubber into product. So at each clean, inspect every seal for wear, splits, flattening or missing pieces; replace any worn or damaged seal before reassembly (and keep to Maintenance's replacement schedule — the weekly O-ring check / O-ring board). If a seal is torn or a piece is missing, find the piece and hold any product that could be affected (see SOP-503) before the machine runs again.",
    "Changing between products with different allergens: follow SOP-204 Allergen Cleaning Procedure — it governs allergen changeover on all shared equipment, including this depositor. On top of the clean above, check every food-contact surface under good light before the next product: inside the cylinders and hopper block, the piston, the nozzle bore, and the rotation cylinder. Anything you can see, re-clean.",
    "Reassemble and release: reassemble with every seal in place and greased (Beldos food-approved grease), all clamps tight, and the correct nozzle fitted; refit the safety connector. The Supervisor checks and signs the release on FRM-911 — all parts clean and dry and the machine body wiped; seals inspected, worn ones replaced, none torn or missing a piece; clamps tight, correct nozzle fitted, nothing left on the machine; sanitizer strength recorded. The depositor is not ready for production until FRM-911 is signed."
  ],
  "form_references": "FRM-911 — Depositor Cleaning & Pre-Use Check Log (the clean and its pre-use release)\nFRM-901 — Master Sanitation Schedule (list the depositor as a line to set its cleaning frequency)\nSOP-204 — Allergen Cleaning Procedure (changeover between different allergens)\nSOP-503 — Operating the Beldos 275 Depositor",
  "records": "The clean and its pre-use release are recorded on FRM-911, retained per the record retention policy.",
  "governing_reference": "SQF Food Safety Code: Food Manufacturing, Edition 9 — 11.2.5.1 (documented cleaning method), 11.2.5.3 (sanitizer concentration verified and recorded), 11.2.5.7 (inspection before production).\nBeldos N.V. — Manual for end user, Depositor 275 series, © 2020 (disassemble and wash daily; remove all seals for cleaning; do not submerge the air cylinders).\nFDA 21 CFR Part 117 Subpart B — Current Good Manufacturing Practice.",
  "revision_history": "New — 2026-07-25 — Initial issue. Written to the daily disassembly the machine requires: all product-contact parts and seals washed in the sink; air cylinders/body wiped only; seals inspected and greased with food-approved grease. Records on FRM-911."
}
$json$::jsonb
where not exists (
  select 1 from public.sop_documents where sop_number = 'SOP-903'
);

commit;
