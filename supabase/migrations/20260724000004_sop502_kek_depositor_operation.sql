-- SOP-502 (Operating the Rhodes Kook-E-King Cookie Depositor) — create the SOP row.
--
-- Second piece of equipment done the same way as the Hobart mixer: an operation SOP (SOP-502), a
-- sanitation SSOP (SOP-902, migration 20260724000005), and a fillable clean/pre-use log (FRM-910,
-- 20260724000006). Machine: Rhodes Kook-E-King Super Automatic cookie depositor, after serial
-- 07SA-2002 (Practical Baker manual, V.3B 2013).
--
-- Numbering: SOP-502 = stage-block 500s (Production & Batching), NOT the SQF-clause SOP scheme —
-- SOP-501 is the mixer ("The Mixing Station"), so the depositor is the next production SOP. Each
-- machine gets its own operation SOP; they'd all collide on one clause under the clause scheme.
--
-- SQF refs verified against src/lib/sqfFoodClauses.ts:
--   11.2.1.7 — food contact / over-food-contact equipment lubricated with FOOD-GRADE lubricant. The
--     manual calls for oil on the feed-roller bushings (right by the dough); the floor uses food-safe
--     (NSF H1) oil, so this is satisfied, not open.
--   11.7.3.1 — equipment kept free of potential contaminants; parts not detached/deteriorated.
--   11.7.3.7 — loose metal removed / not a hazard. Both cover the machine-specific risk: the cut-off
--     WIRE is thin steel under tension that can break into the product. The SOP requires holding
--     product back to the last good wire check and accounting for all the wire if it breaks.
--
-- Unlike the mixer's SOP-501 (which was UPDATEd onto the existing "The Mixing Station" record), no
-- depositor record exists yet, so this INSERTs a new row. Body shape matches the Word importer /
-- SopBodyEditor (purpose, scope, responsibility, procedure[], form_references, records,
-- governing_reference, revision_history) so it renders in the Document tab and exports to PDF.
--
-- status stays 'draft'. Activating SOP-502/SOP-902/FRM-910 together is an approval decision. Since the
-- row is draft, this does not fire the sop_documents_history snapshot (trigger is WHEN
-- old.status='active').
--
-- Idempotent: guarded on sop_number, so re-running is a no-op and won't clobber later edits.

begin;

insert into public.sop_documents
  (sop_number, title, type, category, status, revision, sqf_reference, sqf_required, content)
select
  'SOP-502',
  'Operating the Rhodes Kook-E-King Cookie Depositor',
  'sop',
  'Job-Specific Operations',
  'draft',
  'New',
  '11.2.1.7, 11.7.3.1, 11.7.3.7',
  true,
  $json$
{
  "purpose": "To run the Kook-E-King cookie depositor safely and get consistent, correctly spaced cookies.\n\nThe one food-safety risk specific to this machine is the cut-off wire — a thin steel wire under tension that can break during a run. A broken wire is metal in the product, so every rule below about checking the wire and holding product when it breaks matters.",
  "scope": "Production staff setting up, running, or unloading the depositor.\n\nCleaning is SOP-902. Motor / gear-reducer / chain lubrication and mechanical adjustment (wire-lift cam, scrapers, chain tension) are Maintenance — not operators.",
  "responsibility": "Operators — set up and run the machine as written; stop and report anything unusual.\nSupervisor — trains and signs off operators; takes the machine out of service on a fault; signs the pre-use release on FRM-910.\nMaintenance — lubrication, wire-lift/cam/scraper/chain adjustment, and repair, with the power unplugged.",
  "procedure": [
    "Before you start — training: do not operate this machine unless the Supervisor has trained and signed you off.",
    "Pre-start checks (machine unplugged): FRM-910 is signed for this shift (if not, the machine hasn't been released for production); the die is seated and its six thumbscrews are finger-tight only (over-tightening warps the head and leaks dough); the cut-off wire is present, not frayed or kinked, with one support finger in each die slot and the wire sitting in the small slots at the finger tips; both safety guards (side and gear) are closed and locked — the machine will not run with a guard open; the hopper is secure on its hooks; the cord and plug are undamaged; pans, table belts and the out-feed area are clean. Anything fails → don't run it; tag it and tell the Supervisor.",
    "Get yourself ready: sleeves down and secured, no dangling ties or lanyards, no rings, watches or bracelets, hair fully in a hairnet. Keep hands and clothing clear of the feed rollers, the wire, and the moving pans.",
    "Set up: unplug the machine; confirm a die is in the slot and the wire support fingers are aligned to the die slots; place an 18-inch sheet pan under the feed area and pull the pan extension out fully at the out-feed end; set Deposit Speed, Table Speed and Cut-Off Speed all to 1 (slowest); set the Cut-Off Timer switch to On.",
    "Load: load dough into the hopper spread end to end along the rollers, not heaped in the middle and not piled against the hopper sides (dough hanging on the sides feeds unevenly). Feed dough straight from the mixer where you can. Keep pens, tape, thermometers and spare utensils away from the open hopper.",
    "Start and dial it in: plug the machine in; press the green Power-On button at the front — the rollers turn and the pan travels forward; watch it and be ready to hit a red Stop button if anything binds or catches. Adjust while running (all three knobs adjust live): cookie size/thickness from Deposit Speed + Cut-Off Speed together; spacing down the pan from Cut-Off (faster = closer) and Table Speed (faster = further apart). Record your settings on the batch sheet / settings chart. Two red Stop buttons are on top of the cabinet; the green button restarts.",
    "Watch the cut-off wire: glance at the wire regularly. If the wire breaks or a piece is missing — stop the machine (red button) and unplug it; hold every pan back to the last confirmed-good wire check as possible metal in product (segregate and tag it, tell the Supervisor and Quality); account for all of the broken wire before anything restarts; fit a new wire assembly (Maintenance) before running again. If the wire keeps breaking, the machine may be out of alignment or need a different wire — stop and get Maintenance; don't just keep replacing it.",
    "Refill / short stops: when the hopper runs low, press a red Stop button, unplug, refill the hopper, then press the green button to restart.",
    "Shut down: to stop for cleaning, run the machine until the wire is fully clear of the die in its furthest-back position, press Stop, unplug, and hand over to sanitation (SOP-902).",
    "If something goes wrong — Nothing runs: check the cord is plugged in and both guards are closed (an open guard stops it). Everything runs except the wire cut-off: check the Cut-Off Timer switch and the control-panel fuse; if it persists, get Maintenance. Dough leaks out the back of the rollers: die thumbscrews too tight (loosen to finger-tight); check the hopper is seated and clean underneath; otherwise it's a scraper adjustment — Maintenance. Cookies uneven or different sizes on a row: spread dough end to end, don't overfill the hopper, don't run refrigerated dough; a bad center cookie is usually over-tight die thumbscrews. Odd noise, grinding or binding: stop immediately, unplug, get Maintenance.",
    "Lubricant: the manual calls for a couple of drops of oil on the brass bushings at the feed-roller shaft ends on reassembly. Those bushings sit right by the rollers that push the dough, so a food-safe (NSF H1) oil is used there — only food-safe oil is used on this machine (SQF 11.2.1.7). Lubrication is Maintenance's task, with the power unplugged."
  ],
  "form_references": "Batch sheet / settings chart for the product (die, speeds, spacing)\nFRM-910 — Depositor Cleaning & Pre-Use Check Log (the clean and its release before a run)\nSOP-902 — Depositor Sanitation",
  "records": "Deposit settings go on the batch sheet / settings chart. The clean and the pre-use release are recorded on FRM-910. Operator training sign-off is held in the training record. All retained per the record retention policy.",
  "governing_reference": "SQF Food Safety Code: Food Manufacturing, Edition 9 — 11.2.1.7 (food-grade lubricant on/over food contact), 11.7.3.1 (equipment free of potential contaminants; parts not detached or deteriorated), 11.7.3.7 (loose metal removed / not a hazard).\nPractical Baker — Rhodes Kook-E-King Super Automatic Instruction Manual, V.3B Jan 2013 (machines after serial 07SA-2002).\nOSHA 29 CFR 1910.212 — machine guarding.\nOSHA 29 CFR 1910.147 — Lockout/Tagout.",
  "revision_history": "New — 2026-07-24 — Initial issue. Written from the Practical Baker Super Automatic manual (V.3B, 2013); one page for floor use, mechanical adjustment left to Maintenance's remit."
}
$json$::jsonb
where not exists (
  select 1 from public.sop_documents where sop_number = 'SOP-502'
);

commit;
