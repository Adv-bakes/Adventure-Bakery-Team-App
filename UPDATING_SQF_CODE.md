# Updating the SQF Quality Code (new edition runbook)

This document explains how to refresh the in-app SQF Quality Code reference when SQFI
publishes a new edition. It supports the **interactive SQF references** in the SOPs Library
(`/team/compliance/sops`), where each clause number in the **SQF Ref** column shows the clause
text on hover and links to the exact page of the code PDF.

## How the feature is wired (what depends on what)

**Two codes are hosted** — the Quality Code and the Food Safety Code: Food Manufacturing (for Module 11 / 11.x references). They are independent PDFs + clause maps; the renderer resolves a token against Quality first, then Food Manufacturing.

| Piece | Location | Role |
|-------|----------|------|
| Quality Code PDF | `public/sqf-quality-code.pdf` | Served at `/sqf-quality-code.pdf`; opened via `#page=N`. |
| Food Mfg Code PDF | `public/sqf-food-manufacturing-code.pdf` | Served at `/sqf-food-manufacturing-code.pdf`; opened via `#page=N`. |
| Quality clause data | `src/lib/sqfClauses.ts` | **Auto-generated** map + `lookupSqfClause()`, `sqfPdfHref()`; exports the shared `SqfClause` type. |
| Food clause data | `src/lib/sqfFoodClauses.ts` | **Auto-generated** map + `lookupSqfFoodClause()`, `sqfFoodPdfHref()`, `SQF_FOOD_CLAUSES`. |
| Quality generator | `scripts/generate-sqf-clauses.py` | Parses the Quality PDF → `sqfClauses.ts`. `parse(text, noise=NOISE)` is reused by the food generator. |
| Food generator | `scripts/generate-sqf-food-clauses.py` | Reuses the base `parse()`/`extract_text()` with a Food-Mfg NOISE filter → `sqfFoodClauses.ts`. |
| Renderer | `src/components/team/SqfReference.tsx` | Hover-card chip; resolves Quality→Food, picks the matching PDF + label. |

**Food Manufacturing code:** same workflow as below, but run `python scripts/generate-sqf-food-clauses.py`, spot-check `11.2.5.7`, `11.3.4.1`, `11.7.3.5`, and edit the `NOISE` tuple in `generate-sqf-food-clauses.py` if a new edition changes the footer. That `NOISE` deliberately uses the *full* footer strings (not bare "Edition 9"/"Food Manufacturing") so clause text such as "...in a food manufacturing environment" (11.2.5.2) is not stripped.

Key fact this relies on: in the current PDF the **printed page number equals the physical page
number** (clause 2.3.1.2 is on page 33, etc.), so `#page=N` lands correctly. **Re-verify this for
any new edition** (see step 4) — if a new edition adds front matter, the offset can change.

## Prerequisites (one-time)

- **Python 3** on PATH.
- **poppler's `pdftotext`** on PATH (provides PDF text extraction). Verify with `pdftotext -v`.
  - Windows: ships with Git for Windows (`/mingw64/bin/pdftotext`) or install poppler.
  - macOS: `brew install poppler`. Linux: `apt install poppler-utils`.

## Steps to update to a new edition

1. **Replace the PDF.** Save the new edition over the existing file, keeping the same name:
   ```
   public/sqf-quality-code.pdf
   ```
   (Keep the filename identical — the URL `/sqf-quality-code.pdf` is referenced in code. If you
   must rename it, update `SQF_PDF_URL` in `src/lib/sqfClauses.ts`'s generator header and re-run.)

2. **Check the footer string.** Open `scripts/generate-sqf-clauses.py` and look at the `NOISE`
   tuple. It contains `"Edition 9"` to strip the running footer. If the new edition's footer reads
   e.g. "Edition 10", update that entry so the footer text is still filtered out of clause bodies.

3. **Regenerate the clause data:**
   ```
   python scripts/generate-sqf-clauses.py
   ```
   This rewrites `src/lib/sqfClauses.ts` and prints the clause count (currently ~134).

4. **Spot-check the output** (extraction quirks differ between PDFs). Open `src/lib/sqfClauses.ts`
   and confirm a handful of clauses have correct **text** and **page**, especially:
   - First-sub-clauses that share a line with a section heading: `2.3.1.1`, `2.2.3.1`, `2.6.1.1`
   - A clause with a roman-numeral sub-list: `2.3.4.2`
   - One early and one late clause: `2.1.2.5`, `2.6.1.1`

   Then open the PDF to those printed pages and confirm `page` matches the **physical** page
   (the page you'd type into a viewer's "go to page"). If pages are off by a constant amount, the
   new edition added front matter; the simplest fix is to add that offset where the generator
   records `pidx` (see `add(cid, pidx, ...)` in `parse()`), or adjust `page` handling there.

5. **Type-check and preview:**
   ```
   npx tsc --noEmit
   npm run dev
   ```
   In the app, go to **Compliance → SOPs Library**, switch to **By Category**, hover an SQF Ref
   chip (text appears), and click **View in SQF Code (p.N)** (opens the PDF at the right page).

6. **Update existing references if clause numbers changed.** Editions sometimes renumber clauses.
   The `sqf_reference` values on documents live in the database (`sop_documents.sqf_reference`),
   not in code. Any reference whose number no longer exists in the new edition will render as plain
   text (graceful, but no hover/link). Review and re-map those in the SOP detail drawer's **SQF
   Reference** field. To find them quickly, compare the document references against the keys in the
   regenerated `SQF_CLAUSES`.

7. **Commit** the three changed artifacts together:
   - `public/sqf-quality-code.pdf`
   - `src/lib/sqfClauses.ts`
   - (any edits to `scripts/generate-sqf-clauses.py`)

## Notes & gotchas

- **Licensing:** the SQF Quality Code is copyrighted by SQFI and is served to any authenticated
  app user from `public/`. Only host an edition the site is licensed to use.
- **Do not hand-edit** `src/lib/sqfClauses.ts` — it is overwritten on every regeneration. Fix the
  generator instead if parsing needs adjustment.
- **Unmapped references are safe:** `SqfReference.tsx` renders any clause id it can't find as plain
  text, so a partial or mismatched map never breaks the page.
- **`#page=` support:** the deep link relies on the browser's built-in PDF viewer honoring
  `#page=N`. This works in Chrome/Edge/Firefox. If a user's browser is configured to download PDFs
  instead of viewing them, the file still downloads correctly — it just won't auto-jump.
- **Parser internals** (for when extraction looks wrong): the generator treats a clause id as a new
  clause boundary unless it's an inline cross-reference (preceded by words like "refer to", "in",
  "see", "element" — the `STOP` set) and it stitches page-spanning bodies together. It also repairs
  the common `"R ecords" → "Records"` extraction artifact. Adjust `NOISE`, `STOP`, or the cleanup in
  `clean()` if a new edition extracts differently.
- **Part B gating (`require_marker="PART B"`):** both generators parse **only** pages whose text
  contains the `PART B` running header, skipping Part A (implementation guidance). This is essential
  — Part A prose re-uses clause numbers in lists (e.g. "elements 2.1.1, 2.1.2, 2.1.3, etc.") which
  would otherwise be captured as spurious low-page clause entries. If a new edition changes that
  header string, update the `require_marker` argument in each generator's `main()` (and re-verify
  that no legitimate Part B page is skipped — clause pages should stay contiguous).
