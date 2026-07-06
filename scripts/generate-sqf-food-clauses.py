#!/usr/bin/env python3
"""Generate src/lib/sqfFoodClauses.ts from the SQF Food Safety Code: Food Manufacturing PDF.

Parses public/sqf-food-manufacturing-code.pdf (Edition 9, Module 11 GMPs +
System Elements) into a clause map { clauseId -> { text, page } } used by the
SQF reference hover-cards in the SOPs Library for Module 11 (11.x) references.

This reuses the parser from generate-sqf-clauses.py with a Food-Manufacturing-
specific NOISE filter and emits a parallel module (SQF_FOOD_* exports) so the
two code PDFs stay independent. See UPDATING_SQF_CODE.md for the full runbook.

Usage:
    python scripts/generate-sqf-food-clauses.py [path-to.pdf]

Requirements: Python 3 and poppler's `pdftotext` on PATH.

After running, ALWAYS spot-check a handful of clauses (e.g. 11.2.5.7, 11.3.4.1,
11.7.3.5) against the printed PDF pages, because extraction varies by edition.
"""
import os
import sys
import json
import importlib.util

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DEFAULT_PDF = os.path.join(ROOT, "public", "sqf-food-manufacturing-code.pdf")
OUT_TS = os.path.join(ROOT, "src", "lib", "sqfFoodClauses.ts")

# Load the parser from the (hyphenated) base generator.
_spec = importlib.util.spec_from_file_location(
    "gen_sqf", os.path.join(ROOT, "scripts", "generate-sqf-clauses.py")
)
gen = importlib.util.module_from_spec(_spec)
_spec.loader.exec_module(gen)

# Footer/header boilerplate for the Food Manufacturing code. Use the FULL footer
# strings (not bare "Edition 9" / "Food Manufacturing") so legitimate clause text
# such as "...in a food manufacturing environment" (11.2.5.2) is not stripped.
NOISE = (
    "SQF Food Safety Code: Food Manufacturing, Edition 9",
    "PART B: The SQF Food Safety Code: Food Manufacturing",
)

HEADER = '''// AUTO-GENERATED from "SQF Food Safety Code: Food Manufacturing" (public/sqf-food-manufacturing-code.pdf).
// Maps each clause number to its text and the PDF page it appears on (Module 11 GMPs + System Elements).
// Regenerate with: python scripts/generate-sqf-food-clauses.py  (see UPDATING_SQF_CODE.md)
// Do not hand-edit.

import type { SqfClause } from "./sqfClauses";

export const SQF_FOOD_PDF_URL = "/sqf-food-manufacturing-code.pdf";

/** Build an href that opens the Food Manufacturing code PDF at the given page in the browser viewer. */
export function sqfFoodPdfHref(page: number): string {
  return SQF_FOOD_PDF_URL + "#page=" + page;
}

export const SQF_FOOD_CLAUSES: Record<string, SqfClause> = '''

FOOTER = '''

/** Look up a Food Manufacturing clause by number (whitespace-tolerant). Returns undefined if not found. */
export function lookupSqfFoodClause(id: string): SqfClause | undefined {
  return SQF_FOOD_CLAUSES[id.trim()];
}
'''


def main():
    pdf = sys.argv[1] if len(sys.argv) > 1 else DEFAULT_PDF
    if not os.path.exists(pdf):
        sys.exit(f"PDF not found: {pdf}")
    data = gen.parse(gen.extract_text(pdf), noise=NOISE, require_marker="PART B")
    body = json.dumps(data, ensure_ascii=False, indent=2, sort_keys=True)
    with open(OUT_TS, "w", encoding="utf-8") as f:
        f.write(HEADER + body + ";" + FOOTER)
    print(f"Wrote {OUT_TS} with {len(data)} clauses (from {pdf}).")
    print("Spot-check 11.2.5.7, 11.3.4.1, 11.7.3.5 per UPDATING_SQF_CODE.md before committing.")


if __name__ == "__main__":
    main()
