-- SOP-904 (SSOP — Groen TDB Steam-Jacketed Kettle) — create the SOP row.
--
-- The sanitation SSOP for the Groen kettle. Pairs with SOP-504 (operation, 20260726000001) and
-- FRM-912 (clean/pre-use log, 20260726000003).
--
-- Numbering: SOP-904 uses the stage-block scheme (900s = Sanitation & GMP) — SOP-901 mixer, 902 KEK,
-- 903 Beldos, so this is the next. (SOP-904 was briefly drafted for the Smipack shrink wrapper, then
-- dropped when the operator confirmed that machine needs no cleaning doc; it was never migrated, so
-- the number is free.) Clauses verified against src/lib/sqfFoodClauses.ts: 11.2.5.1 (documented
-- cleaning method), 11.2.5.3 (mixed sanitizer concentration correct + recorded), 11.2.5.7 (pre-op
-- inspection before production).
--
-- Cleaned IN PLACE (a kettle isn't disassembled to a sink): scrape (no metal/steel wool) → detergent
-- wash inside & out → hot-water rinse & drain → sanitize. Sanitizer is the site's Noble Chemical
-- Sani-512 (a quat), food-contact mix 1:512, NO-RINSE (wet ≥1 min, air dry) — NOT the manual's default
-- chlorine, so the chlorine cautions (≤30 min on stainless / rinse off) are deliberately absent.
-- End-of-production-day frequency; hand-tilt (TDB) unit.
--
-- status stays 'draft'. Idempotent: guarded on sop_number.

begin;

insert into public.sop_documents
  (sop_number, title, type, category, status, revision, sqf_reference, sqf_required, content)
select
  'SOP-904',
  'SSOP — Groen TDB Steam-Jacketed Kettle',
  'sop',
  'Module 11',
  'draft',
  'New',
  '11.2.5.1, 11.2.5.3, 11.2.5.7',
  true,
  $json$
{
  "purpose": "To clean and sanitize the Groen kettle so it is safe and ready for the next batch.",
  "scope": "The kettle's food-contact surfaces — the interior, the rim and pouring lip, the cover, and any baskets/strainers used — plus the outside, controls and housing. The kettle is cleaned in place (it isn't taken apart or put in a sink). Cleaning is done at the end of every production day the kettle is used — as soon as possible after use, while the kettle is still warm — and a full clean again between products when the allergens differ.\n\nOperating the kettle is SOP-504. Jacket water, greasing and repairs are Maintenance, not sanitation.",
  "responsibility": "Sanitation / Production staff — perform the cleaning and record it on FRM-912.\nSupervisor — checks the kettle before the next run and signs the release on FRM-912.\n\nThe clean and its pre-use release are recorded on FRM-912 because the plant sanitation forms cannot hold them: FRM-901 Master Sanitation Schedule and FRM-902 Sanitation Verification Log are Word-document attachments (not fillable), and FRM-903 GMP Pre-Operation Inspection is scoped to the glass dial cover / MIG thermometer check. The kettle should still be listed on the FRM-901 Master Sanitation Schedule for its cleaning frequency.",
  "procedure": [
    "Two rules before you start: (1) turn the thermostat to OFF and shut off power at the breaker before cleaning; let the kettle cool enough to work safely — but clean while still warm, not cold, so residue lifts easily. (2) Keep water and cleaning solutions out of the controls and electrical parts, and never use a high-pressure hose on the kettle; the outside is washed with warm water only.",
    "Scrape and wash: scrape and flush out large food residues using the kettle brushes / plastic or rubber scrapers — no metal tools, no steel wool, no abrasive pads (scratches harbor bacteria and steel wool leaves particles that corrode the stainless). Wash the inside and outside with detergent solution at label strength; for burned-on residue, let the detergent soak a few minutes, then brush — don't gouge it off. Don't forget the rim and pouring lip, the underside of the cover, baskets/strainers, and wipe the controls and housing with a cloth moistened with cleaning solution.",
    "Rinse and drain: rinse thoroughly with hot water and drain the kettle completely. If a hard-water film or mineral deposit is left, use a de-liming agent per its label.",
    "Sanitize (Noble Sani-512, no-rinse): after cleaning and draining, sanitize the food-contact surfaces with Noble Chemical Sani-512 mixed for food-contact use at 1:512 — 1 fl oz per 4 gallons of water (0.25 oz per gallon). Wet every food-contact surface and leave it for at least 1 minute, then let it air dry; Sani-512 is a no-rinse sanitizer at this dilution — do not rinse it off. Record the sanitizer strength on FRM-912. Sanitize again just before the next use (the release step).",
    "Changing between products with different allergens: follow SOP-204 Allergen Cleaning Procedure — it governs allergen changeover on all shared equipment, including this kettle. On top of the clean above, check every food-contact surface under good light before the next product: the kettle interior and bottom, the rim and pouring lip, under the cover, and any baskets or strainers. Anything you can see, re-clean.",
    "Before the next run — release: the Supervisor checks and signs the release on FRM-912 — kettle clean inside and out (rim, pouring lip, cover and any baskets clean); no detergent residue, food-contact surfaces sanitized with Sani-512 and air-dried, sanitizer strength recorded; sanitized just before use; jacket water level at the sight-glass midpoint (from SOP-504's daily check). The kettle is not ready for production until FRM-912 is signed."
  ],
  "form_references": "FRM-912 — Kettle Cleaning & Pre-Use Check Log (the clean and its pre-use release)\nFRM-901 — Master Sanitation Schedule (list the kettle as a line to set its cleaning frequency)\nSOP-204 — Allergen Cleaning Procedure (changeover between different allergens)\nSOP-504 — Operating the Groen TDB Steam-Jacketed Kettle",
  "records": "The clean and its pre-use release are recorded on FRM-912, retained per the record retention policy.",
  "governing_reference": "SQF Food Safety Code: Food Manufacturing, Edition 9 — 11.2.5.1 (documented cleaning method), 11.2.5.3 (sanitizer concentration verified and recorded), 11.2.5.7 (inspection before production).\nUnified Brands / Groen — TDB/TDBC Steam Jacketed Kettle Operator Manual (P/N 148733) — clean food contact surfaces after use while warm; no metal tools / steel wool; keep water out of the controls; sanitize just before use.\nNoble Chemical Sani-512 (quaternary sanitizer) — food-contact use at 1:512 (1 fl oz per 4 gallons); no-rinse: wet the surface at least 1 minute and let it air dry.\nFDA 21 CFR Part 117 Subpart B — Current Good Manufacturing Practice.",
  "revision_history": "New — 2026-07-25 — Initial issue, written as a clean-in-place process from the Groen/Unified Brands operator manual: scrape (no metal/steel wool) → detergent wash inside & out → hot-water rinse & drain → sanitize with Noble Sani-512 quat (1:512, no-rinse — wet ≥1 min, air dry) → sanitize just before use. End-of-production-day frequency; hand-tilt (TDB). Records on FRM-912."
}
$json$::jsonb
where not exists (
  select 1 from public.sop_documents where sop_number = 'SOP-904'
);

commit;
