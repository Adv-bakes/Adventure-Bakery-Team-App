// A photo, as the picture the label reader is sent (owner's real test on lot 6283, 2026-10-15).
//
// The label reader (extract-package-label) used to be given a signed LINK to the photo in storage,
// which the AI service then had to fetch. On the first real first-pack check that took over a
// minute and came back with nothing, twice, on a perfectly clear photo - the same thing the PDF
// fill hit on 2026-10-09, where the same pictures sent directly were read in three seconds. So the
// picture itself is sent, as a JPEG data URL, shrunk so its long edge is at most MAX_EDGE: a
// phone photo is 4000 px and several MB, and a lot code is still sharp at 2048.
//
// The photo is still kept on the record where a feature keeps it; this is only what is READ.

import { getResponseAttachmentUrl } from "./formResponses";

/** Long edge of the picture sent, in px. Ink-jet lot codes are small; this keeps them sharp. */
const MAX_EDGE = 2048;
const QUALITY = 0.85;

async function decode(blob: Blob): Promise<{ source: CanvasImageSource; width: number; height: number; close: () => void }> {
  if (typeof createImageBitmap === "function") {
    try {
      // "from-image" turns a phone photo the way it was taken (EXIF orientation).
      const bmp = await createImageBitmap(blob, { imageOrientation: "from-image" } as ImageBitmapOptions);
      return { source: bmp, width: bmp.width, height: bmp.height, close: () => bmp.close() };
    } catch { /* fall back to an <img> */ }
  }
  const url = URL.createObjectURL(blob);
  try {
    const img = new Image();
    img.src = url;
    await img.decode();
    return { source: img, width: img.naturalWidth, height: img.naturalHeight, close: () => URL.revokeObjectURL(url) };
  } catch (e) {
    URL.revokeObjectURL(url);
    throw e;
  }
}

/** The photo as a JPEG data URL, long edge at most MAX_EDGE. */
export async function photoDataUrl(blob: Blob): Promise<string> {
  const img = await decode(blob);
  try {
    const scale = Math.min(1, MAX_EDGE / Math.max(img.width, img.height));
    const canvas = document.createElement("canvas");
    canvas.width = Math.max(1, Math.round(img.width * scale));
    canvas.height = Math.max(1, Math.round(img.height * scale));
    const ctx = canvas.getContext("2d")!;
    ctx.fillStyle = "#fff"; // a transparent PNG would otherwise encode to black
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(img.source, 0, 0, canvas.width, canvas.height);
    const url = canvas.toDataURL("image/jpeg", QUALITY);
    canvas.width = 0;
    canvas.height = 0;
    return url;
  } finally {
    img.close();
  }
}

/** A photo already on an entry (form-attachments), as the picture the reader is sent. */
export async function storedPhotoDataUrl(path: string): Promise<string> {
  const res = await fetch(await getResponseAttachmentUrl(path));
  if (!res.ok) throw new Error("An earlier photo could not be loaded");
  return photoDataUrl(await res.blob());
}
