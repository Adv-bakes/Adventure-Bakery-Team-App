// "Record seal check" on a lot's row of the Today page: the CCP 2 checks of one BATCH - a product
// within the day's lot - on its FRM-606 for the day (one record per batch).
//
// The sibling of BakeLoadButton, and it keeps the same rules: the row supplies the product and the
// lot; a passed check is shown for the operator to ACCEPT, and accepting saves it without leaving
// the page; a FAILED check saves nothing and opens the record with the row filled in and Section 3
// flagged; nothing is created by listening.
//
// The tap stands for the trigger, as a headset button does on the open form (HANDS_FREE_IMPLIED),
// so what is said is the hands-free line without "Form 606": "air check passed", "pull test
// passed", "set up, air check passed, vacuum 27".
//
// The menu: SPEAK THE CHECK, ENTER THE CHECK (a small pop-up, saved from there), CHECKS DONE (marks
// the check recorded last), CHECKS NOT FINISHED (takes the mark back), OPEN THE RECORD.
//
// THE LAST CHECK (FRM-606 v3), the same two marks as baking, in the form's own Last check column:
//  - "Last check of this BATCH": this product's checks are finished for the day. The button turns
//    into a small green icon; its menu still opens.
//  - "Last check of this LOT": all the day's checks are finished. Every record of that lot code
//    the operator has open today is signed on its "Monitored by" line and sent to a named reviewer
//    - one request per record, since each batch has its own.
// "Done" is read back from the marks (sealState in today.ts) and stored nowhere else. On a form
// revision without the column, none of it is offered.
//
// "The batch's record" is the signed-in person's FRM-606 draft dated today for this product and
// lot code; with none, one is created with those three answers filled in - but never for a mark
// on its own, which needs a check already recorded.

import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { CheckCircle2, ChevronDown, FilePenLine, Keyboard, Loader2, Mic, RotateCcw, Wind } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import {
  createResponse, fetchProfileNames, saveResponseData, StaleResponseError, type FormResponse,
} from "@/lib/formResponses";
import { emptyValues, getFormSchema, initialsFromName, type FillContext } from "@/lib/formSchema";
import { fetchSignatories, requestSignature, resolveSignatureRequest, type Signatory } from "@/lib/notifications";
import { applyVoiceFill, CHECK_OPTIONS, sameProduct, type CheckOption, type LastLoad, type VoiceFill } from "@/lib/voiceCommands";
import {
  clearLastCheck, handsFreeFailed, hasLastCheckColumn, markLastCheck, parseSealLine, sealButtonFill, SEAL_LAST_VALUES,
  type HandsFreeRow,
} from "@/lib/voiceHandsFree";
import { findTodaysDrafts, newVoiceState } from "@/lib/voiceCommandTarget";
import { normLot } from "@/lib/releaseAssist";
import { speechRecognitionSupported, useSpeechCommand } from "@/hooks/useSpeechCommand";
import { useUserPref } from "@/lib/userPrefs";
import type { SealState } from "@/lib/today";
import { VOICE_MSG } from "@/lib/voiceMessages";
import { TODAY_MSG, type TodayLang } from "@/lib/todayMessages";

type Doc = { id: string; sop_number: string; revision: string | null; content: any };

/** Warnings from applying the row that mean a person should look at the record before it is saved. */
const NEEDS_RECORD = new Set(["limits_changed", "no_column", "no_initials", "product_mismatch", "lot_mismatch", "date_mismatch"]);

type Mode = "speak" | "enter" | "done";
/** What is about to be saved: a new check (with or without a mark), or a mark on the check recorded last. */
type Pending = { fill: VoiceFill | null; last?: LastLoad; transcript: string };
type Result = "" | "pass" | "fail";

// The pop-up sits on a cream panel, where the default field looks switched off: white, with a clear edge.
const FIELD = "bg-white border-[#2A1F0E]/75 text-[#2A1F0E] font-medium placeholder:font-normal placeholder:text-[#2A1F0E]/55 focus-visible:ring-[#C89B3C]";
const LABEL = "text-xs font-medium text-[#2A1F0E]";
const GOLD = "bg-[#C89B3C] text-[#2A1F0E] hover:bg-[#C89B3C]/90";

export function SealCheckButton({ doc, lot, product, today, state, lang, disabled, onSaved }: {
  doc: Doc;
  lot: string;
  product: string;
  /** yyyy-MM-dd on the device: the production date of the day's record. */
  today: string;
  /** How far this batch's checks have got today, read from the records. */
  state: SealState;
  lang: TodayLang;
  disabled?: boolean;
  onSaved: () => void;
}) {
  // The dialog's common wording (Accept, Try again, Heard ...) is shared with the bake button.
  const M = TODAY_MSG[lang].bake;
  const S = TODAY_MSG[lang].seal;
  const navigate = useNavigate();
  const schema = getFormSchema(doc.content);
  const canMark = hasLastCheckColumn(schema);
  const [busy, setBusy] = useState(false);
  // Which pop-up, and whether it is showing: kept apart so its wording does not change while it fades out.
  const [mode, setMode] = useState<Mode>("speak");
  const [showing, setShowing] = useState(false);
  const [heardLine, setHeardLine] = useState<{ transcript: string; ok: boolean } | null>(null);
  const [pending, setPending] = useState<Pending | null>(null);
  const [typed, setTyped] = useState("");
  const [entry, setEntry] = useState<{ check: CheckOption; visual: Result; pull: Result; vacuum: string }>({ check: "In process", visual: "", pull: "", vacuum: "" });
  const [choice, setChoice] = useState<LastLoad | "none">("none");
  const [ctx, setCtx] = useState<FillContext>({ userInitials: "" });
  const [signer, setSigner] = useState<{ id: string; name: string } | null>(null);
  const [reviewers, setReviewers] = useState<Signatory[] | null>(null);
  // Who this person last sent a record to: theirs, on any device. Shared with the bake button.
  const [reviewerPref, setReviewerPref] = useUserPref<string>("bake.reviewer", "");
  const [reviewerPick, setReviewerPick] = useState<string | null>(null);
  const live = useRef(true);
  useEffect(() => () => { live.current = false; }, []);

  const reviewerId = (() => {
    const list = reviewers ?? [];
    if (reviewerPick && list.some(r => r.id === reviewerPick)) return reviewerPick;
    if (reviewerPref && list.some(r => r.id === reviewerPref)) return reviewerPref;
    return list.length === 1 ? list[0].id : "";
  })();

  const isMine = (d: FormResponse) => sameProduct(String(d.data?.product ?? ""), product);
  /** The signed-in person's FRM-606 drafts dated today for this lot code: this batch's, and the other batches'. */
  const lotDrafts = async (): Promise<FormResponse[]> =>
    (await findTodaysDrafts(doc.id, today)).filter(d => normLot(d.data?.lot_code) === normLot(lot));
  /** The batch's record for today, created if there is none. Only ever called after a tap that needs it. */
  const batchRecord = async (): Promise<FormResponse> =>
    (await lotDrafts()).find(isMine) ?? (await createResponse(doc, { production_date: today, product, lot_code: lot }));

  /** With a row, it is handed over unsaved; with none, the record simply opens. */
  const openRecord = async (f: VoiceFill | null, transcript: string) => {
    setBusy(true);
    try {
      const r = await batchRecord();
      navigate(`/team/compliance/forms/${doc.id}/entries/${r.id}?from=today`, f ? {
        state: { voiceCommand: newVoiceState(r.id, f, transcript, lang) },
      } : undefined);
    } catch (e) {
      console.error(e);
      toast.error(e instanceof Error ? e.message : S.openFailed);
      if (live.current) setBusy(false);
    }
  };

  /** Whose name and initials go on the row, and who a finished record can be sent to. */
  const loadPeople = () => {
    supabase.auth.getUser().then(async ({ data }) => {
      const id = data?.user?.id;
      if (!id) return;
      const names = await fetchProfileNames([id]).catch(() => new Map<string, string>());
      if (!live.current) return;
      const name = names.get(id) ?? "";
      setCtx({ userInitials: initialsFromName(name) });
      setSigner({ id, name });
    });
    if (canMark && reviewers === null) fetchSignatories().then(r => { if (live.current) setReviewers(r); }).catch(() => { if (live.current) setReviewers([]); });
  };

  const open = (m: Mode) => {
    setHeardLine(null); setPending(null); setTyped(""); setEntry({ check: "In process", visual: "", pull: "", vacuum: "" });
    setChoice(m === "done" ? (state.done === "batch" ? "lot" : "batch") : "none");
    // Started inside the tap, which is what lets a browser open the microphone.
    if (m === "speak" && speechRecognitionSupported) speech.start();
    loadPeople();
    setMode(m);
    // The dialog opens once the menu has finished closing: opened in the same tick, the two fight
    // over focus and the page can be left not taking taps.
    setTimeout(() => { if (live.current) setShowing(true); }, 0);
  };
  const close = () => { speech.reset(); setShowing(false); };

  /** A check, spoken, typed as a line, or entered in the pop-up: shown, saved, or sent to the record. */
  const take = (row: HandsFreeRow, last: LastLoad | undefined, transcript: string, direct: boolean) => {
    const f = sealButtonFill({ product, lot }, row, new Date(), lang, last);
    const p: Pending = { fill: f, last, transcript };
    // A failed check is never accepted from a summary: it goes to the record, with Section 3.
    if (handsFreeFailed(row)) {
      toast.error(S.failLead);
      setShowing(false);
      openRecord(f, transcript);
      return;
    }
    setPending(p);
    // The pop-up is its own review: what was chosen there is saved without a second summary.
    if (direct) void accept(p);
  };

  const heard = (alternatives: string[]) => {
    const line = parseSealLine(alternatives, lang);
    if (line.markOnly && line.last) { setHeardLine({ transcript: line.transcript, ok: true }); setPending({ fill: null, last: line.last, transcript: line.transcript }); return; }
    // Not understood: what was heard goes into the box, so a small correction is enough.
    if (!line.row) { setHeardLine({ transcript: line.transcript, ok: false }); setPending(null); setTyped(line.transcript); return; }
    setHeardLine({ transcript: line.transcript, ok: true });
    take(line.row, line.last, line.transcript, false);
  };

  const speech = useSpeechCommand(alternatives => heard(alternatives), { lang });

  const again = () => {
    setHeardLine(null); setPending(null); setTyped("");
    if (speechRecognitionSupported) speech.start();
  };

  const signed = (values: Record<string, any>) => {
    if (!signer?.name || values.monitored_by?.signed_at) return values;
    return { ...values, monitored_by: { user_id: signer.id, name: signer.name, signed_at: new Date().toISOString() } };
  };

  const accept = async (p: Pending) => {
    setBusy(true);
    try {
      let sent: string[] = [];
      const save = async (): Promise<"saved" | "open" | "noload"> => {
        const drafts = await lotDrafts();
        // A mark on its own never creates a record: there must already be a check to put it on.
        const r = drafts.find(isMine) ?? (p.fill ? await createResponse(doc, { production_date: today, product, lot_code: lot }) : null);
        if (!r) return "noload";
        // A draft started on an earlier revision of the form has its own layout: the entry page resolves it.
        if (!schema || r.form_revision !== doc.revision) return "open";
        let values: Record<string, any> = { ...emptyValues(schema, ctx), ...(r.data ?? {}) };
        if (p.fill) {
          const res = applyVoiceFill(schema, values, p.fill, ctx, lang);
          if (!res.ok || (res.warnings ?? []).some(w => NEEDS_RECORD.has(w.code ?? ""))) return "open";
          values = res.values as Record<string, any>;
        } else {
          const marked = markLastCheck(values, p.last as LastLoad);
          if (!marked) return "noload";
          values = marked.values;
        }
        // The last check of the lot is the operator saying the day's checks are complete: their line is signed.
        if (p.last === "lot") values = signed(values);
        sent = [(await saveResponseData(r.id, values, r.updated_at)).id];
        if (p.last === "lot") {
          // Each batch has its own record: the others of this lot are signed and sent too.
          for (const other of drafts.filter(d => d.id !== r.id && d.form_revision === doc.revision)) {
            const data = { ...(other.data ?? {}) };
            const next = signed(data);
            if (next !== data) await saveResponseData(other.id, next, other.updated_at);
            sent.push(other.id);
          }
        }
        return "saved";
      };
      let outcome: "saved" | "open" | "noload";
      try { outcome = await save(); }
      catch (e) {
        // Somebody saved a record in between: read them again and add to what is there now.
        if (!(e instanceof StaleResponseError)) throw e;
        outcome = await save();
      }
      if (outcome === "noload") { toast.error(S.noCheckYet); setBusy(false); return; }
      if (outcome === "open") {
        toast.message(M.needsRecord);
        setShowing(false);
        await openRecord(p.fill, p.transcript);
        return;
      }
      if (p.last === "lot") {
        const reviewer = (reviewers ?? []).find(r => r.id === reviewerId);
        try {
          if (!reviewer) throw new Error("no reviewer");
          for (const id of sent) await requestSignature(id, reviewer.id, S.reviewNote(today, lot, product));
          setReviewerPref(reviewer.id);
          toast.success(S.savedLot(lot, reviewer.name, sent.length));
        } catch (e) {
          console.error(e);
          toast.error(M.reviewFailed);
        }
      } else {
        toast.success(p.last === "batch" ? S.savedBatch(lot, product) : S.saved(lot, product));
      }
      setShowing(false);
      setBusy(false);
      onSaved();
    } catch (e) {
      console.error(e);
      toast.error(e instanceof Error ? e.message : S.openFailed);
      if (live.current) setBusy(false);
    }
  };

  /** "Checks not finished": this batch's marks come off, the lot is reopened, review requests are withdrawn. */
  const reopen = async () => {
    setBusy(true);
    try {
      const run = async () => {
        const drafts = await lotDrafts();
        let changed = false;
        let hadLot = false;
        for (const d of drafts) {
          const c = clearLastCheck({ ...(d.data ?? {}) }, isMine(d));
          hadLot = hadLot || c.hadLot;
          if (!c.changed) continue;
          await saveResponseData(d.id, c.values as Record<string, any>, d.updated_at);
          changed = true;
        }
        return changed ? { ids: drafts.map(d => d.id), hadLot } : null;
      };
      let done: { ids: string[]; hadLot: boolean } | null;
      try { done = await run(); }
      catch (e) { if (!(e instanceof StaleResponseError)) throw e; done = await run(); }
      if (!done) { toast.message(S.nothingToReopen); setBusy(false); return; }
      if (done.hadLot) {
        for (const id of done.ids) { try { await resolveSignatureRequest(id, "Checks reopened by the requester"); } catch (e) { console.error(e); } }
      }
      toast.success(S.reopened(lot, product));
      setBusy(false);
      onSaved();
    } catch (e) {
      console.error(e);
      toast.error(e instanceof Error ? e.message : S.openFailed);
      if (live.current) setBusy(false);
    }
  };

  const enteredRow: HandsFreeRow | null = (() => {
    if (!entry.visual && !entry.pull) return null;
    const vacuum = entry.vacuum.trim();
    if (vacuum !== "" && !Number.isFinite(Number(vacuum))) return null;
    const row: HandsFreeRow = { check: entry.check };
    if (entry.visual) row.visual = entry.visual;
    if (entry.pull) row.pull_test = entry.pull;
    if (vacuum !== "") row.vacuum_reading = vacuum;
    return row;
  })();
  const enteredLast = choice === "none" ? undefined : choice;

  const listening = speech.state === "listening";
  const finished = state.done !== "open";
  const needsReviewer = (which: LastLoad | undefined) => which === "lot" && !reviewerId;

  const reviewerSelect = (
    <label className="block space-y-1">
      <span className={LABEL}>{M.sendTo}</span>
      {reviewers !== null && reviewers.length === 0 ? (
        <p className="text-amber-800">{M.noReviewers}</p>
      ) : (
        <select
          className="w-full rounded-md border border-[#2A1F0E]/75 bg-white text-[#2A1F0E] font-medium px-2 py-2 text-sm"
          value={reviewerId} onChange={e => setReviewerPick(e.target.value)} disabled={reviewers === null}
        >
          <option value="">{M.choose}</option>
          {(reviewers ?? []).map(r => <option key={r.id} value={r.id}>{r.name}</option>)}
        </select>
      )}
    </label>
  );

  const pressed = "border-emerald-600 bg-emerald-50 text-emerald-800";
  const lastChoice = (options: (LastLoad | "none")[]) => (
    <div className="space-y-2">
      <p className={LABEL}>{S.lastLabel}</p>
      <div className="flex flex-wrap gap-2">
        {options.map(o => (
          <Button key={o} type="button" size="sm" variant="outline" onClick={() => setChoice(o)} aria-pressed={choice === o} className={choice === o ? pressed : ""}>
            {o === "none" ? S.lastNone : o === "batch" ? S.lastBatch : S.lastLot}
          </Button>
        ))}
      </div>
      {choice !== "none" && <p className="text-xs opacity-80">{choice === "batch" ? S.lastBatchHelp : S.lastLotHelp}</p>}
      {choice === "lot" && reviewerSelect}
    </div>
  );

  const resultPick = (label: string, value: Result, set: (v: Result) => void) => (
    <div className="space-y-1">
      <p className={LABEL}>{label}</p>
      <div className="flex gap-2">
        {(["pass", "fail", ""] as Result[]).map(v => (
          <Button
            key={v || "none"} type="button" size="sm" variant="outline" onClick={() => set(v)} aria-pressed={value === v}
            className={value === v ? (v === "fail" ? "border-red-500 bg-red-50 text-red-700" : pressed) : ""}
          >
            {v === "pass" ? S.pass : v === "fail" ? S.fail : S.notDoneYet}
          </Button>
        ))}
      </div>
    </div>
  );

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          {finished ? (
            // Finished for the operator: small and green, the label kept for a hover and a screen reader.
            <Button
              size="sm" variant="outline" disabled={disabled || busy} title={S.doneTip} aria-label={S.doneTip}
              className="px-2 border-emerald-600/50 bg-emerald-50 text-emerald-800 hover:bg-emerald-100 hover:text-emerald-900"
            >
              {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Wind className="w-4 h-4" />}
              <ChevronDown className="w-3.5 h-3.5 ml-0.5 opacity-70" />
            </Button>
          ) : (
            <Button size="sm" variant="outline" disabled={disabled || busy}>
              {busy ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : <Wind className="w-4 h-4 mr-1" />}
              {S.button}
              <ChevronDown className="w-3.5 h-3.5 ml-1 opacity-70" />
            </Button>
          )}
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem onSelect={() => open("speak")}><Mic className="w-4 h-4 mr-2" />{S.speak}</DropdownMenuItem>
          <DropdownMenuItem onSelect={() => open("enter")}><Keyboard className="w-4 h-4 mr-2" />{S.enter}</DropdownMenuItem>
          {canMark && state.loads > 0 && state.done !== "lot" && (
            <DropdownMenuItem onSelect={() => open("done")}><CheckCircle2 className="w-4 h-4 mr-2" />{S.done}</DropdownMenuItem>
          )}
          {canMark && finished && (
            <DropdownMenuItem onSelect={reopen}><RotateCcw className="w-4 h-4 mr-2" />{S.notDone}</DropdownMenuItem>
          )}
          <DropdownMenuSeparator />
          <DropdownMenuItem onSelect={() => openRecord(null, "")}>
            <FilePenLine className="w-4 h-4 mr-2" />{S.open}
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <Dialog open={showing} onOpenChange={o => { if (!o) close(); }}>
        <DialogContent className="max-w-md" lang={lang}>
          <DialogHeader>
            <DialogTitle className="text-base">{mode === "done" ? S.doneTitle(lot, product) : S.title(lot, product)}</DialogTitle>
            <DialogDescription>
              {mode === "speak" ? `${S.say}${canMark ? ` ${S.sayLast}` : ""}` : mode === "done" ? S.lastLabel : S.enter}
            </DialogDescription>
          </DialogHeader>

          {mode === "speak" && (
            <div className="space-y-3 text-sm">
              {!speechRecognitionSupported && <p className="text-amber-800">{M.noSpeech}</p>}
              {listening && (
                <p className="flex items-center gap-2 font-medium">
                  <Mic className="w-4 h-4 text-[#C89B3C] animate-pulse" />{M.listening}
                  {speech.interim && <span className="font-normal italic opacity-80">{speech.interim}</span>}
                </p>
              )}
              {speech.error && !listening && <p className="text-destructive">{speech.error}</p>}
              {heardLine && heardLine.transcript && <p className="italic opacity-80">{M.heard(heardLine.transcript)}</p>}
              {heardLine && !heardLine.ok && <p className="text-amber-800">{S.unclear}</p>}

              {pending && (
                <div className="rounded-md border p-3 space-y-2">
                  {pending.fill ? (
                    <>
                      <p className="font-medium text-emerald-700">{S.passLead}</p>
                      <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1">
                        {pending.fill.summary.map(line => (
                          <div key={line.key ?? line.label} className="contents">
                            <dt className="opacity-70">{line.label}</dt>
                            <dd className={line.flag === "pass" ? "font-medium text-emerald-700" : line.flag === "fail" ? "font-medium text-destructive" : ""}>{line.value}</dd>
                          </div>
                        ))}
                        <div className="contents">
                          <dt className="opacity-70">{M.initials}</dt>
                          <dd>{ctx.userInitials || "—"}</dd>
                        </div>
                      </dl>
                    </>
                  ) : (
                    <p className="font-medium text-emerald-700">{S.markOnly(SEAL_LAST_VALUES[pending.last as LastLoad])}</p>
                  )}
                  {pending.last && <p className="text-xs opacity-80">{pending.last === "batch" ? S.lastBatchHelp : S.lastLotHelp}</p>}
                  {pending.last === "lot" && reviewerSelect}
                </div>
              )}

              {!pending && (
                <form className="flex items-center gap-2" onSubmit={e => { e.preventDefault(); if (typed.trim()) { speech.reset(); heard([typed]); } }}>
                  <Input className={FIELD} value={typed} onChange={e => setTyped(e.target.value)} placeholder={M.typeHere} aria-label={M.typeHere} />
                  <Button type="submit" size="sm" variant="outline" disabled={!typed.trim() || busy}>{M.use}</Button>
                </form>
              )}
            </div>
          )}

          {mode === "enter" && (
            <form
              id="seal-entry" className="space-y-3 text-sm"
              onSubmit={e => { e.preventDefault(); if (enteredRow && !needsReviewer(enteredLast) && !busy) take(enteredRow, enteredLast, "", true); }}
            >
              <div className="grid grid-cols-2 gap-2">
                <label className="flex flex-col justify-end gap-1">
                  <span className={LABEL}>{S.checkType}</span>
                  <select
                    className="w-full rounded-md border border-[#2A1F0E]/75 bg-white text-[#2A1F0E] font-medium px-2 py-2 text-sm"
                    value={entry.check} onChange={e => setEntry({ ...entry, check: e.target.value as CheckOption })}
                  >
                    {CHECK_OPTIONS.map(o => <option key={o} value={o}>{VOICE_MSG[lang].summary.checkValue(o)}</option>)}
                  </select>
                </label>
                <label className="flex flex-col justify-end gap-1">
                  <span className={LABEL}>{S.vacuum}</span>
                  <Input className={FIELD} inputMode="decimal" value={entry.vacuum} onChange={e => setEntry({ ...entry, vacuum: e.target.value })} />
                </label>
              </div>
              {resultPick(S.airCheck, entry.visual, v => setEntry({ ...entry, visual: v }))}
              {resultPick(S.pullTest, entry.pull, v => setEntry({ ...entry, pull: v }))}
              {canMark && lastChoice(["none", "batch", "lot"])}
            </form>
          )}

          {mode === "done" && <div className="text-sm">{lastChoice(["batch", "lot"])}</div>}

          <DialogFooter className="gap-2 sm:gap-2 flex-wrap">
            {mode === "speak" && pending && (
              <>
                {pending.fill && <Button variant="ghost" size="sm" disabled={busy} onClick={() => { setShowing(false); openRecord(pending.fill, pending.transcript); }}>{M.openInstead}</Button>}
                <Button variant="outline" size="sm" disabled={busy} onClick={again}>{M.again}</Button>
                <Button size="sm" disabled={busy || needsReviewer(pending.last)} onClick={() => accept(pending)} className={GOLD}>
                  {busy && <Loader2 className="w-4 h-4 animate-spin mr-1" />}{M.accept}
                </Button>
              </>
            )}
            {mode === "speak" && !pending && (
              <>
                <Button variant="ghost" size="sm" onClick={close}>{M.cancel}</Button>
                {!listening && speechRecognitionSupported && <Button variant="outline" size="sm" onClick={again}>{M.again}</Button>}
              </>
            )}
            {mode === "enter" && (
              <>
                <Button variant="ghost" size="sm" disabled={busy} onClick={close}>{M.cancel}</Button>
                <Button type="submit" form="seal-entry" size="sm" disabled={busy || !enteredRow || needsReviewer(enteredLast)} className={GOLD}>
                  {busy && <Loader2 className="w-4 h-4 animate-spin mr-1" />}{M.save}
                </Button>
              </>
            )}
            {mode === "done" && (
              <>
                <Button variant="ghost" size="sm" disabled={busy} onClick={close}>{M.cancel}</Button>
                <Button
                  size="sm" disabled={busy || choice === "none" || needsReviewer(choice)} className={GOLD}
                  onClick={() => accept({ fill: null, last: choice as LastLoad, transcript: "" })}
                >
                  {busy && <Loader2 className="w-4 h-4 animate-spin mr-1" />}{M.save}
                </Button>
              </>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
