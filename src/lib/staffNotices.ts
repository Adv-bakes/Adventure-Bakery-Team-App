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
