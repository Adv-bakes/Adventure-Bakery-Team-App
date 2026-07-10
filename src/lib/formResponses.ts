// Supabase access for filled form instances (sop_document_responses) and the
// sop_document_history snapshots. These tables are not in the generated
// Database types (same situation as inventory_tolling / temperature_logs), so
// every query goes through `from("..." as any)` — confined to this module;
// callers only see the typed wrappers below.

import { supabase } from "@/integrations/supabase/client";
import { emptyValues, getFormSchema, type FormSchema } from "@/lib/formSchema";

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

/** Admin/owner only (RLS-enforced). UI additionally hides delete when settings.deletable === false. */
export async function deleteResponse(id: string): Promise<void> {
  const { error } = await table().delete().eq("id", id);
  if (error) throw error;
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
