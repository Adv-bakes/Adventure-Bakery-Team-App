-- SOP-503 (Operating the Beldos 275 Depositor) — create the SOP row.
--
-- Third piece of equipment done the same way as the mixer (SOP-501) and the Kook-E-King depositor
-- (SOP-502): an operation SOP (SOP-503), a sanitation SSOP (SOP-903, migration 20260725000002), and
-- a fillable clean/pre-use log (FRM-911, 20260725000003). Machine: Beldos 275-series pneumatic
-- (compressed-air) piston depositor (Beldos N.V. end-user manual, © 2020).
--
-- Numbering: SOP-503 = stage-block 500s (Production & Batching), NOT the SQF-clause SOP scheme —
-- SOP-501 is the mixer and SOP-502 the KEK depositor, so this is the next production SOP. Each
-- machine gets its own operation SOP; they'd all collide on one clause under the clause scheme.
--
-- SQF refs verified against src/lib/sqfFoodClauses.ts:
--   11.2.1.7 — food-contact equipment lubricated with FOOD-GRADE lubricant. The seals/O-rings are
--     food-contact rubber and the grease on them touches product; the floor uses Beldos food-approved
--     (food-grade) grease, so this is satisfied, not open.
--   11.7.3.1 — equipment kept free of potential contaminants; parts not deteriorated.
--   11.7.3.9 — gaskets, rubber, and other materials that wear inspected on a regular frequency. Both
--     cover the machine-specific risk: a worn/torn seal gives bad deposits AND can shed rubber into
--     product. The SOP requires holding product and finding the piece if a seal tears.
--
-- No Beldos record exists yet, so this INSERTs a new row. Body shape matches the Word importer /
-- SopBodyEditor (purpose, scope, responsibility, procedure[], form_references, records,
-- governing_reference, revision_history) so it renders in the Document tab and exports to PDF.
--
-- status stays 'draft'. Activating SOP-503/SOP-903/FRM-911 together is an approval decision. Since the
-- row is draft, this does not fire the sop_documents_history snapshot (trigger is WHEN
-- old.status='active').
--
-- Idempotent: guarded on sop_number, so re-running is a no-op and won't clobber later edits.

begin;

insert into public.sop_documents
  (sop_number, title, type, category, status, revision, sqf_reference, sqf_required, content)
select
  'SOP-503',
  'Operating the Beldos 275 Depositor',
  'sop',
  'Job-Specific Operations',
  'draft',
  'New',
  '11.2.1.7, 11.7.3.1, 11.7.3.9',
  true,
  $json$
{
  "purpose": "To set up and run the Beldos 275 depositor safely and get accurate, consistent deposits.\n\nTwo things about this machine drive the rules below. It is air-powered — always bled and disconnected from the air before it's opened. And it runs on rubber seals / O-rings: a worn seal gives bad deposits and can shed rubber into the product, so seals are watched, inspected, and changed on a schedule.",
  "scope": "Production staff setting up, running, or unloading the depositor for any product it deposits (batter, filling, cream).\n\nCleaning is SOP-903. The seal-replacement schedule, air system, and repairs are Maintenance — operators change a seal only as trained.",
  "responsibility": "Operators — set up, run, and unload as written; stop and report bad deposits or worn seals.\nSupervisor — trains and signs off operators; takes the machine out of service on a fault; signs the pre-use release on FRM-911.\nMaintenance — air system, seal-replacement schedule (the O-ring board), and repair, with the air disconnected.",
  "procedure": [
    "Before you start — training: do not operate this depositor unless the Supervisor has trained and signed you off.",
    "Pre-start checks (machine OFF): FRM-911 is signed for this shift (if not, the machine hasn't been released for production); the depositor is fully assembled with all seals in place and greased (Beldos food-approved grease), all clamps tight, and the correct nozzle fitted — before the hopper is filled; air is fed through the air dryer and set to max 7 Bar / 102 PSI (never higher); the frame wheel brakes are engaged; any part new or just back from cleaning that touches product has been washed in hot water and detergent first (stainless parts carry a factory protective coating). Anything fails → don't run it; tag it and tell the Supervisor.",
    "Get yourself ready: sleeves down and secured, no dangling ties or lanyards, no rings, watches or bracelets, hair fully in a hairnet. Keep fingers and hands away from moving parts and the deposit outlet.",
    "Set the deposit — Speed: set the Speed Control OUT knob (clockwise slows, counter-clockwise speeds up); for heavy or aerated products (mousse, meringue) Maintenance can raise the internal speed regulator. Volume / weight: with the machine off, turn the handwheel (clockwise = less, counter-clockwise = more); run 2–3 cycles, weigh the last deposit, adjust, and note the % setting for next time. Changing the speed can change the volume — re-check the weight after any speed change.",
    "Run: keep the hopper more than half full — a near-empty hopper sucks air and gives inconsistent deposits; scrape high-viscosity product down the sides periodically. If the product splashes, lower the deposit speed. Temperature limits: product or water through the machine at most 60 °C with the Normal rotation cylinder, at most 110 °C with the Hot cylinder — never exceed them.",
    "Watch the deposits and the seals: irregular or inconsistent deposits usually mean a worn or damaged seal (an air leak at a piston) or an empty hopper sucking air. If it's the seal, stop and have the seal replaced before running again. If a seal is torn or missing a piece, treat it as possible rubber in the product — hold the product back to the last good check and tell the Supervisor and Quality.",
    "New batch / changing product: same or compatible product — fill the hopper, discharge 3–4 deposits into a bowl and add them back, then check the weight. Different product — scrape the hopper down and deposit until nothing more comes out, pour in a bucket of warm water, wipe clean, and cycle the water out. A different allergen next means a full changeover clean under SOP-903 / SOP-204 first.",
    "Shut down: turn the machine OFF, disconnect the air line and bleed off the pressure, and hand over to sanitation (SOP-903).",
    "If something goes wrong — Won't cycle: check air pressure/supply and the dryer; check the speed regulator is tight; check for an obstruction in the product cylinder. Cylinder goes forward but not back, or machine-gun strokes: speed regulator loose/broken or air hoses blocked — get Maintenance. Irregular deposits: worn/damaged seal (air leak) → replace it, or hopper near empty → refill/scrape (hold product if a seal is torn — see above). Product dripping from the nozzle: use the suck-back regulator under the base. Any part hot beyond the limits, or air over 7 Bar: stop — you're outside the machine's limits.",
    "Seals and grease: the seals/O-rings are food-contact rubber and the grease on them touches product, so both are controlled — only Beldos food-approved (food-grade) grease is used, and worn seals are replaced on a set schedule (the manual's weekly O-ring check / O-ring board). This satisfies SQF 11.2.1.7 and 11.7.3.9. The replacement schedule is Maintenance's; sanitation inspects every seal at each clean (SOP-903)."
  ],
  "form_references": "Batch sheet / settings chart for the product (nozzle, cylinder size, speed, volume %)\nFRM-911 — Depositor Cleaning & Pre-Use Check Log (the clean and its release before a run)\nSOP-903 — Beldos 275 Depositor Sanitation",
  "records": "Deposit settings (nozzle, cylinder size, speed, volume %) go on the batch sheet / settings chart. The clean and the pre-use release are recorded on FRM-911. Operator training sign-off is held in the training record. All retained per the record retention policy.",
  "governing_reference": "SQF Food Safety Code: Food Manufacturing, Edition 9 — 11.2.1.7 (food-grade lubricant on food contact), 11.7.3.1 (equipment free of potential contaminants; parts not deteriorated), 11.7.3.9 (gaskets/rubber that wear inspected on a regular frequency).\nBeldos N.V. — Manual for end user, Depositor 275 series, © 2020.\nOSHA 29 CFR 1910.147 — Control of Hazardous Energy (bleed and disconnect the air before opening).",
  "revision_history": "New — 2026-07-25 — Initial issue. Written from the Beldos 275 end-user manual (2020); one page for floor use, air-system and seal-replacement-schedule detail left to Maintenance's remit."
}
$json$::jsonb
where not exists (
  select 1 from public.sop_documents where sop_number = 'SOP-503'
);

commit;
