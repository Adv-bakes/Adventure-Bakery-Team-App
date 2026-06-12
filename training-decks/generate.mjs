#!/usr/bin/env node
// Generates an SQF training deck (.pptx) + hand-authored quiz sidecar (.quiz.csv)
// from a structured content JSON. One shared template for all modules/languages —
// see DECK_FORMAT_CONTRACT.md for the format the app's importer expects and the
// content policy (no customer/retailer/product brand names; industrial imagery;
// visual-first slides).
//
// Usage: node training-decks/generate.mjs training-decks/content/module-01.en.json [...more]
// Outputs to training-decks/dist/<input-basename>.pptx / .quiz.csv

import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { basename, dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import Pptxgen from "pptxgenjs";
import JSZip from "jszip";
import { buildAssets } from "./assets.mjs";

const C = {
  brown: "3B2F2F", // dark warm brown — text
  amber: "C8873C", // accent
  amberLight: "E8C893",
  cream: "FFF8F0", // base background tone
  paper: "FFFEFB", // card fill
  green: "4A7C59", // safe-green accent
  white: "FFFFFF",
};
const HEAD_FONT = "Cambria";
const BODY_FONT = "Calibri";
const DIST_DIR = join(dirname(fileURLToPath(import.meta.url)), "dist");

// Rasterize the illustration library once per run (PNGs land in dist/assets)
const ASSETS = buildAssets(join(DIST_DIR, "assets"));

// NB: always hand pptxgenjs a fresh shadow object — it mutates the options it
// receives, so a shared constant would only style the first shape.
const SHADOW = { type: "outer", color: "3B2F2F", opacity: 0.22, blur: 8, offset: 2, angle: 90 };
const shadow = () => ({ ...SHADOW });
const card = (color = C.paper, borderColor = C.amberLight) =>
  ({ fill: { color }, line: { color: borderColor, width: 0.75 }, shadow: shadow() });
const solid = (color) => ({ fill: { color }, line: { type: "none" }, shadow: shadow() });

// Places an asset image fit to a target width, returns its height in inches.
const imgH = (name, w) => w * (ASSETS[name].h / ASSETS[name].w);
const addArt = (slide, name, x, y, w) =>
  slide.addImage({ path: ASSETS[name].path, x, y, w, h: imgH(name, w) });

// Mirrors computeSlideDuration() in src/lib/training.ts (dwell gate in the viewer)
const dwellSeconds = (narration) => {
  const words = (narration ?? "").trim().split(/\s+/).filter(Boolean).length;
  return words === 0 ? 20 : Math.max(8, Math.ceil(words / 3));
};

// ---------------------------------------------------------------------------
// Visual renderers. Diagrams use native shapes (white cards + soft shadows);
// spot illustrations come from assets.mjs. Each receives the drawing area
// { x, y, w, h } below the title/lead-in (already narrowed when the slide has
// a right-column illustration).
// ---------------------------------------------------------------------------

function vCards(slide, v, a) {
  const items = v.items;
  const cols = 2, gap = 0.2;
  const rowCount = Math.ceil(items.length / cols);
  const cw = (a.w - gap) / cols;
  const ch = Math.min(1.32, (a.h - gap * (rowCount - 1)) / rowCount);
  items.forEach((text, i) => {
    const x = a.x + (i % cols) * (cw + gap);
    const y = a.y + Math.floor(i / cols) * (ch + gap);
    slide.addShape("roundRect", { x, y, w: cw, h: ch, rectRadius: 0.07, ...card() });
    const icon = v.icons?.[i] && ASSETS[v.icons[i]];
    if (icon) {
      addArt(slide, v.icons[i], x + 0.18, y + ch / 2 - 0.26, 0.52);
    } else {
      slide.addShape("ellipse", { x: x + 0.18, y: y + ch / 2 - 0.19, w: 0.38, h: 0.38, ...solid(C.amber) });
      slide.addText(String(i + 1), { x: x + 0.18, y: y + ch / 2 - 0.19, w: 0.38, h: 0.38, align: "center", valign: "middle", fontFace: BODY_FONT, fontSize: 14, bold: true, color: C.white });
    }
    slide.addText(text, { x: x + 0.82, y, w: cw - 0.95, h: ch, valign: "middle", fontFace: BODY_FONT, fontSize: 13.5, color: C.brown });
  });
}

function vFlow(slide, v, a) {
  const steps = v.steps;
  const arrowW = 0.45, gap = 0.1;
  const bw = (a.w - (steps.length - 1) * (arrowW + gap * 2)) / steps.length;
  const bh = 1.15, y = a.y + a.h / 2 - bh / 2;
  steps.forEach((s, i) => {
    const x = a.x + i * (bw + arrowW + gap * 2);
    const isHl = i === (v.highlight ?? steps.length - 1);
    slide.addShape("roundRect", { x, y, w: bw, h: bh, rectRadius: 0.08, ...(isHl ? solid(C.green) : card()) });
    slide.addText(s, { x: x + 0.08, y, w: bw - 0.16, h: bh, align: "center", valign: "middle", fontFace: BODY_FONT, fontSize: 13.5, bold: isHl, color: isHl ? C.white : C.brown });
    if (i < steps.length - 1) {
      slide.addShape("rightArrow", { x: x + bw + gap, y: y + bh / 2 - 0.15, w: arrowW, h: 0.3, fill: { color: C.amber }, line: { type: "none" } });
    }
  });
  if (v.caption) slide.addText(v.caption, { x: a.x, y: y + bh + 0.25, w: a.w, h: 0.4, align: "center", fontFace: BODY_FONT, fontSize: 13, italic: true, color: C.brown });
}

function vHierarchy(slide, v, a) {
  const topW = Math.min(4.6, a.w - 0.4), topH = 0.7;
  const topX = a.x + a.w / 2 - topW / 2, topY = a.y + 0.05;
  const n = v.children.length, cw = Math.min(2.5, (a.w - 0.6) / n - 0.2), ch = 0.65;
  const gap = (a.w - n * cw) / (n + 1);
  const cy = topY + topH + 0.75;
  v.children.forEach((child, i) => {
    const cx = a.x + gap + i * (cw + gap);
    // line shapes need a non-negative width: anchor at the left end and flip when the child is left of the parent
    const x1 = topX + topW / 2, x2 = cx + cw / 2;
    slide.addShape("line", { x: Math.min(x1, x2), y: topY + topH, w: Math.abs(x2 - x1), h: cy - (topY + topH), flipH: x2 < x1, line: { color: C.amber, width: 1.25 } });
  });
  slide.addShape("roundRect", { x: topX, y: topY, w: topW, h: topH, rectRadius: 0.07, ...solid(C.amber) });
  slide.addText(v.top, { x: topX, y: topY, w: topW, h: topH, align: "center", valign: "middle", fontFace: BODY_FONT, fontSize: 15, bold: true, color: C.white });
  v.children.forEach((child, i) => {
    const cx = a.x + gap + i * (cw + gap);
    const isHl = i === (v.highlight ?? 0);
    slide.addShape("roundRect", { x: cx, y: cy, w: cw, h: ch, rectRadius: 0.07, ...(isHl ? solid(C.green) : card()) });
    slide.addText(child, { x: cx, y: cy, w: cw, h: ch, align: "center", valign: "middle", fontFace: BODY_FONT, fontSize: 13.5, bold: isHl, color: isHl ? C.white : C.brown });
  });
  if (v.caption) slide.addText(v.caption, { x: a.x, y: cy + ch + 0.22, w: a.w, h: 0.4, align: "center", fontFace: BODY_FONT, fontSize: 13, italic: true, color: C.brown });
}

function vCycle(slide, v, a) {
  const [s1, s2, s3, s4] = v.steps;
  const bw = 2.5, bh = 0.8;
  const lx = a.x + 1.1, rx = a.x + a.w - 1.1 - bw;
  const ty = a.y + 0.15, by = a.y + a.h - 0.35 - bh;
  const boxes = [
    { t: s1, x: lx, y: ty }, { t: s2, x: rx, y: ty },
    { t: s3, x: rx, y: by }, { t: s4, x: lx, y: by },
  ];
  boxes.forEach(b => {
    slide.addShape("roundRect", { x: b.x, y: b.y, w: bw, h: bh, rectRadius: 0.08, ...card() });
    slide.addText(b.t, { x: b.x, y: b.y, w: bw, h: bh, align: "center", valign: "middle", fontFace: BODY_FONT, fontSize: 15, bold: true, color: C.brown });
  });
  const midX = a.x + a.w / 2, midYT = ty + bh / 2, midYB = by + bh / 2;
  slide.addShape("rightArrow", { x: midX - 0.3, y: midYT - 0.16, w: 0.6, h: 0.32, fill: { color: C.green }, line: { type: "none" } });
  slide.addShape("downArrow", { x: rx + bw / 2 - 0.16, y: (ty + bh + by) / 2 - 0.3, w: 0.32, h: 0.6, fill: { color: C.green }, line: { type: "none" } });
  slide.addShape("leftArrow", { x: midX - 0.3, y: midYB - 0.16, w: 0.6, h: 0.32, fill: { color: C.green }, line: { type: "none" } });
  slide.addShape("upArrow", { x: lx + bw / 2 - 0.16, y: (ty + bh + by) / 2 - 0.3, w: 0.32, h: 0.6, fill: { color: C.green }, line: { type: "none" } });
  if (v.center) slide.addText(v.center, { x: midX - 1.5, y: (midYT + midYB) / 2 - 0.3, w: 3, h: 0.6, align: "center", valign: "middle", fontFace: BODY_FONT, fontSize: 12.5, italic: true, color: C.brown });
}

function vSplit(slide, v, a) {
  const pw = (a.w - 0.7) / 2, ph = a.h - 0.75;
  const panels = [{ ...v.left, x: a.x }, { ...v.right, x: a.x + pw + 0.7 }];
  panels.forEach(p => {
    const color = p.color === "green" ? C.green : C.amber;
    slide.addShape("roundRect", { x: p.x, y: a.y, w: pw, h: ph, rectRadius: 0.08, ...card(C.paper, color) });
    slide.addShape("rect", { x: p.x + 0.12, y: a.y + 0.1, w: pw - 0.24, h: 0.07, fill: { color }, line: { type: "none" } });
    const runs = [
      { text: p.header, options: { bold: true, fontSize: 15, color, breakLine: true, paraSpaceAfter: 8 } },
      ...p.items.map(t => ({ text: t, options: { fontSize: 13, color: C.brown, breakLine: true, paraSpaceAfter: 6 } })),
    ];
    slide.addText(runs, { x: p.x + 0.25, y: a.y + 0.28, w: pw - 0.5, h: ph - 1.1, valign: "top", fontFace: BODY_FONT });
    let ix = p.x + 0.3;
    for (const name of p.icons ?? []) {
      if (!ASSETS[name]) continue;
      const h = 0.62, w = h * (ASSETS[name].w / ASSETS[name].h);
      slide.addImage({ path: ASSETS[name].path, x: ix, y: a.y + ph - 0.85, w, h });
      ix += w + 0.25;
    }
  });
  if (v.chip) {
    const cw = 4.2, ch = 0.52;
    slide.addShape("roundRect", { x: a.x + a.w / 2 - cw / 2, y: a.y + ph + 0.18, w: cw, h: ch, rectRadius: 0.26, ...solid(C.brown) });
    slide.addText(v.chip, { x: a.x + a.w / 2 - cw / 2, y: a.y + ph + 0.18, w: cw, h: ch, align: "center", valign: "middle", fontFace: BODY_FONT, fontSize: 13, bold: true, color: C.white });
  }
}

function vBubbles(slide, v, a) {
  const n = v.items.length, gap = 0.22;
  const bh = Math.min(0.78, (a.h - gap * (n - 1)) / n);
  v.items.forEach((q, i) => {
    const y = a.y + i * (bh + gap);
    slide.addShape("roundRect", { x: a.x + 0.1, y, w: a.w - 0.2, h: bh, rectRadius: 0.12, ...card(C.paper, i % 2 ? C.green : C.amber) });
    slide.addText([
      { text: "“ ", options: { fontSize: 20, bold: true, color: C.amber } },
      { text: q, options: { fontSize: 14.5, color: C.brown, italic: true } },
    ], { x: a.x + 0.35, y, w: a.w - 0.7, h: bh, valign: "middle", fontFace: BODY_FONT });
  });
}

function vChecklist(slide, v, a) {
  const n = v.items.length, gap = 0.14;
  const rh = Math.min(0.62, (a.h - (v.next ? 0.7 : 0) - gap * (n - 1)) / n);
  v.items.forEach((t, i) => {
    const y = a.y + i * (rh + gap);
    slide.addShape("ellipse", { x: a.x + 0.15, y: y + rh / 2 - 0.19, w: 0.38, h: 0.38, ...solid(C.green) });
    slide.addText("✓", { x: a.x + 0.15, y: y + rh / 2 - 0.19, w: 0.38, h: 0.38, align: "center", valign: "middle", fontFace: BODY_FONT, fontSize: 15, bold: true, color: C.white });
    slide.addText(t, { x: a.x + 0.7, y, w: a.w - 0.9, h: rh, valign: "middle", fontFace: BODY_FONT, fontSize: 15, color: C.brown });
  });
  if (v.next) {
    const cw = 3.6, ch = 0.5, y = a.y + n * (rh + gap) + 0.12;
    slide.addShape("roundRect", { x: a.x + a.w / 2 - cw / 2, y, w: cw, h: ch, rectRadius: 0.25, ...solid(C.amber) });
    slide.addText(v.next, { x: a.x + a.w / 2 - cw / 2, y, w: cw, h: ch, align: "center", valign: "middle", fontFace: BODY_FONT, fontSize: 12.5, bold: true, color: C.white });
  }
}

function vStopSign(slide, v, a) {
  const s = 2.35;
  slide.addShape("octagon", { x: a.x + 0.35, y: a.y + a.h / 2 - s / 2, w: s, h: s, fill: { color: C.brown }, line: { color: C.amberLight, width: 2.5 }, shadow: shadow() });
  slide.addText(v.label ?? "STOP", { x: a.x + 0.35, y: a.y + a.h / 2 - s / 2, w: s, h: s, align: "center", valign: "middle", fontFace: HEAD_FONT, fontSize: 30, bold: true, color: C.white });
  const runs = v.lines.map((t, i) => ({ text: t, options: { fontSize: 15, bold: i === v.lines.length - 1, color: i === v.lines.length - 1 ? C.green : C.brown, breakLine: true, paraSpaceAfter: 10 } }));
  slide.addText(runs, { x: a.x + s + 0.95, y: a.y + 0.1, w: a.w - s - 1.1, h: a.h - 0.2, valign: "middle", fontFace: BODY_FONT });
}

function vWeekStrip(slide, v, a) {
  const days = v.days ?? ["Mon", "Tue", "Wed", "Thu", "Fri"];
  const gap = 0.16, tw = Math.min(1.5, (a.w - gap * (days.length - 1)) / days.length), th = 1.55;
  const total = days.length * tw + (days.length - 1) * gap;
  const x0 = a.x + (a.w - total) / 2, y = a.y + 0.15;
  days.forEach((d, i) => {
    const x = x0 + i * (tw + gap);
    slide.addShape("roundRect", { x, y, w: tw, h: th, rectRadius: 0.08, ...card() });
    slide.addShape("ellipse", { x: x + tw / 2 - 0.24, y: y + 0.22, w: 0.48, h: 0.48, ...solid(C.green) });
    slide.addText("✓", { x: x + tw / 2 - 0.24, y: y + 0.22, w: 0.48, h: 0.48, align: "center", valign: "middle", fontFace: BODY_FONT, fontSize: 18, bold: true, color: C.white });
    slide.addText(d, { x, y: y + 0.85, w: tw, h: 0.5, align: "center", fontFace: BODY_FONT, fontSize: 14, bold: true, color: C.brown });
  });
  if (v.caption) slide.addText(v.caption, { x: a.x, y: y + th + 0.22, w: a.w, h: 0.45, align: "center", fontFace: BODY_FONT, fontSize: 14, italic: true, color: C.brown });
}

function vBadge(slide, v, a) {
  const n = v.letters.length, s = 1.2, gap = 0.45;
  const total = n * s + (n - 1) * gap;
  const x0 = a.x + (a.w - total) / 2, y = a.y + 0.15;
  v.letters.forEach((L, i) => {
    const x = x0 + i * (s + gap);
    slide.addShape("roundRect", { x, y, w: s, h: s, rectRadius: 0.12, ...solid(i === 1 ? C.green : C.amber) });
    slide.addText(L, { x, y, w: s, h: s, align: "center", valign: "middle", fontFace: HEAD_FONT, fontSize: 40, bold: true, color: C.white });
    slide.addText(v.words[i], { x: x - 0.35, y: y + s + 0.08, w: s + 0.7, h: 0.4, align: "center", fontFace: BODY_FONT, fontSize: 14, bold: true, color: C.brown });
  });
  if (v.caption) slide.addText(v.caption, { x: a.x + 0.3, y: y + s + 0.62, w: a.w - 0.6, h: 0.9, align: "center", fontFace: BODY_FONT, fontSize: 14, italic: true, color: C.brown });
}

// Workers in bouffant caps + aprons (industrial PPE) with a message chip.
function vWorkers(slide, v, a) {
  const w = Math.min(4.9, a.w - 1.2), h = imgH("workers", w);
  const x = a.x + (a.w - w) / 2;
  addArt(slide, "workers", x, a.y + 0.05, w);
  if (v.chip) {
    const cw = 4.4, ch = 0.55, cy = a.y + h + 0.22;
    slide.addShape("roundRect", { x: a.x + a.w / 2 - cw / 2, y: cy, w: cw, h: ch, rectRadius: 0.27, ...solid(C.brown) });
    slide.addText(v.chip, { x: a.x + a.w / 2 - cw / 2, y: cy, w: cw, h: ch, align: "center", valign: "middle", fontFace: BODY_FONT, fontSize: 14, bold: true, color: C.white });
  }
}

const VISUALS = {
  cards: vCards, flow: vFlow, hierarchy: vHierarchy, cycle: vCycle, split: vSplit,
  bubbles: vBubbles, checklist: vChecklist, stopSign: vStopSign, weekStrip: vWeekStrip,
  badge: vBadge, workers: vWorkers,
};

// ---------------------------------------------------------------------------

function buildDeck(content) {
  const pptx = new Pptxgen();
  pptx.layout = "LAYOUT_16x9"; // 10 × 5.625 in → 960 × 540 px at CloudConvert's 96 DPI
  pptx.author = content.brand ?? "Adventure Bakery";
  pptx.company = content.brand ?? "Adventure Bakery";
  pptx.title = `${content.moduleLabel} — ${content.title}`;
  pptx.subject = content.subtitle ?? "SQF Food Safety Training";

  content.slides.forEach((s, idx) => {
    const slide = pptx.addSlide();

    if (s.kind === "title") {
      slide.background = { path: ASSETS.bgTitle.path };
      slide.addText((s.subtitle ?? content.subtitle ?? "").toUpperCase(), {
        x: 0, y: 0.95, w: 10, h: 0.4, align: "center",
        fontFace: BODY_FONT, fontSize: 14, bold: true, color: C.amber, charSpacing: 3,
      });
      slide.addText(s.title, {
        x: 0.5, y: 1.4, w: 9, h: 1.1, align: "center",
        fontFace: HEAD_FONT, fontSize: 33, bold: true, color: C.brown,
      });
      slide.addShape("rect", { x: 4.1, y: 2.62, w: 1.8, h: 0.05, fill: { color: C.amber }, line: { type: "none" } });
      addArt(slide, "conveyor", (10 - 4.4) / 2, 2.92, 4.4);
      slide.addText(content.brand ?? "Adventure Bakery", {
        x: 0, y: 5.0, w: 10, h: 0.35, align: "center",
        fontFace: BODY_FONT, fontSize: 12, color: C.brown, transparency: 30,
      });
    } else {
      slide.background = { path: ASSETS.bgContent.path };
      const accent = s.accent === "green" ? C.green : C.amber;
      slide.addShape("rect", { x: 0, y: 0, w: 10, h: 0.09, fill: { color: C.amber }, line: { type: "none" } });
      slide.addText(s.title, {
        x: 0.55, y: 0.38, w: 8.9, h: 0.75,
        fontFace: HEAD_FONT, fontSize: 25, bold: true, color: C.brown, valign: "middle",
      });
      slide.addShape("rect", { x: 0.58, y: 1.18, w: 1.6, h: 0.05, fill: { color: accent }, line: { type: "none" } });

      let areaY = 1.42;
      if (s.lead) {
        slide.addText(s.lead, { x: 0.55, y: areaY, w: 8.9, h: 0.55, fontFace: BODY_FONT, fontSize: 15, italic: true, color: C.brown, valign: "top" });
        areaY += 0.62;
      }
      const hasArt = s.art && ASSETS[s.art];
      const area = { x: 0.55, y: areaY, w: hasArt ? 6.55 : 8.9, h: 5.05 - areaY };

      if (s.visual && VISUALS[s.visual.type]) {
        VISUALS[s.visual.type](slide, s.visual, area);
      } else {
        // text-only fallback: intro + bullets and/or body paragraphs
        const runs = [];
        if (s.intro) runs.push({ text: s.intro, options: { breakLine: true, paraSpaceAfter: 10 } });
        for (const b of s.bullets ?? []) {
          runs.push({ text: b, options: { bullet: { code: "2022", indent: 14 }, breakLine: true, paraSpaceAfter: 8 } });
        }
        if (s.body) {
          for (const para of s.body.split(/\n\n+/)) {
            runs.push({ text: para, options: { breakLine: true, paraSpaceAfter: 12 } });
          }
        }
        slide.addText(runs, { ...area, fontFace: BODY_FONT, fontSize: 18, color: C.brown, valign: "top" });
      }

      if (hasArt) {
        const artW = s.art === "truck" ? 2.3 : 2.05;
        const artH = imgH(s.art, artW);
        addArt(slide, s.art, 7.35 + (2.1 - artW) / 2, area.y + (area.h - artH) / 2, artW);
      }

      slide.addText(`${content.moduleLabel} — ${content.title}`, {
        x: 0.55, y: 5.2, w: 6, h: 0.3,
        fontFace: BODY_FONT, fontSize: 10, color: C.brown, transparency: 45,
      });
      slide.addText(String(idx + 1), {
        x: 9.0, y: 5.2, w: 0.5, h: 0.3, align: "right",
        fontFace: BODY_FONT, fontSize: 10, color: C.brown, transparency: 45,
      });
    }

    if (s.notes) slide.addNotes(s.notes);
  });

  return pptx;
}

// Quiz sidecar in the exact format src/lib/training.ts parseQuizCsv() expects:
// #, Question, Hint, Option A…, Correct Answer, Rationale (letter answer).
function buildQuizCsv(quiz) {
  const esc = (v) => {
    const s = String(v ?? "");
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const optCount = Math.max(4, ...quiz.map((q) => q.options.length));
  const header = ["#", "Question", "Hint", ...Array.from({ length: optCount }, (_, i) => `Option ${String.fromCharCode(65 + i)}`), "Correct Answer", "Rationale"];
  const rows = quiz.map((q, i) => {
    const opts = Array.from({ length: optCount }, (_, j) => q.options[j] ?? "");
    return [i + 1, q.question, q.hint ?? "", ...opts, String.fromCharCode(65 + q.correct), q.rationale ?? ""];
  });
  return [header, ...rows].map((r) => r.map(esc).join(",")).join("\r\n") + "\r\n";
}

// Round-trip check: re-open the written .pptx and confirm each slide's notes
// contain the authored narration (so the app's notes extractor will find it).
async function verifyNotes(pptxPath, content) {
  const zip = await JSZip.loadAsync(readFileSync(pptxPath));
  const unescape = (s) => s.replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&apos;/g, "'").replace(/&#x([0-9A-Fa-f]+);/g, (_, h) => String.fromCodePoint(parseInt(h, 16))).replace(/&#(\d+);/g, (_, d) => String.fromCodePoint(Number(d))).replace(/&amp;/g, "&");
  const norm = (s) => s.replace(/\s+/g, " ").trim();
  const problems = [];
  for (let i = 0; i < content.slides.length; i++) {
    const expected = content.slides[i].notes;
    if (!expected) continue;
    const xml = await zip.file(`ppt/notesSlides/notesSlide${i + 1}.xml`)?.async("string");
    if (!xml) { problems.push(`slide ${i + 1}: notesSlide${i + 1}.xml missing`); continue; }
    const text = norm(unescape(xml.replace(/<[^>]+>/g, " ")));
    if (!text.includes(norm(expected))) problems.push(`slide ${i + 1}: notes text does not match authored narration`);
  }
  return problems;
}

// Content policy check — customer/retailer/product brand names must not appear
// in anything a trainee sees or hears (see DECK_FORMAT_CONTRACT.md).
const FORBIDDEN = [/publix/i, /bahama/i, /botta/i, /biscotti\s+brand/i, /marini/i];
function checkNames(content) {
  const hits = [];
  const scan = (where, text) => {
    if (!text) return;
    for (const re of FORBIDDEN) if (re.test(text)) hits.push(`${where}: matches ${re}`);
  };
  content.slides.forEach((s, i) => {
    scan(`slide ${i + 1} title`, s.title);
    scan(`slide ${i + 1} text`, JSON.stringify(s.visual ?? "") + (s.lead ?? "") + (s.body ?? "") + (s.intro ?? "") + (s.bullets ?? []).join(" "));
    scan(`slide ${i + 1} notes`, s.notes);
  });
  (content.quiz ?? []).forEach((q, i) => scan(`quiz Q${i + 1}`, q.question + " " + q.options.join(" ") + " " + (q.rationale ?? "") + " " + (q.hint ?? "")));
  return hits;
}

async function generate(contentPath) {
  const content = JSON.parse(readFileSync(contentPath, "utf8"));
  const stem = basename(contentPath).replace(/\.json$/i, "");
  mkdirSync(DIST_DIR, { recursive: true });

  const nameHits = checkNames(content);
  if (nameHits.length > 0) {
    console.error(`${stem}: CONTENT POLICY VIOLATION — customer/product names found:\n    ${nameHits.join("\n    ")}`);
    process.exitCode = 1;
    return;
  }

  const pptxPath = join(DIST_DIR, `${stem}.pptx`);
  await buildDeck(content).writeFile({ fileName: pptxPath });

  const csvPath = join(DIST_DIR, `${stem}.quiz.csv`);
  writeFileSync(csvPath, buildQuizCsv(content.quiz ?? []), "utf8");

  const problems = await verifyNotes(pptxPath, content);

  console.log(`\n${stem}: ${content.slides.length} slides, ${content.quiz?.length ?? 0} quiz questions`);
  let total = 0;
  content.slides.forEach((s, i) => {
    const words = (s.notes ?? "").trim().split(/\s+/).filter(Boolean).length;
    const secs = dwellSeconds(s.notes);
    const spoken = Math.round(words / 2.5); // ~150 wpm TTS
    total += secs;
    const flag = words < 35 ? "  ⚠ narration thin (<35 words)" : words > 120 ? "  ⚠ narration long (>120 words)" : "";
    console.log(`  slide ${String(i + 1).padStart(2)}: ${String(words).padStart(3)} words → ${secs}s dwell gate, ~${spoken}s spoken${flag}`);
  });
  console.log(`  total minimum viewing time ≈ ${Math.round(total / 60)} min ${total % 60}s`);
  (content.quiz ?? []).forEach((q, i) => {
    if (!q.hint?.trim()) console.warn(`  ⚠ quiz Q${i + 1} has no hint`);
  });
  console.log(`  content policy check passed ✓ (no customer/product names)`);
  if (problems.length > 0) {
    console.error(`  NOTES VERIFICATION FAILED:\n    ${problems.join("\n    ")}`);
    process.exitCode = 1;
  } else {
    console.log(`  notes round-trip verified ✓`);
  }
  console.log(`  → ${pptxPath}\n  → ${csvPath}`);
}

const inputs = process.argv.slice(2);
if (inputs.length === 0) {
  console.error("Usage: node training-decks/generate.mjs <content.json> [...more]");
  process.exit(1);
}
for (const input of inputs) await generate(input);
