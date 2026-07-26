-- SOP-505 (Operating the Revent 724 Rack Oven / Baking) — create the SOP row.
--
-- Baking is a production step, so this sits in the Production block (500s) after mixing/depositing/
-- kettle (SOP-501..504); category 'Job-Specific Operations' and SQF 11.2.1.2 match SOP-504 (kettle
-- operation), the closest sibling. SOP-505 = next 500s number.
--
-- The bakery's oven is the GAS-fired Revent 724 (nameplate: SU-3 conversion burner, natural or LP gas,
-- 200,000-400,000 BTU) — a rotating rack oven with the HVS steam system, automatic damper, rack lift,
-- and the GIAC control panel (stored programs; 95-572 °F). The supplied PDF was a thin spec/feature
-- sheet (and was the /E electric variant); operation/safety/cleaning were researched and grounded in
-- rotating-rack-oven references, then written to the gas unit per the nameplate. Vendor (Revent) named
-- per owner.
--
-- SQF ref verified against src/lib/sqfFoodClauses.ts:
--   11.2.1.2 — plant and equipment maintained under a maintenance control schedule so equipment
--     functions as intended (same clause SOP-504 uses for equipment operation/maintenance).
--
-- Machine-specific hazards in the body: GAS (leak procedure - shut the manual valve, don't switch or
-- light anything, ventilate, evacuate); hot surfaces + the steam BLAST when the door opens; the
-- rotating rack + door interlock (never bypass). Burner/gas service, steam-system descaling,
-- temperature calibration, electrical, and repairs are Maintenance. Bake temp/time recorded on the
-- batch sheet (no separate FRM). Content written WITHOUT "→" arrows so the pdfmake/Roboto PDF renders
-- cleanly.
--
-- Body shape matches the Word importer / SopBodyEditor. status stays 'draft' (activation is a later
-- approval decision). Draft rows do not fire the sop_documents_history snapshot. Idempotent: guarded
-- on sop_number.

begin;

insert into public.sop_documents
  (sop_number, title, type, category, status, revision, sqf_reference, sqf_required, content)
select
  'SOP-505',
  'Operating the Revent 724 Rack Oven (Baking)',
  'sop',
  'Job-Specific Operations',
  'draft',
  'New',
  '11.2.1.2',
  true,
  $json$
{
  "purpose": "To run the Revent rack oven safely and bake each product to its set program — even bake, correct colour, and the right steam for crust.\n\nTwo hazards drive the rules below. It is a gas oven — a gas leak is a fire/explosion risk. And everything about a hot rack oven burns: the surfaces, the racks, and the blast of steam when the door opens.",
  "scope": "Production/baking staff loading, running, and unloading the Revent 724.\n\nGas/burner service and conversion, steam-system descaling, temperature calibration, electrical, and repairs are Maintenance — not operators. The daily wipe-down is part of running the oven.",
  "responsibility": "Operators — set up and bake as written; stop and report a gas smell, weak steam, uneven bake, or any fault.\nSupervisor — trains and signs off operators; takes the oven out of service on a fault.\nMaintenance — gas, burner, steam system/descaling, temperature calibration, electrical, and repair, with the gas off and the oven cool.",
  "procedure": [
    "Before you start — training: do not operate this oven unless the Supervisor has trained and signed you off. Checks: the oven interior is clean and clear, the door seal/gasket is sound, and the rack lift works; the steam water supply is on, the gas is on, and the canopy/exhaust is running (the space above the oven must stay below 120 °F). Gas safety — if you smell gas: do not switch anything on or off and do not light the oven; shut the manual gas valve, ventilate the area, leave, and tell the Supervisor / Maintenance / the gas company, and do not use the oven until it is cleared. Get ready: dry oven mitts, sleeves secured, hair back; when you open the door, stand to the side and open it slowly (a hot steam blast comes out). The rack rotates while the door is closed; opening the door stops the rotation (door interlock) — never bypass it.",
    "Preheat: on the GIAC panel select the product's program (or set the temperature), and let the oven reach temperature before loading (loading cold wastes the bake). Temperature range is 95 to 572 °F.",
    "Load the rack: roll the rack onto the lift / into the oven with the product stable and not touching the walls or each other. Close the door fully — this engages the interlock and the rack begins to rotate.",
    "Bake: run the product's program (temperature, time, steam, damper); up to four products can run with the multiple-alarm. Steam (HVS): apply steam at the start as the program calls for — it sets the crust and texture. Damper: kept closed early to hold steam, opened near the end to vent and dry/set the crust. Watch through the window; don't open the door mid-bake unless you have to (you lose heat and steam).",
    "When it's done: at the alarm, open the damper to vent the steam, then open the door slowly and remove the rack with the lift — the rack, pans, and product are hot. Check the bake (even colour, fully baked). Record the oven temperature and bake time on the batch sheet.",
    "Shut down: end of the day, set energy-save or off on the panel and let the oven cool; confirm the burner is off. Shut the manual gas valve if site policy requires.",
    "Daily clean: once the oven has cooled, wipe the interior, door glass, and seal, and clear crumbs/spills from the floor and any crumb tray. Do not hose it down or wash it with water. Report scale build-up, weak steam, or a damper fault to Maintenance (steam-system descaling is Maintenance).",
    "If something goes wrong: Smell of gas — manual gas valve off, ventilate, leave, tell the Supervisor/gas company; don't switch or light anything. Won't heat / won't ignite — check the gas is on and the panel setting; if it won't light, get Maintenance (operators don't service the burner). Uneven bake or colour — check the rack is seated and rotating, the damper/steam settings, and the door seal; if it persists, get Maintenance (fan/TCC, calibration). Weak or no steam — check the water supply is on; scale build-up gets Maintenance to descale the steam system. Smoke or fire — shut the gas, evacuate, and follow the fire procedure."
  ],
  "form_references": "Batch sheet — oven temperature, bake time, and steam setting per product.",
  "records": "Oven temperature and bake time are recorded on the batch sheet for the run. Operator training sign-off is held in the training record. All retained per the record retention policy.",
  "governing_reference": "SQF Food Safety Code: Food Manufacturing, Edition 9 — 11.2.1.2 (plant and equipment maintained under a maintenance schedule so equipment functions as intended).\nRevent 724 Installation & Operation Manual (R-724 rack oven) — GIAC control, HVS steam, damper, rack lift.\nGas: ANSI Z21.17 / CSA 2.7 conversion burner (per nameplate); NFPA 54 National Fuel Gas Code.\nOSHA 29 CFR 1910.147 — Control of Hazardous Energy (gas off / power off before servicing).",
  "revision_history": "New — 2026-07-26 — Initial issue for the Revent 724 gas-fired rotating rack oven. Built from the Revent 724 spec sheet and nameplate (SU-3 gas burner, 200-400k BTU, 95-572 °F, HVS steam, GIAC panel, automatic damper, rack lift) plus general rotating-rack-oven operation/safety references (limited data in the supplied PDF, remainder researched). One page for floor use: gas-leak procedure, hot-surface/steam-blast and rotating-rack/door-interlock safety, GIAC preheat, load, steam+damper bake, vent-and-unload, energy-save shutdown, daily wipe-down. Burner/gas, steam descaling, calibration, and repairs left to Maintenance. Bake temp/time recorded on the batch sheet (no separate FRM). Vendor (Revent) named per owner."
}
$json$::jsonb
where not exists (
  select 1 from public.sop_documents where sop_number = 'SOP-505'
);

commit;
