-- SOP-501 (Operating the Hobart V-1401 Mixer) — write the operation body into the EXISTING
-- "The Mixing Station" record instead of creating a second mixer document.
--
-- Why UPDATE, not INSERT: "The Mixing Station" (id 167a1535-…, status draft, category Job-Specific
-- Operations) already exists, unnumbered, holding only the Hobart manual PDF + a mixer video. Per the
-- owner's call SOP-501 adopts that record: assign the number and merge the structured operation body
-- in, so there aren't two active mixer documents with no way to tell which governs.
--
-- content is MERGED (||) so the existing `attachments` (manual + video) are preserved; only body keys
-- are added. Title kept as "The Mixing Station" (matches the sibling station guides, e.g. The Weighing
-- Station) — rename later if desired. Category kept as Job-Specific Operations.
--
-- Numbering: SOP-501 = stage-block 500s (Production & Batching), not the SQF-clause scheme (every
-- machine would collide on one clause). SQF refs 11.2.1.1 / 11.2.1.2 / 11.2.1.7 are ported from the
-- reviewed draft and verified present in src/lib/sqfFoodClauses.ts. NOTE for the quality owner:
-- 11.2.1.1/11.2.1.2 are maintenance-program clauses; on an operation SOP the strongest hook is
-- 11.2.1.7 (food-grade lubricant on equipment over food contact — the drip-cup stop-line rule).
-- Trim 11.2.1.1/2 if you'd rather the clause chips point only at what this SOP actually implements.
--
-- status stays 'draft'. Activating SOP-501 (with SOP-901 / FRM-909) is an approval decision. Since the
-- row is draft, this UPDATE does not fire the sop_documents_history snapshot (trigger is WHEN
-- old.status='active').
--
-- Idempotent: guarded so it only writes while the row is still un-numbered — once sop_number='SOP-501'
-- is set, re-running is a no-op and won't clobber later edits to the body.

begin;

update public.sop_documents set
  sop_number    = 'SOP-501',
  revision      = 'New',
  sqf_reference = '11.2.1.1, 11.2.1.2, 11.2.1.7',
  sqf_required  = true,
  content = content || $json$
{
  "purpose": "To run the Hobart V-1401 mixer safely and get a consistent batch.\n\nThis mixer has no bowl guard — the agitator is exposed whenever the bowl is up, and it will take a hand off. Every rule below about staying out of the bowl is there because nothing else will stop you.",
  "scope": "Production staff operating, loading, or unloading the mixer.\n\nCleaning is SOP-901. Lubrication, agitator clearance, and repairs are Maintenance — not operators.",
  "responsibility": "Operators — run the mixer as written; stop and report anything unusual.\nSupervisor — trains and signs off operators; takes the machine out of service on a fault.\nMaintenance — all lubrication, adjustment, and repair, with the power locked out.",
  "procedure": [
    "Before you start — training: do not operate this mixer unless the Supervisor has trained and signed you off.",
    "Pre-start checks (machine stopped): FRM-909 is signed for this shift (if not, the mixer hasn't been released for production); drip cup in place, clean and dry — no oil; bowl and agitator clean and undamaged, no cracks or loose whip wires; available aprons and covers on, controls and buttons work, oil gauge between the middle and the top; floor dry and clear. Anything fails → don't run it; tag it and tell the Supervisor.",
    "Get yourself ready: sleeves down and secured, no loose apron ties, no dangling lanyards, no rings, watches or bracelets, hair fully in a hairnet. Anything that can be caught, will be.",
    "Fit the bowl — bowl first, always: clutch to STOP and press STOP; lower the bowl lift all the way down; bring the bowl in on the bowl truck (don't carry it); square alignment bracket to the back, locating studs into the holes in the bowl; raise the yoke until the bowl seats; lock BOTH bowl clamps over the ears. A clamp that isn't closed lets the bowl move into the agitator.",
    "Fit the agitator: with the bowl in and fully lowered, push the agitator shank up onto the shaft and turn it clockwise until it latches; tug down to check. An unlatched agitator drops into the batch.",
    "Load: charge ingredients with the agitator stopped — clutch at STOP, STOP button pressed. Check the batch sheet's allergens against the last product run; if they differ, the mixer needs an allergen changeover clean under SOP-901 first. Keep pens, tape, thermometers and spare utensils away from the open bowl.",
    "Mix: clutch at STOP; set the speed from the batch sheet; set the timer (or HOLD for untimed — for under 3 minutes, turn past 3 and back); press START; move the clutch handle to RUN. To stop: clutch to STOP, then press STOP.",
    "Change speed mid-batch: clutch to STOP, wait for the agitator to stop completely, move the selector seated on a number (never between numbers), then clutch back to RUN. Shifting under load wrecks the transmission.",
    "Speeds: 1 Low — dough, heavy batters, and working flour in without throwing dust; 2 Medium-Low — cake batters and developing dough; 3 Medium-High — working air into light batches; 4 High — maximum aeration, light batches only. Never start a full bowl in 3 or 4 — start low, bring it together, then step up.",
    "While it's running: never put a hand, scraper, cloth or thermometer into a moving bowl (to scrape down or sample: clutch STOP, press STOP, wait until it has completely stopped, then reach in); never leave it running unattended; don't lean over the open bowl; stand clear of the bowl yoke when the bowl moves under power (crush point); stop immediately on any odd noise, vibration, smell or smoke.",
    "Unload: clutch to STOP, press STOP, wait for it to stop completely; lower the bowl; remove the agitator; unlock both clamps before lowering the bowl onto the truck; hand over to sanitation (SOP-901).",
    "If something goes wrong — Won't start: check the speed selector is seated on a number; otherwise it's the power supply or an overload — get Maintenance. Stalls under load: press STOP, reduce the batch or clear the obstruction; don't restart against a stall in a lower speed. Agitator touching the bowl: stop, check both clamps are closed; if it still touches, tag it out and get Maintenance — and hold the batch, there may be metal in it. Squealing from the planetary: tell Maintenance, don't oil it yourself. Oil in the drip cup or on the shaft: stop, tag it out, tell Quality and Maintenance, and hold any product mixed since the last clear check.",
    "Safety — no bowl guard: this mixer has no bowl guard, so the agitator is exposed whenever the bowl is up. A retrofit interlocked guard is sold for this model (Hobart 00-875820). Work practices reduce the risk but are not a substitute for a guard; fitting one or replacing the machine is a management decision tracked outside this SOP."
  ],
  "form_references": "Batch sheet for the product (governs agitator, speed, time, batch size)\nFRM-909 — Mixer Cleaning & Pre-Use Check Log (the mixer's clean and its release before a run)\nSOP-901 — Mixer Sanitation",
  "records": "Mixing parameters go on the batch sheet. The clean and the pre-use release are recorded on FRM-909. Operator training sign-off is held in the training record. All retained per the record retention policy.",
  "governing_reference": "SQF Food Safety Code: Food Manufacturing, Edition 9 — 11.2.1.1, 11.2.1.2, 11.2.1.7.\nHobart Corporation Form 13966A Rev. 6-82 — Instruction Manual, Model V-1401 Series Mixers.\nOSHA 29 CFR 1910.212(a)(1) and (a)(3)(ii) — machine guarding.\nOSHA 29 CFR 1910.147 — Lockout/Tagout.",
  "revision_history": "New — 2026-07-24 — Initial issue. Written from Hobart Form 13966A (1982) and Form 33785 (2001); cut to one page for floor use, with lubrication / adjustment / repair detail left to Maintenance's remit."
}
$json$::jsonb
where id = '167a1535-494c-43d4-92dd-aabfcaad7874'
  and coalesce(sop_number, '') <> 'SOP-501';

commit;
