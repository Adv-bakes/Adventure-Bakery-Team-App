// Supabase access for filled form instances (sop_document_responses) and the
// sop_document_history snapshots. These tables are not in the generated
// Database types (same situation as inventory_tolling / temperature_logs), so
// every query goes through `from("..." as any)` — confined to this module;
// callers only see the typed wrappers below.

import { supabase } from "@/integrations/supabase/client";
import { FORMULA_FORM, checkFormulaMapping, type BatchSheetRow, type FormulaEntry } from "@/lib/batchSheetFill";
import {
  emptyValues, getFormSchema, initialsFromName, valueFields,
  type AiCellDraft, type FieldManifest, type FormSchema, type LabelScanResult, type ScanFact, type ScanMode,
} from "@/lib/formSchema";
import type { GuideDoc } from "@/lib/auditGuide";
import {
  RECALL_FORM, TRACE_FORMS, checkTraceMapping,
  type TraceEntry, type TraceKind, type TraceRecords,
} from "@/lib/lotTrace";
import { VISITOR_FORMS, isVisitorKioskSchema, type AckRecord } from "@/lib/visitors";
import {
  RELEASE_SOURCES, checkReleaseMapping, emptyReleaseRecords,
  type ReleaseKind, type ReleaseRecords, type ReleaseSourceSpec,
} from "@/lib/releaseAssist";

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
}, prefill?: Record<string, any>, opts?: {
  /**
   * Resume the caller's newest open draft even when the form allows multiple drafts.
   *
   * Exists for the "start this activity" link on a notification, which has to be safe to click
   * twice: without it, a second click would leave two half-filled records for one task. Intent
   * matches too — a person following a due reminder wants the entry they are filling in for it,
   * not a second one beside it.
   */
  resumeAnyDraft?: boolean;
}): Promise<FormResponse> {
  const schema = getFormSchema(doc.content);
  if (!schema) throw new Error("This form has no fields defined yet.");

  const { data: auth } = await supabase.auth.getUser();
  const userId = auth?.user?.id;
  if (!userId) throw new Error("Not signed in");

  if (opts?.resumeAnyDraft || schema.settings?.allowMultipleDrafts === false) {
    const { data: existing, error: exErr } = await table()
      .select("*")
      .eq("document_id", doc.id)
      .eq("created_by", userId)
      .eq("status", "draft")
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (exErr) throw exErr;
    // Reuse the existing draft untouched — never clobber in-progress answers
    // with a fresh prefill.
    if (existing) return existing as FormResponse;
  }

  // The rows a new entry starts with get their columns' fill-time defaults, so
  // a `defaultTo` column is filled on row one as well as on every Add Row. The
  // name is looked up here rather than passed in because this is the one place
  // an entry is born; a missing profile just yields no initials.
  const { data: prof } = await supabase
    .from("profiles").select("full_name").eq("id", userId).maybeSingle();
  const ctx = { userInitials: initialsFromName((prof as any)?.full_name) };

  // prefill (e.g. figures derived from another data source) overlays the empty
  // values field-by-field; anything it omits keeps the schema's empty default.
  const data0 = prefill ? { ...emptyValues(schema, ctx), ...prefill } : emptyValues(schema, ctx);

  const { data, error } = await table()
    .insert({
      document_id: doc.id,
      form_number: doc.sop_number,
      form_revision: doc.revision,
      data: data0,
      created_by: userId,
    })
    .select("*")
    .single();
  if (error) throw error;
  return data as FormResponse;
}

// ---------- Visitor sign-in (FRM-905 / FRM-906) — see src/lib/visitors.ts ----------
//
// Everything here goes through SECURITY DEFINER functions (migration 20261001000005) rather than
// the tables. The entrance tablet runs as a `kiosk` account that no RLS policy admits, so the
// functions are the only thing it can reach; staff use the same ones from the portal page, which
// keeps it to one path.

export interface VisitorFormDoc {
  id: string;
  sop_number: string;
  revision: string | null;
  schema: FormSchema;
}

export interface VisitorOnSite {
  id: string;
  name: string;
  company: string;
  host: string;
  visitDate: string;
  timeIn: string;
}

export interface VisitorDesk {
  /** Null when either form is missing, inactive, or not yet at a revision the page can write. */
  forms: { signIn: VisitorFormDoc; ack: VisitorFormDoc } | null;
  /** Team members' names, for "who are you here to see?". */
  staff: string[];
  onSite: VisitorOnSite[];
}

const rpc = (name: string, args?: Record<string, unknown>) => (supabase as any).rpc(name, args);

/** The two visitor forms, the team's names, and who is on site now. */
export async function loadVisitorDesk(): Promise<VisitorDesk> {
  const { data, error } = await rpc("visitor_desk_context");
  if (error) throw error;
  const form = (num: string): VisitorFormDoc | null => {
    const row = data?.forms?.[num];
    const schema = row ? getFormSchema({ form_schema: row.form_schema }) : null;
    return row && schema && isVisitorKioskSchema(schema)
      ? { id: row.id, sop_number: row.sop_number, revision: row.revision ?? null, schema }
      : null;
  };
  const signIn = form(VISITOR_FORMS.signIn);
  const ack = form(VISITOR_FORMS.acknowledgement);
  return {
    forms: signIn && ack ? { signIn, ack } : null,
    staff: Array.isArray(data?.staff) ? data.staff : [],
    onSite: (Array.isArray(data?.on_site) ? data.on_site : []).map((r: any) => ({
      id: r.id, name: r.name ?? "", company: r.company ?? "", host: r.host ?? "",
      visitDate: r.visit_date ?? "", timeIn: r.time_in ?? "",
    })),
  };
}

/**
 * Acknowledgements that could belong to whoever typed `query`. The server narrows (and refuses a
 * query too short to identify anybody); findVisitorMatches does the exact matching on the result.
 */
export async function lookupVisitors(query: string): Promise<AckRecord[]> {
  const { data, error } = await rpc("visitor_lookup", { _query: query });
  if (error) throw error;
  return (data ?? []).map((r: any) => ({
    id: r.id,
    formRevision: r.form_revision ?? null,
    ackDate: r.ack_date ?? "",
    name: r.name ?? "",
    company: r.company ?? "",
    phone: r.phone ?? "",
  }));
}

/**
 * Write one visit: the FRM-906 acknowledgement when `ack` is given, and the FRM-905 entry, in a
 * single transaction and already submitted. The revisions are the ones the screen was showing —
 * the server refuses if either form has been revised since.
 */
export async function visitorSignIn(
  visit: Record<string, any>,
  ack: Record<string, any> | null,
  revisions: { signIn: string | null; ack: string | null },
): Promise<void> {
  const { error } = await rpc("visitor_sign_in", {
    _visit: visit, _ack: ack, _revision_905: revisions.signIn, _revision_906: revisions.ack,
  });
  if (error) throw error;
}

/** Stamp the time out (HH:MM) on a submitted FRM-905 entry — see the sign_out_visitor RPC. */
export async function signOutVisitor(responseId: string, timeOut: string): Promise<void> {
  const { error } = await rpc("sign_out_visitor", { _response_id: responseId, _time_out: timeOut });
  if (error) throw error;
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

/**
 * Read one photographed package → the facts printed on it, for filling a grid
 * row or a form section. Sibling of extractFormAnswers (whole paper form).
 *
 * `mode` picks which kind of pack is in frame; the two disagree about what a lot
 * code looks like, so passing the wrong one reads the wrong number. Defaults to
 * "ingredient", which is what every caller meant before the mode existed.
 */
export async function extractPackageLabel(
  imageUrls: string[],
  wanted: ScanFact[],
  mode: ScanMode = "ingredient",
): Promise<LabelScanResult> {
  const { data, error } = await supabase.functions.invoke("extract-package-label", {
    body: { imageUrls, wanted, mode },
  });
  if (error) throw error;
  if (data?.error) throw new Error(data.error);
  return {
    facts: (data?.facts ?? {}) as LabelScanResult["facts"],
    alternates: { lot_code: (data?.alternates?.lot_code ?? []) as string[] },
    extras: (data?.extras ?? []) as { label: string; value: string }[],
    warnings: (data?.warnings ?? []) as string[],
  };
}

/**
 * Draft FRM-010's "Objective evidence seen" for one findings line (draft-audit-evidence). The
 * server computes the facts from the records in the twelve months up to `asOf` and the model
 * writes them up; the caller previews the result and nothing is saved here.
 */
export async function draftAuditEvidence(payload: {
  clause: string;
  requirements: { id: string; text: string }[];
  asOf: string;
}): Promise<AiCellDraft> {
  const { data, error } = await supabase.functions.invoke("draft-audit-evidence", { body: payload });
  if (error) throw error;
  if (data?.error) throw new Error(data.error);
  return {
    text: String(data?.evidence ?? ""),
    window: data?.window,
    sources: (data?.sources ?? []) as AiCellDraft["sources"],
  };
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

/**
 * What the internal-audit guide needs (auditGuide.ts): every active or draft document that
 * carries an SQF reference, and how many SUBMITTED entries each form has had in the last
 * twelve months - the records an auditor samples, where an empty form is often the finding.
 * Paged, because a select is capped at 1000 rows and a busy daily form passes that in a year.
 */
export interface FormLinkTarget {
  docId: string;
  title: string;
  /** The entry to open, when one was asked for and exists. */
  responseId: string | null;
  draft: boolean;
  /** The entry's date (submitted, else created), yyyy-MM-dd. */
  date: string | null;
}

/**
 * Where a FieldLink points: the form by number and, with `latestEntry`, its newest submitted
 * entry - else its newest draft, flagged, since an unsubmitted list is still the one in use.
 * Null when the form does not exist.
 */
export async function fetchFormLinkTarget(form: string, latestEntry?: boolean): Promise<FormLinkTarget | null> {
  const { data: docs, error } = await (supabase as any)
    .from("sop_documents")
    .select("id, title, status")
    .eq("sop_number", form)
    .in("status", ["active", "draft"]);
  if (error) throw error;
  const doc = (docs ?? []).find((d: any) => d.status === "active") ?? (docs ?? [])[0];
  if (!doc) return null;
  const target: FormLinkTarget = { docId: doc.id, title: doc.title ?? form, responseId: null, draft: false, date: null };
  if (!latestEntry) return target;
  const pick = async (status: string, column: string) => {
    const { data, error: err } = await table().select("id, status, submitted_at, created_at")
      .eq("document_id", doc.id).eq("status", status).order(column, { ascending: false }).limit(1);
    if (err) throw err;
    return (data ?? [])[0] as { id: string; status: string; submitted_at: string | null; created_at: string } | undefined;
  };
  const entry = (await pick("submitted", "submitted_at")) ?? (await pick("draft", "created_at"));
  if (entry) {
    target.responseId = entry.id;
    target.draft = entry.status !== "submitted";
    target.date = (entry.submitted_at ?? entry.created_at).slice(0, 10);
  }
  return target;
}

/** Number, title and status of every active or draft document - what DocRefText links from. */
export async function fetchDocIndexRows(): Promise<{ id: string; sop_number: string | null; title: string | null; status: string }[]> {
  const { data, error } = await (supabase as any)
    .from("sop_documents")
    .select("id, sop_number, title, status")
    .not("sop_number", "is", null)
    .in("status", ["active", "draft"]);
  if (error) throw error;
  return data ?? [];
}

/** The id of each active or draft form among `numbers`, for links into the library. */
export async function fetchDocIdsByNumber(numbers: string[]): Promise<Record<string, string>> {
  const { data, error } = await (supabase as any)
    .from("sop_documents")
    .select("id, sop_number, status")
    .in("sop_number", numbers)
    .in("status", ["active", "draft"]);
  if (error) throw error;
  const out: Record<string, string> = {};
  for (const d of (data ?? []) as { id: string; sop_number: string; status: string }[]) {
    if (!out[d.sop_number] || d.status === "active") out[d.sop_number] = d.id;
  }
  return out;
}

export interface TraceDoc { id: string; sop_number: string; revision: string | null; status: string; content: any }
export interface TraceData {
  records: TraceRecords;
  /** The live document of every form the trace reads, and of FRM-012, by number. */
  docs: Record<string, TraceDoc>;
  /** Source forms whose mapped fields have moved: the trace must not run while any exist. */
  sourceProblems: string[];
  /** FRM-012 fields the trace writes that are missing: a record cannot be started or filled. */
  recallProblems: string[];
}

/**
 * Everything the lot trace reads (lotTrace.ts): the entries, submitted AND draft, of the seven
 * source forms. Only the mapped answer keys are selected - entry data can hold drawn-signature
 * images - and each form is paged, since a daily receiving log passes the 1000-row cap. Drafts
 * are included on purpose: in a recall, an unsubmitted lot record is still where the lot went.
 */
export async function loadTraceRecords(): Promise<TraceData> {
  const numbers = [...Object.values(TRACE_FORMS).map(s => s.form), RECALL_FORM];
  const { data: docRows, error } = await (supabase as any)
    .from("sop_documents")
    .select("id, sop_number, revision, status, content")
    .in("sop_number", numbers)
    .eq("type", "form")
    .in("status", ["active", "draft"]);
  if (error) throw error;
  const docs: Record<string, TraceDoc> = {};
  for (const d of (docRows ?? []) as TraceDoc[]) {
    // One number should be one document; if it ever is two, the issued one is the record.
    if (!docs[d.sop_number] || d.status === "active") docs[d.sop_number] = d;
  }
  const schemas = Object.fromEntries(Object.entries(docs).map(([n, d]) => [n, getFormSchema(d.content)]));
  const sourceProblems = checkTraceMapping(schemas, false);
  const recallProblems = checkTraceMapping(schemas).filter(p => !sourceProblems.includes(p));

  const records = Object.fromEntries(Object.keys(TRACE_FORMS).map(k => [k, [] as TraceEntry[]])) as TraceRecords;
  const PAGE = 1000;
  await Promise.all((Object.keys(TRACE_FORMS) as TraceKind[]).map(async kind => {
    const spec = TRACE_FORMS[kind];
    const doc = docs[spec.form];
    if (!doc) return;
    const keys = [...spec.fields, ...Object.keys(spec.grids)];
    const select = ["id", "status", "submitted_at", "created_at", ...keys.map(k => `v_${k}:data->${k}`)].join(", ");
    for (let from = 0; ; from += PAGE) {
      const { data, error: err } = await table().select(select).eq("document_id", doc.id).order("id").range(from, from + PAGE - 1);
      if (err) throw err;
      for (const r of (data ?? []) as any[]) {
        records[kind].push({
          id: r.id, docId: doc.id, status: r.status, date: r.submitted_at ?? r.created_at,
          data: Object.fromEntries(keys.map(k => [k, r[`v_${k}`]])),
        });
      }
      if (!data || data.length < PAGE) break;
    }
  }));
  return { records, docs, sourceProblems, recallProblems };
}

/**
 * Everything the release helper reads (releaseAssist.ts): the entries, submitted AND draft, of the
 * forms a release draws on. Same shape of loader as the lot trace, for the same reasons - only the
 * mapped answer keys are selected (entry data can hold signature images), each form is paged, and
 * practice records made for the mock-recall walk-through are left out.
 */
export async function loadReleaseRecords(): Promise<{ records: ReleaseRecords; problems: string[] }> {
  const specs = Object.values(RELEASE_SOURCES) as ReleaseSourceSpec[];
  const { data: docRows, error } = await (supabase as any)
    .from("sop_documents")
    .select("id, sop_number, status, content")
    .in("sop_number", specs.map(s => s.form))
    .eq("type", "form")
    .in("status", ["active", "draft"]);
  if (error) throw error;
  const docs: Record<string, { id: string; status: string; content: any }> = {};
  for (const d of (docRows ?? []) as any[]) {
    if (!docs[d.sop_number] || d.status === "active") docs[d.sop_number] = d;
  }
  const problems = checkReleaseMapping(Object.fromEntries(Object.entries(docs).map(([n, d]) => {
    const schema = getFormSchema(d.content);
    return [n, schema ? valueFields(schema).map(f => f.id) : undefined];
  })));

  const records = emptyReleaseRecords();
  const PAGE = 1000;
  await Promise.all((Object.keys(RELEASE_SOURCES) as ReleaseKind[]).map(async kind => {
    const spec = RELEASE_SOURCES[kind] as ReleaseSourceSpec;
    const doc = docs[spec.form];
    if (!doc) return;
    const keys = [...spec.fields, ...Object.keys(spec.grids)];
    const select = ["id", "status", "submitted_at", "created_at", "v__test:data->_test_batch", ...keys.map(k => `v_${k}:data->${k}`)].join(", ");
    for (let from = 0; ; from += PAGE) {
      const { data, error: err } = await table().select(select).eq("document_id", doc.id).order("id").range(from, from + PAGE - 1);
      if (err) throw err;
      for (const r of (data ?? []) as any[]) {
        if (r.v__test) continue;
        records[kind].push({
          id: r.id, status: r.status, date: r.submitted_at ?? r.created_at,
          data: Object.fromEntries(keys.map(k => [k, r[`v_${k}`]])),
        });
      }
      if (!data || data.length < PAGE) break;
    }
  }));
  return { records, problems };
}

export async function loadAuditGuideData(): Promise<{ docs: GuideDoc[]; counts: Map<string, number> }> {
  const { data: docs, error } = await (supabase as any)
    .from("sop_documents")
    .select("id, sop_number, title, status, sqf_reference")
    .in("status", ["active", "draft"])
    .not("sqf_reference", "is", null);
  if (error) throw error;

  const since = new Date();
  since.setFullYear(since.getFullYear() - 1);
  const counts = new Map<string, number>();
  const PAGE = 1000;
  for (let from = 0; ; from += PAGE) {
    const { data, error: err } = await table()
      .select("document_id")
      .eq("status", "submitted")
      .gte("submitted_at", since.toISOString())
      .order("id")
      .range(from, from + PAGE - 1);
    if (err) throw err;
    for (const r of data ?? []) counts.set(r.document_id, (counts.get(r.document_id) ?? 0) + 1);
    if (!data || data.length < PAGE) break;
  }
  return { docs: ((docs ?? []) as GuideDoc[]).filter(d => d.sop_number), counts };
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

// ---------- Batch sheets (settings.batchSheet - see batchSheetFill.ts) ----------

/**
 * The batch sheets a lot record can be started from: the current version of each product's sheet.
 * Drafts are included and labelled - a product whose sheet is not approved yet is still baked.
 */
export async function fetchCurrentBatchSheets(): Promise<BatchSheetRow[]> {
  const { data, error } = await (supabase as any)
    .from("batch_sheets")
    .select("id, version, status, data_json")
    .is("superseded_at", null)
    .order("updated_at", { ascending: false })
    .limit(500);
  if (error) throw error;
  return (data ?? []) as BatchSheetRow[];
}

/**
 * The entries of the formula form (FRM-501) a lot record can be started from, newest first, drafts
 * included. `missing` lists the field ids batchSheetFill.ts reads that the live form no longer
 * has, so a renamed field shows on the page instead of as a quietly empty list. Practice records
 * (data._test_batch) are left out.
 */
export async function fetchFormulaEntries(formNumber: string): Promise<{ entries: FormulaEntry[]; missing: string[] }> {
  const { data: doc, error: docError } = await (supabase as any)
    .from("sop_documents").select("id, content").eq("sop_number", formNumber).neq("status", "archived").maybeSingle();
  if (docError) throw docError;
  if (!doc) throw new Error(`${formNumber} was not found.`);
  const missing = formNumber === FORMULA_FORM.number ? checkFormulaMapping(doc.content?.form_schema) : [];
  const { data, error } = await table()
    .select("id, status, created_at, data")
    .eq("document_id", doc.id)
    .order("created_at", { ascending: false })
    .limit(500);
  if (error) throw error;
  const entries = ((data ?? []) as FormulaEntry[]).filter(r => !(r.data && "_test_batch" in r.data));
  return { entries, missing };
}

/** One person in the team directory, for a `teamPick` grid column. */
export interface TeamDirectoryName { name: string; title: string }

/**
 * The names a `teamPick` column offers: everyone holding a staff, admin or owner role who has a
 * name on their profile - the people on the Team Directory page, without the auditor and kiosk
 * accounts, which are not people who attend training. Portal access is not required: someone
 * with no log-in still attends a session.
 */
export async function loadTeamDirectoryNames(): Promise<TeamDirectoryName[]> {
  const { data: roles, error } = await supabase
    .from("user_roles").select("user_id, role").in("role", ["staff", "admin", "owner"]);
  if (error) throw error;
  const ids = [...new Set((roles ?? []).map((r: any) => r.user_id as string))];
  if (!ids.length) return [];
  const { data: people, error: pErr } = await supabase
    .from("profiles").select("id, full_name, job_title, department").in("id", ids);
  if (pErr) throw pErr;
  return (people ?? [])
    .map((p: any) => ({
      name: String(p.full_name ?? "").trim(),
      title: String(p.job_title ?? "").trim() || String(p.department ?? "").trim(),
    }))
    .filter(p => p.name)
    .sort((a, b) => a.name.localeCompare(b.name));
}
