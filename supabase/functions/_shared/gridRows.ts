// Placing the rows a model read from a fixed-row table onto the form's own rows BY THEIR LABEL
// (extract-form-answers, document mode - a PDF given to "Fill from a photo").
//
// The photograph path lines rows up by position: the paper form and the digital form have the same
// rows in the same order. A PDF is often an EARLIER record of the same form, and the form may have
// changed since - a row removed (FRM-903's Chopper, 2026-10-09) - or the table may continue over a
// page break. Position then puts every later answer on the wrong row, and a wrong answer on a
// sanitation record is worse than a blank one. So in document mode the model returns each row with
// the label printed beside it, and this file decides where it goes.
//
// Pure: no imports, tested by scripts/test-grid-rows.mjs.

/** Case, punctuation and spacing ignored: "Kook-E-King Depositor — SOP-902 / FRM-910" == "kook e king depositor sop 902 frm 910". */
export function normLabel(v: unknown): string {
  return String(v ?? "").toLowerCase().normalize("NFKD").replace(/[^a-z0-9]+/g, " ").trim();
}

export interface PlacedRows {
  /** True when the rows carried labels and were placed by them; false = fall back to position. */
  byLabel: boolean;
  /** One entry per form row, in the form's order: the row read for it, or null if none was. */
  rows: (Record<string, unknown> | null)[];
  /** Labels read from the document that are not rows of this form (their answers are dropped). */
  unmatched: string[];
}

/**
 * `incoming` are the model's row objects, each expected to carry "_row": the label printed on
 * that row. A row goes to the form row with the same label; failing that, to the one form row
 * whose label begins with it or that it begins with (a label cut short by a narrow column). A
 * label that fits no row, or more than one, is reported and its row dropped - never guessed.
 * If no row carries a label at all, nothing is placed and the caller uses position as before.
 * When two document rows claim one form row, the first is kept.
 */
export function placeRowsByLabel(rowLabels: unknown[], incoming: unknown[]): PlacedRows {
  const labels = (Array.isArray(rowLabels) ? rowLabels : []).map(normLabel);
  const list = (Array.isArray(incoming) ? incoming : [])
    .filter((r): r is Record<string, unknown> => !!r && typeof r === "object" && !Array.isArray(r));
  const rows: (Record<string, unknown> | null)[] = labels.map(() => null);
  const labelled = list.filter(r => typeof r._row === "string" && normLabel(r._row) !== "");
  if (!labelled.length) return { byLabel: false, rows, unmatched: [] };

  const unmatched: string[] = [];
  for (const row of labelled) {
    const want = normLabel(row._row);
    let at = labels.indexOf(want);
    if (at < 0) {
      const near = labels
        .map((l, i) => (l !== "" && (l.startsWith(want + " ") || want.startsWith(l + " ")) ? i : -1))
        .filter(i => i >= 0);
      at = near.length === 1 ? near[0] : -1;
    }
    if (at < 0) { unmatched.push(String(row._row).trim()); continue; }
    if (rows[at] === null) rows[at] = row;
  }
  return { byLabel: true, rows, unmatched };
}
