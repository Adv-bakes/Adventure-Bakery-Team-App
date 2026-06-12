// Generated illustration library for the SQF training decks.
// Hand-authored flat SVG in the bakery palette, rasterized to PNG at build time
// with @resvg/resvg-js. Industrial/contract-manufacturer vocabulary only —
// production line, hairnet PPE, shipping, QA — no storefront/chef-hat imagery
// (see DECK_FORMAT_CONTRACT.md content policy).

import { Resvg } from "@resvg/resvg-js";
import { writeFileSync, mkdirSync } from "node:fs";
import { join } from "node:path";

const P = {
  brown: "#3B2F2F", amber: "#C8873C", amberLight: "#E8C893",
  cream: "#FFF8F0", paper: "#FFFEFB", white: "#FFFDF7",
  green: "#4A7C59", greenLight: "#9DBCA8", skin: "#EFD9BC", apron: "#FFF4E2",
};

const svg = (w, h, body) =>
  `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">${body}</svg>`;

// One worker bust: bouffant cap (GMP hairnet), head, apron-front body.
const worker = (cx, color) => `
  <ellipse cx="${cx}" cy="96" rx="58" ry="38" fill="${P.white}"/>
  <rect x="${cx - 58}" y="116" width="116" height="16" rx="8" fill="${P.amberLight}"/>
  <circle cx="${cx}" cy="164" r="44" fill="${P.skin}"/>
  <circle cx="${cx - 15}" cy="158" r="5" fill="${P.brown}"/>
  <circle cx="${cx + 15}" cy="158" r="5" fill="${P.brown}"/>
  <path d="M ${cx - 13},178 Q ${cx},189 ${cx + 13},178" stroke="${P.brown}" stroke-width="5" fill="none" stroke-linecap="round"/>
  <rect x="${cx - 72}" y="206" width="144" height="184" rx="36" fill="${color}"/>
  <rect x="${cx - 40}" y="240" width="80" height="116" rx="14" fill="${P.apron}" opacity="0.92"/>`;

const SOURCES = {
  // --- backgrounds (full-bleed, 2x the 960×540 render) ---
  bgContent: svg(1920, 1080, `
    <rect width="1920" height="1080" fill="${P.cream}"/>
    <circle cx="1840" cy="-120" r="560" fill="${P.amber}" opacity="0.07"/>
    <circle cx="-80" cy="1160" r="500" fill="${P.green}" opacity="0.06"/>
    <circle cx="1700" cy="980" r="230" fill="none" stroke="${P.amber}" stroke-width="34" opacity="0.07"/>
    <circle cx="120" cy="990" r="10" fill="${P.amber}" opacity="0.16"/>
    <circle cx="170" cy="950" r="6" fill="${P.green}" opacity="0.16"/>`),
  bgTitle: svg(1920, 1080, `
    <rect width="1920" height="1080" fill="${P.cream}"/>
    <rect width="1920" height="16" fill="${P.amber}"/>
    <rect y="1064" width="1920" height="16" fill="${P.amber}"/>
    <circle cx="1860" cy="-60" r="660" fill="${P.amber}" opacity="0.10"/>
    <circle cx="-120" cy="1180" r="560" fill="${P.green}" opacity="0.08"/>
    <circle cx="170" cy="150" r="250" fill="none" stroke="${P.amber}" stroke-width="40" opacity="0.10"/>
    <circle cx="1680" cy="860" r="12" fill="${P.amber}" opacity="0.20"/>
    <circle cx="1740" cy="800" r="8" fill="${P.green}" opacity="0.20"/>
    <circle cx="1620" cy="920" r="8" fill="${P.amber}" opacity="0.16"/>`),

  // --- spot illustrations ---
  conveyor: svg(900, 360, `
    <rect x="20" y="110" width="74" height="100" rx="10" fill="${P.green}"/>
    <circle cx="57" cy="140" r="9" fill="${P.cream}"/>
    <circle cx="57" cy="170" r="9" fill="${P.amberLight}"/>
    <path d="M250,118 q-14,-22 0,-44 q14,-22 0,-44" stroke="${P.amberLight}" stroke-width="10" fill="none" stroke-linecap="round" opacity="0.75"/>
    <path d="M700,128 q-14,-22 0,-44 q14,-22 0,-44" stroke="${P.amberLight}" stroke-width="10" fill="none" stroke-linecap="round" opacity="0.75"/>
    <ellipse cx="225" cy="172" rx="72" ry="44" fill="${P.amber}"/>
    <ellipse cx="200" cy="146" rx="30" ry="17" fill="${P.amberLight}"/>
    <rect x="395" y="128" width="132" height="82" rx="12" fill="${P.amber}"/>
    <rect x="395" y="128" width="132" height="28" rx="12" fill="${P.cream}"/>
    <circle cx="418" cy="156" r="10" fill="${P.cream}"/>
    <circle cx="461" cy="158" r="10" fill="${P.cream}"/>
    <circle cx="504" cy="156" r="10" fill="${P.cream}"/>
    <circle cx="461" cy="116" r="11" fill="${P.green}"/>
    <ellipse cx="680" cy="174" rx="50" ry="38" fill="${P.amberLight}"/>
    <ellipse cx="664" cy="158" rx="7" ry="4" fill="${P.cream}"/>
    <ellipse cx="692" cy="152" rx="7" ry="4" fill="${P.cream}"/>
    <rect x="70" y="210" width="780" height="54" rx="27" fill="${P.brown}"/>
    <circle cx="160" cy="294" r="22" fill="${P.amberLight}"/>
    <circle cx="320" cy="294" r="22" fill="${P.amberLight}"/>
    <circle cx="480" cy="294" r="22" fill="${P.amberLight}"/>
    <circle cx="640" cy="294" r="22" fill="${P.amberLight}"/>
    <circle cx="790" cy="294" r="22" fill="${P.amberLight}"/>`),
  workers: svg(900, 420, [
    worker(130, P.amber), worker(360, P.green), worker(590, P.brown), worker(820, P.amber),
  ].join("")),
  truck: svg(520, 360, `
    <rect x="14" y="128" width="52" height="14" rx="7" fill="${P.amberLight}" opacity="0.8"/>
    <rect x="2" y="172" width="64" height="14" rx="7" fill="${P.amberLight}" opacity="0.6"/>
    <rect x="14" y="216" width="52" height="14" rx="7" fill="${P.amberLight}" opacity="0.8"/>
    <rect x="86" y="80" width="290" height="172" rx="14" fill="${P.amber}"/>
    <rect x="86" y="148" width="290" height="30" fill="${P.cream}" opacity="0.85"/>
    <rect x="86" y="206" width="290" height="16" fill="${P.green}"/>
    <path d="M376,160 h84 a18,18 0 0 1 18,18 v60 a14,14 0 0 1 -14,14 h-88 Z" fill="${P.green}"/>
    <rect x="390" y="172" width="56" height="44" rx="8" fill="${P.cream}"/>
    <circle cx="160" cy="272" r="40" fill="${P.brown}"/>
    <circle cx="160" cy="272" r="16" fill="${P.cream}"/>
    <circle cx="404" cy="272" r="40" fill="${P.brown}"/>
    <circle cx="404" cy="272" r="16" fill="${P.cream}"/>
    <rect x="30" y="308" width="470" height="10" rx="5" fill="${P.amberLight}" opacity="0.7"/>`),
  clipboardMagnifier: svg(420, 420, `
    <rect x="90" y="56" width="240" height="324" rx="18" fill="${P.paper}" stroke="${P.amberLight}" stroke-width="6"/>
    <rect x="160" y="32" width="100" height="44" rx="12" fill="${P.brown}"/>
    <circle cx="210" cy="54" r="10" fill="${P.cream}"/>
    <rect x="128" y="124" width="164" height="16" rx="8" fill="${P.amberLight}"/>
    <rect x="128" y="172" width="164" height="16" rx="8" fill="${P.amberLight}"/>
    <rect x="128" y="220" width="110" height="16" rx="8" fill="${P.amberLight}"/>
    <circle cx="148" cy="290" r="17" fill="${P.green}"/>
    <path d="M139,290 l7,8 l13,-15" stroke="${P.cream}" stroke-width="6" fill="none" stroke-linecap="round" stroke-linejoin="round"/>
    <circle cx="296" cy="296" r="78" fill="${P.cream}" opacity="0.35" stroke="${P.brown}" stroke-width="16"/>
    <rect x="342" y="342" width="28" height="104" rx="14" fill="${P.brown}" transform="rotate(-45 356 394)"/>`),
  ribbonMedal: svg(340, 440, `
    <polygon points="120,255 72,408 138,368 168,282" fill="${P.green}"/>
    <polygon points="220,255 268,408 202,368 172,282" fill="${P.amber}"/>
    <circle cx="170" cy="165" r="115" fill="${P.amber}"/>
    <circle cx="170" cy="165" r="88" fill="${P.cream}"/>
    <circle cx="170" cy="165" r="98" fill="none" stroke="${P.amberLight}" stroke-width="8"/>
    <path d="M122,168 l32,32 l64,-66" stroke="${P.green}" stroke-width="22" fill="none" stroke-linecap="round" stroke-linejoin="round"/>`),
  auditor: svg(380, 440, `
    <ellipse cx="190" cy="96" rx="62" ry="38" fill="${P.white}"/>
    <rect x="128" y="118" width="124" height="16" rx="8" fill="${P.amberLight}"/>
    <rect x="172" y="214" width="36" height="52" rx="10" fill="${P.skin}"/>
    <circle cx="190" cy="176" r="48" fill="${P.skin}"/>
    <circle cx="162" cy="170" r="24" fill="none" stroke="${P.brown}" stroke-width="7"/>
    <circle cx="218" cy="170" r="24" fill="none" stroke="${P.brown}" stroke-width="7"/>
    <rect x="184" y="166" width="12" height="7" fill="${P.brown}"/>
    <path d="M176,206 Q190,216 204,206" stroke="${P.brown}" stroke-width="5" fill="none" stroke-linecap="round"/>
    <rect x="76" y="258" width="228" height="160" rx="40" fill="${P.green}"/>
    <polygon points="168,258 190,292 212,258" fill="${P.cream}"/>
    <g transform="rotate(8 300 320)">
      <rect x="258" y="250" width="86" height="122" rx="10" fill="${P.paper}" stroke="${P.amberLight}" stroke-width="5"/>
      <rect x="284" y="236" width="36" height="26" rx="8" fill="${P.brown}"/>
      <rect x="272" y="288" width="60" height="10" rx="5" fill="${P.amberLight}"/>
      <rect x="272" y="314" width="44" height="10" rx="5" fill="${P.amberLight}"/>
    </g>`),

  // --- product icons (allergen split panel) ---
  burger: svg(220, 210, `
    <path d="M18,98 Q18,28 110,28 Q202,28 202,98 Z" fill="${P.amber}"/>
    <ellipse cx="70" cy="62" rx="8" ry="5" fill="${P.cream}"/>
    <ellipse cx="112" cy="48" rx="8" ry="5" fill="${P.cream}"/>
    <ellipse cx="152" cy="64" rx="8" ry="5" fill="${P.cream}"/>
    <rect x="14" y="98" width="192" height="20" rx="10" fill="${P.greenLight}"/>
    <rect x="18" y="122" width="184" height="26" rx="13" fill="${P.brown}"/>
    <rect x="22" y="152" width="176" height="30" rx="15" fill="${P.amber}"/>`),
  wheat: svg(200, 280, `
    <path d="M100,272 L100,48" stroke="${P.brown}" stroke-width="8" stroke-linecap="round"/>
    <ellipse cx="100" cy="46" rx="15" ry="30" fill="${P.amber}"/>
    <ellipse cx="72" cy="92" rx="14" ry="28" fill="${P.amber}" transform="rotate(-32 72 92)"/>
    <ellipse cx="128" cy="92" rx="14" ry="28" fill="${P.amber}" transform="rotate(32 128 92)"/>
    <ellipse cx="72" cy="140" rx="14" ry="28" fill="${P.amber}" transform="rotate(-32 72 140)"/>
    <ellipse cx="128" cy="140" rx="14" ry="28" fill="${P.amber}" transform="rotate(32 128 140)"/>
    <ellipse cx="72" cy="188" rx="14" ry="28" fill="${P.amber}" transform="rotate(-32 72 188)"/>
    <ellipse cx="128" cy="188" rx="14" ry="28" fill="${P.amber}" transform="rotate(32 128 188)"/>`),
  egg: svg(180, 220, `
    <path d="M90,18 C136,18 158,82 158,136 C158,186 128,206 90,206 C52,206 22,186 22,136 C22,82 44,18 90,18 Z"
      fill="${P.white}" stroke="${P.amberLight}" stroke-width="8"/>
    <ellipse cx="64" cy="72" rx="13" ry="22" fill="#FFFFFF" opacity="0.8"/>`),
  milk: svg(180, 240, `
    <polygon points="40,95 90,45 140,95" fill="${P.cream}" stroke="${P.amberLight}" stroke-width="6" stroke-linejoin="round"/>
    <rect x="40" y="95" width="100" height="130" fill="${P.paper}" stroke="${P.amberLight}" stroke-width="6"/>
    <rect x="43" y="150" width="94" height="32" fill="${P.green}"/>
    <ellipse cx="90" cy="46" rx="13" ry="8" fill="${P.amberLight}"/>`),

  // --- card icons (amber/green disc + cream glyph) ---
  iconChat: svg(200, 200, `
    <circle cx="100" cy="100" r="100" fill="${P.amber}"/>
    <rect x="46" y="58" width="108" height="72" rx="18" fill="${P.white}"/>
    <polygon points="72,126 72,156 100,126" fill="${P.white}"/>
    <circle cx="78" cy="94" r="8" fill="${P.amber}"/>
    <circle cx="100" cy="94" r="8" fill="${P.amber}"/>
    <circle cx="122" cy="94" r="8" fill="${P.amber}"/>`),
  iconTruck: svg(200, 200, `
    <circle cx="100" cy="100" r="100" fill="${P.amber}"/>
    <rect x="36" y="72" width="82" height="54" rx="8" fill="${P.white}"/>
    <path d="M118,86 h32 a10,10 0 0 1 10,10 v22 a8,8 0 0 1 -8,8 h-34 Z" fill="${P.white}"/>
    <circle cx="66" cy="134" r="14" fill="${P.white}"/>
    <circle cx="66" cy="134" r="6" fill="${P.amber}"/>
    <circle cx="134" cy="134" r="14" fill="${P.white}"/>
    <circle cx="134" cy="134" r="6" fill="${P.amber}"/>`),
  iconPeople: svg(200, 200, `
    <circle cx="100" cy="100" r="100" fill="${P.amber}"/>
    <circle cx="80" cy="80" r="24" fill="${P.white}"/>
    <path d="M44,152 a36,34 0 0 1 72,0 Z" fill="${P.white}"/>
    <circle cx="130" cy="90" r="20" fill="${P.apron}"/>
    <path d="M100,154 a30,28 0 0 1 60,0 Z" fill="${P.apron}"/>`),
  iconHand: svg(200, 200, `
    <circle cx="100" cy="100" r="100" fill="${P.green}"/>
    <rect x="70" y="64" width="62" height="86" rx="26" fill="${P.white}"/>
    <rect x="72" y="42" width="13" height="34" rx="6" fill="${P.white}"/>
    <rect x="88" y="36" width="13" height="38" rx="6" fill="${P.white}"/>
    <rect x="104" y="38" width="13" height="36" rx="6" fill="${P.white}"/>
    <rect x="120" y="44" width="13" height="32" rx="6" fill="${P.white}"/>
    <ellipse cx="62" cy="112" rx="12" ry="22" fill="${P.white}" transform="rotate(-24 62 112)"/>`),
};

// Rasterizes every SVG once into dir; returns { name: { path, w, h } } where
// w/h are the SVG's intrinsic pixel size (for aspect-correct placement).
export function buildAssets(dir) {
  mkdirSync(dir, { recursive: true });
  const out = {};
  for (const [name, src] of Object.entries(SOURCES)) {
    const path = join(dir, `${name}.png`);
    writeFileSync(path, new Resvg(src).render().asPng());
    const [, w, h] = src.match(/width="(\d+)" height="(\d+)"/).map(Number);
    out[name] = { path, w, h };
  }
  return out;
}
