import JSZip from "jszip";

// Extracts per-slide speaker notes from a .pptx so hand-authored narration can be
// imported instead of AI-generated. Returns one entry per slide in presentation
// order; null where a slide has no (non-empty) notes. Never throws — any parse
// failure degrades to nulls so the caller can fall back to AI narration.

const NS_REL = "http://schemas.openxmlformats.org/package/2006/relationships";
const NS_DOC_REL = "http://schemas.openxmlformats.org/officeDocument/2006/relationships";
const NS_PML = "http://schemas.openxmlformats.org/presentationml/2006/main";
const NS_DML = "http://schemas.openxmlformats.org/drawingml/2006/main";

const parseXml = (text: string): Document =>
  new DOMParser().parseFromString(text, "application/xml");

// Resolves a relationship Target (e.g. "../notesSlides/notesSlide1.xml") against
// the directory of the part that declared it (e.g. "ppt/slides").
function resolveTarget(baseDir: string, target: string): string {
  const parts = (baseDir ? baseDir.split("/") : []).concat(target.split("/"));
  const out: string[] = [];
  for (const p of parts) {
    if (p === "" || p === ".") continue;
    if (p === "..") out.pop();
    else out.push(p);
  }
  return out.join("/");
}

function readRels(doc: Document): Map<string, { type: string; target: string }> {
  const map = new Map<string, { type: string; target: string }>();
  const rels = doc.getElementsByTagNameNS(NS_REL, "Relationship");
  for (let i = 0; i < rels.length; i++) {
    const el = rels[i];
    const id = el.getAttribute("Id");
    if (id) map.set(id, { type: el.getAttribute("Type") ?? "", target: el.getAttribute("Target") ?? "" });
  }
  return map;
}

// Slide part paths (e.g. "ppt/slides/slide1.xml") in presentation order.
async function slidePathsInOrder(zip: JSZip): Promise<string[]> {
  const presXml = await zip.file("ppt/presentation.xml")?.async("string");
  const relsXml = await zip.file("ppt/_rels/presentation.xml.rels")?.async("string");
  if (presXml && relsXml) {
    const rels = readRels(parseXml(relsXml));
    const sldIds = parseXml(presXml).getElementsByTagNameNS(NS_PML, "sldId");
    const paths: string[] = [];
    for (let i = 0; i < sldIds.length; i++) {
      const rId = sldIds[i].getAttributeNS(NS_DOC_REL, "id");
      const rel = rId ? rels.get(rId) : undefined;
      if (rel) paths.push(resolveTarget("ppt", rel.target));
    }
    if (paths.length > 0) return paths;
  }
  // Fallback: enumerate slide parts by filename number
  return Object.keys(zip.files)
    .filter(p => /^ppt\/slides\/slide\d+\.xml$/.test(p))
    .sort((a, b) => Number(a.match(/(\d+)\.xml$/)![1]) - Number(b.match(/(\d+)\.xml$/)![1]));
}

// Notes text for one notes-slide part: the body placeholder's paragraphs.
// Skips slide-number / slide-image / header / footer / date placeholders.
function notesTextFromXml(doc: Document): string | null {
  const shapes = doc.getElementsByTagNameNS(NS_PML, "sp");
  let bodyText: string | null = null;
  let anyText: string | null = null;
  for (let i = 0; i < shapes.length; i++) {
    const sp = shapes[i];
    const ph = sp.getElementsByTagNameNS(NS_PML, "ph")[0];
    const phType = ph?.getAttribute("type") ?? "";
    if (["sldNum", "sldImg", "hdr", "ftr", "dt"].includes(phType)) continue;
    const paras = sp.getElementsByTagNameNS(NS_DML, "p");
    const lines: string[] = [];
    for (let j = 0; j < paras.length; j++) {
      const runs = paras[j].getElementsByTagNameNS(NS_DML, "t");
      let line = "";
      for (let k = 0; k < runs.length; k++) line += runs[k].textContent ?? "";
      lines.push(line);
    }
    const text = lines.join("\n").trim();
    if (!text) continue;
    if (phType === "body") bodyText = bodyText ? `${bodyText}\n${text}` : text;
    else anyText = anyText ? `${anyText}\n${text}` : text;
  }
  return bodyText ?? anyText;
}

export async function extractSpeakerNotes(file: File): Promise<(string | null)[]> {
  try {
    const zip = await JSZip.loadAsync(await file.arrayBuffer());
    const slidePaths = await slidePathsInOrder(zip);
    const notes: (string | null)[] = [];
    for (const slidePath of slidePaths) {
      try {
        const relsPath = slidePath.replace(/(slide\d+\.xml)$/, "_rels/$1.rels");
        const relsXml = await zip.file(relsPath)?.async("string");
        if (!relsXml) { notes.push(null); continue; }
        const rel = Array.from(readRels(parseXml(relsXml)).values())
          .find(r => r.type.endsWith("/notesSlide"));
        if (!rel) { notes.push(null); continue; }
        const notesPath = resolveTarget(slidePath.replace(/\/[^/]+$/, ""), rel.target);
        const notesXml = await zip.file(notesPath)?.async("string");
        notes.push(notesXml ? notesTextFromXml(parseXml(notesXml)) : null);
      } catch {
        notes.push(null);
      }
    }
    return notes;
  } catch {
    return [];
  }
}
