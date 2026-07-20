// Supabase access for filled form instances (sop_document_responses) and the
// sop_document_history snapshots. These tables are not in the generated
// Database types (same situation as inventory_tolling / temperature_logs), so
// every query goes through `from("..." as any)` — confined to this module;
// callers only see the typed wrappers below.

import { supabase } from "@/integrations/supabase/client";
import { emptyValues, getFormSchema, type FieldManifest, type FormSchema } from "@/lib/formSchema";

export type ResponseStatus = "draft" | "submitted";

export interface FormResponse {
  id: string;
  document_id: string;
  form_number: string | null;
  form_revision: string | null;
  data: Record<string, any>;
  status: ResponseStatus;
  created_by: string;
  created_at: string;
  updated_at: string;
  updated_by: string | null;
  submitted_at: string | null;
  submitted_by: string | null;
  reopened_at: string | null;
  reopened_by: string | null;
  attachments: ResponseAttachment[];
}

/** One file/photo attached to a filled entry, stored in the form-attachments bucket. */
export interface ResponseAttachment {
  path: string;
  name: string;
  contentType?: string;
  size?: number;
  uploadedAt: string;
  uploadedBy: string;
  /** What the photo/file shows — a camera filename says nothing on its own. */
  note?: string;
}

export interface HistorySnapshot {
  id: string;
  document_id: string;
  revision: string | null;
  changed_fields: string[];
  snapshot: Record<string, any>; // full prior sop_documents row
  snapshotted_at: string;
}

/** Thrown when an optimistic-concurrency update matched zero rows. */
export class StaleResponseError extends Error {
  constructor() {
    super("This entry was changed elsewhere — reload it before saving.");
    this.name = "StaleResponseError";
  }
}

const table = () => (supabase as any).from("sop_document_responses");

export async function fetchResponses(
  documentId?: string,
  range?: { from?: string; to?: string },
): Promise<FormResponse[]> {
  let query = table().select("*").order("created_at", { ascending: false });
  if (documentId) query = query.eq("document_id", documentId);
  if (range?.from) query = query.gte("created_at", range.from);
  if (range?.to) query = query.lte("created_at", range.to);
  const { data, error } = await query;
  if (error) throw error;
  return (data ?? []) as FormResponse[];
}

export async function fetchResponse(id: string): Promise<FormResponse | null> {
  const { data, error } = await table().select("*").eq("id", id).maybeSingle();
  if (error) throw error;
  return (data as FormResponse) ?? null;
}

/**
 * Create a new entry pinned to the form's current number/revision. When the
 * form disallows multiple drafts, an existing draft by this user is resumed
 * instead of creating another.
 */
export async function createResponse(doc: {
  id: string;
  sop_number: string | null;
  revision: string | null;
  content: any;
}): Promise<FormResponse> {
  const schema = getFormSchema(doc.content);
  if (!schema) throw new Error("This form has no fields defined yet.");

  const { data: auth } = await supabase.auth.getUser();
  const userId = auth?.user?.id;
  if (!userId) throw new Error("Not signed in");

  if (schema.settings?.allowMultipleDrafts === false) {
    const { data: existing, error: exErr } = await table()
      .select("*")
      .eq("document_id", doc.id)
      .eq("created_by", userId)
      .eq("status", "draft")
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (exErr) throw exErr;
    if (existing) return existing as FormResponse;
  }

  const { data, error } = await table()
    .insert({
      document_id: doc.id,
      form_number: doc.sop_number,
      form_revision: doc.revision,
      data: emptyValues(schema),
      created_by: userId,
    })
    .select("*")
    .single();
  if (error) throw error;
  return data as FormResponse;
}

/**
 * Save draft data with an optimistic-concurrency guard: the update only lands
 * when updated_at still matches what this client loaded. Zero rows back means
 * someone else saved in between (or RLS rejected the write) → StaleResponseError.
 */
export async function saveResponseData(
  id: string,
  data: Record<string, any>,
  loadedUpdatedAt: string,
): Promise<FormResponse> {
  const { data: auth } = await supabase.auth.getUser();
  const { data: rows, error } = await table()
    .update({ data, updated_by: auth?.user?.id ?? null })
    .eq("id", id)
    .eq("updated_at", loadedUpdatedAt)
    .select("*");
  if (error) throw error;
  if (!rows || rows.length === 0) throw new StaleResponseError();
  return rows[0] as FormResponse;
}

/** Submit: caller validates via buildZodSchema first. Same staleness guard. */
export async function submitResponse(
  id: string,
  data: Record<string, any>,
  loadedUpdatedAt: string,
): Promise<FormResponse> {
  const { data: auth } = await supabase.auth.getUser();
  const userId = auth?.user?.id ?? null;
  const { data: rows, error } = await table()
    .update({
      data,
      status: "submitted",
      submitted_at: new Date().toISOString(),
      submitted_by: userId,
      updated_by: userId,
    })
    .eq("id", id)
    .eq("updated_at", loadedUpdatedAt)
    .select("*");
  if (error) throw error;
  if (!rows || rows.length === 0) throw new StaleResponseError();
  return rows[0] as FormResponse;
}

/** Admin/owner only (RLS-enforced): unlock a submitted entry for editing. */
export async function reopenResponse(id: string): Promise<FormResponse> {
  const { data: auth } = await supabase.auth.getUser();
  const { data: rows, error } = await table()
    .update({
      status: "draft",
      reopened_at: new Date().toISOString(),
      reopened_by: auth?.user?.id ?? null,
    })
    .eq("id", id)
    .select("*");
  if (error) throw error;
  if (!rows || rows.length === 0) throw new Error("Reopen failed — admin access required.");
  return rows[0] as FormResponse;
}

/**
 * Admin/owner only (RLS-enforced). UI additionally hides delete when
 * settings.deletable === false. attachmentPaths (pass response.attachments.map
 * (a => a.path)) are cleaned up from storage best-effort, after the row is
 * gone — an orphaned storage file is harmless; a live compliance record with
 * broken attachment links is not.
 */
export async function deleteResponse(id: string, attachmentPaths: string[] = []): Promise<void> {
  const { error } = await table().delete().eq("id", id);
  if (error) throw error;
  if (attachmentPaths.length > 0) {
    await supabase.storage.from("form-attachments").remove(attachmentPaths).catch(() => { /* best-effort */ });
  }
}

/** Longest-edge cap + JPEG quality for on-upload photo compression. 1600px
 * stays sharp enough to read a label or run the photo-fill OCR, while a 3MB
 * tablet photo lands around 300–500KB. */
const UPLOAD_IMAGE_MAX_PX = 1600;
const UPLOAD_IMAGE_QUALITY = 0.8;

interface CompressedImage { blob: Blob; name: string; contentType: string; }

/**
 * Downscale + re-encode a photo before upload so tablet shots don't cost 3MB
 * in storage and on every load. Images only; returns null (upload the original
 * untouched) for non-images, for anything the browser cannot decode — iPhone/
 * iPad HEIC being the common one — and when the re-encode would not actually be
 * smaller (an already-optimized image). EXIF orientation is baked in so a photo
 * taken sideways is not stored sideways.
 */
async function compressImageForUpload(file: File): Promise<CompressedImage | null> {
  if (!file.type.startsWith("image/")) return null;
  let bitmap: ImageBitmap | undefined;
  try {
    bitmap = await createImageBitmap(file, { imageOrientation: "from-image" });
    const scale = Math.min(1, UPLOAD_IMAGE_MAX_PX / Math.max(bitmap.width, bitmap.height));
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(bitmap.width * scale);
    canvas.height = Math.round(bitmap.height * scale);
    const ctx = canvas.getContext("2d");
    if (!ctx) return null;
    ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    const blob: Blob | null = await new Promise(resolve =>
      canvas.toBlob(resolve, "image/jpeg", UPLOAD_IMAGE_QUALITY));
    // A tiny or already-JPEG-optimized source can come out larger; keep the
    // original in that case rather than trading quality for nothing.
    if (!blob || blob.size >= file.size) return null;
    const name = file.name.replace(/\.(png|jpe?g|gif|webp|heic|heif|bmp|tiff?)$/i, "") + ".jpg";
    return { blob, name, contentType: "image/jpeg" };
  } catch {
    return null; // undecodable (e.g. HEIC in Chrome) — caller uploads original
  } finally {
    bitmap?.close();
  }
}

/**
 * Uploads one file/photo for a response and returns its descriptor. Photos are
 * downscaled/re-encoded first (see compressImageForUpload); non-images and
 * undecodable formats upload as-is. Does NOT persist the descriptor into the
 * response row — call saveResponseAttachments with the updated array afterward
 * (same upload/attach split as uploadSopFile in training.ts).
 */
export async function uploadResponseAttachment(responseId: string, file: File): Promise<ResponseAttachment> {
  const { data: auth } = await supabase.auth.getUser();
  const compressed = await compressImageForUpload(file);
  const body: Blob = compressed?.blob ?? file;
  const name = compressed?.name ?? file.name;
  const contentType = compressed?.contentType ?? (file.type || undefined);

  const safe = name.replace(/[^\w.\-]+/g, "_");
  const path = `${responseId}/${crypto.randomUUID()}-${safe}`;
  const { error } = await supabase.storage
    .from("form-attachments")
    .upload(path, body, { upsert: false, contentType });
  if (error) throw error;
  return {
    path,
    name,
    contentType,
    size: body.size,
    uploadedAt: new Date().toISOString(),
    uploadedBy: auth?.user?.id ?? "",
  };
}

/**
 * Photograph-to-fill: send a field manifest + signed photo URLs to the
 * `extract-form-answers` edge function (Gemini vision via the Lovable gateway)
 * and get back a flat { fieldId: value } map for the fields the model could
 * read. The server sanitizes/coerces to the manifest, so the caller can merge
 * the result straight into RHF. Nothing is persisted here — the user reviews
 * the pre-filled values and saves themselves.
 */
export async function extractFormAnswers(
  manifest: FieldManifest[],
  imageUrls: string[],
): Promise<{ answers: Record<string, any>; warnings: string[] }> {
  const { data, error } = await supabase.functions.invoke("extract-form-answers", {
    body: { manifest, imageUrls },
  });
  if (error) throw error;
  if (data?.error) throw new Error(data.error);
  return { answers: (data?.answers ?? {}) as Record<string, any>, warnings: (data?.warnings ?? []) as string[] };
}

/** Best-effort tolerant of an already-missing object is the caller's job (.catch), same as removeSopFile. */
export async function removeResponseAttachment(path: string): Promise<void> {
  const { error } = await supabase.storage.from("form-attachments").remove([path]);
  if (error) throw error;
}

/** Signed URL for viewing/downloading an attachment (private bucket, 1-year expiry). */
export async function getResponseAttachmentUrl(path: string): Promise<string> {
  const { data, error } = await supabase.storage
    .from("form-attachments")
    .createSignedUrl(path, 60 * 60 * 24 * 365);
  if (error) throw error;
  return data.signedUrl;
}

/**
 * Persists the attachments array. Deliberately no optimistic-concurrency
 * guard (unlike saveResponseData/submitResponse) — attachments are additive
 * and orthogonal to the RHF-managed field data, so guarding here would cause
 * spurious staleness errors whenever a photo upload and a draft save race.
 * The row's updated_at still bumps via the sop_document_responses_touch
 * trigger, so callers must apply the returned row to their local state right
 * away or a subsequent saveResponseData call will see a stale updated_at.
 */
export async function saveResponseAttachments(
  id: string,
  attachments: ResponseAttachment[],
): Promise<FormResponse> {
  const { data: auth } = await supabase.auth.getUser();
  const { data: rows, error } = await table()
    .update({ attachments, updated_by: auth?.user?.id ?? null })
    .eq("id", id)
    .select("*");
  if (error) throw error;
  if (!rows || rows.length === 0) throw new Error("Failed to save attachments.");
  return rows[0] as FormResponse;
}

/**
 * Best available display name per user id, for "Filled by" columns and
 * signature stamping: full_name, falling back to email when full_name was
 * never filled in. Empty string means no profile row matched at all (e.g. a
 * deleted account) — callers fall back further to a shortened user id.
 */
export async function fetchProfileNames(userIds: string[]): Promise<Map<string, string>> {
  const ids = Array.from(new Set(userIds.filter(Boolean)));
  if (ids.length === 0) return new Map();
  const { data, error } = await (supabase as any)
    .from("profiles")
    .select("id, full_name, email")
    .in("id", ids);
  if (error) throw error;
  return new Map((data ?? []).map((p: any) => [p.id, (p.full_name?.trim() || p.email || "")]));
}

/** Shortened user id for display when no profile name/email could be resolved. */
export function shortUserId(userId: string): string {
  return `User ${userId.slice(0, 8)}`;
}

export async function fetchHistorySnapshots(documentId: string): Promise<HistorySnapshot[]> {
  const { data, error } = await (supabase as any)
    .from("sop_document_history")
    .select("*")
    .eq("document_id", documentId)
    .order("snapshotted_at", { ascending: false });
  if (error) throw error;
  return (data ?? []) as HistorySnapshot[];
}

export type SchemaSource = "live" | "snapshot" | "fallback";

export interface ResolvedSchema {
  schema: FormSchema;
  source: SchemaSource;
  /** Set when source !== "live": the revision the entry was filled against. */
  pinnedRevision?: string | null;
}

/**
 * Pick the schema an entry should render against (the schema-drift answer):
 * 1. entry pinned to the live revision (or unpinned) → live schema;
 * 2. else the newest history snapshot published under the pinned revision;
 * 3. else the live schema flagged "fallback" so the editor can warn that
 *    answers may not line up. The renderer tolerates unmatched field ids.
 */
export async function resolveSchemaForResponse(
  doc: { id: string; revision: string | null; content: any },
  response: Pick<FormResponse, "form_revision">,
): Promise<ResolvedSchema | null> {
  const live = getFormSchema(doc.content);
  const pinned = response.form_revision;

  if (!pinned || pinned === doc.revision) {
    return live ? { schema: live, source: "live" } : null;
  }

  try {
    const snapshots = await fetchHistorySnapshots(doc.id);
    const match = snapshots.find(s => s.revision === pinned && getFormSchema(s.snapshot?.content));
    if (match) {
      return {
        schema: getFormSchema(match.snapshot.content)!,
        source: "snapshot",
        pinnedRevision: pinned,
      };
    }
  } catch {
    // History unavailable — fall through to the live schema below.
  }

  return live ? { schema: live, source: "fallback", pinnedRevision: pinned } : null;
}
