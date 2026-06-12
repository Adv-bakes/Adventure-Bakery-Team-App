#!/usr/bin/env node
// Stamps authored narration from a content JSON into a .pptx's speaker notes,
// so externally designed decks (Claude Design, Canva, agencies) work with the
// app's importer (which reads narration from notes — see src/lib/pptxNotes.ts).
//
// Usage:
//   node training-decks/inject-notes.mjs <deck.pptx> <content.json> [-o out.pptx]
//   node training-decks/inject-notes.mjs --strip <deck.pptx> -o <out.pptx>   (remove all notes)
//
// Injection maps content.slides[i].notes → slide i+1 in presentation order, so
// the deck must have exactly as many slides as the JSON. Existing notes are
// overwritten; decks with no notes parts at all get the full machinery added
// (notes slides, rels, content types, and a minimal notes master if missing).

import { readFileSync, writeFileSync } from "node:fs";
import JSZip from "jszip";

const REL_NS = "http://schemas.openxmlformats.org/package/2006/relationships";
const T = {
  slide: "http://schemas.openxmlformats.org/officeDocument/2006/relationships/slide",
  notesSlide: "http://schemas.openxmlformats.org/officeDocument/2006/relationships/notesSlide",
  notesMaster: "http://schemas.openxmlformats.org/officeDocument/2006/relationships/notesMaster",
  theme: "http://schemas.openxmlformats.org/officeDocument/2006/relationships/theme",
};
const CT = {
  notesSlide: "application/vnd.openxmlformats-officedocument.presentationml.notesSlide+xml",
  notesMaster: "application/vnd.openxmlformats-officedocument.presentationml.notesMaster+xml",
};

const esc = (s) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
  .replace(/"/g, "&quot;").replace(/'/g, "&apos;");

// --- tiny XML helpers (regex-based; parts are machine-generated and regular) ---

function parseRels(xml) {
  const rels = [];
  for (const tag of xml?.matchAll(/<Relationship\b[^>]*\/?>/g) ?? []) {
    const attr = (name) => tag[0].match(new RegExp(`${name}="([^"]*)"`))?.[1];
    rels.push({ id: attr("Id"), type: attr("Type"), target: attr("Target") });
  }
  return rels;
}

const relXml = (id, type, target) => `<Relationship Id="${id}" Type="${type}" Target="${target}"/>`;
const emptyRels = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n<Relationships xmlns="${REL_NS}"></Relationships>`;
const addRel = (xml, rel) => xml.replace(/<\/Relationships>/, `${rel}</Relationships>`);
const nextRelId = (rels) => `rId${rels.reduce((m, r) => Math.max(m, Number(r.id?.match(/\d+$/)?.[0] ?? 0)), 0) + 1}`;

function resolveTarget(baseDir, target) {
  const parts = (baseDir ? baseDir.split("/") : []).concat(target.split("/"));
  const out = [];
  for (const p of parts) {
    if (p === "" || p === ".") continue;
    if (p === "..") out.pop();
    else out.push(p);
  }
  return out.join("/");
}

async function slidePathsInOrder(zip) {
  const presXml = await zip.file("ppt/presentation.xml").async("string");
  const rels = parseRels(await zip.file("ppt/_rels/presentation.xml.rels").async("string"));
  const byId = new Map(rels.map(r => [r.id, r]));
  const paths = [];
  for (const m of presXml.matchAll(/<p:sldId\b[^>]*r:id="([^"]+)"/g)) {
    const rel = byId.get(m[1]);
    if (rel) paths.push(resolveTarget("ppt", rel.target));
  }
  return paths;
}

const notesSlideXml = (narration) => {
  const paras = narration.split(/\n+/).map(p => `<a:p><a:r><a:t>${esc(p)}</a:t></a:r></a:p>`).join("");
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<p:notes xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main">
<p:cSld><p:spTree><p:nvGrpSpPr><p:cNvPr id="1" name=""/><p:cNvGrpSpPr/><p:nvPr/></p:nvGrpSpPr><p:grpSpPr/>
<p:sp><p:nvSpPr><p:cNvPr id="2" name="Notes Placeholder"/><p:cNvSpPr><a:spLocks noGrp="1"/></p:cNvSpPr><p:nvPr><p:ph type="body" idx="1"/></p:nvPr></p:nvSpPr><p:spPr/>
<p:txBody><a:bodyPr/><a:lstStyle/>${paras}</p:txBody></p:sp>
</p:spTree></p:cSld><p:clrMapOvr><a:masterClrMapping/></p:clrMapOvr></p:notes>`;
};

const NOTES_MASTER_XML = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<p:notesMaster xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main">
<p:cSld><p:spTree><p:nvGrpSpPr><p:cNvPr id="1" name=""/><p:cNvGrpSpPr/><p:nvPr/></p:nvGrpSpPr><p:grpSpPr/></p:spTree></p:cSld>
<p:clrMap bg1="lt1" tx1="dk1" bg2="lt2" tx2="dk2" accent1="accent1" accent2="accent2" accent3="accent3" accent4="accent4" accent5="accent5" accent6="accent6" hlink="hlink" folHlink="folHlink"/>
</p:notesMaster>`;

function ensureContentTypeOverride(ctXml, partName, contentType) {
  if (ctXml.includes(`PartName="${partName}"`)) return ctXml;
  return ctXml.replace(/<\/Types>/, `<Override PartName="${partName}" ContentType="${contentType}"/></Types>`);
}

// --- strip mode: remove every notes part/reference (for testing & cleanup) ---

async function strip(zip) {
  const removed = [];
  zip.forEach((path) => {
    if (path.startsWith("ppt/notesSlides/") || path.startsWith("ppt/notesMasters/")) removed.push(path);
  });
  removed.forEach(p => zip.remove(p));

  for (const slidePath of await slidePathsInOrder(zip)) {
    const relsPath = slidePath.replace(/(slide\d+\.xml)$/, "_rels/$1.rels");
    const file = zip.file(relsPath);
    if (!file) continue;
    let xml = await file.async("string");
    xml = xml.replace(new RegExp(`<Relationship\\b[^>]*Type="${T.notesSlide}"[^>]*\\/?>`, "g"), "");
    zip.file(relsPath, xml);
  }

  let presRels = await zip.file("ppt/_rels/presentation.xml.rels").async("string");
  presRels = presRels.replace(new RegExp(`<Relationship\\b[^>]*Type="${T.notesMaster}"[^>]*\\/?>`, "g"), "");
  zip.file("ppt/_rels/presentation.xml.rels", presRels);

  let pres = await zip.file("ppt/presentation.xml").async("string");
  pres = pres.replace(/<p:notesMasterIdLst>[\s\S]*?<\/p:notesMasterIdLst>/, "");
  zip.file("ppt/presentation.xml", pres);

  let ct = await zip.file("[Content_Types].xml").async("string");
  ct = ct.replace(/<Override PartName="\/ppt\/notes(Slides|Masters)\/[^"]+"[^>]*\/>/g, "");
  zip.file("[Content_Types].xml", ct);

  return removed.length;
}

// --- inject mode ---

async function inject(zip, narrations) {
  const slidePaths = await slidePathsInOrder(zip);
  if (slidePaths.length !== narrations.length) {
    throw new Error(`Deck has ${slidePaths.length} slides but the content JSON has ${narrations.length} — they must match (no adding/reordering slides in the design tool).`);
  }

  let ct = await zip.file("[Content_Types].xml").async("string");

  // Ensure a notes master exists (required for valid notes slides)
  if (!zip.file(/^ppt\/notesMasters\/notesMaster\d+\.xml$/).length) {
    const themePath = zip.file(/^ppt\/theme\/theme\d+\.xml$/)[0]?.name ?? "ppt/theme/theme1.xml";
    zip.file("ppt/notesMasters/notesMaster1.xml", NOTES_MASTER_XML);
    zip.file("ppt/notesMasters/_rels/notesMaster1.xml.rels",
      addRel(emptyRels, relXml("rId1", T.theme, "../" + themePath.replace(/^ppt\//, ""))));
    ct = ensureContentTypeOverride(ct, "/ppt/notesMasters/notesMaster1.xml", CT.notesMaster);

    let presRelsXml = await zip.file("ppt/_rels/presentation.xml.rels").async("string");
    const rid = nextRelId(parseRels(presRelsXml));
    zip.file("ppt/_rels/presentation.xml.rels", addRel(presRelsXml, relXml(rid, T.notesMaster, "notesMasters/notesMaster1.xml")));

    let pres = await zip.file("ppt/presentation.xml").async("string");
    if (!pres.includes("<p:notesMasterIdLst>")) {
      const lst = `<p:notesMasterIdLst><p:notesMasterId r:id="${rid}"/></p:notesMasterIdLst>`;
      pres = pres.includes("</p:sldMasterIdLst>")
        ? pres.replace("</p:sldMasterIdLst>", `</p:sldMasterIdLst>${lst}`)
        : pres.replace(/<p:sldIdLst>/, `${lst}<p:sldIdLst>`);
      zip.file("ppt/presentation.xml", pres);
    }
  }

  let nextNotesIdx = zip.file(/^ppt\/notesSlides\/notesSlide(\d+)\.xml$/)
    .reduce((m, f) => Math.max(m, Number(f.name.match(/(\d+)\.xml$/)[1])), 0) + 1;

  let injected = 0;
  for (let i = 0; i < slidePaths.length; i++) {
    const narration = narrations[i];
    if (!narration?.trim()) continue;
    const slidePath = slidePaths[i];
    const slideFile = slidePath.split("/").pop();
    const relsPath = slidePath.replace(/([^/]+\.xml)$/, "_rels/$1.rels");
    let relsXml = (await zip.file(relsPath)?.async("string")) ?? emptyRels;

    const existing = parseRels(relsXml).find(r => r.type === T.notesSlide);
    let notesPath;
    if (existing) {
      notesPath = resolveTarget(slidePath.replace(/\/[^/]+$/, ""), existing.target);
    } else {
      notesPath = `ppt/notesSlides/notesSlide${nextNotesIdx}.xml`;
      zip.file(`ppt/notesSlides/_rels/notesSlide${nextNotesIdx}.xml.rels`,
        addRel(addRel(emptyRels,
          relXml("rId1", T.notesMaster, "../notesMasters/notesMaster1.xml")),
          relXml("rId2", T.slide, `../slides/${slideFile}`)));
      relsXml = addRel(relsXml, relXml(nextRelId(parseRels(relsXml)), T.notesSlide, `../notesSlides/notesSlide${nextNotesIdx}.xml`));
      zip.file(relsPath, relsXml);
      nextNotesIdx++;
    }
    zip.file(notesPath, notesSlideXml(narration));
    ct = ensureContentTypeOverride(ct, "/" + notesPath, CT.notesSlide);
    injected++;
  }

  zip.file("[Content_Types].xml", ct);
  return injected;
}

// --- verification: extract notes the way the app does and strict-compare ---

async function extractNotes(zip) {
  const out = [];
  for (const slidePath of await slidePathsInOrder(zip)) {
    const relsPath = slidePath.replace(/([^/]+\.xml)$/, "_rels/$1.rels");
    const relsXml = await zip.file(relsPath)?.async("string");
    const rel = relsXml && parseRels(relsXml).find(r => r.type === T.notesSlide);
    if (!rel) { out.push(null); continue; }
    const notesXml = await zip.file(resolveTarget(slidePath.replace(/\/[^/]+$/, ""), rel.target))?.async("string");
    if (!notesXml) { out.push(null); continue; }
    const text = [...notesXml.matchAll(/<a:t>([\s\S]*?)<\/a:t>/g)].map(m => m[1]).join("\n")
      .replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&apos;/g, "'").replace(/&amp;/g, "&");
    out.push(text.trim() || null);
  }
  return out;
}

// --- CLI ---

const args = process.argv.slice(2);
const stripMode = args.includes("--strip");
const oIdx = args.indexOf("-o");
const outPath = oIdx !== -1 ? args[oIdx + 1] : null;
const positional = args.filter((a, i) => a !== "--strip" && a !== "-o" && (oIdx === -1 || i !== oIdx + 1));

if (stripMode) {
  const [deckPath] = positional;
  if (!deckPath || !outPath) {
    console.error("Usage: node inject-notes.mjs --strip <deck.pptx> -o <out.pptx>");
    process.exit(1);
  }
  const zip = await JSZip.loadAsync(readFileSync(deckPath));
  const n = await strip(zip);
  writeFileSync(outPath, await zip.generateAsync({ type: "nodebuffer", compression: "DEFLATE" }));
  console.log(`Stripped ${n} notes part(s) → ${outPath}`);
} else {
  const [deckPath, jsonPath] = positional;
  if (!deckPath || !jsonPath) {
    console.error("Usage: node inject-notes.mjs <deck.pptx> <content.json> [-o out.pptx]");
    process.exit(1);
  }
  const content = JSON.parse(readFileSync(jsonPath, "utf8"));
  const narrations = content.slides.map(s => s.notes ?? "");
  const zip = await JSZip.loadAsync(readFileSync(deckPath));
  const injected = await inject(zip, narrations);
  const target = outPath ?? deckPath;
  writeFileSync(target, await zip.generateAsync({ type: "nodebuffer", compression: "DEFLATE" }));

  // round-trip verification against the JSON
  const check = await extractNotes(await JSZip.loadAsync(readFileSync(target)));
  const norm = (s) => (s ?? "").replace(/\s+/g, " ").trim();
  const bad = narrations.map((n, i) => norm(n) && norm(check[i]) !== norm(n) ? i + 1 : null).filter(Boolean);
  if (bad.length > 0) {
    console.error(`VERIFICATION FAILED on slide(s): ${bad.join(", ")}`);
    process.exit(1);
  }
  console.log(`Injected narration into ${injected} slide(s) → ${target}\nRound-trip verification ✓ (notes match the content JSON)`);
}
