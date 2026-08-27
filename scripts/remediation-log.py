"""Record what a completed SQF remediation task actually changed, in the tracking workbook.

    python scripts/remediation-log.py --task 30.7 \
        --summary "Section 3 renamed ... FRM-903 is Rev v2." \
        --docs "FRM-903 (Rev v2)" [--status Completed]

Adds two columns to the workbook's "Task Detail" sheet the first time it runs:

    M  Change summary (as built)   - what was actually built, capped at 100 words
    N  Documents affected          - the FRM / SOP / FSQM numbers the task touched

Why this edits the workbook in place instead of regenerating it: the workbook is a living
document the owner edits (statuses, notes), and it has been round-tripped through
LibreOffice. Rebuilding from the generator would discard those edits. So this rewrites only
the one sheet part inside the .xlsx zip and copies every other part through byte-for-byte -
drawings, printer settings, header/footer images and all.

The 100-word cap is enforced, not advisory: the column exists so a reader can see at a
glance what changed, and a wall of text defeats that.
"""
import argparse, datetime, os, re, shutil, sys, zipfile

if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")

DEFAULT_WB = r"C:\AdventureBakes\RumCakeFactory_SQF_Gap Assessment_Ed 9 - Remediation Plan.xlsx"
SHEET = "xl/worksheets/sheet4.xml"          # Task Detail
WORD_CAP = 100
SUMMARY_COL, DOCS_COL, STATUS_COL = "M", "N", "L"
SUMMARY_HEAD = "Change summary (as built)"
DOCS_HEAD = "Documents affected"
HEADER_ROW = 4
SUMMARY_WIDTH, DOCS_WIDTH = 70, 30         # characters, matching the sheet's other wide columns


def esc(s):
    return (s.replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;")
             .replace('"', "&quot;"))


def words(s):
    return len([w for w in re.split(r"\s+", s.strip()) if w])


def cell_style(sheet, row, col):
    """The style id used by `col` on `row` - so a new cell inherits that row's formatting
    (including a status highlight the owner applied to the whole row)."""
    m = re.search(r'<row r="%d"[^>]*>(.*?)</row>' % row, sheet, re.S)
    if not m:
        return None
    c = re.search(r'<c r="%s%d"(?: s="(\d+)")?' % (col, row), m.group(1))
    return c.group(1) if c else None


def ensure_columns(sheet):
    """Add the two headers, the <col> widths, widen the merged banner rows and the sheet
    dimension. Idempotent - re-running finds the headers already there and does nothing."""
    if SUMMARY_HEAD in sheet:
        return sheet, False

    # 1. <col> entries. The sheet uses LibreOffice's verbose form; match it so the file
    #    stays consistent for whatever opens it next.
    tmpl = ('<col collapsed="false" customWidth="true" hidden="false" outlineLevel="0" '
            'max="%d" min="%d" style="0" width="%d"/>')
    cols = tmpl % (13, 13, SUMMARY_WIDTH) + tmpl % (14, 14, DOCS_WIDTH)
    sheet = sheet.replace("</cols>", cols + "</cols>", 1)

    # 2. Header cells, styled like the header row's existing cells.
    hs = cell_style(sheet, HEADER_ROW, "L") or cell_style(sheet, HEADER_ROW, "K")
    sheet = put_cells(sheet, HEADER_ROW, [(SUMMARY_COL, SUMMARY_HEAD), (DOCS_COL, DOCS_HEAD)],
                      style=hs, grow_height=False)

    # 3. Banner/group rows span the whole table; extend them over the new columns so the
    #    section headings still read across it.
    sheet = re.sub(r'(<mergeCell ref="A(\d+):)L(\2"/>)', r"\1N\3", sheet)

    # 4. Sheet dimension.
    sheet = re.sub(r'(<dimension ref="A1:)L(\d+"/>)', r"\1N\2", sheet)
    return sheet, True


def put_cells(sheet, row, pairs, style=None, grow_height=True):
    """Write inline-string cells into `row`, replacing any that are already there.

    Cells must stay in column order inside <row>, and M/N are the last columns, so
    appending at the end of the row is correct.
    """
    m = re.search(r'(<row r="%d"[^>]*>)(.*?)(</row>)' % row, sheet, re.S)
    if not m:
        raise SystemExit("row %d not found in %s" % (row, SHEET))
    open_tag, inner, close_tag = m.groups()

    for col, value in pairs:
        s = style if style is not None else cell_style(sheet, row, "K")
        attr = ' s="%s"' % s if s else ""
        cell = ('<c r="%s%d"%s t="inlineStr"><is><t xml:space="preserve">%s</t></is></c>'
                % (col, row, attr, esc(value)))
        inner = re.sub(r'<c r="%s%d".*?(?:/>|</c>)' % (col, row), "", inner, flags=re.S)
        inner += cell

    if grow_height:
        # Only ever grow. A cell whose text is taller than the row is silently clipped on
        # print, which is the failure mode this column cannot afford.
        need = 0
        for col, value in pairs:
            width = SUMMARY_WIDTH if col == SUMMARY_COL else DOCS_WIDTH
            lines = sum(max(1, -(-len(seg) // (width - 2))) for seg in value.split("\n"))
            need = max(need, lines * 13.5 + 6)
        # Bare ht=, never the tail of customHeight= - the lookbehind matters, a plain
        # ht="..." pattern rewrites customHeight="1" into a duplicate attribute and the
        # file stops parsing.
        cur = re.search(r'(?<![A-Za-z])ht="([\d.]+)"', open_tag)
        if cur and need > float(cur.group(1)):
            open_tag = re.sub(r'(?<![A-Za-z])ht="[\d.]+"', 'ht="%g"' % need, open_tag, count=1)

    return sheet[:m.start()] + open_tag + inner + close_tag + sheet[m.end():]


def shared_strings(parts):
    """The workbook's string table. Column B holds task numbers as shared strings (t="s"),
    not inline text, so a lookup that only reads <t> finds nothing."""
    xml = parts.get("xl/sharedStrings.xml", b"").decode("utf-8")
    return [re.sub(r"<[^>]+>", "", si) for si in re.findall(r"<si>(.*?)</si>", xml, re.S)]


TASK_COLS = ["A", "B", "C", "D", "E", "F", "G", "H", "I", "J", "K", "L"]
INTERNAL_BANNER = ("Internally identified — gaps found during the work, not raised in the "
                   "consultant's gap assessment")


def last_row(sheet):
    return max(int(m) for m in re.findall(r'<row r="(\d+)"', sheet))


def append_row(sheet, values, style, height, merged=False):
    """Append a new row at the bottom of the sheet.

    Appending rather than inserting is deliberate. Inserting mid-sheet means renumbering every
    <row> and every <c r=..> below the insertion point AND rewriting every mergeCell that spans
    them - a lot of moving parts for no benefit, since these rows are new work that did not come
    from the consultant's list and reads better in its own section anyway.
    """
    n = last_row(sheet) + 1
    cells = "".join(
        '<c r="%s%d"%s t="inlineStr"><is><t xml:space="preserve">%s</t></is></c>'
        % (col, n, ' s="%s"' % style if style else "", esc(val))
        for col, val in values if val != "")
    row = ('<row r="%d" customFormat="false" ht="%g" hidden="false" customHeight="true" '
           'outlineLevel="0" collapsed="false">%s</row>' % (n, height, cells))
    sheet = sheet.replace("</sheetData>", row + "</sheetData>", 1)

    if merged:
        last_col = values[-1][0]
        sheet = sheet.replace("</mergeCells>", '<mergeCell ref="A%d:%s%d"/></mergeCells>'
                              % (n, last_col, n), 1)
        sheet = re.sub(r'(<mergeCells count=")(\d+)(")',
                       lambda m: m.group(1) + str(int(m.group(2)) + 1) + m.group(3), sheet, count=1)

    sheet = re.sub(r'(<dimension ref="A1:[A-Z]+)\d+("/>)', r"\g<1>%d\g<2>" % n, sheet)
    return sheet, n


def ensure_internal_group(sheet, strings):
    """The banner row that marks these as internally found. Added once."""
    for rm in re.finditer(r'<row r="(\d+)"[^>]*>(.*?)</row>', sheet, re.S):
        if INTERNAL_BANNER[:40] in rm.group(2):
            return sheet, False
    # style of an existing group banner, taken from a row the header row is not
    style = cell_style(sheet, HEADER_ROW, "A")
    for rm in re.finditer(r'<row r="(\d+)"[^>]*>', sheet):
        n = int(rm.group(1))
        s = cell_style(sheet, n, "A")
        if s and n > HEADER_ROW and re.search(r'<mergeCell ref="A%d:[A-Z]+%d"/>' % (n, n), sheet):
            style = s
            break
    sheet, _ = append_row(sheet, [(c, "") for c in TASK_COLS[:-1]]
                          + [(DOCS_COL, INTERNAL_BANNER)], style, 30, merged=False)
    # rewrite that row so the banner text sits in A and the row is merged across
    n = last_row(sheet)
    sheet = re.sub(r'<row r="%d".*?</row>' % n,
                   '<row r="%d" customFormat="false" ht="30" hidden="false" customHeight="true" '
                   'outlineLevel="0" collapsed="false">'
                   '<c r="A%d"%s t="inlineStr"><is><t xml:space="preserve">%s</t></is></c></row>'
                   % (n, n, ' s="%s"' % style if style else "", esc(INTERNAL_BANNER)), sheet,
                   flags=re.S)
    sheet = sheet.replace("</mergeCells>", '<mergeCell ref="A%d:%s%d"/></mergeCells>'
                          % (n, DOCS_COL, n), 1)
    sheet = re.sub(r'(<mergeCells count=")(\d+)(")',
                   lambda m: m.group(1) + str(int(m.group(2)) + 1) + m.group(3), sheet, count=1)
    return sheet, True


def find_task_row(sheet, task, strings):
    """Locate the row whose column B holds the task number (e.g. 30.7)."""
    for rm in re.finditer(r'<row r="(\d+)"[^>]*>(.*?)</row>', sheet, re.S):
        n, inner = int(rm.group(1)), rm.group(2)
        c = re.search(r'<c r="B%d"([^>]*)>(.*?)</c>' % n, inner, re.S)
        if not c:
            continue
        attrs, body = c.groups()
        if 't="s"' in attrs:
            v = re.search(r"<v>(\d+)</v>", body)
            text = strings[int(v.group(1))] if v and int(v.group(1)) < len(strings) else ""
        else:
            t = re.search(r"<t[^>]*>(.*?)</t>", body, re.S)
            text = t.group(1) if t else ""
        if text.strip() == task:
            return n
    return None


def main():
    ap = argparse.ArgumentParser(description=__doc__,
                                 formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--workbook", default=DEFAULT_WB)
    ap.add_argument("--task", required=True, help="task number as it appears in column B, e.g. 30.7")
    ap.add_argument("--summary", required=True, help="what was actually built (max %d words)" % WORD_CAP)
    ap.add_argument("--docs", required=True, help="documents affected, e.g. 'FRM-903 (Rev v2)'")
    ap.add_argument("--status", help="also set the Status column, e.g. Completed")
    ap.add_argument("--no-backup", action="store_true")
    # --- new-task mode: append a task the consultant's list never had ---
    ap.add_argument("--new-task", action="store_true",
                    help="append a NEW task row instead of updating an existing one. Lands under "
                         "an 'Internally identified' banner at the bottom of the sheet, so a task "
                         "found during the work is never mistaken for one the assessment raised.")
    ap.add_argument("--name", help="new-task: the task name (column C)")
    ap.add_argument("--artifact", help="new-task: what it produces (column D)")
    ap.add_argument("--clauses", help="new-task: clauses served (column E)")
    ap.add_argument("--days", help="new-task: estimate (column F)")
    ap.add_argument("--owner", help="new-task: owner (column G)")
    ap.add_argument("--depends", default="", help="new-task: depends on (column H)")
    ap.add_argument("--app-fit", dest="app_fit", default="",
                    help="new-task: App today / Needs build / Off-app (column I)")
    ap.add_argument("--capability", default="", help="new-task: capability or feature (column J)")
    ap.add_argument("--notes", default="", help="new-task: notes and risk (column K)")
    a = ap.parse_args()

    if a.new_task:
        missing = [f for f in ("name", "artifact", "clauses", "days", "owner")
                   if not getattr(a, f)]
        if missing:
            raise SystemExit("--new-task also needs: %s" % ", ".join("--" + m for m in missing))

    n = words(a.summary)
    if n > WORD_CAP:
        raise SystemExit("summary is %d words; the cap is %d. Trim it - the column is meant to be "
                         "readable at a glance." % (n, WORD_CAP))

    lock = os.path.join(os.path.dirname(a.workbook), ".~lock." + os.path.basename(a.workbook) + "#")
    if os.path.exists(lock):
        raise SystemExit("the workbook is open in Excel/LibreOffice - close it first, or its next "
                         "save will overwrite these edits.")

    zin = zipfile.ZipFile(a.workbook)
    parts = {i.filename: zin.read(i.filename) for i in zin.infolist()}
    infos = zin.infolist()
    zin.close()

    sheet = parts[SHEET].decode("utf-8")
    sheet, added = ensure_columns(sheet)

    strings = shared_strings(parts)
    row = find_task_row(sheet, a.task, strings)

    if a.new_task:
        if row is not None:
            raise SystemExit("task %r already exists at row %d - drop --new-task to update it."
                             % (a.task, row))
        sheet, banner_added = ensure_internal_group(sheet, strings)
        body_style = cell_style(sheet, HEADER_ROW + 3, "K") or cell_style(sheet, HEADER_ROW + 3, "A")
        vals = [("A", ""), ("B", a.task), ("C", a.name), ("D", a.artifact), ("E", a.clauses),
                ("F", a.days), ("G", a.owner), ("H", a.depends), ("I", a.app_fit),
                ("J", a.capability), ("K", a.notes), ("L", a.status or "Not started")]
        # tall enough for the widest wrapped cell among the pre-M columns
        h = max(30, max((-(-len(v) // 44) for _, v in vals if v), default=1) * 13.5 + 6)
        sheet, row = append_row(sheet, vals, body_style, h)
        if banner_added:
            print("added the 'Internally identified' section")
    elif row is None:
        raise SystemExit("task %r not found in column B of the Task Detail sheet. Use --new-task "
                         "to append it." % a.task)

    pairs = [(SUMMARY_COL, a.summary), (DOCS_COL, a.docs)]
    if a.status:
        pairs.append((STATUS_COL, a.status))
    sheet = put_cells(sheet, row, pairs)
    parts[SHEET] = sheet.encode("utf-8")

    if not a.no_backup:
        bak = "%s.%s.bak" % (a.workbook, datetime.datetime.now().strftime("%Y%m%d-%H%M%S"))
        shutil.copy2(a.workbook, bak)
        print("backup: %s" % bak)

    tmp = a.workbook + ".tmp"
    with zipfile.ZipFile(tmp, "w", zipfile.ZIP_DEFLATED) as zout:
        for i in infos:                       # original order, every part carried through
            zout.writestr(i, parts[i.filename])
    os.replace(tmp, a.workbook)

    if added:
        print("added columns %s (%s) and %s (%s)" % (SUMMARY_COL, SUMMARY_HEAD, DOCS_COL, DOCS_HEAD))
    print("task %s -> row %d  (%d words%s)"
          % (a.task, row, n, ", status=" + a.status if a.status else ""))


if __name__ == "__main__":
    main()
