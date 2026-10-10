// Decodes a retail bar code from a photograph - a real scan of the bars, which is stronger than
// reading the digits printed under them.
//
// Two decoders, in order: the browser's own BarcodeDetector (Chrome on Android has it; Chrome on
// Windows and most desktop browsers do not), then the ZXing library, loaded only when needed, so
// the check works the same on a laptop as on the tablet. Returns "" when nothing was found; never
// throws.

const FORMATS = ["upc_a", "upc_e", "ean_13", "ean_8", "code_128", "itf"];
const PLAIN = /^\d{6,}$/;

async function withDetector(bitmap: ImageBitmap): Promise<string> {
  const Detector = (globalThis as any).BarcodeDetector;
  if (!Detector) return "";
  const supported: string[] = await Detector.getSupportedFormats?.() ?? FORMATS;
  const formats = FORMATS.filter(f => supported.includes(f));
  if (!formats.length) return "";
  const found: { rawValue?: string }[] = await new Detector({ formats }).detect(bitmap);
  return String(found.find(f => PLAIN.test(String(f.rawValue ?? "")))?.rawValue ?? "");
}

/** The picture as grey levels at a given longest side, optionally turned a quarter. */
function luminance(bitmap: ImageBitmap, longest: number, quarterTurn: boolean) {
  const scale = Math.min(1, longest / Math.max(bitmap.width, bitmap.height));
  const w = Math.max(1, Math.round(bitmap.width * scale)), h = Math.max(1, Math.round(bitmap.height * scale));
  const canvas = document.createElement("canvas");
  canvas.width = quarterTurn ? h : w;
  canvas.height = quarterTurn ? w : h;
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  if (!ctx) return null;
  ctx.fillStyle = "#fff";
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  if (quarterTurn) { ctx.translate(h, 0); ctx.rotate(Math.PI / 2); }
  ctx.drawImage(bitmap, 0, 0, w, h);
  const { data } = ctx.getImageData(0, 0, canvas.width, canvas.height);
  const grey = new Uint8ClampedArray(canvas.width * canvas.height);
  for (let i = 0, p = 0; i < grey.length; i++, p += 4) grey[i] = (data[p] * 299 + data[p + 1] * 587 + data[p + 2] * 114) / 1000;
  return { grey, width: canvas.width, height: canvas.height };
}

async function withZxing(bitmap: ImageBitmap): Promise<string> {
  const Z = await import("@zxing/library");
  const hints = new Map<unknown, unknown>([
    [Z.DecodeHintType.POSSIBLE_FORMATS, [Z.BarcodeFormat.UPC_A, Z.BarcodeFormat.UPC_E, Z.BarcodeFormat.EAN_13, Z.BarcodeFormat.EAN_8, Z.BarcodeFormat.CODE_128, Z.BarcodeFormat.ITF]],
    [Z.DecodeHintType.TRY_HARDER, true],
  ]);
  // A phone photo is far larger than a decoder needs, and a pack is not always held level: a few
  // sizes, each level and turned a quarter. The first plain number found wins.
  for (const longest of [1600, 1000, 2400]) {
    for (const quarterTurn of [false, true]) {
      const img = luminance(bitmap, longest, quarterTurn);
      if (!img) return "";
      try {
        const reader = new Z.MultiFormatReader();
        const text = reader.decode(new Z.BinaryBitmap(new Z.HybridBinarizer(new Z.RGBLuminanceSource(img.grey, img.width, img.height))), hints as any).getText();
        // ZXing reports a UPC-A as EAN-13 with a leading zero when both are allowed; either is the same code.
        if (PLAIN.test(text)) return text;
      } catch { /* nothing found at this size or turn */ }
    }
  }
  return "";
}

export async function decodeBarcode(file: Blob): Promise<string> {
  let bitmap: ImageBitmap | null = null;
  try {
    bitmap = await createImageBitmap(file);
    const native = await withDetector(bitmap).catch(() => "");
    return native || await withZxing(bitmap);
  } catch {
    return "";
  } finally {
    bitmap?.close?.();
  }
}
