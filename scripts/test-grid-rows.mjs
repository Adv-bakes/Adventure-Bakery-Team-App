// Tests for supabase/functions/_shared/gridRows.ts - placing the rows read from a PDF onto a
// fixed-row table by their label (extract-form-answers, document mode).
//
//   node scripts/test-grid-rows.mjs
//
// Exit code is non-zero if any case fails.

import { execFileSync } from "node:child_process";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const out = mkdtempSync(join(tmpdir(), "gridrows-"));
const file = join(out, "gridRows.mjs");
execFileSync("npx", ["esbuild", "supabase/functions/_shared/gridRows.ts", "--bundle", "--format=esm", `--outfile=${file}`],
  { stdio: ["ignore", "ignore", "inherit"], shell: true });
const T = await import("file://" + file.replace(/\\/g, "/"));

let failures = 0, cases = 0;
function check(name, actual, expected) {
  cases++;
  const a = JSON.stringify(actual), e = JSON.stringify(expected);
  if (a === e) return;
  failures++;
  console.error(`FAIL ${name}\n  expected ${e}\n  actual   ${a}`);
}

// FRM-903's equipment table as the form has it.
const EQUIPMENT = [
  "Hobart V-1401 Mixer — SOP-901 / FRM-909",
  "Kook-E-King Depositor — SOP-902 / FRM-910",
  "Beldos 275 Depositor — SOP-903 / FRM-911",
  "Smipack S560NA Shrink Wrapper — SOP-601",
  "Groen TDB Kettle — SOP-904 / FRM-912",
  "Molds — SOP-906 (recorded here)",
];
const statuses = (p) => p.rows.map(r => r?.status ?? null);

// The 2026-10-08 record, in document order, labels as printed.
{
  const read = [
    { _row: "Hobart V-1401 Mixer — SOP-901 / FRM-909", status: "Clean & sanitized" },
    { _row: "Kook-E-King Depositor — SOP-902 / FRM-910", status: "Not used today" },
    { _row: "Beldos 275 Depositor — SOP-903 / FRM-911", status: "Clean & sanitized" },
    { _row: "Smipack S560NA Shrink Wrapper — SOP-601", status: "Between-use care (scrape, wipe, re-grease)" },
    { _row: "Groen TDB Kettle — SOP-904 / FRM-912", status: "Not used today" },
    { _row: "Molds — SOP-906 (recorded here)", status: "Between-use care (scrape, wipe, re-grease)" },
  ];
  const p = T.placeRowsByLabel(EQUIPMENT, read);
  check("placed by label", [p.byLabel, p.unmatched], [true, []]);
  check("every row lands on its own label", statuses(p), read.map(r => r.status));
  // The same rows in another order (a table continued over a page break, read page 2 first).
  check("order in the document does not matter", statuses(T.placeRowsByLabel(EQUIPMENT, [...read].reverse())), read.map(r => r.status));
  // A row the model missed leaves a gap; nothing slides up into it.
  const missing = T.placeRowsByLabel(EQUIPMENT, read.filter((_, i) => i !== 1));
  check("a missed row is a gap, not a shift", statuses(missing), [read[0].status, null, read[2].status, read[3].status, read[4].status, read[5].status]);
}

// Spelling of the label: dashes, case and spacing do not matter; a label cut short still fits.
{
  const p = T.placeRowsByLabel(EQUIPMENT, [
    { _row: "kook-e-king depositor - SOP-902/FRM-910", status: "A" },
    { _row: "Molds", status: "B" },
    { _row: "Hobart V-1401 Mixer", status: "C" },
  ]);
  check("loose spelling and short labels", statuses(p), ["C", "A", null, null, null, "B"]);
  check("normLabel", T.normLabel("Kook-E-King Depositor — SOP-902 / FRM-910"), "kook e king depositor sop 902 frm 910");
}

// The pre-op table after Chopper left the form: the old record still has the row.
{
  const SURFACES = ["Tables", "Mixers", "Depositors", "Floors", "Handwash stations (clean, stocked, draining)"];
  const p = T.placeRowsByLabel(SURFACES, [
    { _row: "Tables", visibly_clean: "pass" },
    { _row: "Mixers", visibly_clean: "pass" },
    { _row: "Depositors", visibly_clean: "pass" },
    { _row: "Chopper", visibly_clean: "na" },
    { _row: "Floors", visibly_clean: "fail" },
    { _row: "Handwash stations (clean, stocked, draining)", visibly_clean: "pass" },
  ]);
  check("a row no longer on the form is reported, not placed", p.unmatched, ["Chopper"]);
  check("and the rows after it do not shift", p.rows.map(r => r?.visibly_clean ?? null), ["pass", "pass", "pass", "fail", "pass"]);
}

// Never guessed.
{
  const AMBIG = ["Depositor 1", "Depositor 2"];
  const p = T.placeRowsByLabel(AMBIG, [{ _row: "Depositor", status: "x" }]);
  check("a label that fits two rows is not placed", [statuses(p), p.unmatched], [[null, null], ["Depositor"]]);
  const twice = T.placeRowsByLabel(["Tables"], [{ _row: "Tables", s: 1 }, { _row: "tables", s: 2 }]);
  check("two rows for a label the form has once: the first is kept", twice.rows[0].s, 1);
  check("'Mixers' does not match 'Mix'", T.placeRowsByLabel(["Mixers"], [{ _row: "Mix", s: 1 }]).unmatched, ["Mix"]);
}

// One label printed on several rows (FRM-903's glass check): filled in document order.
{
  const GLASS = ["Processing Room", "Processing Room", "Processing Room"];
  const read = [
    { _row: "Processing Room", item: "Pan scrubber dials", undamaged: "pass" },
    { _row: "Processing Room", item: "Oven controls and door glass", undamaged: "fail" },
    { _row: "Processing Room", item: "MIG thermometers", undamaged: "pass" },
  ];
  const p = T.placeRowsByLabel(GLASS, read);
  check("three rows sharing a label all land", p.rows.map(r => r?.undamaged ?? null), ["pass", "fail", "pass"]);
  check("and none is reported", p.unmatched, []);
  // The model runs the label and the item together.
  const run = T.placeRowsByLabel(GLASS, read.map(r => ({ ...r, _row: `${r._row} ${r.item}` })));
  check("a label run together with the item still lands", [run.rows.map(r => r?.undamaged ?? null), run.unmatched], [["pass", "fail", "pass"], []]);
  // More rows in the document than the form has for that label: the extra is dropped, not shifted.
  const extra = T.placeRowsByLabel(GLASS.slice(0, 2), read);
  check("a fourth row of the label has nowhere to go", extra.rows.map(r => r?.item), ["Pan scrubber dials", "Oven controls and door glass"]);
  // A repeated label beside distinct ones.
  const mixed = T.placeRowsByLabel(["Office", "Processing Room", "Processing Room"], [
    { _row: "Processing Room", v: 1 }, { _row: "Office", v: 2 }, { _row: "Processing Room", v: 3 },
  ]);
  check("repeated and distinct labels together", mixed.rows.map(r => r?.v), [2, 1, 3]);
}

// No labels at all: the caller falls back to position.
{
  const p = T.placeRowsByLabel(EQUIPMENT, [{ status: "A" }, { status: "B" }]);
  check("no labels means not placed by label", [p.byLabel, p.rows.every(r => r === null)], [true, true].map((_, i) => i === 0 ? false : true));
  check("junk input", T.placeRowsByLabel(null, "nope"), { byLabel: false, rows: [], unmatched: [] });
  check("a blank label does not count", T.placeRowsByLabel(["Tables"], [{ _row: "  ", s: 1 }]).byLabel, false);
}

// ---------- what the document's own text says (the owner's FRM-903 record of 2026-10-08) ----------
{
  // The text layer exactly as pdfjs gives it in the browser, three pages.
  const PAGES = ["Adventure Bakery, LLC Revision Num. v6 \nForm Title Daily Sanitation, Pre-Operation & Release\nRecord\nFilled By Richard Mercer \nForm No. FRM-903 Submitted: 10/8/2026 2:49 PM \nDay / Shift \nDate: 2026-10-08 \nProduction area / line: — \nShift: 1st Shift \nProduct / batch run: Bahama Rum Cakes \n1. Pre-Operation Cleanliness Check \nSurface & equipment check \nVisibly clean Sanitized Corrective action / comments\nTables Pass Pass \nMixers Pass Pass \nBowls Pass Pass \nUtensils Pass Pass \nPans Pass Pass \nRacks Pass N/A \nOvens Pass N/A \nScales Pass N/A \nDepositors Pass Pass \nChopper N/A N/A \nFloors Pass N/A \nHandwash stations (clean, stocked,\ndraining) \nPass Pass \nRestrooms / sanitary facilities Pass Pass \nBreak room / lockers (staff amenities) Pass Pass \n2. Production Equipment — Cleaned & Sanitized per SSOP \nEquipment \nStatus Notes\nHobart V-1401 Mixer — SOP-901 / FRM-909 Clean & sanitized \nKook-E-King Depositor — SOP-902 / FRM-910 Not used today \nAdventure Bakery, LLC Confidential 1 \nThis document contains Confidential Commercial Information which constitutes TRADE SECRETS and is exempt from disclosure under the Freedom of Information Act\npursuant to 5 USC (b) (4) and may not be disclosed without prior written approval from Adventure Bakery, LLC.", "Status Notes\nBeldos 275 Depositor — SOP-903 / FRM-911 Clean & sanitized \nSmipack S560NA Shrink Wrapper — SOP-601 Between-use care (scrape,\nwipe, re-grease) \nGroen TDB Kettle — SOP-904 / FRM-912 Not used today \nMolds — SOP-906 (recorded here) Between-use care (scrape,\nwipe, re-grease) \n3. Detergent & Sanitizer Verification \nDetergent used: Dawn Professional \nDetergent concentration: 1-2 oz per 10 gallons \nDetergent within target?: Pass \nDetergent test method: Measured dose per sink fill \nSanitizer used: Noble Sani-512 \nConcentration (PPM): 200 ppm \nWithin target?: Pass \nTest method (e.g. test strip): Test strip \nFoot baths — use the HIGH-RANGE quat strip. The baths run Sani-512 at 1:160, roughly three times the 1:512 food-contact strength. The\n0-400 ppm strips used on equipment saturate at this concentration and will read high on a bath that has failed. Change the solution when\nthe strip reads below target, when the bath is visibly soiled, or when it has been diluted by water carried in or by washdown. \nFoot baths — Sani-512 at 1:160 \nReading (ppm) At strength? Clean & not\ndiluted?\nAction (none / recharged / changed)\nProduction entrance (from\noffice / break room / reception) \nPass Pass \nWalkthrough — production to\ninventory & packaging \nPass Pass \n4. Glass & Brittle Plastic Check \nGlass dial covers & MIG thermometers \nItem Undamage\nd\nCondition / comments Action taken\nProcessing Room Pan scrubber dials Pass \nProcessing Room Oven controls and door\nglass\nPass \nProcessing Room MIG thermometers Pass \n5. Operational GMP Check \nOperational GMP check \nConforms Corrective action / comments\nHair/beard nets worn; no exposed jewelry Pass \nAdventure Bakery, LLC Confidential 2 \nThis document contains Confidential Commercial Information which constitutes TRADE SECRETS and is exempt from disclosure under the Freedom of Information Act\npursuant to 5 USC (b) (4) and may not be disclosed without prior written approval from Adventure Bakery, LLC.", "Conforms Corrective action / comments\nClean outer garments; no eating/drinking/gum in\nproduction \nPass \nHandwash stations stocked (soap, towels,\nsanitizer) \nPass \nHands washed on entry and as required Pass \nAllergen controls / segregation followed Pass \nWaste and floor debris controlled Pass \nNo condensation or drip over exposed product Pass \nPest control devices in place and intact Pass \nDoors/screens to outside kept closed Pass \n6. Corrective Actions & Release \nAll corrective actions completed before start-up: Pass \nQA Technician (qualified inspector): Signed — Richard Mercer — 10/8/2026 2:49 PM \nProduction Supervisor: Signed — Richard Mercer — 10/8/2026 2:49 PM \nCreated: 10/8/2026 2:47 PM Status: submitted Submitted: 10/8/2026 2:49 PM\nAdventure Bakery, LLC Confidential 3 \nThis document contains Confidential Commercial Information which constitutes TRADE SECRETS and is exempt from disclosure under the Freedom of Information Act\npursuant to 5 USC (b) (4) and may not be disclosed without prior written approval from Adventure Bakery, LLC."];
  const words = T.textWords(PAGES);
  const SURFACE = [{ id: "visibly_clean", type: "pass_fail" }, { id: "sanitized", type: "pass_fail" }, { id: "corrective", type: "text" }];
  const EQUIP = [{ id: "status", type: "select", options: ["Clean & sanitized", "Between-use care (scrape, wipe, re-grease)", "Not used today"] }, { id: "notes", type: "text" }];
  const GMP = [{ id: "result", type: "pass_fail" }, { id: "corrective", type: "text" }];
  const surface = (label) => T.readRowFromText(words, label, SURFACE);

  check("Depositors is pass, pass - the cell a model read as N/A", surface("Depositors"), { visibly_clean: "pass", sanitized: "pass" });
  check("Racks is pass, n/a", surface("Racks"), { visibly_clean: "pass", sanitized: "na" });
  check("Floors is pass, n/a", surface("Floors"), { visibly_clean: "pass", sanitized: "na" });
  check("a label wrapped over two lines", surface("Handwash stations (clean, stocked, draining)"), { visibly_clean: "pass", sanitized: "pass" });
  check("every pre-operation row", ["Tables", "Mixers", "Bowls", "Utensils", "Pans", "Ovens", "Scales", "Restrooms / sanitary facilities", "Break room / lockers (staff amenities)"]
    .map(l => Object.values(surface(l)).join("/")), ["pass/pass", "pass/pass", "pass/pass", "pass/pass", "pass/pass", "pass/na", "pass/na", "pass/pass", "pass/pass"]);
  check("a row that is not in the document", surface("Slicer"), {});

  check("the machine a model read wrongly", T.readRowFromText(words, EQUIPMENT[1], EQUIP), { status: "Not used today" });
  check("every equipment row, one continued on page 2 and one wrapped", EQUIPMENT.map(l => T.readRowFromText(words, l, EQUIP).status), [
    "Clean & sanitized", "Not used today", "Clean & sanitized", "Between-use care (scrape, wipe, re-grease)", "Not used today", "Between-use care (scrape, wipe, re-grease)",
  ]);
  check("a single pass/fail column", T.readRowFromText(words, "Hair/beard nets worn; no exposed jewelry", GMP), { result: "pass" });
  check("a wrapped GMP row", T.readRowFromText(words, "Handwash stations stocked (soap, towels, sanitizer)", GMP), { result: "pass" });

  // Reading stops where the text stops being plain.
  check("a table that starts with a free-text column gives nothing", T.readRowFromText(words, "Production entrance (from office / break room / reception)", [{ id: "reading", type: "text" }, { id: "ok", type: "pass_fail" }]), {});
  check("stops at the first cell that is not a choice", T.readRowFromText(T.textWords(["Tables Pass smudged Pass"]), "Tables", SURFACE), { visibly_clean: "pass" });
  check("the same label twice with different choices is not used", T.readRowFromText(T.textWords(["Tables Pass Pass", "Tables Fail Pass"]), "Tables", SURFACE), {});
  check("the same label twice with the same choices is", T.readRowFromText(T.textWords(["Tables Pass N/A", "Tables Pass N/A"]), "Tables", SURFACE), { visibly_clean: "pass", sanitized: "na" });
  check("a scan has no text", T.readRowFromText(T.textWords([""]), "Tables", SURFACE), {});
  check("fail is read", T.readRowFromText(T.textWords(["Mixers Fail Pass re-cleaned"]), "Mixers", SURFACE), { visibly_clean: "fail", sanitized: "pass" });
}

rmSync(out, { recursive: true, force: true });
if (failures) { console.error(`\n${failures} of ${cases} checks failed`); process.exit(1); }
console.log(`grid rows: ${cases} checks passed`);
