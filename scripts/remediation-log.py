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
import argparse, datetime, os, re, shutil, sys, xml.dom.minidom, zipfile

if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")

DEFAULT_WB = r"C:\AdventureBakes\RumCakeFactory_SQF_Gap Assessment_Ed 9 - Remediation Plan.xlsx"
SHEET = "xl/worksheets/sheet4.xml"          # Task Detail
WORD_CAP = 100
SUMMARY_COL, DOCS_COL, STATUS_COL, NOTES_COL = "M", "N", "L", "K"
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


def cell_text(inner, col, row_n, strings):
    """Resolved text of one cell, whether it is stored inline or as a shared string."""
    c = re.search(r'<c r="%s%d"([^>]*)>(.*?)</c>' % (col, row_n), inner, re.S)
    if not c:
        return ""
    attrs, body = c.groups()
    if 't="s"' in attrs:
        v = re.search(r"<v>(\d+)</v>", body)
        return strings[int(v.group(1))] if v and int(v.group(1)) < len(strings) else ""
    t = re.search(r"<t[^>]*>(.*?)</t>", body, re.S)
    return t.group(1) if t else ""


def sheet_has_text(sheet, needle, strings):
    """Is `needle` in any cell of this sheet?

    A literal `needle in sheet` will NOT do, and getting this wrong is silent: LibreOffice
    rewrites inline strings into the shared string table when it saves, so text this script
    wrote as <is><t>...</t></is> comes back as <v>417</v> and the substring vanishes from
    sheet4.xml. Both idempotency guards below used a raw substring search and both quietly
    returned "not present" after the workbook had been opened and saved once - which appended
    a second set of M/N <col> entries and a duplicate "Internally identified" banner
    (2026-08-27). Resolve the string table instead.
    """
    for rm in re.finditer(r'<row r="(\d+)"[^>]*>(.*?)</row>', sheet, re.S):
        n, inner = int(rm.group(1)), rm.group(2)
        for cm in re.finditer(r'<c r="([A-Z]+)%d"' % n, inner):
            if needle in cell_text(inner, cm.group(1), n, strings):
                return True
    return False


def ensure_columns(sheet, strings):
    """Add the two headers, the <col> widths, widen the merged banner rows and the sheet
    dimension. Idempotent - re-running finds the headers already there and does nothing."""
    if sheet_has_text(sheet, SUMMARY_HEAD, strings):
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


STYLES = "xl/styles.xml"
GREEN_RGB = "FF81D41A"   # the fill already on completed rows in this workbook, matched exactly


# A cellXfs entry is either self-closing or a container with <alignment>/<protection> children.
# The self-closing branch MUST come first and the container branch MUST end at a real </xf>:
# a single non-greedy `<xf .*?(?:/>|</xf>)` stops at the first `/>` it meets, which for a styled
# entry is the end of its <alignment/> CHILD. That returns a truncated element, and appending a
# truncated copy writes an <xf> with no closing tag - which is how this script corrupted the
# workbook on 2026-09-01 (styles.xml unparseable, count bumped to 71 with only 70 real entries,
# Excel offering to "repair" the file by stripping the formatting). Keep the two branches.
XF_RE = r"<xf\b[^>]*/>|<xf\b[^>]*>.*?</xf>"


def _cell_xfs(styles):
    m = re.search(r'(<cellXfs count=")(\d+)(">)(.*?)(</cellXfs>)', styles, re.S)
    if not m:
        raise SystemExit("no <cellXfs> in %s" % STYLES)
    xfs = re.findall(XF_RE, m.group(4), re.S)
    for e in xfs:                     # cheap invariant: every captured entry is balanced
        if not (e.endswith("/>") or e.endswith("</xf>")):
            raise SystemExit("parsed an unbalanced <xf> from %s - refusing to edit styles" % STYLES)
    return m, xfs


def green_fill_id(styles):
    """Index of the green solid fill, appended only if this workbook has none."""
    fills = re.findall(r"<fill>.*?</fill>", styles, re.S)
    for i, f in enumerate(fills):
        if GREEN_RGB in f:
            return styles, i
    add = ('<fill><patternFill patternType="solid"><fgColor rgb="%s"/>'
           '<bgColor rgb="FF70AD47"/></patternFill></fill>' % GREEN_RGB)
    m = re.search(r'(<fills count=")(\d+)(">)(.*?)(</fills>)', styles, re.S)
    styles = (styles[:m.start()] + m.group(1) + str(int(m.group(2)) + 1) + m.group(3)
              + m.group(4) + add + m.group(5) + styles[m.end():])
    return styles, len(fills)


def green_twin(styles, style_id, fill):
    """The cellXfs id that is `style_id` plus the green fill.

    A cell's style is font+fill+border+alignment together, so "make it green" means swapping in
    the sibling entry that differs only in fillId - not editing the style in place, which would
    repaint every other cell using it. This workbook already carries both twins it needs (67 is
    green 20, 68 is green 3); one is minted only when a base style has none, so repeat runs do
    not grow styles.xml.
    """
    m, xfs = _cell_xfs(styles)
    if style_id is None or style_id >= len(xfs):
        style_id = 0
    base = xfs[style_id]
    if re.search(r'fillId="%d"' % fill, base):
        return styles, style_id, False                      # already green
    want = re.sub(r'fillId="\d+"', 'fillId="%d"' % fill, base)
    want = (re.sub(r'applyFill="[^"]*"', 'applyFill="true"', want) if "applyFill=" in want
            else want.replace("<xf ", '<xf applyFill="true" ', 1))
    norm = lambda s: re.sub(r"\s+", " ", re.sub(r'applyFill="[^"]*"\s*', "", s)).strip()
    for i, e in enumerate(xfs):
        if norm(e) == norm(want):
            return styles, i, False
    styles = (styles[:m.start()] + m.group(1) + str(len(xfs) + 1) + m.group(3)
              + m.group(4) + want + m.group(5) + styles[m.end():])
    return styles, len(xfs), True


def green_completed_rows(sheet, styles, strings):
    """Fill every row whose Status reads Completed with the workbook's green.

    ADDITIVE ONLY - a row is never un-greened. Green does not mean exactly "Completed" in this
    file: row 97 is an N/A the owner greened by hand. Clearing fills to match the status column
    would silently destroy a distinction someone deliberately made, and a spreadsheet script
    should never be the thing that erases a human's mark.

    Rows are rewritten back-to-front so that each match's offsets stay valid as earlier ones are
    edited.
    """
    styles, fill = green_fill_id(styles)
    touched, minted = [], 0
    for rm in reversed(list(re.finditer(r'<row r="(\d+)"[^>]*>(.*?)</row>', sheet, re.S))):
        n, inner = int(rm.group(1)), rm.group(2)
        if n <= HEADER_ROW or cell_text(inner, STATUS_COL, n, strings).strip() != "Completed":
            continue
        new_inner, changed = inner, False
        for cm in re.finditer(r'<c r="([A-Z]+)%d"([^>]*)>' % n, inner):
            col, attrs = cm.groups()
            s = re.search(r's="(\d+)"', attrs)
            cur = int(s.group(1)) if s else None
            styles, twin, made = green_twin(styles, cur, fill)
            minted += made
            if twin != cur:
                old = cm.group(0)
                new = (re.sub(r's="\d+"', 's="%d"' % twin, old, count=1) if s
                       else old.replace('<c r="%s%d"' % (col, n),
                                        '<c r="%s%d" s="%d"' % (col, n, twin), 1))
                new_inner = new_inner.replace(old, new, 1)
                changed = True
        if changed:
            sheet = sheet[:rm.start()] + rm.group(0).replace(inner, new_inner, 1) + sheet[rm.end():]
            touched.append(n)
    return sheet, styles, sorted(touched), minted


TASK_COLS = ["A", "B", "C", "D", "E", "F", "G", "H", "I", "J", "K", "L"]
INTERNAL_BANNER = ("Internally identified — gaps found during the work, not raised in the "
                   "consultant's gap assessment")

# The Task Detail tab only breaks down the 11 deliverables that close 7+ findings or run to
# 5+ days; the other 25 exist solely as a row on the Remediation Plan tab. When one of those
# is completed there is nowhere to record what was built, and filing it under the banner above
# would be a lie about where it came from - it IS on the consultant's list. So an appended row
# can take its own banner instead.
DELIVERABLE_BANNER = ("From the gap assessment, below the Task Detail breakdown threshold — "
                      "deliverables the consultant raised but did not break into tasks")


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


def ensure_internal_group(sheet, strings, banner=INTERNAL_BANNER):
    """The banner row a group of appended tasks sits under. Added once per banner text."""
    if sheet_has_text(sheet, banner[:40], strings):
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
                          + [(DOCS_COL, banner)], style, 30, merged=False)
    # rewrite that row so the banner text sits in A and the row is merged across
    n = last_row(sheet)
    sheet = re.sub(r'<row r="%d".*?</row>' % n,
                   '<row r="%d" customFormat="false" ht="30" hidden="false" customHeight="true" '
                   'outlineLevel="0" collapsed="false">'
                   '<c r="A%d"%s t="inlineStr"><is><t xml:space="preserve">%s</t></is></c></row>'
                   % (n, n, ' s="%s"' % style if style else "", esc(banner)), sheet,
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
        if cell_text(inner, "B", n, strings).strip() == task:
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
    ap.add_argument("--deliverable", default="",
                    help="new-task: the deliverable id for column A, e.g. D-07. Leave empty for "
                         "an internally identified task, which belongs to no deliverable.")
    ap.add_argument("--banner", choices=("internal", "deliverable"), default="internal",
                    help="new-task: which section to append under. 'internal' = found during the "
                         "work; 'deliverable' = on the consultant's list but never broken into "
                         "tasks. Filing one under the other misstates where the work came from.")
    ap.add_argument("--name", help="new-task: the task name (column C)")
    ap.add_argument("--artifact", help="new-task: what it produces (column D)")
    ap.add_argument("--clauses", help="new-task: clauses served (column E)")
    ap.add_argument("--days", help="new-task: estimate (column F)")
    ap.add_argument("--owner", help="new-task: owner (column G)")
    ap.add_argument("--depends", default="", help="new-task: depends on (column H)")
    ap.add_argument("--app-fit", dest="app_fit", default="",
                    help="new-task: App today / Needs build / Off-app (column I)")
    ap.add_argument("--capability", default="", help="new-task: capability or feature (column J)")
    ap.add_argument("--notes", default="",
                    help="notes and risk (column K). Sets it on a --new-task row, and rewrites "
                         "it on an existing one - a note can go stale when the thing it warns "
                         "about gets fixed.")
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
    strings = shared_strings(parts)
    sheet, added = ensure_columns(sheet, strings)

    row = find_task_row(sheet, a.task, strings)

    if a.new_task:
        if row is not None:
            raise SystemExit("task %r already exists at row %d - drop --new-task to update it."
                             % (a.task, row))
        banner = INTERNAL_BANNER if a.banner == "internal" else DELIVERABLE_BANNER
        sheet, banner_added = ensure_internal_group(sheet, strings, banner)
        body_style = cell_style(sheet, HEADER_ROW + 3, "K") or cell_style(sheet, HEADER_ROW + 3, "A")
        vals = [("A", a.deliverable), ("B", a.task), ("C", a.name), ("D", a.artifact), ("E", a.clauses),
                ("F", a.days), ("G", a.owner), ("H", a.depends), ("I", a.app_fit),
                ("J", a.capability), ("K", a.notes), ("L", a.status or "Not started")]
        # tall enough for the widest wrapped cell among the pre-M columns
        h = max(30, max((-(-len(v) // 44) for _, v in vals if v), default=1) * 13.5 + 6)
        sheet, row = append_row(sheet, vals, body_style, h)
        if banner_added:
            print("added the %r section" % banner[:46])
    elif row is None:
        raise SystemExit("task %r not found in column B of the Task Detail sheet. Use --new-task "
                         "to append it." % a.task)

    pairs = [(SUMMARY_COL, a.summary), (DOCS_COL, a.docs)]
    if a.status:
        pairs.append((STATUS_COL, a.status))
    # On a new row the note went in with the rest of the columns already; on an existing row
    # this is the only way to correct one.
    if a.notes and not a.new_task:
        pairs.append((NOTES_COL, a.notes))
    sheet = put_cells(sheet, row, pairs)

    styles_xml = parts[STYLES].decode("utf-8")
    sheet, styles_xml, greened, minted = green_completed_rows(sheet, styles_xml, strings)
    parts[SHEET] = sheet.encode("utf-8")
    parts[STYLES] = styles_xml.encode("utf-8")

    # Nothing malformed reaches the workbook. A broken part does not fail loudly - Excel offers to
    # "repair" the file and silently strips whatever it could not parse, so the damage shows up as
    # missing formatting days later rather than as an error here. Both checks are microseconds.
    for part in (SHEET, STYLES):
        try:
            xml.dom.minidom.parseString(parts[part])
        except Exception as exc:
            raise SystemExit("refusing to write: %s is not well-formed XML (%s). "
                             "The workbook is untouched." % (part, exc))
    sm = re.search(r'<cellXfs count="(\d+)">(.*?)</cellXfs>', styles_xml, re.S)
    if sm and int(sm.group(1)) != len(re.findall(XF_RE, sm.group(2), re.S)):
        raise SystemExit("refusing to write: cellXfs says %s entries but %d are present. "
                         "The workbook is untouched."
                         % (sm.group(1), len(re.findall(XF_RE, sm.group(2), re.S))))

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
    if greened:
        print("green fill applied to Completed row%s %s%s"
              % ("" if len(greened) == 1 else "s", ", ".join(str(r) for r in greened),
                 " (minted %d style%s)" % (minted, "" if minted == 1 else "s") if minted else ""))
    print("task %s -> row %d  (%d words%s)"
          % (a.task, row, n, ", status=" + a.status if a.status else ""))


if __name__ == "__main__":
    main()
