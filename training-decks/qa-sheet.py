#!/usr/bin/env python
"""Build a single contact-sheet PNG from a rendered deck PDF.

One image instead of twelve = far fewer tokens when QA'ing a deck visually.
Usage:  python qa-sheet.py qa/module-11.en.design.pdf [out.png]
Default output: qa/<pdfstem>.sheet.png  (4 columns, slide number labels)
"""
import sys, os, fitz
from PIL import Image, ImageDraw

def build(pdf_path, out_path=None, cols=4, thumb_w=540, pad=12, label_h=22):
    doc = fitz.open(pdf_path)
    n = len(doc)
    rows = (n + cols - 1) // cols
    # render first page to get aspect ratio
    p0 = doc[0]
    ar = p0.rect.height / p0.rect.width
    thumb_h = int(thumb_w * ar)
    cell_w = thumb_w + pad
    cell_h = thumb_h + label_h + pad
    sheet = Image.new("RGB", (cols * cell_w + pad, rows * cell_h + pad), (32, 26, 18))
    draw = ImageDraw.Draw(sheet)
    for i in range(n):
        page = doc[i]
        zoom = thumb_w / page.rect.width
        pix = page.get_pixmap(matrix=fitz.Matrix(zoom, zoom))
        img = Image.frombytes("RGB", (pix.width, pix.height), pix.samples)
        if img.width != thumb_w:
            img = img.resize((thumb_w, int(thumb_w * img.height / img.width)))
        r, c = divmod(i, cols)
        x = pad + c * cell_w
        y = pad + r * cell_h
        draw.text((x + 2, y), f"slide {i+1}", fill=(230, 200, 120))
        sheet.paste(img, (x, y + label_h))
    if out_path is None:
        stem = os.path.splitext(os.path.basename(pdf_path))[0]
        out_path = os.path.join(os.path.dirname(pdf_path), stem + ".sheet.png")
    sheet.save(out_path)
    print(f"sheet: {out_path}  ({n} slides, {sheet.width}x{sheet.height})")

if __name__ == "__main__":
    if len(sys.argv) < 2:
        sys.exit("usage: python qa-sheet.py <deck.pdf> [out.png]")
    build(sys.argv[1], sys.argv[2] if len(sys.argv) > 2 else None)
