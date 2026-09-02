# -*- coding: utf-8 -*-
"""Render the readable `sop-drafts/` mirror of an FSQM document from its content JSON.

WHY THIS SCRIPT EXISTS. `sop-drafts/FSQM-012-gmp-program.md` was written by hand alongside
its migration and then fell three migrations behind the live row: it had no FSQM-013
reference and still carried the Part 10 training wording that 20260901000017 corrected.
That is the same draft-vs-live drift that left FRM-903's printed blank two revisions behind
the app, and hand-maintaining a second copy of a controlled document guarantees it recurs.

So the mirror is GENERATED from the same JSON the migration writes. It carries no prose of
its own: the narrative about why a document exists and what it deliberately does not do
lives in the document's own Revision History, which is the authoritative place for it and
is rendered here like any other section.

Sections and their order come from SECTION_LABELS in src/lib/sopDocxParser.ts - the same
order the drawer's Document tab and generateSopPdf() use. Adding a key there means adding
one line here.

Usage:  python scripts/generate-fsqm-draft.py           # regenerate every registered mirror
"""
import io, json, os, sys

sys.stdout.reconfigure(encoding="utf-8", errors="replace")

# Mirrors SECTION_LABELS in src/lib/sopDocxParser.ts (key -> display), in display order.
SECTIONS = [
    ("purpose",             "Purpose"),
    ("scope",               "Scope"),
    ("definitions",         "Definitions"),
    ("responsibility",      "Responsibility"),
    ("procedure",           "Procedure"),
    ("form_references",     "Form References"),
    ("records",             "Records"),
    ("governing_reference", "Governing Reference"),
    ("revision_history",    "Revision History"),
]

BULLET = "•"
MD_SPECIALS = "|"


def render_procedure(lines):
    """A plain line is a numbered step; a line starting with the bullet marker is a
    sub-bullet of the step above it. Same rule as groupProcedureSteps() in
    sopDocxParser.ts, which is what the app and the PDF both route through."""
    out, n = [], 0
    for raw in lines:
        if raw.startswith(BULLET):
            body = raw[len(BULLET):].lstrip()
            out.append("  - " + body)
        else:
            n += 1
            out.append("")
            out.append("**%d. %s**" % (n, raw))
            out.append("")
    return "\n".join(out).strip("\n") + "\n"


def render(meta, content):
    b = []
    b.append("# %s %s %s\n" % (meta["number"], "—", meta["title"]))
    b.append((
        "**Not the controlled copy.** The controlled copy is the `{no}` row in `sop_documents`;\n"
        "this file is the readable version of it. **It is generated** from the same JSON the\n"
        "migration writes, by `scripts/generate-fsqm-draft.py`, so the two cannot drift. Edit the\n"
        "body through a migration and re-run the script; never edit this file directly.\n"
    ).format(no=meta["number"]))
    b.append("| | |\n|---|---|")
    rows = [
        ("Number", "`%s`" % meta["number"]),
        ("Type", "`%s`" % meta["type"]),
        ("Category", meta["category"]),
        ("Status", meta["status"]),
        ("Revision", meta["revision"]),
        ("Effective", meta.get("effective") or "*(draft)*"),
        ("SQF reference", "`%s`" % meta["sqf"]),
    ]
    for k, v in meta.get("extra", []):
        rows.append((k, v))
    for k, v in rows:
        b.append("| %s | %s |" % (k, v))
    b.append("\n---\n")

    for key, display in SECTIONS:
        val = content.get(key)
        if not val:
            continue
        b.append("## %s\n" % display)
        if key == "procedure":
            b.append(render_procedure(val))
        else:
            b.append(val.strip() + "\n")
    return "\n".join(b).rstrip() + "\n"


# ------------------------------------------------------------------ registry
# Metadata mirrors the live sop_documents row. When a migration changes a row's
# revision, status or effective date, update it here and re-run.
DOCS = [
    {
        "json": "sop-drafts/FSQM-009-capa-program.json",
        "md":   "sop-drafts/FSQM-009-capa-program.md",
        "meta": {
            "number": "FSQM-009",
            "title": "Corrective and Preventive Action (CAPA) Program",
            "type": "fsqm (Food Safety Quality Manual)",
            "category": "Food Safety Quality Manual",
            "status": "draft",
            "revision": "New",
            "effective": None,
            "sqf": "2.1.3.3, 2.5.3.1, 2.5.3.2, 2.5.4.4, 2.6.3.3",
            "extra": [
                ("Record", "**FRM-007** Corrective & Preventive Action (CAPA) Report"),
                ("Register", "**REP-007** CAPA Log"),
                ("Seeded by", "`20260902000001_fsqm009_capa_program.sql`"),
            ],
        },
    },
    {
        "json": "sop-drafts/FSQM-012-gmp-program.json",
        "md":   "sop-drafts/FSQM-012-gmp-program.md",
        "meta": {
            "number": "FSQM-012",
            "title": "Good Manufacturing Practices Program",
            "type": "fsqm (Food Safety Quality Manual)",
            "category": "Food Safety Quality Manual",
            "status": "active",
            "revision": "v2",
            "effective": "2026-09-01",
            "sqf": "2.4.2.1, 2.4.2.2, 2.5.4.3, 11.3.1, 11.3.2, 11.3.3, 11.3.4, 11.3.5, 11.4.1",
            "extra": [
                ("Supersedes", "**SOP-11.3** Personnel Hygiene & Visitor Policy "
                               "(archived 2026-09-01)"),
                ("Exemption analysis", "**FSQM-013** Module 11 Applicability & Exemption Analysis"),
            ],
        },
    },
]


def main():
    for d in DOCS:
        if not os.path.exists(d["json"]):
            print("skip %s (no content JSON)" % d["meta"]["number"])
            continue
        content = json.load(io.open(d["json"], encoding="utf-8"))
        md = render(d["meta"], content)
        io.open(d["md"], "w", encoding="utf-8", newline="\n").write(md)
        parts = [l for l in content.get("procedure", []) if not l.startswith(BULLET)]
        print("wrote %-38s %6d bytes  %d Parts" % (d["md"], len(md.encode("utf-8")), len(parts)))


if __name__ == "__main__":
    main()
