#!/usr/bin/env python3
"""
Generate the "Document Numbering & Creation Guide" reference PDF.

Style mirrors yolink_operations_guide.pdf (navy header bar, slate body, shaded
code/reference blocks, per-page confidential footer). Content is the controlled-document
numbering convention implemented in src/lib/docNumber.ts + DOCUMENT_REGISTER.md.

Usage:  python scripts/generate-document-numbering-guide.py [output.pdf]
Default output: ./document_numbering_guide.pdf
"""
import sys
from reportlab.lib.pagesizes import letter
from reportlab.lib.units import inch
from reportlab.lib import colors
from reportlab.lib.styles import ParagraphStyle
from reportlab.lib.enums import TA_LEFT
from reportlab.platypus import (
    BaseDocTemplate, PageTemplate, Frame, Paragraph, Spacer, Table, TableStyle,
    Preformatted, NextPageTemplate,
)

# ---- palette (sampled from yolink_operations_guide.pdf) -----------------------
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

PAGE_W, PAGE_H = letter
LMARGIN = 54
CONTENT_W = PAGE_W - 2 * LMARGIN

# ---- paragraph styles --------------------------------------------------------
body = ParagraphStyle("body", fontName="Helvetica", fontSize=9.4, leading=13.2,
                      textColor=BODY, spaceAfter=6, alignment=TA_LEFT)
h2 = ParagraphStyle("h2", fontName="Helvetica-Bold", fontSize=13, leading=16,
                    textColor=HEADING, spaceBefore=14, spaceAfter=6)
small = ParagraphStyle("small", parent=body, fontSize=8.6, leading=12, spaceAfter=3)
cell = ParagraphStyle("cell", fontName="Helvetica", fontSize=8.6, leading=11.5, textColor=BODY)
cell_b = ParagraphStyle("cell_b", parent=cell, fontName="Helvetica-Bold", textColor=LABEL)
cell_hdr = ParagraphStyle("cell_hdr", fontName="Helvetica-Bold", fontSize=9, leading=11,
                          textColor=colors.white)
mono = ParagraphStyle("mono", fontName="Courier", fontSize=8.1, leading=11, textColor=BODY)

TITLE = "Document Numbering & Creation Guide"
SUBTITLE_TEXT = "C O N T R O L L E D   D O C U M E N T   R E F E R E N C E"


def m(text):
    """Wrap inline monospace."""
    return f'<font face="Courier">{text}</font>'


# ---- header bar (first page) + footer (every page) ---------------------------
def draw_header(c):
    c.saveState()
    c.setFillColor(NAVY)
    c.rect(0, PAGE_H - 66, PAGE_W, 66, stroke=0, fill=1)
    c.setFillColor(colors.white)
    c.setFont("Helvetica-Bold", 20)
    c.drawString(LMARGIN, PAGE_H - 38, TITLE)
    c.setFillColor(SUBTITLE)
    c.setFont("Helvetica-Bold", 10.5)
    c.drawString(LMARGIN, PAGE_H - 54, SUBTITLE_TEXT)
    # thin gold accent under the bar
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
    # right-aligned "Page N of M" is drawn by NumberedCanvas (needs the total page count)
    c.restoreState()


def on_first(c, doc):
    draw_header(c)
    draw_footer(c, doc)


def on_later(c, doc):
    draw_footer(c, doc)


# ---- reusable flowable builders ----------------------------------------------
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
        ("BACKGROUND", (0, 0), (-1, -1), colors.Color(0.984, 0.965, 0.914)),  # #FBF6E9
        ("LINEBEFORE", (0, 0), (0, -1), 3, ACCENT),
        ("BOX", (0, 0), (-1, -1), 0.5, HAIRLINE),
        ("LEFTPADDING", (0, 0), (-1, -1), 10),
        ("RIGHTPADDING", (0, 0), (-1, -1), 10),
        ("TOPPADDING", (0, 0), (-1, -1), 7),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 7),
    ]))
    return t


# ---- document content --------------------------------------------------------
def build(out_path):
    doc = BaseDocTemplate(
        out_path, pagesize=letter,
        leftMargin=LMARGIN, rightMargin=LMARGIN, topMargin=84, bottomMargin=52,
        title="Document Numbering & Creation Guide", author="Adventure Bakery",
    )
    frame_first = Frame(LMARGIN, 48, CONTENT_W, PAGE_H - 84 - 48, id="first")
    frame_later = Frame(LMARGIN, 48, CONTENT_W, PAGE_H - 54 - 48, id="later")
    doc.addPageTemplates([
        PageTemplate(id="first", frames=[frame_first], onPage=on_first),
        PageTemplate(id="later", frames=[frame_later], onPage=on_later),
    ])

    S = [NextPageTemplate("later")]  # page 1 uses "first" (header bar); page 2+ use "later"
    S.append(meta_table([
        ("Facility:", "Adventure Bakery"),
        ("Applies to:", "SOPs, Forms (FRM), Manuals (FSQM), and Policies (POL)"),
        ("Document owner:", "Quality / SQF Practitioner"),
        ("Governing reference:", "SQF Code Ed. 9 — 2.2 Document Control; 2.2.3 Document Register"),
        ("System reference:", "Team Portal → Compliance → Document Register"),
    ]))
    S.append(Spacer(1, 4))

    S.append(Paragraph("Purpose", h2))
    S.append(Paragraph(
        "This guide defines how every controlled document at Adventure Bakery is identified and "
        "numbered. It exists so that anyone creating a new form, SOP, manual section, or policy "
        "assigns a number that is <b>meaningful, unique, and stable</b> — and so an auditor "
        "can trace any record back to a controlled document. Read this before creating a new "
        "document number.", body))

    S.append(Paragraph("Why the old scheme was replaced", h2))
    S.append(Paragraph(
        "The prior identifiers (for example " + m("FRM-046-1") + ") combined two unrelated things "
        "into one label: an arbitrary sequence number that carried no meaning, and a trailing "
        "revision digit. Baking the revision into the identifier means the number <b>changes when "
        "only the content changes</b>, which breaks traceability. Numbers were also frequently "
        "stored inside the document title rather than a dedicated field, and the same number "
        "(for example " + m("FRM002") + ") was reused on more than one form. The convention below "
        "fixes all three problems.", body))

    S.append(Paragraph("The rule", h2))
    S.append(Paragraph(
        "Every controlled document number takes the form " + m("&lt;TYPE&gt;-&lt;NNN&gt;") + ":", body))
    S.append(data_table(
        ["Prefix", "Type", "Used for"],
        [
            ["SOP", "Procedure", "Standard Operating Procedure"],
            ["FRM", "Form", "Form, log, or record template"],
            ["FSQM", "Manual", "Food Safety Quality Manual section"],
            ["POL", "Policy", "Policy statement"],
        ],
        col_widths=[70, 90, CONTENT_W - 160], mono_cols=(0,)))
    S.append(Spacer(1, 6))
    S.append(Paragraph(
        "<b>NNN</b> is a three-digit number whose <b>hundreds block marks the process stage</b> the "
        "document belongs to — low numbers early in the flow, high numbers late. Within a block "
        "you simply take the next free number (301, 302, 303 …). A form and its parent SOP "
        "share a block, so " + m("SOP-301") + " (receiving procedure) pairs with " + m("FRM-301") +
        " (receiving log).", body))

    S.append(Paragraph("Process-stage blocks", h2))
    S.append(data_table(
        ["Block", "Process stage", "Typical documents"],
        [
            ["000–099", "Food Safety System", "HACCP, recall, complaints, audits, CAPA"],
            ["100–199", "Sales / New Product Development", "PRF, product brief, approval record"],
            ["200–299", "Sourcing & Supplier Approval", "Approved supplier list, questionnaires"],
            ["300–399", "Receiving & Incoming Inspection", "Incoming material receiving log"],
            ["400–499", "Storage & Inventory", "Warehouse, tolling inventory, FIFO"],
            ["500–599", "Production & Batching", "Batch weigh-up, in-process checks"],
            ["600–699", "Packaging & Labeling", "Label verification, packaging inspection"],
            ["700–799", "QC / Testing / Hold & Release", "Finished-goods hold, positive release"],
            ["800–899", "Shipping / Distribution / Traceability", "Load-out check, mock recall"],
            ["900–949", "Sanitation & GMP", "Sanitation verification, pest, glass register"],
            ["950–999", "HR / Training / Admin / Records", "Training matrix, sign-in, competency"],
        ],
        col_widths=[64, 190, CONTENT_W - 254], mono_cols=(0,)))

    S.append(Paragraph("Three rules that never change", h2))
    for txt in [
        "<b>The identifier is stable for the life of the document.</b> " + m("FRM-301") +
        " stays " + m("FRM-301") + " at revision 1, 2, 3…",
        "<b>The revision lives in its own field</b> (Revision), never inside the number or the title.",
        "<b>The number lives in the SOP / Form Number field</b>, not baked into the title. Titles "
        "describe the document; numbers identify it.",
    ]:
        S.append(Paragraph("•&nbsp;&nbsp;" + txt, body))

    S.append(Paragraph("Assigning the next number", h2))
    for i, txt in enumerate([
        "Decide the stage from what the document <b>does in the process</b> — not who owns it. "
        "A receiving log is a 300, wherever the person filling it sits.",
        "Open the <b>Document Register</b> (Compliance → Document Register). It groups documents "
        "by stage, so gaps in a block are visible at a glance.",
        "Take the next free number in that block and enter it as " + m("TYPE-NNN") +
        " in the SOP / Form Number field. The field shows the derived stage and warns if the "
        "format strays.",
        "Put the revision in the <b>Revision</b> field — never in the number.",
    ], start=1):
        S.append(Paragraph(f"<b>{i}.</b>&nbsp;&nbsp;{txt}", body))

    S.append(callout(
        "<b>SQF cross-reference is separate.</b> Do not put an SQF clause number in the document "
        "identifier (SQF renumbers clauses between code editions, which would churn your numbers). "
        "Record the clauses a document satisfies in the <b>SQF Reference</b> field instead — they "
        "render as clickable clause chips in the app."))

    S.append(Paragraph("The one exception: SOPs", h2))
    S.append(Paragraph(
        "Standard Operating Procedures deliberately use a <b>second scheme</b>: the number is the "
        "SQF clause the procedure implements — " + m("SOP-2.3.1") + " (New Product & "
        "Specification), " + m("SOP-11.7.5") + " (Glass & Brittle Plastic). This is kept on purpose "
        "so an auditor can jump from a clause straight to the SOP that satisfies it. The app "
        "recognizes clause-style SOP numbers (no format warning) and lists them under "
        "“SOPs (numbered by SQF clause)” in the register. <b>Forms, manuals, and policies "
        "use the stage-block scheme above; only SOPs use clause numbers.</b>", body))

    S.append(Paragraph("Quick reference", h2))
    S.append(data_table(
        ["If you are creating…", "Number it…"],
        [
            ["A new form or log", "FRM-&lt;stage block&gt; (e.g. a receiving log → FRM-3xx)"],
            ["A new SOP", "SOP-&lt;SQF clause&gt; it implements (e.g. SOP-2.3.1)"],
            ["A manual section", "FSQM-&lt;section&gt; (keep the manual's existing sequence)"],
            ["A policy", "POL-&lt;stage block&gt;"],
            ["A revision of an existing doc", "Keep the number; bump the Revision field only"],
            ["Something that spans stages", "Pick the stage where the record is generated"],
        ],
        col_widths=[190, CONTENT_W - 190]))

    S.append(Paragraph("Legacy numbers", h2))
    S.append(Paragraph(
        "When an older document is renumbered to this convention, its previous identifier is kept "
        "in the " + m("legacy_sop_number") + " field so it stays findable by its old number. Until a "
        "document has been given a clean " + m("TYPE-NNN") + " (or, for SOPs, a clause) number, it "
        "appears under <b>“Unassigned”</b> in the Document Register — that group is the "
        "worklist of documents still to be numbered.", body))

    doc.build(S, canvasmaker=NumberedCanvas)


# ---- {nb} total-page support -------------------------------------------------
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
        # overwrite the "{nb}" placeholder area with the real total
        self.drawRightString(PAGE_W - LMARGIN, 30, f"Page {self._pageNumber} of {total}")


if __name__ == "__main__":
    out = sys.argv[1] if len(sys.argv) > 1 else "document_numbering_guide.pdf"
    build(out)
    print("wrote", out)
