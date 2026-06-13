// design-deck.mjs — renders a training deck in the approved "Claude Design" Module 1 look
// (editorial dark/cream layouts, 20x11.25in, Helvetica + Georgia), driven by a content JSON.
// Photos are drawn as labeled placeholder boxes for the user to swap later.
//
//   node training-decks/design-deck.mjs training-decks/content/module-02.en.json
//     → dist/<name>.design.pptx   (+ reuses generate.mjs for the quiz CSV)
//
// Design tokens reverse-engineered from training-decks/incoming/SQF_Module_1.pptx.

import PptxGenJS from "pptxgenjs";
import { readFileSync, readdirSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// ---- palette ----
const C = {
  ink: "3B2F2F",
  cream: "FFF8F0",
  tan: "F4E8D8",
  amber: "C8873C",
  amberLt: "E0A85A",   // kicker accent on dark
  amberDk: "A56A28",   // kicker accent on light
  muted: "6B5C57",     // muted text on light
  mutedLt: "C9BBB2",   // muted text on dark
  body: "D8C9C0",      // body text on dark
  bodyLt: "E8DCD4",
  green: "4A7C59",
  darkBg: "4A3B3A",
  panelInk: "3B2F2F",
};
const SANS = "Helvetica";
const SERIF = "Georgia";

// ---- localization (chrome strings; slide content comes from the JSON) ----
const KICKERS_BY_LANG = {
  en: ["", "", "GET READY", "FOUNDATIONS", "WHY IT MATTERS", "HANDWASHING", "HANDWASHING",
       "ON THE FLOOR", "ON THE FLOOR", "STAY SAFE", "ON THE FLOOR", "ON THE FLOOR", "RECAP"],
  es: ["", "", "PREPÁRATE", "FUNDAMENTOS", "POR QUÉ IMPORTA", "LAVADO DE MANOS", "LAVADO DE MANOS",
       "EN LA PLANTA", "EN LA PLANTA", "MANTENTE SEGURO", "EN LA PLANTA", "EN LA PLANTA", "REPASO"],
};
const STEP_WORD = { en: "STEP", es: "PASO" };
// Set in main() once the content language is known.
let LANG = "en";
let STEP = STEP_WORD.en;
let PROGRAM = "SQF FOOD SAFETY TRAINING";
let MODLABEL = "MODULE";

// ---- shared helpers ----
function bg(slide, dark) {
  slide.background = { color: dark ? C.darkBg : C.cream };
}

function footer(slide, dark, num, total) {
  const muted = dark ? C.mutedLt : C.muted;
  const ink = dark ? C.cream : C.ink;
  slide.addShape("rect", { x: 1.17, y: 10.36, w: 17.67, h: 0.012, fill: { color: dark ? C.cream : C.ink } });
  slide.addText("Adventure Bakery", { x: 1.17, y: 10.56, w: 3, h: 0.26, fontFace: SANS, fontSize: 13.5, bold: true, color: ink, margin: 0 });
  slide.addText(PROGRAM, { x: 7, y: 10.57, w: 6, h: 0.22, fontFace: SANS, fontSize: 11.2, color: muted, align: "center", charSpacing: 1, margin: 0 });
  slide.addText(`${String(num).padStart(2, "0")} / ${String(total).padStart(2, "0")}`, { x: 17.12, y: 10.56, w: 1.71, h: 0.26, fontFace: SANS, fontSize: 13.5, bold: true, color: muted, align: "right", margin: 0 });
}

function kicker(slide, dark, label, num, y = 1.0) {
  const accent = dark ? C.amberLt : C.amberDk;
  const lab = dark ? C.body : C.muted;
  slide.addShape("rect", { x: 1.17, y: y + 0.13, w: 0.09, h: 0.09, fill: { color: accent } });
  slide.addText(String(num).padStart(2, "0"), { x: 1.45, y, w: 0.5, h: 0.31, fontFace: SANS, fontSize: 16.5, bold: true, color: accent, charSpacing: 1, margin: 0 });
  slide.addText(label.toUpperCase(), { x: 2.0, y, w: 8, h: 0.31, fontFace: SANS, fontSize: 16.5, bold: true, color: lab, charSpacing: 2, margin: 0 });
}

const SCRIM = path.join(__dirname, "assets", "hero-scrim.png");

// Standard content-slide head: kicker + title + optional lead. Returns y below the lead.
function head(slide, dark, label, num, title, lead) {
  kicker(slide, dark, label, num);
  const titleColor = dark ? C.cream : C.ink;
  slide.addText(title, { x: 1.17, y: 1.58, w: 17.6, h: 1.5, fontFace: SANS, fontSize: 49.5, bold: true, color: titleColor, margin: 0, valign: "top" });
  if (lead) {
    slide.addText(lead, { x: 1.17, y: 3.05, w: 17.6, h: 1.1, fontFace: SANS, fontSize: 30, color: dark ? C.body : C.muted, margin: 0, valign: "top" });
    return 4.4;
  }
  return 3.2;
}

// Renders a real image (cropped to fill the box) when imgPath is given, else a labeled placeholder.
function photoBox(slide, x, y, w, h, label, caption, dark, imgPath) {
  if (imgPath) {
    slide.addImage({ path: imgPath, x, y, w, h, sizing: { type: "cover", w, h } });
  } else {
    slide.addShape("rect", { x, y, w, h, fill: { color: dark ? "6E5C58" : C.tan }, line: { color: dark ? C.mutedLt : C.amber, width: 1.25, dashType: "dash" } });
    slide.addText(`▣  ${label}`, { x: x + 0.3, y: y + h / 2 - 0.4, w: w - 0.6, h: 0.8, fontFace: SANS, fontSize: 18, italic: true, color: dark ? C.cream : C.muted, align: "center", valign: "middle", margin: 0 });
  }
  if (caption) {
    slide.addText(caption.toUpperCase(), { x, y: y + h + 0.04, w, h: 0.22, fontFace: SANS, fontSize: 11.2, bold: true, color: dark ? C.mutedLt : C.muted, charSpacing: 1, margin: 0 });
  }
}

function chip(slide, x, y, text, { fill = C.amber, color = "FFFFFF", w } = {}) {
  const width = w ?? Math.min(0.5 + text.length * 0.16, 7.5);
  slide.addShape("roundRect", { x, y, w: width, h: 0.62, rectRadius: 0.08, fill: { color: fill } });
  slide.addText(text, { x: x + 0.25, y, w: width - 0.5, h: 0.62, fontFace: SANS, fontSize: 19.5, bold: true, color, valign: "middle", margin: 0 });
  return width;
}

function arrow(slide, x, y) {
  slide.addShape("triangle", { x, y, w: 0.26, h: 0.26, rotate: 90, fill: { color: C.amber } });
}

// ---- renderers ----
function renderTitle(slide, s, total) {
  bg(slide, true);
  slide.addShape("rect", { x: 1.17, y: 3.13, w: 0.09, h: 0.09, fill: { color: C.amberLt } });
  slide.addText(MODLABEL, { x: 1.45, y: 3.04, w: 3, h: 0.31, fontFace: SANS, fontSize: 16.5, bold: true, color: C.amberLt, charSpacing: 2, margin: 0 });
  slide.addText("ADVENTURE BAKERY", { x: 3.6, y: 3.04, w: 5, h: 0.31, fontFace: SANS, fontSize: 16.5, bold: true, color: C.mutedLt, charSpacing: 2, margin: 0 });
  slide.addText(s.titleMain ?? "Personal Hygiene & GMPs", { x: 1.17, y: 3.6, w: 9.2, h: 2.5, fontFace: SANS, fontSize: 81, bold: true, color: C.cream, margin: 0, valign: "top", lineSpacingMultiple: 0.95 });
  slide.addShape("rect", { x: 1.17, y: 6.62, w: 0.56, h: 0.04, fill: { color: C.amber } });
  slide.addText(s.subtitle ?? "SQF Food Safety Training", { x: 1.92, y: 6.42, w: 7, h: 0.47, fontFace: SANS, fontSize: 27, bold: true, color: C.amberLt, margin: 0 });
  slide.addText(s.intro ?? "", { x: 1.17, y: 7.2, w: 8.5, h: 1.6, fontFace: SANS, fontSize: 24, color: C.body, margin: 0, valign: "top", lineSpacingMultiple: 1.1 });
  photoBox(slide, 10.76, 2.81, 8.07, 5.42, s.photo ?? "PHOTO: hand-wash station", s.photoFile ? null : (s.photoCaption ?? "GMP · PERSONAL HYGIENE"), true, s.photoFile);
  footer(slide, true, 1, total);
}

function renderCards(slide, s, num, total) {
  bg(slide, false);
  head(slide, false, s.kicker, num, s.title, s.lead);
  const items = s.visual.items;
  if (s.photoFile) {
    // Photo-right / cards-left single column.
    const cardW = 10.6, cardH = 1.3, x = 1.17;
    const startY = 4.4, gap = 1.45;
    items.forEach((it, i) => {
      const y = startY + i * gap;
      slide.addShape("rect", { x, y, w: cardW, h: cardH, fill: { color: C.tan } });
      slide.addText(String(i + 1), { x: x + 0.34, y: y + 0.2, w: 0.6, h: 0.9, fontFace: SERIF, fontSize: 40, bold: true, color: C.amber, margin: 0, valign: "top" });
      slide.addText(it, { x: x + 1.0, y: y + 0.15, w: cardW - 1.35, h: cardH - 0.3, fontFace: SANS, fontSize: 21, bold: true, color: C.ink, margin: 0, valign: "middle", lineSpacingMultiple: 1.0 });
    });
    const bottom = startY + (items.length - 1) * gap + cardH;
    photoBox(slide, 12.1, startY, 6.73, bottom - startY, "", null, false, s.photoFile);
    footer(slide, false, num, total);
    return;
  }
  const colX = [1.17, 10.14], cardW = 8.7, cardH = 1.55;
  const rowY = items.length <= 2 ? [5.6] : [5.0, 6.85];
  items.forEach((it, i) => {
    const x = colX[i % 2], y = rowY[Math.floor(i / 2)];
    slide.addShape("rect", { x, y, w: cardW, h: cardH, fill: { color: C.tan } });
    slide.addText(String(i + 1), { x: x + 0.38, y: y + 0.3, w: 0.6, h: 0.9, fontFace: SERIF, fontSize: 45, bold: true, color: C.amber, margin: 0, valign: "top" });
    slide.addText(it, { x: x + 1.05, y: y + 0.2, w: cardW - 1.4, h: cardH - 0.4, fontFace: SANS, fontSize: 23, bold: true, color: C.ink, margin: 0, valign: "middle", lineSpacingMultiple: 1.0 });
  });
  footer(slide, false, num, total);
}

function renderBadge(slide, s, num, total) {
  bg(slide, false);
  head(slide, false, s.kicker, num, s.title, s.lead);
  const v = s.visual;
  const startY = 5.16, gap = 1.27;
  v.letters.forEach((L, i) => {
    const y = startY + i * gap;
    slide.addText(L, { x: 1.17, y, w: 1.1, h: 1.1, fontFace: SERIF, fontSize: 90, bold: true, color: C.amber, margin: 0, valign: "top" });
    slide.addText(v.words[i], { x: 2.4, y: y + 0.52, w: 5, h: 0.6, fontFace: SANS, fontSize: 33, bold: true, color: C.ink, margin: 0 });
  });
  // green caption panel
  slide.addShape("rect", { x: 11.7, y: 5.34, w: 7.13, h: 3.5, fill: { color: C.green } });
  slide.addShape("rect", { x: 12.12, y: 5.79, w: 0.81, h: 0.81, fill: { color: "FFFFFF" }, line: { color: "FFFFFF", width: 1.5 } });
  slide.addText("✓", { x: 12.12, y: 5.79, w: 0.81, h: 0.81, fontFace: SANS, fontSize: 33, bold: true, color: C.green, align: "center", valign: "middle", margin: 0 });
  slide.addText(v.caption, { x: 12.12, y: 6.86, w: 6.49, h: 1.7, fontFace: SANS, fontSize: 22.5, color: "FFFFFF", margin: 0, valign: "top", lineSpacingMultiple: 1.05 });
  footer(slide, false, num, total);
}

function renderPhotoHero(slide, s, num, total) {
  bg(slide, true);
  const headline = s.lead ?? s.title;
  if (s.photoFile) {
    // Full-bleed background photo + left-weighted gradient scrim, text overlaid on the left.
    slide.addImage({ path: s.photoFile, x: 0, y: 0, w: 20, h: 11.25, sizing: { type: "cover", w: 20, h: 11.25 } });
    if (existsSync(SCRIM)) slide.addImage({ path: SCRIM, x: 0, y: 0, w: 20, h: 11.25 });
    kicker(slide, true, s.kicker, num, 3.86);
    slide.addText(headline, { x: 1.17, y: 4.43, w: 8.6, h: 2.3, fontFace: SERIF, fontSize: 46.5, bold: true, italic: true, color: C.cream, margin: 0, valign: "top", lineSpacingMultiple: 1.0 });
    if (s.visual.chip) chip(slide, 1.17, 6.95, s.visual.chip);
    footer(slide, true, num, total);
    return;
  }
  // No photo yet: clear left-text / right-placeholder layout.
  kicker(slide, true, s.kicker, num);
  slide.addText(headline, { x: 1.17, y: 4.2, w: 8.3, h: 2.6, fontFace: SERIF, fontSize: 46.5, bold: true, color: C.cream, margin: 0, valign: "top", lineSpacingMultiple: 1.0 });
  if (s.visual.chip) chip(slide, 1.17, 7.1, s.visual.chip);
  photoBox(slide, 10.1, 2.2, 8.73, 6.9, s.photo ?? "PHOTO: team in hairnets on the floor", null, true);
  footer(slide, true, num, total);
}

function renderChecklist(slide, s, num, total) {
  const dark = !!s.visual.next; // summary slide is dark
  bg(slide, dark);
  head(slide, dark, s.kicker, num, s.title, s.lead);
  const items = s.visual.items;
  const txtColor = dark ? C.cream : C.ink;
  let y = 4.7;
  const rowH = 0.99;
  items.forEach((it, i) => {
    slide.addShape("rect", { x: 1.17, y: y + 0.56, w: 17.67, h: 0.012, fill: { color: dark ? C.cream : "E6D4BE" } });
    slide.addShape("rect", { x: 1.17, y, w: 0.56, h: 0.56, fill: { color: C.green } });
    slide.addText("✓", { x: 1.12, y, w: 0.66, h: 0.6, fontFace: SANS, fontSize: 22.5, bold: true, color: "FFFFFF", align: "center", valign: "middle", margin: 0 });
    slide.addText(it, { x: 2.0, y: y - 0.05, w: 16.5, h: 0.66, fontFace: SANS, fontSize: 24, bold: true, color: txtColor, margin: 0, valign: "middle" });
    y += rowH;
  });
  if (s.visual.next) chip(slide, 1.17, 9.75, s.visual.next);
  footer(slide, dark, num, total);
}

function renderFlow(slide, s, num, total) {
  bg(slide, true);
  head(slide, true, s.kicker, num, s.title, s.lead);
  const steps = s.visual.steps;
  const n = steps.length;
  const gap = 0.5;
  const totalW = 17.67;
  const stepW = (totalW - gap * (n - 1)) / n;
  const y = 5.4, h = 2.4;
  steps.forEach((st, i) => {
    const x = 1.17 + i * (stepW + gap);
    const hot = (s.visual.highlight ?? -1) === i;
    slide.addShape("rect", { x, y, w: stepW, h, fill: { color: hot ? C.amber : "5A4A48" } });
    slide.addText(`${STEP} ${i + 1}`, { x: x + 0.24, y: y + 0.3, w: stepW - 0.48, h: 0.3, fontFace: SANS, fontSize: 15, bold: true, color: hot ? "FFFFFF" : C.amberLt, charSpacing: 1, margin: 0 });
    slide.addText(st, { x: x + 0.24, y: y + 0.72, w: stepW - 0.48, h: h - 1.0, fontFace: SANS, fontSize: 20, bold: true, color: "FFFFFF", margin: 0, valign: "top", lineSpacingMultiple: 1.0 });
    if (i < n - 1) arrow(slide, x + stepW + gap / 2 - 0.13, y + h / 2 - 0.13);
  });
  footer(slide, true, num, total);
}

function renderSplit(slide, s, num, total) {
  bg(slide, false);
  head(slide, false, s.kicker, num, s.title, s.lead);
  const v = s.visual;
  const panelY = 4.5, panelH = 4.7, panelW = 8.69;
  const sides = [
    { d: v.left, x: 1.17 },
    { d: v.right, x: 10.15 },
  ];
  sides.forEach(({ d, x }) => {
    const col = d.color === "green" ? C.green : C.amber;
    slide.addShape("rect", { x, y: panelY, w: panelW, h: panelH, fill: { color: col } });
    slide.addText((d.header || "").toUpperCase(), { x: x + 0.43, y: panelY + 0.5, w: panelW - 0.86, h: 0.4, fontFace: SANS, fontSize: 16, bold: true, color: "FFFFFF", charSpacing: 1, margin: 0 });
    const lines = d.items.map((t) => ({ text: t, options: { bullet: { code: "2022" }, breakLine: true } }));
    slide.addText(lines, { x: x + 0.43, y: panelY + 1.2, w: panelW - 0.86, h: panelH - 1.6, fontFace: SANS, fontSize: 24, bold: true, color: "FFFFFF", margin: 0, valign: "top", lineSpacingMultiple: 1.15, paraSpaceAfter: 10 });
  });
  if (v.chip) {
    const w = Math.min(0.5 + v.chip.length * 0.16, 9);
    chip(slide, (20 - w) / 2, 9.55, v.chip, { w });
  }
  footer(slide, false, num, total);
}

function renderStop(slide, s, num, total) {
  bg(slide, true);
  kicker(slide, true, s.kicker, num);
  const v = s.visual;
  slide.addShape("rect", { x: 3.0, y: 4.4, w: 3.12, h: 3.12, fill: { color: C.amber } });
  slide.addText(v.label ?? "STOP", { x: 2.96, y: 4.4, w: 3.22, h: 3.12, fontFace: SANS, fontSize: 42, bold: true, color: "FFFFFF", align: "center", valign: "middle", margin: 0 });
  slide.addText(s.title, { x: 8.4, y: 3.7, w: 10.2, h: 1.1, fontFace: SANS, fontSize: 43.5, bold: true, color: C.cream, margin: 0, valign: "top" });
  const body = v.lines.slice(0, -1).join("  ");
  slide.addText(body, { x: 8.4, y: 4.95, w: 9.8, h: 1.9, fontFace: SANS, fontSize: 24, color: C.bodyLt, margin: 0, valign: "top", lineSpacingMultiple: 1.1 });
  const last = v.lines[v.lines.length - 1];
  slide.addShape("rect", { x: 8.4, y: 7.1, w: 9.8, h: 1.5, fill: { color: C.green } });
  slide.addText(last, { x: 8.76, y: 7.3, w: 9.1, h: 1.1, fontFace: SANS, fontSize: 22.5, bold: true, color: "FFFFFF", margin: 0, valign: "middle", lineSpacingMultiple: 1.05 });
  footer(slide, true, num, total);
}

// fallback for any unhandled visual: kicker + title + lead only
function renderPlain(slide, s, num, total) {
  bg(slide, false);
  head(slide, false, s.kicker, num, s.title, s.lead);
  footer(slide, false, num, total);
}

function main() {
  const jsonPath = process.argv[2];
  if (!jsonPath) { console.error("usage: node design-deck.mjs <content.json>"); process.exit(1); }
  const content = JSON.parse(readFileSync(jsonPath, "utf8"));
  const slides = content.slides;
  const total = slides.length;

  // Localize chrome from the content's language.
  LANG = (content.language === "es") ? "es" : "en";
  STEP = STEP_WORD[LANG];
  PROGRAM = (content.subtitle ?? "SQF Food Safety Training").toUpperCase();
  MODLABEL = `${LANG === "es" ? "MÓDULO" : "MODULE"} ${String(content.module ?? 1).padStart(2, "0")}`;
  const KICK = KICKERS_BY_LANG[LANG];

  // Optional images dir: files named "*slide<N>*.(jpg|jpeg|png|webp)" attach to slide N (1-based).
  const imagesDir = process.argv[3];
  if (imagesDir && existsSync(imagesDir)) {
    for (const f of readdirSync(imagesDir)) {
      if (!/\.(jpe?g|png|webp)$/i.test(f)) continue;
      const m = f.match(/slide0*(\d+)/i);
      if (!m) continue;
      const idx = parseInt(m[1], 10) - 1;
      if (slides[idx]) {
        slides[idx].photoFile = path.resolve(imagesDir, f);
        console.log(`  slide ${idx + 1} ← ${f}`);
      }
    }
  }

  const pptx = new PptxGenJS();
  pptx.defineLayout({ name: "M1", width: 20, height: 11.25 });
  pptx.layout = "M1";

  slides.forEach((s, i) => {
    const num = i + 1;
    s.kicker = s.kicker ?? KICK[num] ?? "";
    const slide = pptx.addSlide();
    if (s.kind === "title") {
      s.titleMain = content.title;
      s.subtitle = content.subtitle;
      s.intro = (content.slides[0].notes || "").split(".").slice(0, 2).join(".") + ".";
      renderTitle(slide, s, total);
      return;
    }
    const t = s.visual?.type;
    switch (t) {
      case "cards": renderCards(slide, s, num, total); break;
      case "badge": renderBadge(slide, s, num, total); break;
      case "workers": renderPhotoHero(slide, s, num, total); break;
      case "checklist": renderChecklist(slide, s, num, total); break;
      case "flow": renderFlow(slide, s, num, total); break;
      case "split": renderSplit(slide, s, num, total); break;
      case "stopSign": renderStop(slide, s, num, total); break;
      default: renderPlain(slide, s, num, total);
    }
  });

  const base = path.basename(jsonPath).replace(/\.json$/, "");
  const out = path.join(__dirname, "dist", `${base}.design.pptx`);
  pptx.writeFile({ fileName: out }).then(() => console.log("→", out));
}

main();
