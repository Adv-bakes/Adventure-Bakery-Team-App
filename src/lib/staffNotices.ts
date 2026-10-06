// Staff notices: a posting area with a record of who has read each post (D-03, SQF 2.1.1.2).
//
// staff_notices / staff_notice_reads are not in the generated Database types, so every query here
// goes through `(supabase as any)` - confined to this file, as notifications.ts does. Neither table
// has a write policy: posting, acknowledging and withdrawing go through SECURITY DEFINER functions
// that stamp the person and the time on the server.

import { supabase } from "@/integrations/supabase/client";

export type StaffNotice = {
  id: string;
  title: string;
  body: string;
  title_es: string | null;
  body_es: string | null;
  posted_by: string;
  posted_at: string;
  withdrawn_by: string | null;
  withdrawn_at: string | null;
  /** When the signed-in person acknowledged it; null while they have not. */
  read_at: string | null;
};

export type NoticeReader = { notice_id: string; user_id: string; full_name: string; read_at: string | null };

const COLUMNS = "id, title, body, title_es, body_es, posted_by, posted_at, withdrawn_by, withdrawn_at";

/** Pure: which notices the reader still has to acknowledge. Withdrawn ones are never asked for. */
export function unreadNotices(notices: StaffNotice[]): StaffNotice[] {
  return notices.filter((n) => !n.withdrawn_at && !n.read_at);
}

/** Pure: "7 of 10" for one notice, from the readers list. */
export function readTally(readers: NoticeReader[], noticeId: string): { read: number; total: number } {
  const rows = readers.filter((r) => r.notice_id === noticeId);
  return { read: rows.filter((r) => r.read_at).length, total: rows.length };
}

/** Every notice, newest first, each carrying the signed-in person's own acknowledgement. */
export async function fetchStaffNotices(limit = 50): Promise<StaffNotice[]> {
  const [{ data: notices, error }, { data: reads, error: readsError }] = await Promise.all([
    (supabase as any).from("staff_notices").select(COLUMNS)
      .order("posted_at", { ascending: false }).limit(limit),
    // RLS returns only the signed-in person's rows.
    (supabase as any).from("staff_notice_reads").select("notice_id, read_at"),
  ]);
  if (error) throw error;
  if (readsError) throw readsError;
  const mine = new Map<string, string>(
    (reads ?? []).map((r: { notice_id: string; read_at: string }) => [r.notice_id, r.read_at]));
  return (notices ?? []).map((n: Omit<StaffNotice, "read_at">) => ({ ...n, read_at: mine.get(n.id) ?? null }));
}

/**
 * For the sidebar pill. Never throws: the pill also counts notifications, and a failure here must
 * not blank that count.
 */
export async function countUnreadNotices(): Promise<number> {
  try {
    return unreadNotices(await fetchStaffNotices()).length;
  } catch {
    return 0;
  }
}

export type NoticeLang = "en" | "es";

/** What the Post a notice dialog holds: the notice as written, and the same notice in the other language. */
export type NoticeDraft = {
  title: string;
  body: string;
  /** The language the top two fields are written in. */
  lang: NoticeLang;
  otherTitle: string;
  otherBody: string;
  /** The title and notice the translation was made from; null when it was typed or there is none. */
  translatedFrom: { title: string; body: string } | null;
};

export const EMPTY_NOTICE_DRAFT: NoticeDraft = {
  title: "", body: "", lang: "en", otherTitle: "", otherBody: "", translatedFrom: null,
};

/** Pure: the notice was changed after it was translated, so the translation no longer says the same thing. */
export function translationIsStale(d: NoticeDraft): boolean {
  if (!d.translatedFrom || !(d.otherTitle.trim() || d.otherBody.trim())) return false;
  return d.translatedFrom.title !== d.title.trim() || d.translatedFrom.body !== d.body.trim();
}

/** Pure: why the draft cannot be posted yet, or null when it can. */
export function noticeDraftProblem(d: NoticeDraft): string | null {
  if (!d.title.trim() || !d.body.trim()) return "A notice needs a title and the notice itself.";
  const hasTitle = !!d.otherTitle.trim(), hasBody = !!d.otherBody.trim();
  if (hasTitle !== hasBody) return "The translation needs both a title and the notice, or neither.";
  if (translationIsStale(d)) return "The notice changed after it was translated. Translate it again, or remove the translation.";
  return null;
}

/**
 * Pure: the draft as post_staff_notice stores it. English always goes in title / body and Spanish in
 * title_es / body_es, whichever one was written first - so a notice written in Spanish and
 * translated is stored the same way as one written in English. A notice with no translation is
 * stored as written.
 */
export function noticeToPost(d: NoticeDraft): { title: string; body: string; titleEs?: string; bodyEs?: string } {
  const translated = !!d.otherBody.trim();
  if (!translated) return { title: d.title, body: d.body };
  return d.lang === "en"
    ? { title: d.title, body: d.body, titleEs: d.otherTitle, bodyEs: d.otherBody }
    : { title: d.otherTitle, body: d.otherBody, titleEs: d.title, bodyEs: d.body };
}

/** The same notice in the other language, and which language it was written in. Writes nothing. */
export async function translateNotice(title: string, body: string): Promise<{ source: NoticeLang; title: string; body: string }> {
  const { data, error } = await supabase.functions.invoke("translate-notice", { body: { title, body } });
  if (error) {
    // The function's own message is in the response body, not in error.message.
    let message = "The translation could not be made. Try again, or type it in.";
    try {
      const detail = await (error as { context?: Response }).context?.json();
      if (typeof detail?.error === "string") message = detail.error;
    } catch { /* keep the general message */ }
    throw new Error(message);
  }
  if (!data || (data.source !== "en" && data.source !== "es") || typeof data.body !== "string") {
    throw new Error("The translation came back incomplete. Try again.");
  }
  return { source: data.source, title: String(data.title ?? ""), body: data.body };
}

export async function postStaffNotice(input: {
  title: string; body: string; titleEs?: string; bodyEs?: string;
}): Promise<void> {
  const { error } = await (supabase as any).rpc("post_staff_notice", {
    _title: input.title, _body: input.body,
    _title_es: input.titleEs?.trim() ? input.titleEs : null,
    _body_es: input.bodyEs?.trim() ? input.bodyEs : null,
  });
  if (error) throw error;
}

export async function acknowledgeStaffNotice(id: string): Promise<void> {
  const { error } = await (supabase as any).rpc("acknowledge_staff_notice", { _notice_id: id });
  if (error) throw error;
}

export async function withdrawStaffNotice(id: string): Promise<void> {
  const { error } = await (supabase as any).rpc("withdraw_staff_notice", { _notice_id: id });
  if (error) throw error;
}

/** Admin, owner and auditor only - the function refuses anyone else. */
export async function fetchNoticeReaders(): Promise<NoticeReader[]> {
  const { data, error } = await (supabase as any).rpc("staff_notice_readers");
  if (error) throw error;
  return (data ?? []) as NoticeReader[];
}
