#!/usr/bin/env python3
"""Generate src/lib/sqfClauses.ts from the SQF Quality Code PDF.

Parses public/sqf-quality-code.pdf (the licensed SQF Quality Code) into a clause
map { clauseId -> { text, page } } used by the SQF reference hover-cards in the
SOPs Library. See UPDATING_SQF_CODE.md for the full runbook.

Usage:
    python scripts/generate-sqf-clauses.py [path-to.pdf]

If no path is given, defaults to public/sqf-quality-code.pdf.

Requirements:
    - Python 3
    - poppler's `pdftotext` on PATH (https://poppler.freedesktop.org/)

After running, ALWAYS spot-check a handful of clauses in the generated file
(see the runbook) because PDF text extraction varies between editions.
"""
import os
import re
import sys
import json
import subprocess

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DEFAULT_PDF = os.path.join(ROOT, "public", "sqf-quality-code.pdf")
OUT_TS = os.path.join(ROOT, "src", "lib", "sqfClauses.ts")

# Lines containing any of these are page headers/footers/boilerplate, not clause body.
NOISE = (
    "SQF Quality Code",
    "PART B",
    "TRADE SECRET",
    "Confidential",
    "Freedom of Information",
    "Edition 9",  # update this string if a new edition changes the footer text
)
# A clause id is a new clause boundary UNLESS the preceding word is one of these
# (i.e. it's an inline cross-reference such as "refer to 2.3.2.1" / "described in 2.5").
STOP = {"to", "in", "see", "refer", "clause", "clauses", "and", "or", "per",
        "with", "section", "under", "of", "the", "at", "as", "element", "elements"}

CID_RE = re.compile(r"\d+\.\d+(?:\.\d+){1,3}")


def extract_text(pdf_path):
    # Plain (non -layout) output keeps clean form-feed page breaks so physical
    # page index == printed page number for this document.
    out = subprocess.run(
        ["pdftotext", pdf_path, "-"],
        capture_output=True, check=True,
    )
    return out.stdout.decode("utf-8", "replace")


def parse(text, noise=NOISE, require_marker=None):
    # `require_marker`: when set, only pages whose raw text contains this string are
    # parsed. Use it to restrict parsing to Part B (the auditable standard, whose pages
    # carry a "PART B" running header) and skip Part A implementation guidance, which
    # re-uses clause numbers in prose (e.g. "elements 2.1.1, 2.1.2, 2.1.3, etc.") and
    # would otherwise produce spurious clause entries.
    pages = text.split("\f")
    clauses = {}   # id -> [page, body_str]
    order = []
    cur = {"id": None}

    def add(cid, page, body):
        cur["id"] = cid
        if cid in clauses:
            clauses[cid][1] += " " + body
        else:
            clauses[cid] = [page, body]
            order.append(cid)

    for pidx, ptext in enumerate(pages, 1):
        if require_marker and require_marker not in ptext:
            continue
        lines = [s.strip() for s in ptext.split("\n")]
        lines = [s for s in lines if s and not any(n in s for n in noise)]
        joined = re.sub(r"\s+", " ", " ".join(lines)).strip()
        if not joined:
            continue

        bounds = []
        for m in CID_RE.finditer(joined):
            cid = m.group(0)
            if len(cid.split(".")) < 3:   # only 3- and 4-segment clause ids
                continue
            st = m.start()
            prev = joined[:st].rstrip()
            pw = re.findall(r"(\w+)\W*$", prev)
            pw = pw[0].lower() if pw else ""
            if st != 0 and (pw in STOP or prev[-1:] == "("):
                continue  # inline cross-reference, not a real boundary
            bounds.append((st, m.end(), cid))

        if not bounds:
            if cur["id"]:
                clauses[cur["id"]][1] += " " + joined
            continue

        # Text before the first boundary continues the previous clause (page-spanning body).
        if cur["id"] and bounds[0][0] > 0:
            clauses[cur["id"]][1] += " " + joined[: bounds[0][0]].strip()

        for i, (s, e, cid) in enumerate(bounds):
            end = bounds[i + 1][0] if i + 1 < len(bounds) else len(joined)
            add(cid, pidx, joined[e:end].strip())

    def clean(t):
        t = re.sub(r"\s+", " ", t).strip()
        t = re.sub(r"\bR ecords\b", "Records", t)   # common extraction artifact
        return t

    out = {}
    for cid in order:
        txt = clean(clauses[cid][1])
        if txt:
            out[cid] = {"page": clauses[cid][0], "text": txt}
    return out


HEADER = '''// AUTO-GENERATED from "SQF Quality Code" (public/sqf-quality-code.pdf).
// Maps each clause number to its text and the PDF page it appears on.
// Regenerate with: python scripts/generate-sqf-clauses.py  (see UPDATING_SQF_CODE.md)
// Do not hand-edit.

export interface SqfClause {
  /** Clause body text as printed in the SQF Quality Code. */
  text: string;
  /** Physical (and printed) page number in public/sqf-quality-code.pdf. */
  page: number;
}

export const SQF_PDF_URL = "/sqf-quality-code.pdf";

/** Build an href that opens the SQF Code PDF at the given page in the browser viewer. */
export function sqfPdfHref(page: number): string {
  return SQF_PDF_URL + "#page=" + page;
}

export const SQF_CLAUSES: Record<string, SqfClause> = '''

FOOTER = '''

/** Look up a clause by number (whitespace-tolerant). Returns undefined if not found. */
export function lookupSqfClause(id: string): SqfClause | undefined {
  return SQF_CLAUSES[id.trim()];
}
'''


def main():
    pdf = sys.argv[1] if len(sys.argv) > 1 else DEFAULT_PDF
    if not os.path.exists(pdf):
        sys.exit(f"PDF not found: {pdf}")
    data = parse(extract_text(pdf), require_marker="PART B")
    body = json.dumps(data, ensure_ascii=False, indent=2, sort_keys=True)
    with open(OUT_TS, "w", encoding="utf-8") as f:
        f.write(HEADER + body + ";" + FOOTER)
    print(f"Wrote {OUT_TS} with {len(data)} clauses (from {pdf}).")
    print("Spot-check the output per UPDATING_SQF_CODE.md before committing.")


if __name__ == "__main__":
    main()
