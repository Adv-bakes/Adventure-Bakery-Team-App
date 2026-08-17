// Reads a returned client document (NDA / PSS) into the two things the AI reviewer can actually
// use: text when the file has recoverable text, and page images when it does not.
//
// Why this exists: `review-client-document` used to recover PDF text by scraping printable ASCII
// out of the raw bytes, and handled .docx by UTF-8-decoding a ZIP archive. Neither can work. PDF
// text lives inside FlateDecode-compressed content streams and a .docx is a zip of XML parts, so
// both produced binary noise and the model reported "raw PDF data, not readable text".
//
// The harder half is that a signed NDA is very often a phone photo or scan of the paper original:
// a single full-page image per page and no font resources at all. Perfect text extraction returns
// an empty string for those, and the reviewer answered "no signature found" about documents that
// were plainly signed -- a false statement about a legal record, which is worse than no answer.
// Those pages have to go to the vision model as images.
//
// This runs in the browser rather than in the edge function because rendering a PDF page needs a
// canvas, and because this repo already depends on pdfjs-dist (prfPdfImport.ts) and mammoth
// (sopDocxParser.ts) on the client.

export type DocReadKind = "pdf" | "docx" | "unsupported";

export type DocRead = {
  kind: DocReadKind;
  /** Recovered text (HTML for .docx, so tables survive). Empty when the document is a scan. */
  text: string;
  /** JPEG data URLs, populated only when a PDF has no usable text layer. */
  pageImages: string[];
  pageCount: number;
  /** True when there was no usable text layer and the pages had to be rasterized. */
  scanned: boolean;
  /** Pages beyond MAX_IMAGE_PAGES that were not rasterized, so callers can say so out loud. */
  droppedPages: number;
};

/**
 * Below this many characters across the whole document, treat a PDF as a scan. A real NDA runs to
 * thousands of characters; a scan yields 0. The gap is wide enough that the threshold is not
 * delicate -- it only has to sit above the stray ligature or watermark a scan sometimes carries.
 */
const TEXT_LAYER_MIN_CHARS = 200;
/** Long edge, in px, of the images handed to the vision model. Legible for signatures, small enough to post. */
const IMAGE_MAX_EDGE = 1800;
/** Cap on rasterized pages so a long attachment cannot blow up the request body. */
const MAX_IMAGE_PAGES = 8;
const JPEG_QUALITY = 0.85;

/** Thrown for files nothing here can read, so the caller can say why rather than send garbage. */
export class UnreadableDocumentError extends Error {}

let workerConfigured = false;

async function loadPdfjs() {
  const pdfjs: any = await import("pdfjs-dist");
  if (!workerConfigured) {
    pdfjs.GlobalWorkerOptions.workerSrc = new URL(
      "pdfjs-dist/build/pdf.worker.mjs",
      import.meta.url,
    ).toString();
    workerConfigured = true;
  }
  return pdfjs;
}

/** Renders one page to a JPEG data URL, scaled so its long edge is IMAGE_MAX_EDGE. */
async function renderPage(page: any): Promise<string> {
  const base = page.getViewport({ scale: 1 });
  const scale = Math.min(IMAGE_MAX_EDGE / Math.max(base.width, base.height), 2);
  const viewport = page.getViewport({ scale });

  const canvas = document.createElement("canvas");
  canvas.width = viewport.width;
  canvas.height = viewport.height;
  const ctx = canvas.getContext("2d")!;
  // A PDF paints no background and unpainted canvas is transparent black, which encodes to a
  // solid black JPEG. Lay down white first.
  ctx.fillStyle = "#fff";
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  await page.render({ canvasContext: ctx, viewport, canvas }).promise;

  const url = canvas.toDataURL("image/jpeg", JPEG_QUALITY);
  canvas.width = 0; // release the backing store; scans rasterize large
  canvas.height = 0;
  return url;
}

async function readPdf(data: ArrayBuffer): Promise<DocRead> {
  const pdfjs = await loadPdfjs();
  const doc = await pdfjs.getDocument({ data }).promise;
  const pageCount = doc.numPages;

  let text = "";
  for (let pno = 1; pno <= pageCount; pno++) {
    const page = await doc.getPage(pno);
    const content = await page.getTextContent();
    const pageText = (content.items || [])
      .map((i: any) => (typeof i.str === "string" ? i.str : ""))
      .join(" ")
      .replace(/[ \t]+/g, " ")
      .trim();
    if (pageText) text += (text ? "\n\n" : "") + pageText;
  }

  if (text.length >= TEXT_LAYER_MIN_CHARS) {
    return { kind: "pdf", text, pageImages: [], pageCount, scanned: false, droppedPages: 0 };
  }

  // No usable text layer -- rasterize for the vision model.
  const renderCount = Math.min(pageCount, MAX_IMAGE_PAGES);
  const pageImages: string[] = [];
  for (let pno = 1; pno <= renderCount; pno++) {
    pageImages.push(await renderPage(await doc.getPage(pno)));
  }

  return {
    kind: "pdf",
    text: "",
    pageImages,
    pageCount,
    scanned: true,
    droppedPages: pageCount - renderCount,
  };
}

async function readDocx(data: ArrayBuffer): Promise<DocRead> {
  const mammoth = (await import("mammoth")).default;
  // HTML rather than extractRawText: a PSS carries its recipe and packaging in tables, and raw
  // text collapses every row into one run-on line. The AI reads an HTML table fine -- this is the
  // same reason generate-form-schema sends HTML.
  const { value: html } = await mammoth.convertToHtml({ arrayBuffer: data });
  const text = (html || "").trim();
  if (!text) {
    throw new UnreadableDocumentError("This Word file appears to be empty.");
  }
  return { kind: "docx", text, pageImages: [], pageCount: 0, scanned: false, droppedPages: 0 };
}

/**
 * Reads `data` according to `fileName`'s extension. Throws UnreadableDocumentError for formats
 * that cannot be recovered here (notably legacy .doc, which mammoth does not support).
 */
export async function readDocumentForReview(
  data: ArrayBuffer,
  fileName: string,
): Promise<DocRead> {
  const name = (fileName || "").toLowerCase();

  if (name.endsWith(".pdf")) return readPdf(data);
  if (name.endsWith(".docx")) return readDocx(data);
  if (name.endsWith(".doc")) {
    // Legacy OLE binary, not a zip -- mammoth reads .docx only.
    throw new UnreadableDocumentError(
      "Legacy .doc files can't be read. Ask the client to resend it as .docx or PDF.",
    );
  }
  return {
    kind: "unsupported",
    text: "",
    pageImages: [],
    pageCount: 0,
    scanned: false,
    droppedPages: 0,
  };
}

/** True when readDocumentForReview should handle this file rather than the edge function. */
export const needsClientRead = (fileName: string): boolean =>
  /\.(pdf|docx?)$/i.test(fileName || "");
