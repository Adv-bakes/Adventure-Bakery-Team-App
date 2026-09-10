# -*- coding: utf-8 -*-
"""Render a repo markdown document to PDF.

    python scripts/md-to-pdf.py VERIFICATION_NOTIFICATIONS.md [out.pdf]

Written for the runbooks - VERIFICATION_NOTIFICATIONS.md, FORM_REPORTS.md, DOCUMENT_REGISTER.md -
which are read on screen but occasionally need to leave the machine: handed to a contractor, taken
to an audit, printed for somebody debugging at 6am without the repo checked out.

SUPPORTS the subset those documents actually use: ATX headings, paragraphs, bullet and numbered
lists, GFM pipe tables, fenced code blocks, blockquotes, horizontal rules, and inline **bold**,
*italic*, `code` and [links](url). It is not a markdown implementation and does not try to be -
anything it does not recognise is rendered as plain text rather than dropped, so an unsupported
construct degrades to something readable instead of vanishing.

FONTS. Arial for the body rather than core Helvetica, for the reason scripts/generate-form-blank.py
records: core Helvetica has no em-dash or arrow glyph, and these documents are full of both, so they
render as missing-glyph boxes. Consolas for code, which also carries the box-drawing characters the
architecture diagram is made of. Segoe UI Symbol is registered as a fallback.

AND IT CHECKS. Every character is tested against the font that will draw it before rendering, and
anything missing is reported and substituted. A missing glyph in reportlab is a silent black box -
the failure is in the font, not the source text, which is exactly why it is worth catching here
rather than discovering on the printed page.
"""
import io, os, re, sys

sys.stdout.reconfigure(encoding="utf-8", errors="replace")

from reportlab.lib import colors
from reportlab.lib.pagesizes import letter
from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
from reportlab.lib.units import inch
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.pdfmetrics import registerFontFamily
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.platypus import (CondPageBreak, HRFlowable, KeepTogether, ListFlowable,
                                ListItem, PageBreak, Paragraph, SimpleDocTemplate, Spacer,
                                Table, TableStyle)

# Warm bakery palette, matching lib/sopPdf.ts and generate-form-blank.py.
GOLD = colors.HexColor("#8a6a1f")        # darker than --tp-gold: this is ink on white paper
BROWN = colors.HexColor("#2A1F0E")
GREY = colors.HexColor("#5a5a5a")
RULE = colors.HexColor("#d8d0bd")
CODEBG = colors.HexColor("#f5f1e6")
QUOTEBG = colors.HexColor("#fbf7ec")

F = "C:/Windows/Fonts/"
for name, file in (("Body", "arial.ttf"), ("Body-Bold", "arialbd.ttf"),
                   ("Body-Italic", "ariali.ttf"), ("Body-BoldItalic", "arialbi.ttf"),
                   ("Mono", "consola.ttf"), ("Mono-Bold", "consolab.ttf"),
                   ("Sym", "seguisym.ttf")):
    pdfmetrics.registerFont(TTFont(name, F + file))
registerFontFamily("Body", normal="Body", bold="Body-Bold",
                   italic="Body-Italic", boldItalic="Body-BoldItalic")
registerFontFamily("Mono", normal="Mono", bold="Mono-Bold", italic="Mono", boldItalic="Mono-Bold")


def missing_glyphs(text, font):
    """Characters the font cannot draw. reportlab renders these as a black box, silently."""
    face = pdfmetrics.getFont(font).face
    table = getattr(face, "charToGlyph", None)
    if not table:
        return set()
    return {c for c in set(text)
            if ord(c) > 127 and c not in ("\n", "\t") and ord(c) not in table}


# ───────────────────────────────────────────────────────────── inline markup

def esc(s):
    return s.replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;")


def inline(s):
    """Markdown inline -> reportlab intra-paragraph markup. Escapes first, always."""
    out = esc(s)
    # Code before emphasis: `**not bold**` inside backticks must stay literal.
    out = re.sub(r"`([^`]+)`",
                 r'<font name="Mono" size="8.5" backColor="#f5f1e6">\1</font>', out)
    out = re.sub(r"\*\*([^*]+)\*\*", r"<b>\1</b>", out)
    out = re.sub(r"(?<![\*\w])\*([^*\n]+)\*(?!\w)", r"<i>\1</i>", out)
    # Links: show the text, and the URL only when it is not already the text.
    def link(m):
        text, href = m.group(1), m.group(2)
        if href.startswith("#") or href == text:
            return text
        return f'<link href="{href}" color="#8a6a1f">{text}</link>'
    out = re.sub(r"\[([^\]]+)\]\(([^)]+)\)", link, out)
    return out


# ───────────────────────────────────────────────────────────── block parsing

def parse(md):
    """markdown text -> a list of (kind, payload) blocks."""
    lines = md.replace("\r\n", "\n").split("\n")
    blocks, i = [], 0
    while i < len(lines):
        ln = lines[i]

        if ln.strip().startswith("```"):
            fence, i = [], i + 1
            while i < len(lines) and not lines[i].strip().startswith("```"):
                fence.append(lines[i]); i += 1
            i += 1
            blocks.append(("code", "\n".join(fence)))
            continue

        m = re.match(r"^(#{1,4})\s+(.*)$", ln)
        if m:
            blocks.append(("h%d" % len(m.group(1)), m.group(2).strip()))
            i += 1
            continue

        if re.match(r"^\s*([-*_])\s*\1\s*\1[\s\-*_]*$", ln):
            blocks.append(("hr", None)); i += 1
            continue

        # GFM table: a header row followed by a --- separator.
        if ln.strip().startswith("|") and i + 1 < len(lines) and \
           re.match(r"^\s*\|[\s:|-]+\|\s*$", lines[i + 1]):
            rows = []
            while i < len(lines) and lines[i].strip().startswith("|"):
                cells = [c.strip() for c in lines[i].strip().strip("|").split("|")]
                if not re.match(r"^[\s:|-]+$", "|".join(cells)):
                    rows.append(cells)
                i += 1
            blocks.append(("table", rows))
            continue

        if ln.startswith(">"):
            quote = []
            while i < len(lines) and (lines[i].startswith(">") or
                                      (quote and lines[i].strip() and not lines[i].startswith("#"))):
                quote.append(re.sub(r"^>\s?", "", lines[i])); i += 1
            blocks.append(("quote", " ".join(x.strip() for x in quote if x.strip())))
            continue

        m = re.match(r"^\s*([-*+]|\d+\.)\s+(.*)$", ln)
        if m:
            ordered = bool(re.match(r"^\d+\.$", m.group(1)))
            items = []
            while i < len(lines):
                mm = re.match(r"^\s*([-*+]|\d+\.)\s+(.*)$", lines[i])
                if mm:
                    items.append(mm.group(2).strip()); i += 1
                elif lines[i].strip() and lines[i].startswith(("  ", "\t")) and items:
                    items[-1] += " " + lines[i].strip(); i += 1   # continuation
                else:
                    break
            blocks.append(("ol" if ordered else "ul", items))
            continue

        if not ln.strip():
            i += 1
            continue

        para = []
        while i < len(lines) and lines[i].strip() and not lines[i].startswith(("#", ">", "|", "```")) \
                and not re.match(r"^\s*([-*+]|\d+\.)\s+", lines[i]) \
                and not re.match(r"^\s*([-*_])\s*\1\s*\1[\s\-*_]*$", lines[i]):
            para.append(lines[i].strip()); i += 1
        if para:
            blocks.append(("p", " ".join(para)))
    return blocks


# ───────────────────────────────────────────────────────────── rendering

def build(md, out_path, title):
    st = getSampleStyleSheet()
    body = ParagraphStyle("body", parent=st["Normal"], fontName="Body", fontSize=9.5,
                          leading=13.5, textColor=BROWN, spaceAfter=5)
    h1 = ParagraphStyle("h1", parent=body, fontName="Body-Bold", fontSize=19, leading=23,
                        textColor=BROWN, spaceBefore=2, spaceAfter=8)
    h2 = ParagraphStyle("h2", parent=body, fontName="Body-Bold", fontSize=13.5, leading=17,
                        textColor=GOLD, spaceBefore=16, spaceAfter=5)
    h3 = ParagraphStyle("h3", parent=body, fontName="Body-Bold", fontSize=11, leading=14,
                        textColor=BROWN, spaceBefore=11, spaceAfter=3)
    h4 = ParagraphStyle("h4", parent=body, fontName="Body-Bold", fontSize=9.5, leading=13,
                        textColor=GREY, spaceBefore=8, spaceAfter=2)
    code = ParagraphStyle("code", parent=body, fontName="Mono", fontSize=8,
                          leading=10.5, textColor=BROWN, spaceAfter=0)
    quote = ParagraphStyle("quote", parent=body, fontName="Body", fontSize=9.5, leading=13.5,
                           leftIndent=8, textColor=BROWN)
    cell = ParagraphStyle("cell", parent=body, fontSize=8.5, leading=11.5, spaceAfter=0)
    cellh = ParagraphStyle("cellh", parent=cell, fontName="Body-Bold", textColor=colors.white)

    PAGE_W = letter[0] - 1.3 * inch
    flow = []

    for kind, payload in parse(md):
        if kind == "h1":
            flow.append(Paragraph(inline(payload), h1))
            flow.append(HRFlowable(width="100%", thickness=1.4, color=GOLD,
                                   spaceBefore=1, spaceAfter=9))
        elif kind in ("h2", "h3", "h4"):
            style = {"h2": h2, "h3": h3, "h4": h4}[kind]
            # A heading must never be the last thing on a page.
            flow.append(CondPageBreak(1.0 * inch))
            flow.append(Paragraph(inline(payload), style))
        elif kind == "p":
            flow.append(Paragraph(inline(payload), body))
        elif kind == "hr":
            flow.append(HRFlowable(width="100%", thickness=0.5, color=RULE,
                                   spaceBefore=7, spaceAfter=9))
        elif kind in ("ul", "ol"):
            # `value` numbers an ordered list; on a bullet list it becomes the bullet itself,
            # and an int there breaks stringWidth deep inside reportlab.
            items = [ListItem(Paragraph(inline(t), body), leftIndent=14,
                              **({"value": n + 1} if kind == "ol" else {}))
                     for n, t in enumerate(payload)]
            flow.append(ListFlowable(items, bulletType="1" if kind == "ol" else "bullet",
                                     bulletFontName="Body", bulletFontSize=8,
                                     leftIndent=16, bulletOffsetY=0.5, spaceAfter=6))
        elif kind == "quote":
            t = Table([[Paragraph(inline(payload), quote)]], colWidths=[PAGE_W])
            t.setStyle(TableStyle([
                ("BACKGROUND", (0, 0), (-1, -1), QUOTEBG),
                ("LINEBEFORE", (0, 0), (0, -1), 2.5, GOLD),
                ("LEFTPADDING", (0, 0), (-1, -1), 9), ("RIGHTPADDING", (0, 0), (-1, -1), 9),
                ("TOPPADDING", (0, 0), (-1, -1), 7), ("BOTTOMPADDING", (0, 0), (-1, -1), 7),
            ]))
            flow.extend([t, Spacer(1, 8)])
        elif kind == "code":
            # Pre-formatted: escape, keep every space, and let it clip rather than rewrap -
            # rewrapping the architecture diagram would destroy it.
            lines = [Paragraph(esc(l).replace(" ", "&nbsp;") or "&nbsp;", code)
                     for l in payload.split("\n")]
            t = Table([[l] for l in lines], colWidths=[PAGE_W])
            t.setStyle(TableStyle([
                ("BACKGROUND", (0, 0), (-1, -1), CODEBG),
                ("BOX", (0, 0), (-1, -1), 0.5, RULE),
                ("LEFTPADDING", (0, 0), (-1, -1), 8), ("RIGHTPADDING", (0, 0), (-1, -1), 8),
                ("TOPPADDING", (0, 0), (-1, -1), 0.5), ("BOTTOMPADDING", (0, 0), (-1, -1), 0.5),
                ("TOPPADDING", (0, 0), (-1, 0), 6), ("BOTTOMPADDING", (0, -1), (-1, -1), 6),
            ]))
            flow.extend([t, Spacer(1, 9)])
        elif kind == "table":
            rows = payload
            ncol = max(len(r) for r in rows)
            rows = [r + [""] * (ncol - len(r)) for r in rows]
            # Width by content weight, floored so a narrow column stays writable.
            weight = [max(1, max(len(r[c]) for r in rows)) for c in range(ncol)]
            total = sum(weight)
            widths = [max(0.7 * inch, PAGE_W * w / total) for w in weight]
            scale = PAGE_W / sum(widths)
            widths = [w * scale for w in widths]
            data = [[Paragraph(inline(c), cellh if i == 0 else cell) for c in r]
                    for i, r in enumerate(rows)]
            t = Table(data, colWidths=widths, repeatRows=1)
            t.setStyle(TableStyle([
                ("BACKGROUND", (0, 0), (-1, 0), GOLD),
                ("ROWBACKGROUNDS", (0, 1), (-1, -1), [colors.white, CODEBG]),
                ("GRID", (0, 0), (-1, -1), 0.4, RULE),
                ("VALIGN", (0, 0), (-1, -1), "TOP"),
                ("LEFTPADDING", (0, 0), (-1, -1), 6), ("RIGHTPADDING", (0, 0), (-1, -1), 6),
                ("TOPPADDING", (0, 0), (-1, -1), 4), ("BOTTOMPADDING", (0, 0), (-1, -1), 4),
            ]))
            flow.extend([t, Spacer(1, 9)])

    def furniture(canvas, doc):
        canvas.saveState()
        canvas.setFont("Body", 7.5)
        canvas.setFillColor(GREY)
        canvas.drawString(0.65 * inch, 0.45 * inch,
                          "Adventure Bakery, LLC · Internal technical documentation")
        canvas.drawRightString(letter[0] - 0.65 * inch, 0.45 * inch, "Page %d" % doc.page)
        canvas.setStrokeColor(RULE); canvas.setLineWidth(0.4)
        canvas.line(0.65 * inch, 0.62 * inch, letter[0] - 0.65 * inch, 0.62 * inch)
        canvas.restoreState()

    doc = SimpleDocTemplate(out_path, pagesize=letter,
                            leftMargin=0.65 * inch, rightMargin=0.65 * inch,
                            topMargin=0.6 * inch, bottomMargin=0.8 * inch,
                            title=title, author="Adventure Bakery, LLC")
    doc.build(flow, onFirstPage=furniture, onLaterPages=furniture)


def main():
    if len(sys.argv) < 2:
        raise SystemExit(__doc__)
    src = sys.argv[1]
    out = sys.argv[2] if len(sys.argv) > 2 else os.path.splitext(src)[0] + ".pdf"
    md = io.open(src, encoding="utf-8", newline="").read()

    # Glyph check before rendering, not after. Code blocks are drawn in Mono, everything else
    # in the Arial family; a character missing from the font it will actually be drawn in is a
    # silent black box on the page.
    code_text = "\n".join(p for k, p in parse(md) if k == "code")
    rest = "\n".join(str(p) for k, p in parse(md) if k != "code" and p)
    problems = {}
    for text, font in ((code_text, "Mono"), (rest, "Body")):
        miss = missing_glyphs(text, font)
        if miss:
            problems[font] = miss
    if problems:
        for font, chars in problems.items():
            print("  WARNING  %s cannot draw: %s" % (
                font, " ".join("%r (U+%04X)" % (c, ord(c)) for c in sorted(chars))))
        print("  These would render as black boxes. Substitute them in the source, or register a"
              " font that carries them.")

    title = next((p for k, p in parse(md) if k == "h1"), os.path.basename(src))
    build(md, out, title)
    print("wrote %s (%.0f KB)" % (out, os.path.getsize(out) / 1024))


if __name__ == "__main__":
    main()
