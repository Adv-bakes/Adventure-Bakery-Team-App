-- SOP-605 (Operating the Flow Wrapper — S350X Rotary Pillow Packer) — create the SOP row.
--
-- Fifth PACKAGING machine and the last of the equipment batch. A horizontal flow wrapper (film-down
-- HFFS): folds food-grade film into a tube around the product, makes a mid (fin) seal, then a rotary
-- end-seal that seals and cuts each pack; color-mark magic eye registers the cut; two PID controls set
-- mid/end-seal temps; HMI sets speed/bag-length/cut-position (Track-cut for color-mark film, Set-length
-- cut for plain). SOP-605 = next 600s number; category 'Job-Specific Operations' (matches SOP-601..604).
--
-- Same food-contact basis as SOP-601 (Smipack shrink wrapper): the film wraps the baked product
-- DIRECTLY, so SQF 2.3.2.6 (packaging in direct food contact certified/approved; LOG/COC on file) and
-- 11.7.3.1 (equipment free of contaminants; film scraps / cutter debris are the foreign-matter hazard).
-- Both clauses previously verified against src/lib/sqfClauses.ts / sqfFoodClauses.ts for SOP-601/602.
--
-- Machine-specific hazards in the body: hot mid-seal heater + end-seal/cutter (~120 C, burns; film on
-- hot parts is a fire risk) and moving parts (sealing wheels, cutter, push-finger chain, conveyor);
-- E-stop (mushroom, reset to restart). Electrical/lubrication/cutter-belt/system-parameter setup left to
-- Maintenance / the commissioning technician; operators don't open the electrical cabinet. Settings +
-- seal/package check recorded on the batch record (no new FRM). Vendor (US Brother) named. Content
-- written WITHOUT "→" arrows so the pdfmake/Roboto PDF renders cleanly.
--
-- Body shape matches the Word importer / SopBodyEditor. status stays 'draft' (activation is a later
-- approval decision; a pre-activation item is confirming the food-grade film's certificate / letter of
-- guarantee is on file, which the SOP requires). Draft rows do not fire the sop_documents_history
-- snapshot. Idempotent: guarded on sop_number.

begin;

insert into public.sop_documents
  (sop_number, title, type, category, status, revision, sqf_reference, sqf_required, content)
select
  'SOP-605',
  'Operating the Flow Wrapper (S350X Rotary Pillow Packer)',
  'sop',
  'Job-Specific Operations',
  'draft',
  'New',
  '2.3.2.6, 11.7.3.1',
  true,
  $json$
{
  "purpose": "To run the flow wrapper safely and produce a well-sealed, correctly-cut pillow pack on the baked product.\n\nTwo things drive the rules below. The mid-seal heater and the end-seal/cutter are hot (the cutter runs around 120 C) and the sealing wheels, cutter, push-finger chain and conveyor are moving parts — both burn or catch. And the film wraps the baked product directly, so the film must be food-grade and film/cutter debris kept off the product.",
  "scope": "Packaging staff loading film, setting up, running, and clearing the S350X to wrap finished product.\n\nElectrical work, drive/cutter/bearing lubrication, cutter or belt replacement, and factory parameter/system setup are Maintenance / the commissioning technician — not operators. Operators don't open the electrical cabinet.",
  "responsibility": "Operators — set up and run as written; check seals and cut registration; stop and report bad seals, film on the hot parts, or faults.\nSupervisor — trains and signs off operators; approves the setup for the run; takes the machine out of service on a fault.\nMaintenance / commissioning technician — electrical, lubrication, cutter/belt wear, temperature and system settings, and repairs, with the power off.",
  "procedure": [
    "Before you start — training: do not operate this machine unless the Supervisor has trained and signed you off. Checks: the worktable, conveyor, and end-seal knives are clear of foreign matter and tools, and no one is inside the machine's working area; the film is the approved food-grade film (it touches the baked product directly), loaded on the correct route through the bag maker, mid-seal, and end-seal; guards/covers are in place and the emergency stop (mushroom) works. Hot parts and moving parts: never touch the sealing wheels, sealing die, cutter, or push-finger chain while the machine runs, and never reach inside without switching the power off.",
    "Set up the product: set the bag maker width and height to the product +5 mm. On the HMI set the packing speed, bag length, and cut position. Choose the cut mode — Track cut for film with color marks, or Set-length cut for plain film; for color-mark film, aim the magic eye at the color mark.",
    "Set the seal temperatures: set the mid-seal and end-seal PID temperatures for the film and speed. Target: no leaks and no burnt/crimped seals — too hot burns/crimples the seal, too cold leaves it loose or open.",
    "Test packs — verify before you run: inch or run slow and check the first packs — mid-seal tight with clear lines, end-seal complete, the cut clean and landing on the color mark, and the product centered in the pack and not caught by the cutter. Adjust cut position / push-finger / knife speed / temperature as needed. The Supervisor approves the setup. Don't run production until seals and cut are right.",
    "Run and monitor: press start (green). Through the run, check the seal and the cut on packs periodically. A pack with a loose, open, or burnt seal, or an off/torn cut, is a reject — set it aside. The film touches the baked product directly, so film scraps or cutter debris are foreign matter — if a fragment could have reached a baked product, segregate the affected packs and tell the Supervisor.",
    "Stop and per-shift clean: normal stop is the red stop button (parks the knife level); emergency is the mushroom E-stop (press reset to restart). Per shift, with the power OFF: wipe the table and surfaces with a clean damp cloth; blow film scraps off the feeding, mid-seal, and end-seal mechanisms with compressed air; brush film off the end-seal knife. (Lubrication and electrical are Maintenance — see the manual's monthly/biannual list.)",
    "If something goes wrong: Cut deviates from the color mark — use Track cut mode, check/adjust the magic eye, and check the film isn't slipping (tension/brake). Cutter cuts onto the product — re-sync the push-finger, set the cutter-seat height to half the product height, or slow the packing speed. Burnt / crimped seal — temperature too high or speed too low, so lower temp / raise speed and check the film. Loose or missed seal — temperature too low or speed too high, so raise temp / lower speed. Film on the hot seals/cutter — stop and clear it (power off / cool as needed); film on hot parts is a fire risk and a foreign-matter source. Smoke, burning smell, or flame — E-stop, cut power, and follow the fire procedure."
  ],
  "form_references": "Batch / settings record for the product (film, speed, bag length, cut position, mid/end-seal temperatures).",
  "records": "Film, speed, and seal/temperature settings and the seal/package check for the run are recorded on the batch record. Operator training sign-off is held in the training record. All retained per the record retention policy.",
  "governing_reference": "SQF Food Safety Code: Food Manufacturing, Edition 9 — 2.3.2.6 (packaging in direct food contact certified/approved for the use), 11.7.3.1 (equipment free of potential contaminants; parts not deteriorated).\nUS Brother — 350X (S350X) Rotary Pillow Packing Machine / Flowpack Instruction Manual.\nOSHA 29 CFR 1910.147 — Control of Hazardous Energy (power off before servicing); 1910.212 machine guarding.",
  "revision_history": "New — 2026-07-26 — Initial issue from the US Brother 350X (S350X) Rotary Pillow Packing Machine / Flowpack Instruction Manual; one page for floor use. Written as a flow-wrapping process: load approved food-grade film on the correct route, set bag-maker width/height (product +5 mm) and HMI speed/bag-length/cut-position, choose Track-cut (color-mark) or Set-length cut, set mid- and end-seal PID temps (no leak / no burnt crimple), test packs and verify seals + cut registration with Supervisor approval, monitor and reject bad seals/cuts, per-shift clean (power off; compressed air + brush off film scraps). Hot seal/cutter (~120 C) and moving-parts (sealing wheels, cutter, push-finger chain) safety and E-stop called out. Electrical/lubrication/cutter-belt/system setup left to Maintenance. Film confirmed as direct food contact — food-grade film required. Vendor (US Brother) named."
}
$json$::jsonb
where not exists (
  select 1 from public.sop_documents where sop_number = 'SOP-605'
);

commit;
