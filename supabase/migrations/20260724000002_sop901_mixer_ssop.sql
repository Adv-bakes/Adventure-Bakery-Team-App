-- SOP-901 (Sanitation / SSOP — Hobart V-1401 Planetary Mixer) — create the SOP row.
--
-- Why: the mixer SSOP existed only as a markdown draft in sop-drafts/. The SOP Library reads the
-- sop_documents table, so a draft on disk never appears there. This inserts the structured SOP body
-- (the same shape the Word importer / SopBodyEditor use: purpose, scope, responsibility, procedure[],
-- form_references, records, governing_reference, revision_history) so it renders in the Document tab
-- and exports to PDF.
--
-- Numbering: SOP-901 uses the stage-block scheme (900s = Sanitation & GMP), NOT the SQF-clause SOP
-- scheme (SOP-11.2.5), on purpose — every piece of equipment needs its own sanitation SOP and they
-- would all collide on 11.2.5. Cross-reference to SQF is via sqf_reference (renders as clause chips).
-- The three cited clauses were verified against src/lib/sqfFoodClauses.ts: 11.2.5.1 (documented
-- cleaning method), 11.2.5.3 (mixed sanitizer concentration correct + recorded), 11.2.5.7 (pre-op
-- inspection before production).
--
-- Records: SOP-901 points at FRM-909 (Mixer Cleaning & Pre-Use Check Log, seeded by
-- 20260724000001). The plant forms FRM-901/902 are Word attachments (not fillable) and FRM-903 is a
-- glass check, so none could hold the mixer's record — see that migration's header.
--
-- Scope note: SOP-501 (mixer OPERATION) is deliberately NOT created here. Per the owner's call it is
-- to be applied to the existing "The Mixing Station" record rather than inserted as a new row; that
-- is a separate change.
--
-- status stays 'draft'. Activating SOP-901 (and SOP-501/FRM-909 with it) is an approval decision.
-- Idempotent: guarded on sop_number, so re-running is a no-op and won't clobber later edits.

begin;

insert into public.sop_documents
  (sop_number, title, type, category, status, revision, sqf_reference, sqf_required, content)
select
  'SOP-901',
  'SSOP — Hobart V-1401 Planetary Mixer',
  'sop',
  'Module 11',
  'draft',
  'New',
  '11.2.5.1, 11.2.5.3, 11.2.5.7',
  true,
  $json$
{
  "purpose": "To clean and sanitize the Hobart V-1401 mixer after production so it is safe and ready for the next day's batch.",
  "scope": "The mixer, its bowl, and its agitators (paddle, whip, dough arm). Cleaning is done at the end of every production day the mixer is used, and again between products when the allergens differ.\n\nOperating the mixer is SOP-501. Lubrication and repairs are Maintenance, not sanitation.",
  "responsibility": "Sanitation / Production staff — perform the cleaning and record it on FRM-909.\nSupervisor — checks the machine before the next run and signs the release on FRM-909.\n\nThe clean and its pre-use release are recorded on FRM-909 because the plant sanitation forms cannot hold them: FRM-901 Master Sanitation Schedule and FRM-902 Sanitation Verification Log are Word-document attachments (not fillable), and FRM-903 GMP Pre-Operation Inspection is scoped to the glass dial cover / MIG thermometer check. The mixer should still be listed on the FRM-901 Master Sanitation Schedule for its cleaning frequency.",
  "procedure": [
    "Before you start: unplug the mixer before wiping it, and never hose or pressure-wash it — damp cloth only. Water driven into the electrics or the transmission will destroy the machine (the manufacturer's own instruction).",
    "The machine: lower the bowl and unplug the power.",
    "Remove the bowl and the agitator.",
    "Dry wipe the whole machine — top, levers and controls, column, bowl yoke and support, down to the footers. Get loose flour and dried batter off before any water.",
    "Wet wipe with a damp cloth and detergent, same coverage, top down; wipe off the detergent with a second cloth and clean water, and let it air dry.",
    "Check the drip cup under the planetary is clean and dry. If there is oil in it, do not run the machine — tell the Supervisor and Maintenance (it sits directly over the bowl, so oil there can get into product).",
    "Plug the mixer back in once everything is dry and reassembled.",
    "The bowl: break it down and remove all residual ingredients; rinse with warm water; scrub with detergent; empty out.",
    "Run the bowl through the pan washer on the high-temperature cycle — the hot final rinse is what sanitizes it, so the cycle temperature matters. Store clean, dry and inverted. If the washer is down, wash and sanitize the bowl by hand in the sink the same way as the agitators.",
    "The paddle, whip and dough arm: wash in the sink — detergent, rinse, sanitizing solution at label strength, then onto the drying rack to air dry. Do not towel them dry; that undoes the sanitizing.",
    "Check the sanitizer strength with a test strip and record the reading on FRM-909.",
    "Allergen changeover (a different allergen next): follow SOP-204 Allergen Cleaning Procedure. On top of the clean above, check every food contact surface under good light before the next product — bowl inside and under the rim, the agitator including the wire crossings and the shank, and the agitator shaft. Re-clean anything you can see.",
    "Before the next run: the Supervisor checks and signs the release on FRM-909 — bowl, agitator and machine clean and dry; drip cup clear of oil; nothing left on the machine; sanitizer strength recorded. The mixer is not ready for production until FRM-909 is signed."
  ],
  "form_references": "FRM-909 — Mixer Cleaning & Pre-Use Check Log (the clean and its pre-use release)\nFRM-901 — Master Sanitation Schedule (list the mixer as a line to set its cleaning frequency)\nSOP-204 — Allergen Cleaning Procedure (changeover between different allergens)\nSOP-501 — Operating the Hobart V-1401 Mixer",
  "records": "The clean and its pre-use release are recorded on FRM-909, retained per the record retention policy.",
  "governing_reference": "SQF Food Safety Code: Food Manufacturing, Edition 9 — 11.2.5.1 (documented cleaning method), 11.2.5.3 (mixed sanitizer concentration correct and recorded), 11.2.5.7 (inspection before production).\nHobart Corporation Form 13966A Rev. 6-82 — Instruction Manual, Model V-1401 Series Mixers (clean daily; no hose; damp cloth only).\nFDA 21 CFR Part 117 Subpart B — Current Good Manufacturing Practice.",
  "revision_history": "New — 2026-07-24 — Initial issue. Written to the cleaning process actually performed on the floor; records on FRM-909."
}
$json$::jsonb
where not exists (
  select 1 from public.sop_documents where sop_number = 'SOP-901'
);

commit;
