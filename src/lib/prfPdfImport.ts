// Reads a filled Manufacturing Project Request Form (Form 009-1) PDF and proposes column
// values for prf_submissions. Nothing here writes — the caller reviews the proposal first.
//
// The form is a fixed printed template that customers fill in a PDF editor, which leaves three
// separable layers in the file:
//
//   1. the template   — Calibri, plus MS-Mincho/MS-PGothic for the ☐ glyphs
//   2. typed answers  — always Arial, and the template never is
//   3. ticks          — vector marks drawn OVER the ☐ glyph, so a ticked box still extracts
//                       as an empty ☐ and can only be found by looking at pixels
//
// Layer 2 is why this works at all, and layer 3 carries more columns than layer 1 does.
//
// Two pdf.js details this depends on, both verified rather than assumed:
//   • textContent.styles[].fontFamily is only a generic CSS fallback ("sans-serif"), so the real
//     font name must come from page.commonObjs — which is populated ONLY after the page renders.
//     Hence render-then-read, not read-then-maybe-render.
//   • Answers are located by their label, never by fixed coordinates: an answer's owning label is
//     the nearest template item to its left on the same row. A template revision moves the
//     coordinates but preserves that relationship.

export type PrfImportValue = string | string[] | boolean | null;

export type PrfImportField = {
  /** prf_submissions column */
  column: string;
  /** human label for the review UI */
  label: string;
  value: PrfImportValue;
  /** verbatim text/ticks read off the page, shown so a reviewer can check the interpretation */
  raw: string;
  /** set when the source is ambiguous and a person has to choose */
  review?: string;
};

export type PrfImportResult =
  | { ok: true; fields: PrfImportField[]; warnings: string[] }
  | { ok: false; reason: string };

type Item = {
  page: number;
  x: number;
  y: number;
  str: string;
  kind: "answer" | "template" | "box";
  /** ink ratio inside the box glyph; only meaningful for kind === "box" */
  ink?: number;
};

/** Ticked boxes measured 0.024–0.167; unticked measured exactly 0. The gap is wide. */
const TICK_THRESHOLD = 0.015;
/** An answer's baseline sits 2–5 units above its label's; line spacing is ~15. */
const ROW_TOLERANCE = 8;
/** Rendering scale for tick detection — enough pixels inside an ~8pt box to be decisive. */
const RENDER_SCALE = 3;

// ─── extraction ────────────────────────────────────────────────────────────────────────────

let workerConfigured = false;

async function loadPdfjs() {
  const pdfjs: any = await import("pdfjs-dist");
  if (!workerConfigured) {
    pdfjs.GlobalWorkerOptions.workerSrc = new URL(
      "pdfjs-dist/build/pdf.worker.mjs",
      import.meta.url,
    ).toString();
    workerConfigured = true;
  }
  return pdfjs;
}

/** Strips the six-letter subset prefix embedded fonts carry ("SOXHWI+Arial" → "Arial"). */
const baseFontName = (name: string) => (name || "").replace(/^[A-Z]{6}\+/, "");

async function readItems(file: File): Promise<{ items: Item[]; pages: number }> {
  const pdfjs = await loadPdfjs();
  const buf = await file.arrayBuffer();
  const doc = await pdfjs.getDocument({ data: buf }).promise;

  const items: Item[] = [];
  // Pages 4–5 are the recipe/process sheets; they carry no prf_submissions columns.
  const lastPage = Math.min(doc.numPages, 3);

  for (let pno = 1; pno <= lastPage; pno++) {
    const page = await doc.getPage(pno);
    const viewport = page.getViewport({ scale: RENDER_SCALE });
    const canvas = document.createElement("canvas");
    canvas.width = viewport.width;
    canvas.height = viewport.height;
    const ctx = canvas.getContext("2d", { willReadFrequently: true })!;
    // White ground first: the PDF paints no background, and unpainted canvas is transparent
    // black, which would read as ink in every box.
    ctx.fillStyle = "#fff";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    await page.render({ canvasContext: ctx, viewport, canvas }).promise;

    const content = await page.getTextContent({ disableCombineTextItems: true });
    const pixels = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const isDark = (x: number, y: number) => {
      if (x < 0 || y < 0 || x >= canvas.width || y >= canvas.height) return false;
      const i = ((y | 0) * canvas.width + (x | 0)) * 4;
      return (pixels.data[i] + pixels.data[i + 1] + pixels.data[i + 2]) / 3 < 140;
    };

    const fontOf = (key: string) => {
      try {
        return baseFontName(page.commonObjs.get(key)?.name ?? "");
      } catch {
        return "";
      }
    };

    for (const it of content.items as any[]) {
      if (!it.str || !it.str.trim()) continue;
      const font = fontOf(it.fontName);
      const x = it.transform[4];
      const y = it.transform[5];
      const boxAt = it.str.search(/[☐☑☒]/);

      if (boxAt >= 0) {
        const em = Math.hypot(it.transform[0], it.transform[1]);
        const [vx, vy] = viewport.convertToViewportPoint(x, y);
        // Advance past any characters preceding the glyph (they are ~0.5em each in this font).
        const left = vx + boxAt * 0.5 * em * RENDER_SCALE;
        const size = 0.78 * em * RENDER_SCALE;
        const inset = 0.28 * size; // skip the box outline itself; only its interior matters
        let ink = 0;
        let total = 0;
        for (let py = vy - size + inset; py < vy - inset; py++) {
          for (let px = left + inset; px < left + size - inset; px++) {
            total++;
            if (isDark(px, py)) ink++;
          }
        }
        items.push({ page: pno, x, y, str: it.str, kind: "box", ink: total ? ink / total : 0 });
        continue;
      }

      items.push({
        page: pno,
        x,
        y,
        str: it.str,
        kind: font === "Arial" ? "answer" : "template",
      });
    }

    canvas.width = 0; // release the backing store; these are ~2500×3300 per page
    canvas.height = 0;
  }

  return { items, pages: doc.numPages };
}

// ─── row model ─────────────────────────────────────────────────────────────────────────────

/** Template items on the same visual row as `y`, left-to-right. */
const rowTemplates = (items: Item[], page: number, y: number) =>
  items
    .filter((i) => i.page === page && i.kind === "template" && Math.abs(i.y - y) <= ROW_TOLERANCE)
    .sort((a, b) => a.x - b.x);

/**
 * Pairs each typed answer with the label that owns it — the nearest template item to its left on
 * the same row. This is what makes the reader tolerant of a moved layout.
 */
function pairAnswers(items: Item[]) {
  const pairs: { page: number; label: string; value: string; x: number; y: number }[] = [];
  for (const ans of items.filter((i) => i.kind === "answer")) {
    const owner = rowTemplates(items, ans.page, ans.y)
      .filter((t) => t.x <= ans.x + 4)
      .pop();
    pairs.push({
      page: ans.page,
      label: owner?.str ?? "",
      value: ans.str.trim(),
      x: ans.x,
      y: ans.y,
    });
  }
  return pairs.sort((a, b) => a.page - b.page || b.y - a.y || a.x - b.x);
}

/**
 * One checkbox on the paper form.
 *
 * `box` is the wording printed on the form; `as` is what gets written to the column. They differ
 * more often than not — the paper says "Bag in box" and "CoPack provided" where the Stage 2 wizard
 * writes "Bag-in-box" and "Manufacturer Provided". Emitting paper wording would leave imported
 * PRFs rendering inconsistently beside wizard-sourced ones. `as: null` means the box is understood
 * but contributes no value (the form's "Warehousing needs: yes" is implied by the storage type
 * ticked beside it).
 */
type Option = { box: string; as?: string | null; note?: string };

type Tick = { paper: string; value: string | null; note?: string };

/** Ticked options for a row, matched positionally against `options` in left-to-right order. */
function ticksForRow(items: Item[], page: number, rowMatch: RegExp, options: Option[]) {
  const row = items.find((i) => i.page === page && i.kind === "template" && rowMatch.test(i.str));
  if (!row) return { found: false, ticked: [] as Tick[], count: 0, y: 0 };
  const boxes = items
    .filter((i) => i.page === page && i.kind === "box" && Math.abs(i.y - row.y) <= ROW_TOLERANCE)
    .sort((a, b) => a.x - b.x);
  const ticked: Tick[] = [];
  boxes.forEach((b, idx) => {
    const opt = options[idx];
    if (!opt || (b.ink ?? 0) < TICK_THRESHOLD) return;
    ticked.push({ paper: opt.box, value: opt.as === undefined ? opt.box : opt.as, note: opt.note });
  });
  return { found: true, ticked, count: boxes.length, y: row.y };
}

// ─── the form map ──────────────────────────────────────────────────────────────────────────

type CheckField = {
  column: string;
  label: string;
  multi?: boolean;
  boolean?: boolean;
  groups: { page: number; row: RegExp; options: Option[] }[];
};

/** Readiness wording is shared by the packaging and artwork questions. */
const READINESS: Option[] = [
  { box: "Ready", as: "Ready / Packaging Secured" },
  { box: "In process", as: "In Process" },
  { box: "Need assistance", as: "Need Assistance" },
];

const CHECK_FIELDS: CheckField[] = [
  {
    column: "project_type",
    label: "Project type",
    groups: [
      {
        page: 1,
        row: /NEW PROJECT/,
        options: [{ box: "NEW PROJECT", as: "New Project" }, { box: "PROJECT CHANGE", as: "Project Change / Revision" }],
      },
    ],
  },
  {
    column: "development_approach",
    label: "Development approach",
    groups: [
      {
        page: 1,
        row: /Match Existing/,
        options: [
          { box: "Match Existing", as: "Match Existing Product" },
          { box: "Match & Improve", as: "Match & Improve Existing Product" },
        ],
      },
      { page: 1, row: /Develop from Scratch/, options: [{ box: "Develop from Scratch" }] },
    ],
  },
  {
    // The paper asks about process (bake/freeze/extrude); the wizard asks about pack format. Only
    // the two pack answers translate — the rest keep the form's own wording and are flagged, because
    // inventing an equivalence here would quietly put a wrong answer on the record.
    column: "finished_form",
    label: "Finished form",
    multi: true,
    groups: [
      {
        page: 1,
        row: /Baked & frozen/,
        options: [
          { box: "Baked & frozen (thaw & serve)", note: "No equivalent option in the online form — kept the paper wording." },
          { box: "Bake, bulk pack", as: "Bulk Pack" },
          { box: "bake & retail pack", as: "Retail Pack" },
        ],
      },
      {
        // Only two boxes on this row — "other______" beside them is a write-in blank, not a checkbox.
        page: 1,
        row: /Batter \(no bake\)/,
        options: [
          { box: "Batter (no bake) thaw and scoop", note: "No equivalent option in the online form — kept the paper wording." },
          { box: "Extrude pucks & Freeze", note: "No equivalent option in the online form — kept the paper wording." },
        ],
      },
    ],
  },
  {
    column: "is_nutraceutical",
    label: "Nutraceutical",
    boolean: true,
    groups: [{ page: 1, row: /considered Nutraceutical/, options: [{ box: "yes" }] }],
  },
  {
    column: "flavor_type",
    label: "Flavor type",
    groups: [
      {
        page: 1,
        row: /^Natural$/,
        options: [
          { box: "Natural" },
          { box: "Artificial" },
          { box: "Natural/Artificial", as: "Natural + Artificial" },
        ],
      },
    ],
  },
  {
    column: "intended_application",
    label: "Intended application",
    multi: true,
    groups: [
      {
        page: 1,
        row: /intended application of the product/,
        options: [{ box: "Retail" }, { box: "Foodservice" }, { box: "Other" }],
      },
    ],
  },
  {
    column: "additional_requirements",
    label: "Additional requirements",
    multi: true,
    groups: [
      {
        page: 1,
        row: /^Kosher/,
        options: [
          { box: "Kosher" },
          { box: "Allergen Restrictions" },
          { box: "Organic" },
          { box: "Gluten Free" },
          { box: "Non-GMO" },
          { box: "Export", as: "Export Requirements" },
        ],
      },
    ],
  },
  {
    column: "packaging_readiness",
    label: "Primary packaging design",
    groups: [{ page: 2, row: /Primary Packaging Design/, options: READINESS }],
  },
  {
    column: "primary_packaging_vessel",
    label: "Primary packaging vessel",
    groups: [
      {
        page: 2,
        row: /Primary Packaging Vessel/,
        options: [{ box: "Pre-made bags", note: "The online form has no \"pre-made bags\" option — kept the paper wording." }],
      },
      { page: 2, row: /^Bag in box/, options: [{ box: "Bag in box", as: "Bag-in-box" }] },
      { page: 2, row: /^Flow wrap/, options: [{ box: "Flow wrap" }] },
      { page: 2, row: /^Other$/, options: [{ box: "Other", as: "Other (text)" }] },
    ],
  },
  {
    column: "artwork_readiness",
    label: "Artwork / graphic design",
    groups: [{ page: 2, row: /Artwork\/Graphic Design/, options: READINESS }],
  },
  {
    column: "label_responsibility",
    label: "Primary label",
    groups: [
      {
        page: 2,
        row: /Primary Label \(if applicable\)/,
        options: [
          { box: "Customer Provided" },
          { box: "CoPack provided", as: "Manufacturer Provided" },
        ],
      },
    ],
  },
  {
    column: "pallets_required",
    label: "Pallets required",
    groups: [
      {
        page: 2,
        row: /Type of Pallets required/,
        options: [
          { box: "NA" },
          { box: "Chep Pallet" },
          { box: "Plastic Pallet" },
          { box: "Euro Pallet" },
        ],
      },
    ],
  },
  {
    column: "warehousing_needs",
    label: "Warehousing needs",
    multi: true,
    groups: [
      {
        page: 2,
        row: /Warehousing needs/,
        options: [
          // "yes" carries nothing the storage type beside it does not already say.
          { box: "yes", as: null },
          { box: "no", as: "No Warehousing Needed" },
          { box: "Just dry Storage", as: "Dry Storage" },
          { box: "Cold Storage", as: "Cold Storage (Refrigerated)" },
          { box: "Freezer storage", as: "Freezer Storage" },
        ],
      },
    ],
  },
];

// ─── value parsing ─────────────────────────────────────────────────────────────────────────

/** "22gr" → { value: "22", unit: "g" }; "1.5 lbs" → { value: "1.5", unit: "lbs" } */
export function splitMeasure(raw: string): { value: string | null; unit: string | null } {
  const m = /^\s*([\d.,]+)\s*([A-Za-z]*)/.exec(raw || "");
  if (!m) return { value: null, unit: null };
  const unit = (m[2] || "").toLowerCase();
  const normalized =
    unit.startsWith("gr") || unit === "g" ? "g"
    : unit.startsWith("kg") ? "kg"
    : unit === "oz" ? "oz"
    : unit.startsWith("lb") ? "lbs"
    : unit || null;
  return { value: m[1].replace(/,$/, ""), unit: normalized };
}

/** "1*1.5 inches" → { dims: ["1","1.5"], unit: "inches" } — separator may be * x × or , */
export function splitDimensions(raw: string): { dims: string[]; unit: string | null } {
  const unit = /(inch(es)?|in|cm|mm|ft)\b/i.exec(raw || "")?.[1] ?? null;
  const dims = (raw || "").replace(/[^\d.*x×,\s]/gi, " ").split(/[*x×,\s]+/i).map((s) => s.trim()).filter((s) => /^[\d.]+$/.test(s));
  return { dims, unit: unit ? unit.toLowerCase() : null };
}

// ─── public entry point ────────────────────────────────────────────────────────────────────

export async function extractPrfFromPdf(file: File): Promise<PrfImportResult> {
  if (!/\.pdf$/i.test(file.name) && file.type !== "application/pdf") {
    return { ok: false, reason: "Only PDF files can be read. Attach the file and fill the form manually." };
  }

  let items: Item[];
  try {
    ({ items } = await readItems(file));
  } catch (e: any) {
    return { ok: false, reason: `Could not open the PDF (${e?.message || "unknown error"}).` };
  }

  const templates = items.filter((i) => i.kind === "template");
  if (templates.length < 20) {
    // A printed-and-scanned PRF is a single image with no text layer at all. Nothing here can
    // read it, and pretending otherwise would silently import nothing.
    return {
      ok: false,
      reason: "This PDF has no text layer — it looks like a scan. Values must be entered manually.",
    };
  }
  if (!templates.some((t) => /MANUFACTURING PROJECT REQUEST FORM/i.test(t.str))) {
    return {
      ok: false,
      reason: "This does not look like a Manufacturing Project Request Form, so nothing was read.",
    };
  }

  const fields: PrfImportField[] = [];
  const warnings: string[] = [];
  const pairs = pairAnswers(items);
  const push = (column: string, label: string, value: PrfImportValue, raw: string, review?: string) => {
    if (value === null || value === "" || (Array.isArray(value) && !value.length)) return;
    fields.push({ column, label, value, raw, review });
  };
  const find = (page: number, label: RegExp) => pairs.find((p) => p.page === page && label.test(p.label));

  // ── typed answers ────────────────────────────────────────────────────────────────────────
  push("company_name", "Company", find(1, /CUSTOMER NAME/)?.value ?? null, find(1, /CUSTOMER NAME/)?.value ?? "");
  push("product_name", "Product name", find(1, /PRODUCT NAME/)?.value ?? null, find(1, /PRODUCT NAME/)?.value ?? "");

  const weight = find(2, /Weight of Unit/);
  if (weight) {
    const { value, unit } = splitMeasure(weight.value);
    push("weight_per_unit", "Weight per unit", value, weight.value);
    push("weight_per_unit_unit", "Weight unit", unit, weight.value);
  }

  const dim = find(2, /Dimension of Unit/);
  if (dim) {
    const { dims, unit } = splitDimensions(dim.value);
    const axes = ["unit_dimension_l", "unit_dimension_w", "unit_dimension_h"];
    dims.slice(0, 3).forEach((d, i) =>
      push(axes[i], `Unit dimension ${["L", "W", "H"][i]}`, d, dim.value),
    );
    push("unit_dimension_unit", "Dimension unit", unit, dim.value);
    if (dims.length < 3) {
      warnings.push(
        `Unit dimensions gave ${dims.length} of 3 values ("${dim.value}") — height was left blank on the form.`,
      );
    }
  }

  push("target_date", "Target date", find(2, /Target Date/)?.value ?? null, find(2, /Target Date/)?.value ?? "");
  push("price_target_per_unit", "Price target per unit", find(2, /Price Target/)?.value ?? null, find(2, /Price Target/)?.value ?? "");
  push("annual_volume", "Annual volume", find(2, /Annual Volumes/)?.value ?? null, find(2, /Annual Volumes/)?.value ?? "");

  const order = find(2, /Order Quantity & Frequency/);
  if (order) {
    // One blank on paper, two columns in the schema. Don't invent a split.
    push("order_frequency", "Order frequency", order.value, order.value, "The form has a single blank for quantity and frequency — confirm the split.");
  }

  push("net_weight_per_primary_pack", "Required vessel weight", find(2, /Required Vessel Weight/)?.value ?? null, find(2, /Required Vessel Weight/)?.value ?? "");
  push("secondary_packaging", "Secondary packaging", find(2, /Secondary Packaging/)?.value ?? null, find(2, /Secondary Packaging/)?.value ?? "");
  push("master_carton_requirements", "Shipping packaging", find(2, /Shipping Packaging Requirements/)?.value ?? null, find(2, /Shipping Packaging Requirements/)?.value ?? "");

  push("technical_contact_name", "Technical contact", find(3, /Technical\/R&D Contact/)?.value ?? null, find(3, /Technical\/R&D Contact/)?.value ?? "");
  push("technical_contact_phone", "Technical contact phone", find(3, /Telephone Number/)?.value ?? null, find(3, /Telephone Number/)?.value ?? "");
  push("technical_contact_email", "Technical contact email", find(3, /^Email:/)?.value ?? null, find(3, /^Email:/)?.value ?? "");

  // Additional project info runs across several underscore-only rows, so it is gathered by
  // position between its heading and the signature line rather than by label.
  const infoTop = items.find((i) => i.page === 3 && i.kind === "template" && /Additional Project Information/.test(i.str));
  const infoBottom = items.find((i) => i.page === 3 && i.kind === "template" && /Clients signature/.test(i.str));
  if (infoTop) {
    const body = items
      .filter(
        (i) =>
          i.page === 3 &&
          i.kind === "answer" &&
          i.y <= infoTop.y + ROW_TOLERANCE &&
          (!infoBottom || i.y > infoBottom.y + ROW_TOLERANCE),
      )
      .sort((a, b) => b.y - a.y)
      .map((i) => i.str.trim())
      .join("\n");
    push("additional_project_info", "Additional project information", body || null, body);
  }

  // ── ticked boxes ─────────────────────────────────────────────────────────────────────────
  /** Row y of the ticked vessel, kept so the units-per-vessel lookup below can find its row. */
  let vesselRowY: number | undefined;
  let vesselPaper: string | undefined;

  for (const field of CHECK_FIELDS) {
    const ticked: Tick[] = [];
    let anyRow = false;
    for (const g of field.groups) {
      const r = ticksForRow(items, g.page, g.row, g.options);
      if (!r.found) continue;
      anyRow = true;
      if (r.count !== g.options.length) {
        warnings.push(
          `"${field.label}" expected ${g.options.length} boxes but found ${r.count} — the form template may have changed.`,
        );
      }
      if (field.column === "primary_packaging_vessel" && r.ticked.length) {
        vesselRowY = r.y;
        vesselPaper = r.ticked[0].paper;
      }
      ticked.push(...r.ticked);
    }
    if (!anyRow) continue;

    if (field.boolean) {
      push(field.column, field.label, ticked.length > 0, ticked.length ? "ticked" : "not ticked");
      continue;
    }
    const values = ticked.map((t) => t.value).filter((v): v is string => v !== null);
    if (!values.length) continue;
    const notes = [...new Set(ticked.map((t) => t.note).filter(Boolean))].join(" ");
    const raw = ticked.map((t) => t.paper).join(", ");

    if (field.multi) {
      push(field.column, field.label, values, raw, notes || undefined);
    } else {
      push(
        field.column,
        field.label,
        values[0],
        raw,
        [values.length > 1 ? "More than one box is ticked — only the first was taken." : "", notes]
          .filter(Boolean)
          .join(" ") || undefined,
      );
    }
  }

  // ── the "Other" vessel write-in ──────────────────────────────────────────────────────────
  // Only meaningful when Other is the ticked vessel; the form often carries stray text on that
  // line even when a different vessel is selected.
  if (vesselPaper === "Other" && vesselRowY != null) {
    const onRow = pairs
      .filter((p) => p.page === 2 && Math.abs(p.y - vesselRowY) <= ROW_TOLERANCE)
      .sort((a, b) => a.x - b.x);
    if (onRow.length) push("primary_packaging_other", "Other vessel", onRow[0].value, onRow[0].value);
  }

  // ── units per primary vessel ─────────────────────────────────────────────────────────────
  // The form repeats "Units per primary vessel" once per vessel type and more than one row can
  // carry a number. The ticked vessel decides which is real — the tick layer resolving an
  // ambiguity the typed layer cannot.
  // The "Other ______; Units per primary vessel" row shares one label item, so a write-in vessel
  // description lands here too. A count has a digit in it; a description does not.
  const vesselCounts = pairs.filter(
    (p) => p.page === 2 && /Units per primary vessel/.test(p.label) && /\d/.test(p.value),
  );
  if (vesselCounts.length) {
    const onChosenRow =
      vesselRowY != null
        ? vesselCounts.find((p) => Math.abs(p.y - vesselRowY!) <= ROW_TOLERANCE)
        : undefined;
    const picked = onChosenRow ?? vesselCounts[0];
    push(
      "units_per_primary_pack",
      "Units per primary pack",
      picked.value,
      vesselCounts.map((v) => v.value).join(" / "),
      vesselCounts.length > 1
        ? `${vesselCounts.length} vessel rows carry a number (${vesselCounts.map((v) => v.value).join(", ")}); ${
            onChosenRow ? `took the ticked "${vesselPaper}" row.` : "none matched the ticked vessel, so the first was taken."
          }`
        : undefined,
    );
  }

  if (!fields.length) {
    return { ok: false, reason: "The PDF was readable but no filled-in values were found." };
  }
  return { ok: true, fields, warnings };
}
