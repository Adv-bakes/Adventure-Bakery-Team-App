#!/usr/bin/env node
// Translates a .pptx's visible slide text in place using an EN→target string map,
// preserving the deck's design (layouts, photos, styles). Used to produce the
// Spanish copies of the Claude Design decks without a second design session.
//
// Usage:
//   node training-decks/translate-deck.mjs --extract <deck.pptx>            (dump paragraph strings as a JSON skeleton)
//   node training-decks/translate-deck.mjs <deck.pptx> <strings.json> -o <out.pptx>
//
// Matching is per paragraph (<a:p>): all of a paragraph's <a:t> runs are joined,
// looked up (whitespace-normalized) in the map, and the translation is written
// into the first run (remaining runs are blanked). A paragraph with mixed inline
// styling therefore collapses to the first run's style. Paragraphs not in the map
// are reported; the run fails if any non-ignored paragraph is unmatched, so a
// half-translated deck can't slip through. Map a string to null to mark it
// "keep as is" (brand names, numbers, SQF, etc.). Pure numbers/punctuation are
// ignored automatically.

import { readFileSync, writeFileSync } from "node:fs";
import JSZip from "jszip";

const norm = (s) => s.replace(/\s+/g, " ").trim();
const unesc = (s) => s.replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"')
  .replace(/&apos;/g, "'").replace(/&#x([0-9A-Fa-f]+);/g, (_, h) => String.fromCodePoint(parseInt(h, 16)))
  .replace(/&#(\d+);/g, (_, d) => String.fromCodePoint(Number(d))).replace(/&amp;/g, "&");
const esc = (s) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
  .replace(/"/g, "&quot;").replace(/'/g, "&apos;");
const isIgnorable = (s) => /^[\d\s./•·–—-]*$/.test(s) || s === "";

const slideFiles = (zip) => zip.file(/^ppt\/slides\/slide\d+\.xml$/)
  .sort((a, b) => Number(a.name.match(/(\d+)\.xml$/)[1]) - Number(b.name.match(/(\d+)\.xml$/)[1]));

// Splits a slide XML into paragraphs and maps each through fn(joinedText, paraXml) → newParaXml | null
function transformParagraphs(xml, fn) {
  return xml.replace(/<a:p>[\s\S]*?<\/a:p>/g, (para) => {
    const runs = [...para.matchAll(/<a:t>([\s\S]*?)<\/a:t>/g)];
    if (runs.length === 0) return para;
    const joined = norm(unesc(runs.map(m => m[1]).join("")));
    return fn(joined, para) ?? para;
  });
}

const args = process.argv.slice(2);

if (args[0] === "--extract") {
  const zip = await JSZip.loadAsync(readFileSync(args[1]));
  const seen = new Map(); // text → first slide number
  for (const f of slideFiles(zip)) {
    const n = Number(f.name.match(/(\d+)\.xml$/)[1]);
    transformParagraphs(await f.async("string"), (joined) => {
      if (!isIgnorable(joined) && !seen.has(joined)) seen.set(joined, n);
      return null;
    });
  }
  const skeleton = {};
  for (const [text, n] of [...seen.entries()].sort((a, b) => a[1] - b[1])) {
    skeleton[text] = `TODO (slide ${n})`;
  }
  console.log(JSON.stringify(skeleton, null, 2));
} else {
  const oIdx = args.indexOf("-o");
  const outPath = oIdx !== -1 ? args[oIdx + 1] : null;
  const [deckPath, mapPath] = args.filter((a, i) => a !== "-o" && (oIdx === -1 || i !== oIdx + 1));
  if (!deckPath || !mapPath || !outPath) {
    console.error("Usage: node translate-deck.mjs <deck.pptx> <strings.json> -o <out.pptx>\n       node translate-deck.mjs --extract <deck.pptx>");
    process.exit(1);
  }
  const rawMap = JSON.parse(readFileSync(mapPath, "utf8"));
  const map = new Map(Object.entries(rawMap).map(([k, v]) => [norm(k), v]));
  const zip = await JSZip.loadAsync(readFileSync(deckPath));

  let translated = 0, kept = 0;
  const unmatched = [];
  for (const f of slideFiles(zip)) {
    const n = Number(f.name.match(/(\d+)\.xml$/)[1]);
    const xml = await f.async("string");
    const out = transformParagraphs(xml, (joined, para) => {
      if (isIgnorable(joined)) return null;
      if (!map.has(joined)) { unmatched.push(`slide ${n}: "${joined.slice(0, 90)}"`); return null; }
      const replacement = map.get(joined);
      if (replacement === null) { kept++; return null; } // explicit keep-as-is
      let first = true;
      const newPara = para.replace(/<a:t>[\s\S]*?<\/a:t>/g, () => {
        const out = first ? `<a:t>${esc(replacement)}</a:t>` : "<a:t></a:t>";
        first = false;
        return out;
      });
      translated++;
      return newPara;
    });
    zip.file(f.name, out);
  }

  if (unmatched.length > 0) {
    console.error(`UNMATCHED paragraphs (add them to ${mapPath}):\n  ${unmatched.join("\n  ")}`);
    process.exit(1);
  }
  writeFileSync(outPath, await zip.generateAsync({ type: "nodebuffer", compression: "DEFLATE" }));
  console.log(`Translated ${translated} paragraph(s), kept ${kept} as-is → ${outPath}`);
}
