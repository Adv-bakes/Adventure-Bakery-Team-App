// Decodes a retail bar code from a photograph with the browser's own BarcodeDetector (Chrome on
// Android has it; most desktop browsers do not). A decode is a real scan of the bars - stronger
// than reading the digits printed under them. Returns "" when the browser cannot, or nothing was
// found; never throws.

const FORMATS = ["upc_a", "upc_e", "ean_13", "ean_8", "code_128", "itf"];

export async function decodeBarcode(file: Blob): Promise<string> {
  try {
    const Detector = (globalThis as any).BarcodeDetector;
    if (!Detector) return "";
    const supported: string[] = await Detector.getSupportedFormats?.() ?? FORMATS;
    const formats = FORMATS.filter(f => supported.includes(f));
    if (!formats.length) return "";
    const bitmap = await createImageBitmap(file);
    try {
      const found: { rawValue?: string }[] = await new Detector({ formats }).detect(bitmap);
      return String(found.find(f => /^\d{6,}$/.test(String(f.rawValue ?? "")))?.rawValue ?? "");
    } finally {
      bitmap.close?.();
    }
  } catch {
    return "";
  }
}
