#!/usr/bin/env python3
"""
Generate the "Derived Form Reports — Technical Foundation Guide" reference PDF.

Style is identical to generate-dynamic-forms-guide.py (navy header bar, slate
body, shaded code/reference blocks, gold-accented callouts, per-page footer with
"Page N of M") so the guides read as one family. Content documents the derived-
report feature: a log/register FRM form (e.g. FRM-003 Customer Complaint Log)
presenting itself as a live report projected from another form's collected
sop_document_responses (submitted FRM-002 Customer Complaint Reports). Covers the
content.report_schema convention (src/lib/formReport.ts), the declarative column
kinds, run-time parameters, client-side projection, the read-only SQL equivalent,
authoring, and the FRM-003 <- FRM-002 worked mapping.

Usage:  python scripts/generate-derived-reports-guide.py [output.pdf]
Default output: ./derived_reports_technical_guide.pdf
"""
import sys
from reportlab.lib.pagesizes import letter
from reportlab.lib import colors
from reportlab.lib.styles import ParagraphStyle
from reportlab.lib.enums import TA_LEFT
from reportlab.platypus import (
    BaseDocTemplate, PageTemplate, Frame, Paragraph, Spacer, Table, TableStyle,
    Preformatted, NextPageTemplate, PageBreak,
)
from reportlab.graphics.shapes import Drawing, Rect, String, Line

# ---- palette (identical to generate-dynamic-forms-guide.py) -------------------
NAVY      = colors.Color(0.118, 0.227, 0.373)   # header bar        #1E3A5F
HEADING   = colors.Color(0.118, 0.227, 0.373)   # section headings  #1E3A5F
BODY      = colors.Color(0.172, 0.243, 0.314)   # body text         #2C3E50
SUBTITLE  = colors.Color(0.796, 0.835, 0.882)   # header subtitle   #CBD5E1
SLATE_HDR = colors.Color(0.278, 0.333, 0.412)   # table header fill #47556A
LABEL     = colors.Color(0.278, 0.333, 0.412)   # table label text  #475569
ALT_ROW   = colors.Color(0.973, 0.980, 0.988)   # zebra row         #F8FAFC
CODE_BG   = colors.Color(0.945, 0.961, 0.976)   # code block fill   #F1F5F9
HAIRLINE  = colors.Color(0.886, 0.910, 0.941)   # thin borders      #E2E8F0
ACCENT    = colors.Color(0.784, 0.608, 0.235)   # AB gold accent    #C89B3C
WARN_BG   = colors.Color(0.984, 0.965, 0.914)   # callout fill      #FBF6E9

PAGE_W, PAGE_H = letter
LMARGIN = 54
CONTENT_W = PAGE_W - 2 * LMARGIN

# ---- paragraph styles (identical set to the forms guide) ---------------------
body = ParagraphStyle("body", fontName="Helvetica", fontSize=9.4, leading=13.2,
                      textColor=BODY, spaceAfter=6, alignment=TA_LEFT)
h2 = ParagraphStyle("h2", fontName="Helvetica-Bold", fontSize=13, leading=16,
                    textColor=HEADING, spaceBefore=14, spaceAfter=6)
h3 = ParagraphStyle("h3", fontName="Helvetica-Bold", fontSize=10.5, leading=13,
                    textColor=HEADING, spaceBefore=8, spaceAfter=4)
small = ParagraphStyle("small", parent=body, fontSize=8.6, leading=12, spaceAfter=3)
cell = ParagraphStyle("cell", fontName="Helvetica", fontSize=8.4, leading=11.2, textColor=BODY)
cell_b = ParagraphStyle("cell_b", parent=cell, fontName="Helvetica-Bold", textColor=LABEL)
cell_hdr = ParagraphStyle("cell_hdr", fontName="Helvetica-Bold", fontSize=9, leading=11,
                          textColor=colors.white)
mono = ParagraphStyle("mono", fontName="Courier", fontSize=8.0, leading=10.8, textColor=BODY)

TITLE = "Derived Form Reports — Technical Foundation"
SUBTITLE_TEXT = "S Y S T E M   A R C H I T E C T U R E   &   D E V E L O P E R   R E F E R E N C E"


def m(text):
    """Wrap inline monospace. Caller HTML-escapes < > & first."""
    return f'<font face="Courier">{text}</font>'


# ---- header bar (first page) + footer (every page) ---------------------------
def draw_header(c):
    c.saveState()
    c.setFillColor(NAVY)
    c.rect(0, PAGE_H - 66, PAGE_W, 66, stroke=0, fill=1)
    c.setFillColor(colors.white)
    c.setFont("Helvetica-Bold", 18)
    c.drawString(LMARGIN, PAGE_H - 38, TITLE)
    c.setFillColor(SUBTITLE)
    c.setFont("Helvetica-Bold", 9)
    c.drawString(LMARGIN, PAGE_H - 54, SUBTITLE_TEXT)
    c.setFillColor(ACCENT)
    c.rect(0, PAGE_H - 68, PAGE_W, 2, stroke=0, fill=1)
    c.restoreState()


def draw_footer(c, doc):
    c.saveState()
    c.setStrokeColor(HAIRLINE)
    c.setLineWidth(0.5)
    c.line(LMARGIN, 40, PAGE_W - LMARGIN, 40)
    c.setFont("Helvetica", 8)
    c.setFillColor(LABEL)
    c.drawString(LMARGIN, 30, "Adventure Bakery  •  Documentation")
    c.restoreState()


def on_first(c, doc):
    draw_header(c)
    draw_footer(c, doc)


def on_later(c, doc):
    draw_footer(c, doc)


# ---- reusable flowable builders (same helpers as the forms guide) ------------
def meta_table(rows):
    data = [[Paragraph(f"{k}", cell_b), Paragraph(v, cell)] for k, v in rows]
    t = Table(data, colWidths=[120, CONTENT_W - 120])
    style = [
        ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
        ("LINEBELOW", (0, 0), (-1, -2), 0.5, HAIRLINE),
        ("BOX", (0, 0), (-1, -1), 0.5, HAIRLINE),
        ("TOPPADDING", (0, 0), (-1, -1), 5),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 5),
        ("LEFTPADDING", (0, 0), (-1, -1), 8),
    ]
    for i in range(len(rows)):
        if i % 2 == 1:
            style.append(("BACKGROUND", (0, i), (-1, i), ALT_ROW))
    t.setStyle(TableStyle(style))
    return t


def data_table(header, rows, col_widths, mono_cols=()):
    data = [[Paragraph(h, cell_hdr) for h in header]]
    for r in rows:
        cells = []
        for ci, val in enumerate(r):
            st = mono if ci in mono_cols else (cell_b if ci == 0 else cell)
            cells.append(Paragraph(val, st))
        data.append(cells)
    t = Table(data, colWidths=col_widths, repeatRows=1)
    style = [
        ("BACKGROUND", (0, 0), (-1, 0), SLATE_HDR),
        ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
        ("TOPPADDING", (0, 0), (-1, -1), 5),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 5),
        ("LEFTPADDING", (0, 0), (-1, -1), 8),
        ("RIGHTPADDING", (0, 0), (-1, -1), 8),
        ("LINEBELOW", (0, 1), (-1, -2), 0.4, HAIRLINE),
        ("BOX", (0, 0), (-1, -1), 0.5, HAIRLINE),
    ]
    for i in range(1, len(data)):
        if i % 2 == 0:
            style.append(("BACKGROUND", (0, i), (-1, i), ALT_ROW))
    t.setStyle(TableStyle(style))
    return t


def code_block(text):
    p = Preformatted(text, mono)
    t = Table([[p]], colWidths=[CONTENT_W])
    t.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, -1), CODE_BG),
        ("BOX", (0, 0), (-1, -1), 0.5, HAIRLINE),
        ("LEFTPADDING", (0, 0), (-1, -1), 10),
        ("RIGHTPADDING", (0, 0), (-1, -1), 10),
        ("TOPPADDING", (0, 0), (-1, -1), 8),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 8),
    ]))
    return t


def callout(html):
    """Gold-accented important note."""
    p = Paragraph(html, body)
    t = Table([[p]], colWidths=[CONTENT_W])
    t.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, -1), WARN_BG),
        ("LINEBEFORE", (0, 0), (0, -1), 3, ACCENT),
        ("BOX", (0, 0), (-1, -1), 0.5, HAIRLINE),
        ("LEFTPADDING", (0, 0), (-1, -1), 10),
        ("RIGHTPADDING", (0, 0), (-1, -1), 10),
        ("TOPPADDING", (0, 0), (-1, -1), 7),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 7),
    ]))
    return t


def bullets(items):
    return [Paragraph("•&nbsp;&nbsp;" + txt, body) for txt in items]


# ---- flow diagram (drawn with reportlab.graphics shapes, no external image) --
def er_entity(shapes, x, y, w, h, title, rows, header_color=SLATE_HDR):
    shapes.append(Rect(x, y, w, h, strokeColor=LABEL, strokeWidth=0.9, fillColor=colors.white))
    hdr_h = 20
    shapes.append(Rect(x, y + h - hdr_h, w, hdr_h, strokeColor=LABEL, strokeWidth=0.9, fillColor=header_color))
    shapes.append(String(x + 8, y + h - hdr_h + 6, title, fontName="Helvetica-Bold",
                          fontSize=9.0, fillColor=colors.white))
    ty = y + h - hdr_h - 13
    for r in rows:
        shapes.append(String(x + 8, ty, r, fontName="Courier", fontSize=7.1, fillColor=BODY))
        ty -= 11.3
    return (x, y, w, h)


def er_arrow(shapes, p1, p2, label):
    x1, y1 = p1
    x2, y2 = p2
    shapes.append(Line(x1, y1, x2, y2, strokeColor=ACCENT, strokeWidth=1.1))
    mx, my = (x1 + x2) / 2, (y1 + y2) / 2
    shapes.append(String(mx - 2, my + 4, label, fontName="Helvetica-Bold", fontSize=7.6, fillColor=ACCENT))


def build_flow_diagram():
    d = Drawing(CONTENT_W, 250)
    shapes = []

    report_box = er_entity(shapes, 6, 150, 250, 82, "log form  ·  content.report_schema", [
        "sourceSopNumber   'FRM-002'",
        "sourceStatus      submitted | all",
        "columns[]         header + source rule",
        "params[]          date-range | text | select",
    ], header_color=NAVY)

    source_box = er_entity(shapes, 300, 158, 200, 66, "source form  (type='form')", [
        "id              uuid    PK",
        "content         jsonb",
        "  ⊃ form_schema",
    ])

    resp_box = er_entity(shapes, 300, 44, 200, 82, "sop_document_responses", [
        "document_id     uuid    FK",
        "data            jsonb   { fieldId: value }",
        "status          draft | submitted",
    ])

    out_box = er_entity(shapes, 6, 44, 250, 70, "projected register  (client-side)", [
        "resolveReportColumns() -> cells",
        "filterReportRows()     -> params",
        "generateDerivedReportPdf / CSV",
    ], header_color=ACCENT)

    for s in shapes:
        d.add(s)

    rx, ry, rw, rh = report_box
    sx, sy, sw, sh = source_box
    qx, qy, qw, qh = resp_box
    ox, oy, ow, oh = out_box

    er_arrow(d.contents, (rx + rw, ry + rh * 0.5), (sx, sy + sh * 0.5), "resolve by sop_number")
    er_arrow(d.contents, (sx + sw * 0.5, sy), (qx + qw * 0.5, qy + qh), "1 : N")
    er_arrow(d.contents, (qx, qy + qh * 0.5), (ox + ow, oy + oh * 0.5), "project")
    return d


# ---- document content ----------------------------------------------------------
def build(out_path):
    doc = BaseDocTemplate(
        out_path, pagesize=letter,
        leftMargin=LMARGIN, rightMargin=LMARGIN, topMargin=84, bottomMargin=52,
        title="Derived Form Reports — Technical Foundation", author="Adventure Bakery",
    )
    frame_first = Frame(LMARGIN, 48, CONTENT_W, PAGE_H - 84 - 48, id="first")
    frame_later = Frame(LMARGIN, 48, CONTENT_W, PAGE_H - 54 - 48, id="later")
    doc.addPageTemplates([
        PageTemplate(id="first", frames=[frame_first], onPage=on_first),
        PageTemplate(id="later", frames=[frame_later], onPage=on_later),
    ])

    S = [NextPageTemplate("later")]
    S.append(meta_table([
        ("System:", "Derived Form Reports (log / register FRM forms)"),
        ("Built:", "July 2026"),
        ("Schema location:", m("sop_documents.content.report_schema")),
        ("Reference report:", "FRM-003 Customer Complaint Log &nbsp;&larr;&nbsp; FRM-002"),
        ("System reference:", "Team Portal → Compliance → SOPs Library → Report tab"),
    ]))
    S.append(Spacer(1, 4))

    # ---------------------------------------------------------------- Purpose
    S.append(Paragraph("Purpose", h2))
    S.append(Paragraph(
        "This guide orients an engineer who did not build this feature on what a <b>derived report</b> "
        "is, why it is shaped this way, and where each piece lives — so it can be extended (new column "
        "kinds, new parameter types, new log forms) without re-deriving the design from the code. It "
        "builds on the Dynamic Fillable Forms system; read that guide first for the "
        + m("sop_document_responses") + " model this projects over.", body))

    # ---------------------------------------------------------------- Overview
    S.append(Paragraph("What This Feature Does", h2))
    S.append(Paragraph(
        "Several FRM forms are <b>logs / registers</b> — e.g. <b>FRM-003 Customer Complaint Log</b> — "
        "whose rows are not hand-entered. Each row is a projection of a completed <b>source</b> report "
        "(FRM-003's rows come from submitted <b>FRM-002 Customer Complaint Reports</b>). A derived "
        "report has <b>no entries of its own</b> — it reprojects a <i>different</i> form's responses.",
        body))
    for t in [
        "<b>1. Definition</b> — a " + m("report_schema") + " lives on the log form's own row, authored "
        "by an admin: a source form, declarative columns, and run-time parameters.",
        "<b>2. Projection</b> — at view time the engine fetches the source form's responses and maps each "
        "into the columns. All aggregation is <b>client-side</b> (log-sized data; no new SQL/RPC).",
        "<b>3. Parameters</b> — date range, text search, and dropdown filters apply live over the rows.",
        "<b>4. Output</b> — a register table with CSV / PDF export, plus a <b>View SQL</b> panel that "
        "renders the read-only SQL equivalent of the current definition.",
    ]:
        S.append(Paragraph(t, body))
    S.append(callout(
        "<b>Distinct from Records.</b> " + m("Records.tsx") + " (" + m("/team/compliance/records") +
        ") flattens a form's <i>own</i> entries. A derived report reprojects <i>another</i> form's "
        "entries into a purpose-built register — so this feature deliberately did not extend Records."))

    # ---------------------------------------------------------------- Flow diagram
    S.append(Paragraph("How It Fits Together", h2))
    S.append(Paragraph(
        "The log form's " + m("report_schema") + " names its source by " + m("sop_number") + " (portable "
        "across environments); the engine resolves that to the source form row, reads its "
        + m("sop_document_responses") + ", and projects each into the register — entirely in the browser.",
        body))
    S.append(build_flow_diagram())

    # ---------------------------------------------------------------- report_schema shape
    S.append(PageBreak())
    S.append(Paragraph("report_schema Shape (Cheat Sheet)", h2))
    S.append(Paragraph(
        "Stored at " + m("sop_documents.content.report_schema") + ", merged alongside the JSON this row "
        "already carries (" + m("form_schema") + ", attachments, SOP body) — never clobbering them. See "
        + m("src/lib/formReport.ts") + " for the TypeScript definitions.", body))
    S.append(data_table(
        ["Field", "Value", "Notes"],
        [
            ["version", "number", "schema version (currently 1)"],
            ["sourceSopNumber", "string", "e.g. \"FRM-002\" — resolved to a doc id at run time (portable)"],
            ["sourceStatus", "\"submitted\" | \"all\"", "default submitted; \"all\" includes drafts"],
            ["defaultDateField", "string", "source field the date-range param filters on"],
            ["columns[]", "ReportColumnDef[]", "id + header + source rule (kinds below)"],
            ["params[]", "ReportParam[]", "user-adjustable run-time filters (types below)"],
            ["filters[]", "ReportFilter[]", "fixed conditions (always applied) — define the register's universe"],
            ["legend[]", "string[]", "footnote lines printed under the PDF table"],
        ],
        col_widths=[110, 120, CONTENT_W - 230], mono_cols=(0,)))
    S.append(Spacer(1, 6))
    S.append(code_block(
        "{\n"
        "  \"version\": 1,\n"
        "  \"sourceSopNumber\": \"FRM-002\",\n"
        "  \"sourceStatus\": \"all\",\n"
        "  \"defaultDateField\": \"date_received\",\n"
        "  \"columns\": [\n"
        "    { \"id\": \"product_lot\", \"header\": \"Product / Lot\",\n"
        "      \"source\": { \"kind\": \"template\", \"template\": \"{product_name} / {lot_batch_code}\" } },\n"
        "    { \"id\": \"status\", \"header\": \"Status\",\n"
        "      \"source\": { \"kind\": \"cases\",\n"
        "        \"cases\": [ { \"field\": \"closure_date\", \"op\": \"notEmpty\", \"then\": \"Closed\" } ],\n"
        "        \"default\": \"Open\" } }\n"
        "  ],\n"
        "  \"params\": [\n"
        "    { \"id\": \"date\", \"label\": \"Date received\", \"type\": \"date-range\", \"field\": \"date_received\" },\n"
        "    { \"id\": \"customer\", \"label\": \"Customer\", \"type\": \"text\", \"field\": \"customer_name\", \"op\": \"contains\" }\n"
        "  ]\n"
        "}"
    ))

    # ---------------------------------------------------------------- Column kinds
    S.append(Paragraph("Column Source Kinds (Cheat Sheet)", h2))
    S.append(Paragraph(
        "The " + m("source.kind") + " set is <b>declarative and safe</b> — no arbitrary JS/SQL ever comes "
        "off the schema. Compiled to renderable cells by " + m("resolveReportColumns()") + ".", body))
    S.append(data_table(
        ["Kind", "Renders", "Config"],
        [
            ["field", "one source field, formatted like on the source form", "field"],
            ["template", "text with {field_id} tokens substituted", "template"],
            ["map", "a value → label lookup (e.g. Critical → C)", "field, map{}, fallback?"],
            ["cases", "first matching rule wins (notEmpty / empty / equals), else default", "cases[], default"],
            ["const", "a fixed literal — or blank, for a column with no source field yet", "value"],
        ],
        col_widths=[70, CONTENT_W - 250, 180], mono_cols=(0,)))

    # ---------------------------------------------------------------- Parameters
    S.append(Paragraph("Parameter Types", h2))
    S.append(data_table(
        ["Type", "Behavior", "Config"],
        [
            ["date-range", "From / To on a source date field (defaults to defaultDateField)", "field"],
            ["text", "case-insensitive contains or equals on a source field", "field, op"],
            ["select", "dropdown of the distinct values a column produces across all rows", "column (a column id)"],
        ],
        col_widths=[80, CONTENT_W - 250, 170], mono_cols=(0,)))
    S.append(Paragraph(
        "Parameters apply <b>live</b> (client-side) — there is no separate Run button. " +
        m("select") + " options come from " + m("distinctColumnValues()") + " over the unfiltered rows, "
        "so the dropdown never collapses to the value already chosen.", small))

    # ---------------------------------------------------------------- Fixed conditions
    S.append(Paragraph("Fixed Conditions (filters[])", h2))
    S.append(Paragraph(
        "Optional <b>always-applied</b> conditions that define which source entries the register includes "
        "— <i>not</i> user-adjustable (that is what params are for). They AND together; an " + m("in") +
        " filter ORs its values. This is how an <b>Approved Supplier Register</b> (FRM-201) lists only "
        "suppliers whose " + m("supplier_status") + " is Approved or Conditionally Approved. Applied in "
        + m("loadReportBase") + " (so " + m("select") + "-param dropdowns only ever see eligible rows) and "
        "rendered into the " + m("buildReportSql") + " WHERE marked " + m("-- fixed") + ".", body))
    S.append(data_table(
        ["op", "Matches when", "Config"],
        [
            ["in", "the field's value is any of the listed values", "values[]"],
            ["equals / notEquals", "the field equals / does not equal a value", "value"],
            ["notEmpty / empty", "the field has / lacks a value", "(none)"],
        ],
        col_widths=[110, CONTENT_W - 290, 180], mono_cols=(0,)))

    # ---------------------------------------------------------------- Projection
    S.append(PageBreak())
    S.append(Paragraph("Projection & Filtering", h2))
    S.append(Paragraph(
        "The engine splits fetch from filter so the viewer can load once and filter live:", body))
    S.append(code_block(
        "loadReportBase(schema)      -- fetchSourceForm(sopNumber) -> fetchResponses(sourceId)\n"
        "                            -- keep status == sourceStatus; project via resolveReportColumns()\n"
        "                            -- returns ALL base rows (params NOT yet applied)\n"
        "filterReportRows(schema, columns, rows, values)   -- pure; applies the live params client-side\n"
        "runReport(schema, values)   -- convenience = loadReportBase + filterReportRows (builder Preview)"
    ))
    S.append(callout(
        "<b>Client-side & unbounded fetch.</b> " + m("loadReportBase") + " fetches the source responses "
        "with <b>no</b> " + m("created_at") + " bound, because the date param filters a <i>data</i> field "
        "(e.g. " + m("date_received") + ") that can differ from " + m("created_at") + ". Fine for "
        "log-sized data; if a source form ever grows huge, compile the same declarative schema into a "
        + m("SECURITY DEFINER") + " RPC without changing the UI."))

    # ---------------------------------------------------------------- SQL equivalent
    S.append(Paragraph("Equivalent Read-Only SQL (View SQL)", h2))
    S.append(Paragraph(
        m("buildReportSql()") + " renders the read-only SQL equivalent of the current definition <b>plus "
        "the live parameters</b> — surfaced by the viewer's <b>View SQL</b> panel with a Copy button. Each "
        "column kind maps to an expression over " + m("data-&gt;&gt;'field'") + " (" + m("field") +
        "→accessor, " + m("template") + "→" + m("||") + " concat, " + m("map") + "/" + m("cases") +
        "→" + m("CASE") + ", " + m("const") + "→literal); params become " + m("WHERE") + " clauses. It is "
        "<b>illustrative</b> — the app still projects client-side — but it is valid SQL an auditor can copy "
        "and run against " + m("sop_document_responses") + ".", body))
    S.append(code_block(
        "-- Read-only equivalent (projected client-side; not executed as SQL)\n"
        "select\n"
        "  d.data-&gt;&gt;'complaint_ref_no'                   as \"Ref No.\",\n"
        "  (coalesce(d.data-&gt;&gt;'product_name','') || ' / '\n"
        "     || coalesce(d.data-&gt;&gt;'lot_batch_code','')) as \"Product / Lot\",\n"
        "  case d.data-&gt;&gt;'classification'\n"
        "       when 'Critical (food safety risk)' then 'C'\n"
        "       when 'Non-Critical (quality concern)' then 'NC' else '' end as \"Class. (C / NC)\",\n"
        "  case when coalesce(d.data-&gt;&gt;'closure_date','') &lt;&gt; '' then 'Closed'\n"
        "       when coalesce(d.data-&gt;&gt;'investigation_findings','') &lt;&gt; '' then 'Under Investigation'\n"
        "       else 'Open' end                          as \"Status\"\n"
        "from sop_document_responses d\n"
        "where d.document_id = '&lt;FRM-002 id&gt;'   -- resolved from sourceSopNumber\n"
        "  and d.data-&gt;&gt;'customer_name' ilike '%cookies%'\n"
        "order by d.created_at desc;"
    ))

    # ---------------------------------------------------------------- Authoring
    S.append(Paragraph("Authoring a Report", h2))
    S.extend(bullets([
        "Open the log form → <b>Report</b> tab → (admin) <b>Define report</b> / <b>Edit report</b>.",
        "Pick the <b>source form</b> (fillable " + m("type='form'") + " docs; the current form is "
        "excluded). Stores " + m("sourceSopNumber") + ".",
        "Set <b>Include</b> (" + m("submitted") + " vs " + m("all") + ") and the <b>default date field</b>.",
        "Add <b>columns</b> (header + source kind; field pickers come from the source form's fields) and "
        "<b>parameters</b>; add optional <b>legend</b> lines.",
        "<b>Preview</b> runs the projection against live data (read-only). <b>Save Report</b> writes via "
        + m("updateModuleContent") + " (a <b>merge</b>, so " + m("form_schema") + "/attachments survive).",
    ]))

    # ---------------------------------------------------------------- Key files
    S.append(PageBreak())
    S.append(Paragraph("Key Files (Cheat Sheet)", h2))
    S.append(data_table(
        ["File", "Purpose"],
        [
            ["src/lib/formReport.ts", "Engine + types; resolveReportColumns, loadReportBase + filterReportRows, runReport, distinctColumnValues, buildReportSql"],
            ["src/components/team/forms/FormReportTab.tsx", "Viewer: live params, table, CSV/PDF, View SQL panel, admin Edit"],
            ["src/components/team/forms/ReportSchemaBuilder.tsx", "Admin authoring; source picker, column-kind editors, params, legend, Preview; saves via updateModuleContent merge"],
            ["src/lib/formPdf.ts", "generateDerivedReportPdf — landscape register PDF (reuses sopPdf.ts logo/footer)"],
            ["src/pages/team/compliance/SopsLibrary.tsx", "Report tab + 'Report' list pill; report-only logs default to the Report tab"],
            ["FORM_REPORTS.md", "Prose runbook — same content, repo root"],
        ],
        col_widths=[205, CONTENT_W - 205], mono_cols=(0,)))

    # ---------------------------------------------------------------- Security
    S.append(Paragraph("Security", h2))
    S.append(Paragraph(
        "The feature adds <b>no new tables or policies</b>. Reports only <b>read</b> " +
        m("sop_document_responses") + " (any staff " + m("SELECT") + " — shared compliance records) and "
        "the log form's own row. The " + m("report_schema") + " is edited through " +
        m("updateModuleContent") + " on " + m("sop_documents") + ", which is admin-gated in the UI. "
        "See the Dynamic Fillable Forms guide for the full responses/history RLS.", body))

    # ---------------------------------------------------------------- Worked example
    S.append(Paragraph("Worked Example — FRM-003 ← FRM-002", h2))
    S.append(data_table(
        ["FRM-003 column", "Kind", "Source"],
        [
            ["Ref No.", "field", "complaint_ref_no"],
            ["Date Received", "field", "date_received"],
            ["Customer", "field", "customer_name"],
            ["Product / Lot", "template", "{product_name} / {lot_batch_code}"],
            ["Complaint Summary", "field", "complaint_description_text"],
            ["Class. (C / NC)", "map", "classification → C / NC"],
            ["Root Cause", "field", "root_cause_sqf_2_5_3_1"],
            ["CAPA Ref", "const", "blank — FRM-002 has no CAPA/CAR-number field yet"],
            ["Status", "cases", "closure_date → Closed; else investigation_findings → Under Investigation; else Open"],
            ["Date Closed", "field", "closure_date"],
        ],
        col_widths=[110, 60, CONTENT_W - 170], mono_cols=()))

    # ---------------------------------------------------------------- Gotchas
    S.append(Paragraph("Behavior, Gotchas &amp; Known Gaps", h2))
    S.extend(bullets([
        "<b>Field ids are the join key.</b> A column's " + m("field") + " keys into the source response "
        + m("data") + ". Never rename a source field id after entries exist — it orphans the column.",
        "<b>Column ids ≠ field ids.</b> Column ids are a separate namespace; " + m("select") + " params "
        "reference them (" + m("param.column") + "). Renaming a header re-slugs its id and cascades into "
        "any param that points at it.",
        "<b>sourceStatus default is submitted.</b> A complaint-style register often wants " + m("all") +
        " so every <i>received</i> complaint appears, Status column conveying progress — a per-form call.",
        "<b>CAPA Ref gap.</b> FRM-002 captures no CAPA/CAR number, so that column is " + m("const") +
        "-blank. To fill it, add a " + m("capa_ref") + " field to FRM-002 and switch the column to " +
        m("field") + " — the general pattern for any log column the source doesn't yet capture.",
        "<b>PDF column clamp.</b> " + m("generateDerivedReportPdf") + " clamps to 10 columns and points "
        "wider reports at the CSV — same rule as " + m("generateFormReportPdf") + ".",
        "<b>Grids are not offered as column sources</b> (a multi-row value has no single-cell projection).",
        "<b>Tab visibility.</b> The Report tab shows for " + m("type='form'") + " docs when "
        + m("isAdmin || hasReportSchema") + "; a report-only log (no " + m("form_schema") + ") defaults to it.",
    ]))

    # ---------------------------------------------------------------- Quick ref
    S.append(Paragraph("If You Need To… (Quick Reference)", h2))
    S.append(data_table(
        ["If you need to…", "Start here"],
        [
            ["Add a column source kind", "ColumnSource union + resolveReportColumns() + columnSql() in formReport.ts, then the editor in ReportSchemaBuilder.tsx"],
            ["Add a parameter type", "ReportParam + filterReportRows() + buildReportSql() in formReport.ts, then the control in FormReportTab.tsx"],
            ["Add a fixed-condition op", "FilterOp + matchesFilter() + the filter branch in buildReportSql() in formReport.ts, then FILTER_OP_LABELS for the builder"],
            ["Change how a column projects", "resolveReportColumns() in formReport.ts"],
            ["Change the equivalent SQL", "buildReportSql() / columnSql() in formReport.ts"],
            ["Change the register PDF", "generateDerivedReportPdf() in formPdf.ts"],
            ["Point a log at a different source", "Report tab → Edit report → Source form (rewrites report_schema.sourceSopNumber)"],
            ["Debug an empty register", "Check sourceStatus (submitted vs all) and that the source form has matching responses"],
        ],
        col_widths=[175, CONTENT_W - 175]))

    doc.build(S, canvasmaker=NumberedCanvas)


# ---- {nb} total-page support (identical to the forms guide) ------------------
from reportlab.pdfgen import canvas as _canvas  # noqa: E402


class NumberedCanvas(_canvas.Canvas):
    def __init__(self, *a, **k):
        super().__init__(*a, **k)
        self._saved = []

    def showPage(self):
        self._saved.append(dict(self.__dict__))
        self._startPage()

    def save(self):
        total = len(self._saved)
        for st in self._saved:
            self.__dict__.update(st)
            self._draw_total(total)
            super().showPage()
        super().save()

    def _draw_total(self, total):
        self.setFont("Helvetica", 8)
        self.setFillColor(LABEL)
        self.drawRightString(PAGE_W - LMARGIN, 30, f"Page {self._pageNumber} of {total}")


if __name__ == "__main__":
    out = sys.argv[1] if len(sys.argv) > 1 else "derived_reports_technical_guide.pdf"
    build(out)
    print("wrote", out)
