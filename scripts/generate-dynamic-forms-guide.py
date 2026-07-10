#!/usr/bin/env python3
"""
Generate the "Dynamic Fillable Forms — Technical Foundation Guide" reference PDF.

Style mirrors generate-document-numbering-guide.py (navy header bar, slate body,
shaded code/reference blocks, per-page confidential footer) so the two guides
read as one family. Content documents the FRM fillable-form system: the schema
convention in src/lib/formSchema.ts, the sop_document_responses / sop_document_history
tables (migration 20260709000001_form_responses_history.sql), the fill lifecycle,
schema-drift resolution, reporting, and the AI schema-extraction edge function.

Usage:  python scripts/generate-dynamic-forms-guide.py [output.pdf]
Default output: ./dynamic_forms_technical_guide.pdf
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

# ---- palette (identical to generate-document-numbering-guide.py) -------------
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

# ---- paragraph styles (identical set to the numbering guide) -----------------
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

TITLE = "Dynamic Fillable Forms — Technical Foundation"
SUBTITLE_TEXT = "S Y S T E M   A R C H I T E C T U R E   &   D E V E L O P E R   R E F E R E N C E"


def m(text):
    """Wrap inline monospace. Caller is responsible for HTML-escaping < > &."""
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


# ---- reusable flowable builders (same helpers as the numbering guide) --------
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
    out = []
    for txt in items:
        out.append(Paragraph("•&nbsp;&nbsp;" + txt, body))
    return out


# ---- ER diagram (drawn with reportlab.graphics shapes, no external image) ----
def er_entity(shapes, x, y, w, h, title, rows, header_color=SLATE_HDR):
    shapes.append(Rect(x, y, w, h, strokeColor=LABEL, strokeWidth=0.9, fillColor=colors.white))
    hdr_h = 20
    shapes.append(Rect(x, y + h - hdr_h, w, hdr_h, strokeColor=LABEL, strokeWidth=0.9, fillColor=header_color))
    shapes.append(String(x + 8, y + h - hdr_h + 6, title, fontName="Helvetica-Bold",
                          fontSize=9.3, fillColor=colors.white))
    ty = y + h - hdr_h - 13
    for r in rows:
        shapes.append(String(x + 8, ty, r, fontName="Courier", fontSize=7.1, fillColor=BODY))
        ty -= 11.3
    return (x, y, w, h)


def er_link(shapes, p1, p2, label1, label2):
    x1, y1 = p1
    x2, y2 = p2
    shapes.append(Line(x1, y1, x2, y2, strokeColor=ACCENT, strokeWidth=1.1))
    shapes.append(String(x1 + 3, y1 + 3, label1, fontName="Helvetica-Bold", fontSize=8, fillColor=ACCENT))
    shapes.append(String(x2 - 10, y2 + 3, label2, fontName="Helvetica-Bold", fontSize=8, fillColor=ACCENT))


def build_er_diagram():
    d = Drawing(CONTENT_W, 470)
    shapes = []

    docs_box = er_entity(shapes, 142, 335, 220, 118, "sop_documents  (existing)", [
        "id              uuid    PK",
        "type            text",
        "sop_number      text",
        "revision        text",
        "status          text",
        "content         jsonb",
        "  ⊃ form_schema",
    ], header_color=NAVY)

    hist_box = er_entity(shapes, 6, 150, 235, 118, "sop_document_history  (new)", [
        "id              uuid    PK",
        "document_id     uuid    FK → sop_documents",
        "revision        text",
        "changed_fields  text[]",
        "snapshot        jsonb   (full prior row)",
        "snapshotted_at  timestamptz",
    ])

    resp_box = er_entity(shapes, 263, 84, 235, 165, "sop_document_responses  (new)", [
        "id              uuid    PK",
        "document_id     uuid    FK → sop_documents",
        "form_number     text    (pinned)",
        "form_revision   text    (pinned)",
        "data            jsonb",
        "status          text    draft|submitted",
        "created_by      uuid    FK → auth.users",
        "submitted_by    uuid    FK → auth.users",
        "reopened_by     uuid    FK → auth.users",
    ])

    users_box = er_entity(shapes, 6, 10, 160, 58, "auth.users / profiles", [
        "id              uuid    PK",
        "full_name       text",
    ])

    for s in shapes:
        d.add(s)

    dx, dy, dw, dh = docs_box
    hx, hy, hw, hh = hist_box
    rx, ry, rw, rh = resp_box
    ux, uy, uw, uh = users_box

    er_link(d.contents, (dx + 55, dy), (hx + hw * 0.55, hy + hh), "1", "N")
    er_link(d.contents, (dx + dw - 55, dy), (rx + rw * 0.4, ry + rh), "1", "N")
    er_link(d.contents, (ux + uw, uy + uh * 0.5), (rx, ry + rh * 0.18), "1", "N")

    return d


# ---- document content ----------------------------------------------------------
def build(out_path):
    doc = BaseDocTemplate(
        out_path, pagesize=letter,
        leftMargin=LMARGIN, rightMargin=LMARGIN, topMargin=84, bottomMargin=52,
        title="Dynamic Fillable Forms — Technical Foundation", author="Adventure Bakery",
    )
    frame_first = Frame(LMARGIN, 48, CONTENT_W, PAGE_H - 84 - 48, id="first")
    frame_later = Frame(LMARGIN, 48, CONTENT_W, PAGE_H - 54 - 48, id="later")
    doc.addPageTemplates([
        PageTemplate(id="first", frames=[frame_first], onPage=on_first),
        PageTemplate(id="later", frames=[frame_later], onPage=on_later),
    ])

    S = [NextPageTemplate("later")]
    S.append(meta_table([
        ("System:", "Dynamic Fillable Forms (FRM documents)"),
        ("Built:", "July 2026"),
        ("Core migration:", m("20260709000001_form_responses_history.sql")),
        ("New tables:", m("sop_document_responses") + ", " + m("sop_document_history")),
        ("System reference:", "Team Portal → Compliance → SOPs Library / Form Records"),
    ]))
    S.append(Spacer(1, 4))

    # ---------------------------------------------------------------- Purpose
    S.append(Paragraph("Purpose", h2))
    S.append(Paragraph(
        "This guide orients an engineer who did not build this system on what exists, why it is "
        "shaped this way, and where each piece lives — so it can be extended (new field types, "
        "new reports, floor-worker entry) without re-deriving the design from the code. Read this "
        "before making structural changes to forms, responses, or history.", body))

    # ---------------------------------------------------------------- Overview
    S.append(Paragraph("What This System Does", h2))
    S.append(Paragraph(
        "FRM-numbered " + m("sop_documents") + " rows (paper forms imported via Word/PDF) can carry "
        "a fillable <b>field schema</b>. Staff fill out instances from the SOPs Library; each filled "
        "instance is a durable record with an audit-defensible lifecycle; reporting rolls answers up "
        "across entries; and an AI step can propose the schema from the original uploaded document.",
        body))
    for t in [
        "<b>1. Schema</b> — a JSON field-schema lives on the form's own row, authored by an admin.",
        "<b>2. Responses</b> — filled instances are separate rows with a draft → submitted lifecycle.",
        "<b>3. History</b> — a DB trigger snapshots the form whenever a published revision changes, "
        "so an old entry always renders against the exact layout it was filled on.",
        "<b>4. Reporting + AI</b> — a cross-form Records page exports answers to CSV/PDF; an edge "
        "function proposes a schema from an uploaded .docx for admin review.",
    ]:
        S.append(Paragraph(t, body))

    # ---------------------------------------------------------------- ER Diagram
    S.append(Paragraph("Data Model", h2))
    S.append(Paragraph(
        "One schema-bearing document fans out to many history snapshots and many filled responses. "
        "Responses additionally reference the acting user for creation, submission, and reopening.",
        body))
    S.append(build_er_diagram())
    S.append(Paragraph(
        m("PK") + " = primary key &nbsp;&nbsp; " + m("FK") + " = foreign key &nbsp;&nbsp; "
        "1 / N = one-to-many. Full DDL: " + m("supabase/migrations/20260709000001_form_responses_history.sql") + ".",
        small))
    S.append(callout(
        "<b>Deliberately unused:</b> the dormant scaffold tables " + m("sop_versions") + ", " +
        m("form_templates") + ", " + m("form_submissions") + " (migration " +
        m("20260608000001") + ") predate this system, are referenced by zero app code, and their "
        "RLS is incompatible with the draft/submitted/reopen lifecycle below. Do not repurpose them "
        "— they may still hold data from an earlier, abandoned design."))

    # ---------------------------------------------------------------- Table reference
    S.append(PageBreak())
    S.append(Paragraph("Table Reference (Cheat Sheet)", h2))
    S.append(Paragraph(m("sop_document_responses"), h3))
    S.append(data_table(
        ["Column", "Type", "Notes"],
        [
            ["id", "uuid PK", "gen_random_uuid()"],
            ["document_id", "uuid FK", "→ sop_documents.id, ON DELETE RESTRICT"],
            ["form_number", "text", "sop_number at creation — survives renumbering"],
            ["form_revision", "text", "revision at creation — the schema pin"],
            ["data", "jsonb", "flat { fieldId: value }"],
            ["status", "text", "'draft' | 'submitted' (CHECK constraint)"],
            ["created_by", "uuid FK", "→ auth.users, defaults to auth.uid()"],
            ["updated_at", "timestamptz", "optimistic-concurrency token (see below)"],
            ["submitted_at / submitted_by", "timestamptz / uuid", "set on submit"],
            ["reopened_at / reopened_by", "timestamptz / uuid", "set on admin reopen"],
        ],
        col_widths=[130, 90, CONTENT_W - 220], mono_cols=(0,)))
    S.append(Spacer(1, 6))
    S.append(Paragraph(m("sop_document_history"), h3))
    S.append(data_table(
        ["Column", "Type", "Notes"],
        [
            ["id", "uuid PK", "gen_random_uuid()"],
            ["document_id", "uuid FK", "→ sop_documents.id, ON DELETE CASCADE"],
            ["revision", "text", "OLD.revision — what this snapshot was published under"],
            ["changed_fields", "text[]", "which watched fields differed (audit trail)"],
            ["snapshot", "jsonb", "to_jsonb(OLD) — the FULL prior sop_documents row"],
            ["snapshotted_at", "timestamptz", "trigger fire time"],
        ],
        col_widths=[130, 90, CONTENT_W - 220], mono_cols=(0,)))
    S.append(callout(
        "No " + m("INSERT") + "/" + m("UPDATE") + "/" + m("DELETE") + " RLS policies exist on "
        + m("sop_document_history") + " — rows are written <b>only</b> by the "
        + m("SECURITY DEFINER") + " trigger function " + m("snapshot_sop_document()") + ". Staff can "
        "read it (used by schema-drift resolution below); nothing else writes to it."))

    # ---------------------------------------------------------------- form_schema shape
    S.append(Paragraph("content.form_schema Shape (Cheat Sheet)", h2))
    S.append(Paragraph(
        "The field schema itself is <b>not a new column</b> — it lives at " +
        m("sop_documents.content.form_schema") + ", alongside the other JSON this table already "
        "carries (slides, quiz, attachments, SOP body). See " + m("src/lib/formSchema.ts") +
        " for the full TypeScript definitions.", body))
    S.append(data_table(
        ["Field type", "Stored value", "Notes"],
        [
            ["text / textarea", "string", "maxLength (text only), placeholder, rows (textarea)"],
            ["number", "number | \"\"", "min / max / step / unit"],
            ["date / time / datetime", "string", "defaultToday stamps the value at creation"],
            ["checkbox", "boolean", ""],
            ["select", "string | string[]", "options[], multiple. allowOther is typed but NOT wired — see Known Gaps"],
            ["pass_fail", "\"pass\"|\"fail\"|\"na\"", "naAllowed toggles the N/A option; labels{} overrides text"],
            ["signature", "{user_id,name,signed_at}", "role: \"filler\" | \"verifier\" (verifier gated to admin/owner)"],
            ["grid", "array of row objects", "columns[] (typed) + rows: dynamic{min,max} | fixed{labels[]}"],
            ["heading / info", "(no value)", "layout-only; info.text is static instructional copy"],
        ],
        col_widths=[95, 105, CONTENT_W - 200], mono_cols=(0,)))
    S.append(Spacer(1, 6))
    S.append(Paragraph(m("settings") + " (per-form, in the same schema object)", h3))
    S.append(data_table(
        ["Setting", "Effect"],
        [
            ["deletable", "false hides Delete Entry in the UI even for admins (default true)"],
            ["allowMultipleDrafts", "false makes New Entry resume the user's existing draft (default true)"],
            ["instanceTitleTemplate", "\"{date} — {supplier_name}\" tokens for the Entries-tab row label"],
            ["requireVerification", "Stored on save. NOT YET consumed anywhere — see Known Gaps"],
        ],
        col_widths=[150, CONTENT_W - 150]))

    # ---------------------------------------------------------------- Lifecycle
    S.append(PageBreak())
    S.append(Paragraph("Entry Lifecycle", h2))
    S.append(data_table(
        ["State / action", "Who", "What happens"],
        [
            ["Create", "Any staff", "New row, status='draft', pins form_number/form_revision"],
            ["Save Draft", "Author only", "No validation — drafts accept partial/invalid data"],
            ["Submit", "Author only", "Zod-validates required fields/columns, then status='submitted', locks for the author"],
            ["Reopen", "Admin / owner", "status back to 'draft'; reopened_at/by recorded (does not re-snapshot the form)"],
            ["Delete", "Admin / owner", "Blocked in UI when settings.deletable === false"],
        ],
        col_widths=[95, 85, CONTENT_W - 180]))
    S.append(callout(
        "<b>Optimistic concurrency:</b> every save/submit does " + m("UPDATE ... WHERE updated_at = &lt;loaded value&gt;") +
        ". Zero rows returned → " + m("StaleResponseError") + " — someone else changed it first. "
        "There is no locking; this is deliberately cheap given low real-world contention on a single form entry."))

    # ---------------------------------------------------------------- Schema drift
    S.append(Paragraph("Schema Drift Resolution", h2))
    S.append(Paragraph(
        "A form's schema can change after entries already exist against it. " +
        m("resolveSchemaForResponse()") + " (" + m("src/lib/formResponses.ts") + ") decides what to "
        "render for a given entry:", body))
    S.append(code_block(
        "1. entry.form_revision is empty OR equals the doc's current revision\n"
        "     -> render the LIVE schema (source: \"live\")\n"
        "2. else: newest sop_document_history row where revision == entry.form_revision\n"
        "     AND its snapshot.content.form_schema exists\n"
        "     -> render that SNAPSHOT schema (source: \"snapshot\")\n"
        "3. else: fall back to the LIVE schema, flagged (source: \"fallback\")\n"
        "     -> amber banner: answers may not line up with the fields shown"
    ))
    S.append(Paragraph(
        "The renderer is <b>fieldId-tolerant</b> in all three cases: any recorded answer whose key no "
        "longer matches a field is shown (never dropped) in a collapsed “Unmapped answers” block "
        "on the entry page. The snapshot trigger only fires for a <b>published</b> document (" +
        m("WHEN (OLD.status = 'active')") + ") and only when a watched field actually changed: " +
        m("revision, sop_number, title, effective_date, approved_by, status") + ", plus " +
        m("content->'form_schema'") + " specifically — <b>not</b> the whole " + m("content") +
        " column, so slide/quiz/attachment edits on training modules never spam this table.", body))

    # ---------------------------------------------------------------- AI extraction
    S.append(Paragraph("AI Schema Extraction", h2))
    S.append(Paragraph(
        "“Generate with AI” (SOPs Library → Form tab, shown when a " + m(".docx") +
        " is attached) runs " + m("mammoth.convertToHtml()") + " <b>client-side</b> on the original "
        "uploaded file — this is deliberate: " + m("sopDocxParser.ts") + "'s block walk "
        "(" + m("p, h1-h4, ul, ol") + ") drops tables, so it cannot see the paper form's grids. The "
        "raw HTML (tables intact) is POSTed to the " + m("generate-form-schema") + " edge function, "
        "which prompts Gemini via the Lovable gateway and server-side sanitizes/whitelists the result "
        "(unknown field/column types dropped with a warning, ids slugified and de-duplicated, empty "
        "sections/grids removed). The response is loaded into " + m("FormSchemaBuilder") +
        " as an <b>unsaved proposal</b> — nothing persists until an admin reviews it and clicks "
        "Save Form.", body))
    S.append(Paragraph(
        "A " + m("pdf_images") + " input shape (scanned pages as vision content parts, same pattern as "
        "the existing " + m("generate-narration") + " function) is defined in the edge function's "
        "contract but has <b>no client trigger yet</b> — the UI only ever sends the "
        + m("html") + " path today. Wiring a PDF source through CloudConvert (as " +
        m("convert-pptx") + " already does for slides) is the natural next step.", body))

    # ---------------------------------------------------------------- Key files
    S.append(PageBreak())
    S.append(Paragraph("Key Files (Cheat Sheet)", h2))
    S.append(data_table(
        ["File", "Purpose"],
        [
            ["src/lib/formSchema.ts", "Types, buildZodSchema, emptyValues, flattenForReport, instanceTitle, slugifyFieldId"],
            ["src/lib/formResponses.ts", "All Supabase access for responses/history; resolveSchemaForResponse"],
            ["src/lib/formPdf.ts", "generateFormResponsePdf, generateFormReportPdf (reuses sopPdf.ts logo/footer)"],
            ["components/team/forms/FormRenderer.tsx", "Schema -> RHF-driven form; dispatches to field components"],
            ["components/team/forms/FormFieldInput.tsx", "Scalar field dispatcher; also exports PassFailInput"],
            ["components/team/forms/GridFieldInput.tsx", "The table/grid field — useFieldArray dynamic rows"],
            ["components/team/forms/SignatureFieldInput.tsx", "Typed acknowledgment stamp (user id + timestamp)"],
            ["components/team/forms/FormSchemaBuilder.tsx", "Admin authoring UI, live Preview, Save Form"],
            ["components/team/forms/FormEntriesTab.tsx", "Drawer “Entries” tab — list + New Entry"],
            ["pages/team/compliance/FormEntry.tsx", "/team/compliance/forms/:docId/entries/:responseId"],
            ["pages/team/compliance/Records.tsx", "/team/compliance/records — cross-form + per-form report"],
            ["pages/team/compliance/SopsLibrary.tsx", "Form/Entries drawer tabs, “Fillable” pill, Generate-AI wiring"],
            ["supabase/functions/generate-form-schema/", "Edge function: docx HTML → proposed schema"],
            ["supabase/migrations/20260709000001_...sql", "sop_document_responses, sop_document_history, trigger, RLS"],
        ],
        col_widths=[195, CONTENT_W - 195], mono_cols=(0,)))

    # ---------------------------------------------------------------- Security
    S.append(Paragraph("Security / RLS Cheat Sheet", h2))
    S.append(data_table(
        ["Table", "Action", "Who"],
        [
            ["sop_document_responses", "SELECT", "any staff (is_staff_or_admin) — shared compliance records"],
            ["sop_document_responses", "INSERT", "staff, created_by = auth.uid()"],
            ["sop_document_responses", "UPDATE (own)", "author, only while status = 'draft'"],
            ["sop_document_responses", "UPDATE (any) / DELETE", "has_role('admin') OR is_owner()"],
            ["sop_document_history", "SELECT", "any staff"],
            ["sop_document_history", "INSERT/UPDATE/DELETE", "nobody — SECURITY DEFINER trigger only"],
        ],
        col_widths=[145, 95, CONTENT_W - 240]))
    S.append(callout(
        "<b>" + m("has_role(uid,'admin')") + " does not include owner.</b> Every admin-gated policy in "
        "this migration uses " + m("has_role(auth.uid(),'admin') OR is_owner(auth.uid())") +
        " — the same pattern established in migration " + m("20260623000001") + " after an owner "
        "account was silently blocked by an admin-only policy. Reuse this pattern for any new "
        "admin-gated table; do not gate on " + m("has_role('admin')") + " alone."))

    # ---------------------------------------------------------------- Known gaps
    S.append(Paragraph("Known Gaps &amp; Deferred Work", h2))
    S.extend(bullets([
        m("SelectField.allowOther") + " is a typed schema field with <b>no renderer or builder support</b> "
        "— setting it currently has zero effect. Either implement it or remove it.",
        m("FormSettings.requireVerification") + " is saved by the builder but <b>nothing reads it</b> "
        "— it does not currently surface or require the verifier signature specially.",
        "AI extraction is <b>.docx only</b> in the UI today. The edge function accepts a " +
        m("pdf_images") + " shape for scanned forms, but no client path calls it yet.",
        "Report PDF export clamps to the first 10 flattened columns (“see CSV for full detail”) "
        "— wide forms need the CSV export for complete data.",
        "Computed fields, conditional field visibility, and photo/file-upload answers were deliberately "
        "scoped out of v1 (see the original plan) — not bugs, just not built yet.",
        "Reopening a submitted entry does <b>not</b> migrate it to the live schema — it keeps "
        "rendering its originally pinned revision, drift banner and all.",
        "Four migration files dated " + m("20260629*") + " (" + m("fix_prf_upsert_sales_lead_blank_fields") +
        ", " + m("client_documents_lead_id") + ", " + m("reassign_morini_pss") + ", " +
        m("prf_upsert_sets_lead_id") + ") are committed as <b>empty placeholders</b> — those "
        "changes were applied directly to production before this system existed and their original "
        "SQL was never captured locally. They exist only so the CLI's migration history reconciles; "
        "do not assume they contain real DDL.",
    ]))

    # ---------------------------------------------------------------- Onboarding quick ref
    S.append(Paragraph("If You Need To… (Quick Reference)", h2))
    S.append(data_table(
        ["If you need to…", "Start here"],
        [
            ["Add a new field type", "FormFieldType union in formSchema.ts, then the dispatcher in FormFieldInput.tsx / builder UI in FormSchemaBuilder.tsx"],
            ["Change submit-time validation", "buildZodSchema() / gridZod() in formSchema.ts"],
            ["Change what counts as a schema-changing edit", "The watched-field list in snapshot_sop_document() (the migration SQL)"],
            ["Add a report column or change flattening", "flattenForReport() in formSchema.ts"],
            ["Debug an old entry rendering wrong", "resolveSchemaForResponse() + query sop_document_history for that document_id"],
            ["Change the AI extraction prompt", "SYSTEM_PROMPT in supabase/functions/generate-form-schema/index.ts"],
            ["Add a PDF-sourced schema path", "Wire pdf_images (CloudConvert, like convert-pptx) into the Generate-AI button in SopsLibrary.tsx"],
        ],
        col_widths=[175, CONTENT_W - 175]))

    doc.build(S, canvasmaker=NumberedCanvas)


# ---- {nb} total-page support (identical to the numbering guide) --------------
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
    out = sys.argv[1] if len(sys.argv) > 1 else "dynamic_forms_technical_guide.pdf"
    build(out)
    print("wrote", out)
