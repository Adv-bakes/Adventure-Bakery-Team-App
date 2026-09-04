# -*- coding: utf-8 -*-
"""Set a deliverable's Status (and Document(s)) on the workbook's Remediation Plan tab.

    python scripts/remediation-plan-status.py --deliverable D-27 --status Completed \
        --docs "FSQM-018 (issued 2026-09-02)"

WHY THIS EXISTS SEPARATELY FROM remediation-log.py. That script records what a completed TASK
built, on the Task Detail sheet. The Remediation Plan sheet is the other half - one row per
deliverable, and the view anyone opens first. Nothing wrote to it, so on 2026-09-04 all 36
deliverables still read "Not started" while D-07 had been built, issued and logged in full on
Task Detail. A summary tab that disagrees with the detail tab is worse than one that is merely
out of date: it makes the reader trust neither.

Column K is the last column on that sheet, so a rewritten Status cell can be appended at the
end of the row without breaking the column ordering Excel requires inside <row>. Column D is
mid-row and is therefore replaced IN PLACE, never removed-and-appended.

Rows whose status reads Completed get the workbook's green fill, reusing the same additive
logic remediation-log.py applies to Task Detail - a row is never un-greened, because green does
not mean exactly "Completed" in this file and a script should not erase a mark a human made.

Everything else in the .xlsx is copied through byte-for-byte, for the reason the sibling script
gives: the workbook is a living document the owner edits and has been round-tripped through
LibreOffice.
"""
import argparse, importlib.util, os, re, shutil, sys, zipfile

if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")

HERE = os.path.dirname(os.path.abspath(__file__))
_spec = importlib.util.spec_from_file_location("remediation_log",
                                               os.path.join(HERE, "remediation-log.py"))
RL = importlib.util.module_from_spec(_spec)
_spec.loader.exec_module(RL)

SHEET = "xl/worksheets/sheet3.xml"       # Remediation Plan
ID_COL, DOCS_COL, STATUS_COL = "A", "D", "K"
HEADER_ROW = 4


def find_deliverable_row(sheet, ident, strings):
    for m in re.finditer(r'<row r="(\d+)"[^>]*>(.*?)</row>', sheet, re.S):
        n, inner = int(m.group(1)), m.group(2)
        if n > HEADER_ROW and RL.cell_text(inner, ID_COL, n, strings).strip() == ident:
            return n
    return None


def replace_in_place(sheet, row, col, value):
    """Rewrite one cell without moving it. Used for column D, which is mid-row."""
    m = re.search(r'(<row r="%d"[^>]*>)(.*?)(</row>)' % row, sheet, re.S)
    open_tag, inner, close_tag = m.groups()
    cm = re.search(r'<c r="%s%d"([^>]*)>.*?</c>|<c r="%s%d"([^>]*)/>' % (col, row, col, row),
                   inner, re.S)
    if not cm:
        raise SystemExit("no %s%d cell to replace" % (col, row))
    attrs = cm.group(1) or cm.group(2) or ""
    s = re.search(r's="(\d+)"', attrs)
    cell = ('<c r="%s%d"%s t="inlineStr"><is><t xml:space="preserve">%s</t></is></c>'
            % (col, row, ' s="%s"' % s.group(1) if s else "", RL.esc(value)))
    return sheet[:m.start()] + open_tag + inner.replace(cm.group(0), cell, 1) + close_tag \
           + sheet[m.end():]


def main():
    ap = argparse.ArgumentParser(description=__doc__,
                                 formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--workbook", default=RL.DEFAULT_WB)
    ap.add_argument("--deliverable", required=True, help="id in column A, e.g. D-27")
    ap.add_argument("--status", required=True, help="Completed / WIP / Not started")
    ap.add_argument("--docs", help="rewrite column D, e.g. 'FSQM-020 + FRM-701 (issued …)'")
    ap.add_argument("--no-backup", action="store_true")
    a = ap.parse_args()

    zin = zipfile.ZipFile(a.workbook)
    parts = {i.filename: zin.read(i.filename) for i in zin.infolist()}
    infos = zin.infolist()
    zin.close()

    sheet = parts[SHEET].decode("utf-8")
    strings = RL.shared_strings(parts)
    row = find_deliverable_row(sheet, a.deliverable, strings)
    if row is None:
        raise SystemExit("no row for %r on the Remediation Plan sheet" % a.deliverable)

    was = RL.cell_text(re.search(r'<row r="%d"[^>]*>(.*?)</row>' % row, sheet, re.S).group(1),
                       STATUS_COL, row, strings).strip()
    sheet = RL.put_cells(sheet, row, [(STATUS_COL, a.status)],
                         style=RL.cell_style(sheet, row, STATUS_COL), grow_height=False)
    if a.docs:
        sheet = replace_in_place(sheet, row, DOCS_COL, a.docs)

    # Green the completed rows, with the sibling script's constants pointed at this sheet.
    RL.STATUS_COL, RL.HEADER_ROW = STATUS_COL, HEADER_ROW
    styles = parts["xl/styles.xml"].decode("utf-8")
    sheet, styles, greened, minted = RL.green_completed_rows(sheet, styles, strings)

    parts[SHEET] = sheet.encode("utf-8")
    parts["xl/styles.xml"] = styles.encode("utf-8")

    if not a.no_backup:
        bak = a.workbook + "." + __import__("datetime").datetime.now().strftime("%Y%m%d-%H%M%S") + ".bak"
        shutil.copy2(a.workbook, bak)
        print("backup: %s" % os.path.basename(bak))

    tmp = a.workbook + ".tmp"
    with zipfile.ZipFile(tmp, "w", zipfile.ZIP_DEFLATED) as zout:
        for i in infos:
            zout.writestr(i, parts[i.filename])
    os.replace(tmp, a.workbook)

    print("%s -> row %d  status %r -> %r%s"
          % (a.deliverable, row, was, a.status, "  (documents rewritten)" if a.docs else ""))
    if greened:
        print("  green fill on completed row%s %s%s"
              % ("" if len(greened) == 1 else "s", ", ".join(map(str, greened)),
                 "  (minted %d style%s)" % (minted, "" if minted == 1 else "s") if minted else ""))


if __name__ == "__main__":
    main()
