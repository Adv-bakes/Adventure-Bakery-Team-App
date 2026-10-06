// Staff notices on the Notifications page (D-03, SQF 2.1.1.2).
//
// A notice is how management tells the whole team something: this year's food safety objectives,
// last month's results, a changed rule. It stays at the top of the page for each person until they
// tap "I have read this", and the post keeps the list of who read it and when - that list is the
// evidence the notice was communicated.
//
// A notice cannot be edited once posted, because people have put their name to that wording. A
// wrong one is withdrawn and posted again.

import { useCallback, useEffect, useState } from "react";
import { AlertTriangle, Check, ChevronDown, Languages, Loader2, Megaphone, Plus } from "lucide-react";
import { toast } from "sonner";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { useUserRole } from "@/hooks/useUserRole";
import { fetchProfileNames } from "@/lib/formResponses";
import {
  EMPTY_NOTICE_DRAFT, NoticeDraft, NoticeLang, NoticeReader, StaffNotice, acknowledgeStaffNotice,
  fetchNoticeReaders, fetchStaffNotices, noticeDraftProblem, noticeToPost, postStaffNotice, readTally,
  translateNotice, translationIsStale, unreadNotices, withdrawStaffNotice,
} from "@/lib/staffNotices";

const LANG_NAME: Record<NoticeLang, string> = { en: "English", es: "Spanish" };
const otherLang = (l: NoticeLang): NoticeLang => (l === "en" ? "es" : "en");

const when = (iso: string) => new Date(iso).toLocaleString([], { dateStyle: "medium", timeStyle: "short" });

function NoticeText({ n }: { n: StaffNotice }) {
  return (
    <>
      <p className="font-medium leading-snug">{n.title}</p>
      <p className="text-sm mt-1 whitespace-pre-line">{n.body}</p>
      {n.body_es && (
        <div className="mt-3 pt-3 border-t" lang="es">
          {n.title_es && <p className="font-medium leading-snug">{n.title_es}</p>}
          <p className="text-sm mt-1 whitespace-pre-line">{n.body_es}</p>
        </div>
      )}
    </>
  );
}

function ReaderList({ readers, noticeId }: { readers: NoticeReader[]; noticeId: string }) {
  const rows = readers.filter((r) => r.notice_id === noticeId);
  const read = rows.filter((r) => r.read_at);
  const waiting = rows.filter((r) => !r.read_at);
  return (
    <div className="mt-2 grid gap-3 sm:grid-cols-2 text-xs">
      <div>
        <p className="font-medium">Read ({read.length})</p>
        {read.map((r) => (
          <p key={r.user_id} className="tp-card-dim">{r.full_name} · {when(r.read_at!)}</p>
        ))}
      </div>
      <div>
        <p className="font-medium">Not yet read ({waiting.length})</p>
        {waiting.length === 0 && <p className="tp-card-dim">Everyone has read it.</p>}
        {waiting.map((r) => <p key={r.user_id} className="tp-card-dim">{r.full_name}</p>)}
      </div>
    </div>
  );
}

export default function StaffNotices({ onChanged }: { onChanged?: () => void }) {
  const { hasRole, loading: roleLoading } = useUserRole();
  const canPost = hasRole("admin") || hasRole("owner");

  const [notices, setNotices] = useState<StaffNotice[]>([]);
  const [readers, setReaders] = useState<NoticeReader[]>([]);
  const [names, setNames] = useState<Map<string, string>>(new Map());
  // Until the tables exist (the page can deploy before the migration is pushed) the section is
  // simply absent - it must never break the notifications below it.
  const [available, setAvailable] = useState(false);
  const [showEarlier, setShowEarlier] = useState(false);
  const [openReaders, setOpenReaders] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [withdrawTarget, setWithdrawTarget] = useState<StaffNotice | null>(null);

  const [posting, setPosting] = useState(false);
  const [saving, setSaving] = useState(false);
  const [draft, setDraft] = useState<NoticeDraft>(EMPTY_NOTICE_DRAFT);
  const [translating, setTranslating] = useState(false);

  const load = useCallback(async () => {
    try {
      const rows = await fetchStaffNotices();
      setNotices(rows);
      setAvailable(true);
      const ids = [...new Set(rows.map((n) => n.posted_by))];
      setNames(ids.length ? await fetchProfileNames(ids) : new Map());
    } catch {
      setAvailable(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  useEffect(() => {
    if (roleLoading || !canPost || !available) return;
    fetchNoticeReaders().then(setReaders).catch(() => setReaders([]));
  }, [roleLoading, canPost, available, notices]);

  const acknowledge = async (n: StaffNotice) => {
    setBusyId(n.id);
    try {
      await acknowledgeStaffNotice(n.id);
      await load();
      onChanged?.();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not record that you read it");
    } finally {
      setBusyId(null);
    }
  };

  const post = async () => {
    setSaving(true);
    try {
      await postStaffNotice(noticeToPost(draft));
      toast.success("Notice posted to the team");
      setPosting(false);
      setDraft(EMPTY_NOTICE_DRAFT);
      await load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not post the notice");
    } finally {
      setSaving(false);
    }
  };

  const translate = async () => {
    const title = draft.title.trim(), body = draft.body.trim();
    setTranslating(true);
    try {
      const t = await translateNotice(title, body);
      // Only if the notice is still what was sent: a translation of older wording is worse than none.
      setDraft((d) => (d.title.trim() === title && d.body.trim() === body
        ? { ...d, lang: t.source, otherTitle: t.title, otherBody: t.body, translatedFrom: { title, body } }
        : d));
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "The translation could not be made");
    } finally {
      setTranslating(false);
    }
  };

  const withdraw = async () => {
    if (!withdrawTarget) return;
    setBusyId(withdrawTarget.id);
    try {
      await withdrawStaffNotice(withdrawTarget.id);
      toast.success("Notice withdrawn");
      setWithdrawTarget(null);
      await load();
      onChanged?.();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not withdraw the notice");
    } finally {
      setBusyId(null);
    }
  };

  if (!available) return null;
  const unread = unreadNotices(notices);
  const earlier = notices.filter((n) => !unread.includes(n));
  if (!canPost && notices.length === 0) return null;

  const postedLine = (n: StaffNotice) =>
    `Posted by ${names.get(n.posted_by) ?? "a team member"} · ${when(n.posted_at)}`;

  const tally = (n: StaffNotice) => {
    if (!canPost) return null;
    const t = readTally(readers, n.id);
    if (!t.total) return null;
    return (
      <button
        type="button"
        className="text-xs tp-card-gold hover:underline font-medium"
        onClick={() => setOpenReaders((v) => (v === n.id ? null : n.id))}
      >
        Read by {t.read} of {t.total}
      </button>
    );
  };

  return (
    <section className="space-y-2">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <h2 className="text-sm font-semibold tp-on-bg-dim flex items-center gap-2">
          <Megaphone className="w-4 h-4 text-[hsl(var(--tp-gold))]" />
          Notices{unread.length > 0 ? ` to read (${unread.length})` : ""}
        </h2>
        {canPost && (
          <Button size="sm" variant="outline" onClick={() => setPosting(true)}>
            <Plus className="w-4 h-4 mr-1" /> Post a notice
          </Button>
        )}
      </div>

      {unread.map((n) => (
        <Card key={n.id} className="border-l-4 border-l-[hsl(var(--tp-gold))]">
          <CardContent className="pt-4 pb-4">
            <NoticeText n={n} />
            <div className="flex items-center justify-between gap-3 flex-wrap mt-3">
              <span className="text-xs tp-card-dim">{postedLine(n)}</span>
              <Button size="sm" onClick={() => void acknowledge(n)} disabled={busyId === n.id}>
                {busyId === n.id
                  ? <Loader2 className="w-4 h-4 animate-spin" />
                  : <><Check className="w-4 h-4 mr-1" /> I have read this</>}
              </Button>
            </div>
          </CardContent>
        </Card>
      ))}

      {unread.length === 0 && notices.length === 0 && (
        <p className="text-sm tp-on-bg-dim">No notices have been posted yet.</p>
      )}

      {earlier.length > 0 && (
        <div>
          <button
            type="button"
            className="flex items-center gap-1 text-sm tp-on-bg-dim hover:text-[#F5F1E6]"
            onClick={() => setShowEarlier((v) => !v)}
          >
            <ChevronDown className={`w-4 h-4 transition-transform ${showEarlier ? "" : "-rotate-90"}`} />
            Earlier notices ({earlier.length})
          </button>
          {showEarlier && (
            <Card className="mt-2">
              <CardContent className="pt-4 space-y-4">
                {earlier.map((n) => (
                  <div key={n.id} className="border-b last:border-0 pb-4 last:pb-0">
                    <NoticeText n={n} />
                    <div className="flex items-center gap-3 flex-wrap mt-2">
                      <span className="text-xs tp-card-dim">{postedLine(n)}</span>
                      {n.withdrawn_at
                        ? <span className="text-xs text-destructive">Withdrawn {when(n.withdrawn_at)}</span>
                        : n.read_at && <span className="text-xs tp-card-dim">You read it {when(n.read_at)}</span>}
                      {tally(n)}
                      {canPost && !n.withdrawn_at && (
                        <button
                          type="button"
                          className="text-xs tp-card-dim hover:underline"
                          onClick={() => setWithdrawTarget(n)}
                        >
                          Withdraw
                        </button>
                      )}
                    </div>
                    {openReaders === n.id && <ReaderList readers={readers} noticeId={n.id} />}
                  </div>
                ))}
              </CardContent>
            </Card>
          )}
        </div>
      )}

      <Dialog open={posting} onOpenChange={(v) => { if (!saving) setPosting(v); }}>
        <DialogContent className="max-w-xl">
          <DialogHeader>
            <DialogTitle>Post a notice to the team</DialogTitle>
            <DialogDescription>
              Everyone sees it until they tap "I have read this". A notice cannot be edited after it
              is posted; a wrong one is withdrawn and posted again.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <p className="text-xs text-muted-foreground">
              Write it in English or Spanish, then tap Translate for the other language.
            </p>
            <div className="space-y-1">
              <Label htmlFor="notice-title">Title</Label>
              <Input id="notice-title" maxLength={200} value={draft.title}
                onChange={(e) => setDraft({ ...draft, title: e.target.value })} />
            </div>
            <div className="space-y-1">
              <Label htmlFor="notice-body">Notice</Label>
              <Textarea id="notice-body" rows={5} maxLength={10000} value={draft.body}
                onChange={(e) => setDraft({ ...draft, body: e.target.value })} />
            </div>
            <div className="flex items-center justify-between gap-3 flex-wrap">
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <span>Written in</span>
                {(["en", "es"] as NoticeLang[]).map((l) => (
                  <button
                    key={l}
                    type="button"
                    aria-pressed={draft.lang === l}
                    onClick={() => setDraft({ ...draft, lang: l })}
                    className={`rounded-full border px-2.5 py-0.5 ${draft.lang === l
                      ? "border-[#C89B3C] bg-[#C89B3C]/15 text-[#2A1F0E] font-medium" : "hover:bg-muted"}`}
                  >
                    {LANG_NAME[l]}
                  </button>
                ))}
              </div>
              <Button type="button" size="sm" variant="outline" onClick={() => void translate()}
                disabled={translating || saving || !draft.body.trim()}>
                {translating
                  ? <><Loader2 className="w-4 h-4 mr-1 animate-spin" /> Translating</>
                  : <><Languages className="w-4 h-4 mr-1" /> {draft.otherBody.trim() ? "Translate again" : "Translate"}</>}
              </Button>
            </div>
            <div className="space-y-1">
              <Label htmlFor="notice-title-other">Title in {LANG_NAME[otherLang(draft.lang)]} (optional)</Label>
              <Input id="notice-title-other" maxLength={200} value={draft.otherTitle} lang={otherLang(draft.lang)}
                onChange={(e) => setDraft({ ...draft, otherTitle: e.target.value })} />
            </div>
            <div className="space-y-1">
              <Label htmlFor="notice-body-other">Notice in {LANG_NAME[otherLang(draft.lang)]} (optional)</Label>
              <Textarea id="notice-body-other" rows={5} maxLength={10000} value={draft.otherBody} lang={otherLang(draft.lang)}
                onChange={(e) => setDraft({ ...draft, otherBody: e.target.value })} />
            </div>
            {draft.translatedFrom && draft.otherBody.trim() && !translationIsStale(draft) && (
              <p className="text-xs text-muted-foreground">
                Translated by AI. If you can, have someone who reads {LANG_NAME[otherLang(draft.lang)]} check it
                before you post: a notice cannot be changed afterwards.
              </p>
            )}
            {translationIsStale(draft) && (
              <div className="flex items-start gap-2 text-xs rounded border border-amber-400 bg-amber-50 text-amber-900 p-2">
                <AlertTriangle className="w-3.5 h-3.5 mt-0.5 shrink-0" />
                <p className="flex-1">
                  The notice changed after it was translated. Translate it again, or{" "}
                  <button type="button" className="underline"
                    onClick={() => setDraft({ ...draft, otherTitle: "", otherBody: "", translatedFrom: null })}>
                    remove the translation
                  </button>.
                </p>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setPosting(false)} disabled={saving}>Cancel</Button>
            <Button onClick={() => void post()} disabled={saving || translating || !!noticeDraftProblem(draft)}>
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : "Post to the team"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!withdrawTarget} onOpenChange={(v) => { if (!v) setWithdrawTarget(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Withdraw this notice?</AlertDialogTitle>
            <AlertDialogDescription>
              It stops being shown to people who have not read it. The notice and the list of who
              read it are kept. This cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={!!busyId}>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={(e) => { e.preventDefault(); void withdraw(); }} disabled={!!busyId}>
              {busyId ? <Loader2 className="w-4 h-4 animate-spin" /> : "Withdraw it"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </section>
  );
}
