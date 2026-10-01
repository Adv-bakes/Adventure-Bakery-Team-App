// Tests for src/lib/visitors.ts - who a returning visitor is, whether their GMP acknowledgement
// still counts, and what the two entries (FRM-905, FRM-906) contain.
//
// Run from the repo root:  node scripts/test-visitors.mjs
//
// The last block is the one that ties the page to the controlled forms: the data the page builds is
// validated against the real FRM-905 / FRM-906 schemas in sop-drafts/, so a required field the page
// forgets to fill fails here rather than at the door with a visitor waiting.

import { execFileSync } from "node:child_process";
import { mkdtempSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const out = mkdtempSync(join(tmpdir(), "visitors-"));

// shell:true because on Windows the bin is a .cmd shim, which spawnSync refuses to exec directly.
function bundle(src, name) {
  const file = join(out, name);
  execFileSync("npx", ["esbuild", src, "--bundle", "--format=esm", `--outfile=${file}`],
    { stdio: ["ignore", "ignore", "inherit"], shell: true });
  return import("file://" + file.replace(/\\/g, "/"));
}

const V = await bundle("src/lib/visitors.ts", "visitors.mjs");
const F = await bundle("src/lib/formSchema.ts", "schema.mjs");
const S905 = JSON.parse(readFileSync("sop-drafts/FRM-905-visitor-signin-schema.json", "utf8"));
const S906 = JSON.parse(readFileSync("sop-drafts/FRM-906-visitor-gmp-acknowledgement-schema.json", "utf8"));

let failed = 0;
let passed = 0;
function check(label, got, want) {
  if (JSON.stringify(got) === JSON.stringify(want)) { passed++; return; }
  failed++;
  console.log(`  FAIL ${label}\n       got:  ${JSON.stringify(got)}\n       want: ${JSON.stringify(want)}`);
}

const rec = (id, name, company, phone, ackDate, formRevision = "v3") => ({ id, name, company, phone, ackDate, formRevision });
const INDEX = [
  rec("a1", "Maria Lopez", "Acme Pest", "(407) 555-4471", "2026-03-02"),
  rec("a2", "Maria Lopez", "Acme Pest", "(407) 555-4471", "2025-02-01", "v2"),
  rec("b1", "José Pérez", "Sysco", "4471", "2026-09-30"),
  rec("c1", "Sam Carter", "", "", "2026-08-15"),
  rec("d1", "Samantha Reed", "Carter Mechanical", "321-555-0199", "2026-01-10"),
];
const names = q => V.findVisitorMatches(INDEX, q).map(m => `${m.name}|${m.ack.id}`);

// ---- phone helpers
check("last4 of a formatted number", V.last4("(407) 555-4471"), "4471");
check("last4 of four digits", V.last4("4471"), "4471");
check("last4 of too few digits", V.last4("47"), "");
check("last4 of nothing", V.last4(null), "");

// ---- lookup
check("last four finds both people who share them, newest ack each", names("4471"), ["José Pérez|b1", "Maria Lopez|a1"]);
check("full number finds a visitor who gave only the last four", names("407-555-4471"), ["José Pérez|b1", "Maria Lopez|a1"]);
check("a different full number", names("3215550199"), ["Samantha Reed|d1"]);
check("three digits match nobody", names("447"), []);
check("one letter matches nobody", names("m"), []);
check("empty matches nobody", names("   "), []);
check("name prefix", names("mar"), ["Maria Lopez|a1"]);
check("accents folded", names("jose perez"), ["José Pérez|b1"]);
check("word order does not matter", names("lopez maria"), ["Maria Lopez|a1"]);
check("company is searched too", names("carter"), ["Sam Carter|c1", "Samantha Reed|d1"]);
check("every word must match", names("sam reed"), ["Samantha Reed|d1"]);
check("mid-word text does not match", names("aria"), []);
check("a visitor with no phone is not found by digits", names("0000"), []);

// ---- twelve months
check("addMonths plain", V.addMonthsIso("2026-10-01", 12), "2027-10-01");
check("addMonths clamps to month end", V.addMonthsIso("2026-01-31", 1), "2026-02-28");
check("addMonths leap day", V.addMonthsIso("2024-02-29", 12), "2025-02-28");
check("addMonths backwards", V.addMonthsIso("2026-10-01", -1), "2026-09-01");

const ack = rec("x", "A", "", "", "2026-10-01");
check("valid on the day it is signed", V.ackState(ack, "v3", "2026-10-01"), { valid: true, expiresOn: "2027-10-01" });
check("valid on the last day", V.ackState(ack, "v3", "2027-09-30").valid, true);
check("expired on the anniversary", V.ackState(ack, "v3", "2027-10-01"), { valid: false, reason: "expired" });
check("a revised form invalidates it", V.ackState(ack, "v4", "2026-10-02"), { valid: false, reason: "revised" });
check("an old-revision ack is invalid even when recent", V.ackState(INDEX[1], "v3", "2025-02-02"), { valid: false, reason: "revised" });
check("no acknowledgement", V.ackState(null, "v3", "2026-10-01"), { valid: false, reason: "none" });
check("unreadable date", V.ackState(rec("y", "A", "", "", ""), "v3", "2026-10-01"), { valid: false, reason: "none" });
check("a date in the future is not valid", V.ackState(ack, "v3", "2026-09-30"), { valid: false, reason: "expired" });

// ---- which schemas the page takes over
check("v4 FRM-905 is the kiosk flow", V.isVisitorKioskSchema(S905), true);
check("v4 FRM-906 is the kiosk flow", V.isVisitorKioskSchema(S906), true);
check("a schema that also needs a host signature is not (v3)", V.isVisitorKioskSchema({ sections: [{ fields: [
  { id: "visitor_signature", type: "signature", capture: "drawn" }, { id: "host_signature", type: "signature" }] }] }), false);
check("a stamp-signature schema is not (v2)", V.isVisitorKioskSchema({ sections: [{ fields: [{ id: "visitor_signature", type: "signature" }] }] }), false);
check("no schema is not", V.isVisitorKioskSchema(null), false);
check("FRM-905 is a visitor form", V.isVisitorForm("FRM-905"), true);
check("FRM-507 is not", V.isVisitorForm("FRM-507"), false);

// ---- the entries, against the real schemas
const AT = new Date(2026, 9, 1, 9, 5); // 1 Oct 2026 09:05 local
const PNG = "data:image/png;base64,iVBORw0KGgo=";
const answers = {
  name: "  Maria Lopez ", company: "Acme Pest", phone: "4471", purpose: "Pest control", host: "Gabriela Mercer",
  noSymptoms: "pass", woundsCovered: "na", healthNotes: "", signatureImage: PNG,
};
const validate = (schema, data) => F.buildZodSchema(schema).safeParse({ ...F.emptyValues(schema), ...data });
const ids = schema => F.valueFields(schema).map(f => f.id);

const ackData = V.buildAckData(answers, AT);
const ackCheck = validate(S906, ackData);
check("FRM-906 entry passes its schema", ackCheck.success, true);
check("FRM-906 keeps the drawn image through validation", ackCheck.success && ackCheck.data.visitor_signature.image, PNG);
check("FRM-906 visitor signature is not a staff stamp", ackData.visitor_signature.user_id, null);
check("FRM-906 name trimmed", ackData.visitor_name, "Maria Lopez");
check("FRM-906 date", ackData.ack_date, "2026-10-01");
check("FRM-906 title", F.instanceTitle(S906, { data: ackData, created_at: AT.toISOString() }).includes("Maria Lopez"), true);
check("FRM-906 has no host signature to give", ids(S906).includes("briefed_by"), false);

const visit = V.buildSignInData(answers, AT, { id: "ack-1", ackDate: "2026-10-01" });
const visitCheck = validate(S905, visit);
check("FRM-905 entry passes its schema", visitCheck.success, true);
check("FRM-905 keeps the drawn image through validation", visitCheck.success && visitCheck.data.visitor_signature.image, PNG);
check("FRM-905 records the acknowledgement relied on", [visit.ack_response_id, visit.ack_date], ["ack-1", "2026-10-01"]);
check("FRM-905 route is briefed", visit.entry_route, V.ROUTE_BRIEFED);
check("FRM-905 time in, no time out", [visit.time_in, visit.time_out], ["09:05", ""]);
check("FRM-905 host is who the visitor came to see", visit.host, "Gabriela Mercer");
check("FRM-905 has no host signature to give", ids(S905).includes("host_signature"), false);
check("the visitor's statement carries what the host used to attest",
  ["11.3.4.2", "11.3.4.4"].every(c =>
    S905.sections.flatMap(s => s.fields).find(f => f.id === "visitor_signature").statement.includes(c)), true);
// visitor_sign_in rejects an answer key the form does not have, so this is what keeps it working.
check("every key the page writes is a field of FRM-905", Object.keys(visit).filter(k => !ids(S905).includes(k)), []);
check("every key the page writes is a field of FRM-906", Object.keys(ackData).filter(k => !ids(S906).includes(k)), []);
check("the validated FRM-905 payload carries no key the form lacks",
  Object.keys(visitCheck.data).filter(k => !ids(S905).includes(k)), []);
check("route options are spelled as the schema spells them",
  [V.ROUTE_BRIEFED, V.ROUTE_REFUSED].every(r =>
    S905.sections.flatMap(s => s.fields).find(f => f.id === "entry_route").options.includes(r)), true);

const firstVisit = V.buildSignInData(answers, AT, null);
check("first visit: the server fills in the acknowledgement", [firstVisit.ack_response_id, firstVisit.ack_date], ["", ""]);
check("first visit entry passes its schema", validate(S905, firstVisit).success, true);
check("a visit with no host is rejected", validate(S905, V.buildSignInData({ ...answers, host: " " }, AT, null)).success, false);

const refused = V.buildSignInData({ ...answers, noSymptoms: "fail" }, AT, { id: "ack-1", ackDate: "2026-10-01" });
check("a declared symptom is a refusal", V.isRefused({ noSymptoms: "fail" }), true);
check("refused: route", refused.entry_route, V.ROUTE_REFUSED);
check("refused: never on site", [refused.time_in, refused.time_out], ["09:05", "09:05"]);
check("refused: relies on no acknowledgement", [refused.ack_response_id, refused.ack_date], ["", ""]);
check("refused: note says why", /refused/i.test(refused.entry_notes), true);
check("refused entry passes its schema", validate(S905, refused).success, true);

// ---- what must NOT pass
check("FRM-905 without a drawing is rejected",
  validate(S905, { ...visit, visitor_signature: { ...visit.visitor_signature, image: undefined } }).success, false);
check("FRM-905 with a non-PNG image is rejected",
  validate(S905, { ...visit, visitor_signature: { ...visit.visitor_signature, image: "javascript:alert(1)" } }).success, false);
check("FRM-905 without the health answer is rejected", validate(S905, { ...visit, no_symptoms: "" }).success, false);
check("FRM-906 unsigned is rejected", validate(S906, { ...ackData, visitor_signature: null }).success, false);

console.log(`${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
