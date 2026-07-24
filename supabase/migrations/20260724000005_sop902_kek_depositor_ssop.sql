-- SOP-902 (Sanitation / SSOP — Rhodes Kook-E-King Cookie Depositor) — create the SOP row.
--
-- The depositor's sanitation SSOP, companion to SOP-502 (operation, 20260724000004) and FRM-910
-- (clean/pre-use log, 20260724000006). Machine: Rhodes Kook-E-King Super Automatic, after serial
-- 07SA-2002.
--
-- Numbering: SOP-902 uses the stage-block scheme (900s = Sanitation & GMP), NOT the SQF-clause SOP
-- scheme — SOP-901 is the mixer SSOP, so the depositor is the next sanitation SOP. Every piece of
-- equipment needs its own sanitation SOP and they'd all collide on 11.2.5 under the clause scheme.
-- Cross-reference to SQF is via sqf_reference (renders as clause chips). Clauses verified against
-- src/lib/sqfFoodClauses.ts: 11.2.5.1 (documented cleaning method), 11.2.5.3 (mixed sanitizer
-- concentration correct + recorded), 11.2.5.7 (pre-op inspection before production).
--
-- Process is written to what the floor actually does (confirmed with operators):
--   * Hopper, feed rollers, die and scrapers come off and are washed in the SINK — detergent, rinse,
--     sanitizer at label strength, air-dry on the rack. Nothing goes through the pan washer.
--   * The cut-off WIRE and its support fingers STAY on the machine (it isn't practical to take the
--     wire off) and are wiped clean in place, with a foreign-matter integrity check.
--   * The cabinet, depositing head and table belts are wiped (no excessive water, nothing on the
--     control panel — the manufacturer's warning).
-- Records go on FRM-910. FRM-901/902 are Word attachments and FRM-903 is a glass check, so none could
-- hold the depositor's record — same reason the mixer got FRM-909.
--
-- status stays 'draft'. Activating the set is an approval decision.
-- Idempotent: guarded on sop_number, so re-running is a no-op and won't clobber later edits.

begin;

insert into public.sop_documents
  (sop_number, title, type, category, status, revision, sqf_reference, sqf_required, content)
select
  'SOP-902',
  'SSOP — Rhodes Kook-E-King Cookie Depositor',
  'sop',
  'Module 11',
  'draft',
  'New',
  '11.2.5.1, 11.2.5.3, 11.2.5.7',
  true,
  $json$
{
  "purpose": "To clean and sanitize the Kook-E-King cookie depositor after production so it is safe and ready for the next day's run.",
  "scope": "The depositor and its food-contact parts. Hopper, the two feed rollers, the die and the scrapers come off and are washed in the sink. The cut-off wire and its support fingers stay on the machine — it isn't practical to take the wire off, so they are wiped clean in place. Cleaning is done at the end of every production day the machine is used, and a full clean again between products when the allergens differ.\n\nOperating the depositor is SOP-502. Lubrication and repairs are Maintenance, not sanitation.",
  "responsibility": "Sanitation / Production staff — perform the cleaning and record it on FRM-910.\nSupervisor — checks the machine before the next run and signs the release on FRM-910.\n\nThe clean and its pre-use release are recorded on FRM-910 because the plant sanitation forms cannot hold them: FRM-901 Master Sanitation Schedule and FRM-902 Sanitation Verification Log are Word-document attachments (not fillable), and FRM-903 GMP Pre-Operation Inspection is scoped to the glass dial cover / MIG thermometer check. The depositor should still be listed on the FRM-901 Master Sanitation Schedule for its cleaning frequency.",
  "procedure": [
    "Before you start: stop with the wire clear of the die (furthest-back position), then unplug the machine. Never hose or pressure-wash the machine — damp cloth only on the cabinet and depositing head. Water in the control panel or the motors will destroy it (the manufacturer's own warning).",
    "Break it down: swing the side guard open and remove the gear guard; loosen the hopper knobs, release the hopper hooks and lift the hopper straight up off the head; remove the feed rollers and scrape the dough out of the roller grooves with the roller scraper (don't remove the gears); support the die, loosen the six thumbscrews and let it drop out below; remove the scrapers; save reusable dough from between the rollers and die for the next run. The hopper, feed rollers, die and scrapers go to the sink; the cut-off wire and support fingers stay on.",
    "The machine (wipe only): clear dough fragments from the die slot and the inside of the depositing head where the rollers sit; dry wipe the head interior, top of the cabinet and the table belts to get loose dough off; damp wipe the same surfaces with detergent, wipe clean with a second damp cloth and let air dry. No excessive water; nothing on the control panel.",
    "Wash the removable parts in the sink: the hopper, feed rollers, die and scrapers are washed detergent, rinse, sanitizing solution at label strength, then onto the drying rack to air dry. Don't towel them dry; that undoes the sanitizing. Store clean, dry and protected.",
    "Check the sanitizer strength with a test strip and record the reading on FRM-910.",
    "The cut-off wire and fingers — wipe in place + foreign-matter check: the wire and its support fingers stay on the machine; wipe them clean in place, don't run them through the sink. While wiping, check the wire is whole (not frayed, kinked or missing a section) and that there is still one support finger seated in each die slot. If any piece of wire is missing, find it before the machine runs again and hold any product that could be affected (a broken wire is metal in the product). If the wire is frayed or damaged, fit a fresh assembly (Maintenance) before the next run.",
    "Allergen changeover (a different allergen next): follow SOP-204 Allergen Cleaning Procedure. On top of the clean above, check every food-contact surface under good light before the next product — the die holes, the roller grooves, the hopper, the wire and fingers, and the scrapers. Re-clean anything you can see.",
    "Reassemble: reinstall the die (finger-tight only) in a clean slot and the feed rollers (food-safe oil on the bushings — see SOP-502), refit the hopper, confirm a support finger is seated in each die slot, and return both guards to their locked positions.",
    "Before the next run: the Supervisor checks and signs the release on FRM-910 — hopper, rollers, die and scrapers clean and dry; wire and fingers wiped clean and the wire accounted for; machine wiped down with nothing left on it and guards locked; sanitizer strength recorded. The depositor is not ready for production until FRM-910 is signed."
  ],
  "form_references": "FRM-910 — Depositor Cleaning & Pre-Use Check Log (the clean and its pre-use release)\nFRM-901 — Master Sanitation Schedule (list the depositor as a line to set its cleaning frequency)\nSOP-204 — Allergen Cleaning Procedure (changeover between different allergens)\nSOP-502 — Operating the Rhodes Kook-E-King Cookie Depositor",
  "records": "The clean and its pre-use release are recorded on FRM-910, retained per the record retention policy.",
  "governing_reference": "SQF Food Safety Code: Food Manufacturing, Edition 9 — 11.2.5.1 (documented cleaning method), 11.2.5.3 (sanitizer concentration verified and recorded), 11.2.5.7 (inspection before production).\nPractical Baker — Rhodes Kook-E-King Super Automatic Instruction Manual, V.3B Jan 2013 (clean the head/cabinet with a damp cloth; no excessive water; nothing on electrical components).\nFDA 21 CFR Part 117 Subpart B — Current Good Manufacturing Practice.",
  "revision_history": "New — 2026-07-24 — Initial issue. Written to the process actually performed on the floor: hopper, rollers, die and scrapers washed in the sink; cut-off wire and fingers wiped in place; cabinet/head/belts wiped; food-safe oil on the bushings. Records on FRM-910."
}
$json$::jsonb
where not exists (
  select 1 from public.sop_documents where sop_number = 'SOP-902'
);

commit;
