// "Record bake" on a lot's row of the Today page: the oven loads of one BATCH - a product within
// the day's lot ("Lot 6279 · Rum Cake - Pumpkin Spice") - on the day's CCP 1 record (FRM-507, one
// record per production day from v2).
//
// The row already knows the product and the lot, so they are never said or typed again. The menu:
//
//  - SPEAK THE READING: "Temperature 350, bake time 27" (and "probe 180" if the load was probed).
//    Within the limits, the row is shown for the operator to ACCEPT, and accepting saves it without
//    leaving the page. A limit missed (or a spoken "failed") saves nothing: the record opens with
//    the row filled in and Section 3 flagged, because a deviation needs more than a row.
//  - ENTER THE READING: the same three numbers in a small pop-up, saved from there.
//  - BAKING DONE: marks the load recorded last, for when it was recorded without saying so.
//  - OPEN THE RECORD: the day's record opens with a row carrying the time, product, lot and
//    initials, for the readings to be typed.
//
// THE LAST LOAD (FRM-507 v3). A final load carries a mark in the form's own Last load column:
//  - "Last load of this BATCH": this product is finished for the day. The button turns into a
//    small green flame; its menu still opens, for a late load or to take the mark back.
//  - "Last load of this LOT": all the day's baking is finished. On top of the mark, the operator's
//    "Monitored by" line is signed with their name and the record is sent to a named reviewer
//    (the existing signature request), who finds it in their Notifications.
// It can be said with the reading ("... last load of this batch"), said on its own, chosen in the
// pop-up, or picked from Baking done. "Done" is read back from those marks (bakeState in today.ts)
// and stored nowhere else. On a form revision without the column, none of this is offered.
//
// NOTHING IS CREATED BY LISTENING. The day's record is looked up, or created, only on Accept or
// Save, on a failed reading, or on Open the record - a misheard line must not leave a stray
// record. A mark on its own never creates one. "The day's record" is the signed-in person's draft
// dated today (findDraftForDay), the same rule as the page's other CCP buttons.
//
// Saving with the form closed is always an explicit tap on something the operator has read, and
// anything out of the ordinary - a draft on an earlier revision of the form, limits that no longer
// match, a column missing - opens the record instead of saving.

import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { CheckCircle2, ChevronDown, FilePenLine, Flame, Keyboard, Loader2, Mic, RotateCcw } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import {
  createResponse, fetchProfileNames, findDraftForDay, saveResponseData, StaleResponseError, type FormResponse,
} from "@/lib/formResponses";
import { emptyValues, getFormSchema, initialsFromName, type FillContext } from "@/lib/formSchema";
import { fetchSignatories, requestSignature, resolveSignatureRequest, type Signatory } from "@/lib/notifications";
import {
  applyVoiceFill, BAKE_READING_TEXT, buildBakeFill, clearLastLoad, hasLastLoadColumn, LAST_LOAD_VALUES,
  markLastLoad, parseBakeAlternatives, startedBakeFill,
  type BakeReading, type LastLoad, type VoiceFill,
} from "@/lib/voiceCommands";
import { newVoiceState } from "@/lib/voiceCommandTarget";
import { speechRecognitionSupported, useSpeechCommand } from "@/hooks/useSpeechCommand";
import { useUserPref } from "@/lib/userPrefs";
import type { BakeState } from "@/lib/today";
import { TODAY_MSG, type TodayLang } from "@/lib/todayMessages";

type Doc = { id: string; sop_number: string; revision: string | null; content: any };

/** Warnings from applying the row that mean a person should look at the record before it is saved. */
const NEEDS_RECORD = new Set(["limits_changed", "no_column", "no_initials", "product_mismatch", "date_mismatch"]);

type Mode = "speak" | "enter" | "done";
/** What is about to be saved: a new load (with or without a mark), or a mark on the load recorded last. */
type Pending = { fill: VoiceFill | null; last?: LastLoad; transcript: string };

const GOLD = "bg-[#C89B3C] text-[#2A1F0E] hover:bg-[#C89B3C]/90";

export function BakeLoadButton({ doc, lot, product, today, state, lang, disabled, onSaved }: {
  doc: Doc;
  lot: string;
  product: string;
  /** yyyy-MM-dd on the device: the production date of the day's record. */
  today: string;
  /** How far this batch's baking has got today, read from the records. */
  state: BakeState;
  lang: TodayLang;
  disabled?: boolean;
  onSaved: () => void;
}) {
  const M = TODAY_MSG[lang].bake;
  const navigate = useNavigate();
  const schema = getFormSchema(doc.content);
  const canMark = hasLastLoadColumn(schema);
  const [busy, setBusy] = useState(false);
  // Which pop-up, and whether it is showing: kept apart so its wording does not change while it fades out.
  const [mode, setMode] = useState<Mode>("speak");
  const [showing, setShowing] = useState(false);
  const [reading, setReading] = useState<BakeReading | null>(null);
  const [pending, setPending] = useState<Pending | null>(null);
  const [typed, setTyped] = useState("");
  const [entry, setEntry] = useState({ temp: "", minutes: "", probe: "" });
  const [choice, setChoice] = useState<LastLoad | "none">("none");
  const [ctx, setCtx] = useState<FillContext>({ userInitials: "" });
  const [signer, setSigner] = useState<{ id: string; name: string } | null>(null);
  const [reviewers, setReviewers] = useState<Signatory[] | null>(null);
  // Who this person last sent a record to: theirs, on any device.
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

  /** The day's record, created if there is none. Only ever called after a tap that needs it. */
  const dayRecord = async (): Promise<FormResponse> =>
    (await findDraftForDay(doc.id, "production_date", today)) ?? (await createResponse(doc, { production_date: today }));

  /** With a row, it is handed over unsaved; with none, the record simply opens. */
  const openRecord = async (f: VoiceFill | null, transcript: string) => {
    setBusy(true);
    try {
      const r = await dayRecord();
      navigate(`/team/compliance/forms/${doc.id}/entries/${r.id}?from=today`, f ? {
        state: { voiceCommand: newVoiceState(r.id, f, transcript, lang) },
      } : undefined);
    } catch (e) {
      console.error(e);
      toast.error(e instanceof Error ? e.message : M.openFailed);
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
    setReading(null); setPending(null); setTyped(""); setEntry({ temp: "", minutes: "", probe: "" });
    setChoice(m === "done" ? (state.done === "batch" ? "lot" : "batch") : "none");
    // Started inside the tap, which is what lets a browser open the microphone.
    if (m === "speak" && speechRecognitionSupported) speech.start();
    loadPeople();
    // The dialog opens once the menu has finished closing: opened in the same tick, the two fight
    // over focus and the page can be left not taking taps.
    setMode(m);
    setTimeout(() => { if (live.current) setShowing(true); }, 0);
  };
  const close = () => { speech.reset(); setShowing(false); };

  /** A reading, spoken, typed as a line, or entered in the pop-up: judged, then shown or sent on. */
  const take = (r: BakeReading, direct: boolean) => {
    setReading(r);
    if (r.markOnly && r.last) { setPending({ fill: null, last: r.last, transcript: r.transcript }); return; }
    if (!r.ok) { setPending(null); return; }
    const f = buildBakeFill({ product, lot }, r, new Date(), lang);
    const p: Pending = { fill: f, last: r.last, transcript: r.transcript };
    // A deviation is never accepted from a summary: it goes to the record, with Section 3.
    if (f.row.within_limits !== "pass") {
      toast.error(M.failLead);
      setShowing(false);
      openRecord(f, r.transcript);
      return;
    }
    setPending(p);
    // The pop-up is its own review: what was typed there is saved without a second summary.
    if (direct) void accept(p);
  };

  const speech = useSpeechCommand(alternatives => take(parseBakeAlternatives(alternatives, lang, lang), false), { lang });

  const again = () => {
    setReading(null); setPending(null); setTyped("");
    if (speechRecognitionSupported) speech.start();
  };

  const accept = async (p: Pending) => {
    setBusy(true);
    try {
      let savedId = "";
      const save = async (): Promise<"saved" | "open" | "noload"> => {
        // A mark on its own never creates a record: there must already be a load to put it on.
        const r = p.fill ? await dayRecord() : await findDraftForDay(doc.id, "production_date", today);
        if (!r) return "noload";
        // A draft started on an earlier revision of the form has its own layout: the entry page resolves it.
        if (!schema || r.form_revision !== doc.revision) return "open";
        let values: Record<string, any> = { ...emptyValues(schema, ctx), ...(r.data ?? {}) };
        if (p.fill) {
          const res = applyVoiceFill(schema, values, p.fill, ctx, lang);
          if (!res.ok || (res.warnings ?? []).some(w => NEEDS_RECORD.has(w.code ?? ""))) return "open";
          values = res.values as Record<string, any>;
        } else {
          const marked = markLastLoad(values, { product, lot }, p.last as LastLoad);
          if (!marked) return "noload";
          values = marked.values;
        }
        // The last load of the lot is the operator saying the day's baking is complete: their line is signed.
        if (p.last === "lot" && signer?.name && !values.monitored_by?.signed_at) {
          values.monitored_by = { user_id: signer.id, name: signer.name, signed_at: new Date().toISOString() };
        }
        savedId = (await saveResponseData(r.id, values, r.updated_at)).id;
        return "saved";
      };
      let outcome: "saved" | "open" | "noload";
      try { outcome = await save(); }
      catch (e) {
        // Somebody saved the record in between: read it again and add to what is there now.
        if (!(e instanceof StaleResponseError)) throw e;
        outcome = await save();
      }
      if (outcome === "noload") { toast.error(M.noLoadYet); setBusy(false); return; }
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
          await requestSignature(savedId, reviewer.id, M.reviewNote(today, lot));
          setReviewerPref(reviewer.id);
          toast.success(M.savedLot(lot, reviewer.name));
        } catch (e) {
          console.error(e);
          toast.error(M.reviewFailed);
        }
      } else {
        toast.success(p.last === "batch" ? M.savedBatch(lot, product) : M.saved(lot, product));
      }
      setShowing(false);
      setBusy(false);
      onSaved();
    } catch (e) {
      console.error(e);
      toast.error(e instanceof Error ? e.message : M.openFailed);
      if (live.current) setBusy(false);
    }
  };

  /** "Baking not finished": the marks come off this batch's loads, and a request for review is withdrawn. */
  const reopen = async () => {
    setBusy(true);
    try {
      const run = async () => {
        const r = await findDraftForDay(doc.id, "production_date", today);
        const cleared = r ? clearLastLoad({ ...(r.data ?? {}) }, { product, lot }) : null;
        if (!r || !cleared?.changed) return null;
        await saveResponseData(r.id, cleared.values as Record<string, any>, r.updated_at);
        return { id: r.id, lotReopened: cleared.lotReopened };
      };
      let done: { id: string; lotReopened: boolean } | null;
      try { done = await run(); }
      catch (e) { if (!(e instanceof StaleResponseError)) throw e; done = await run(); }
      if (!done) { toast.message(M.nothingToReopen); setBusy(false); return; }
      if (done.lotReopened) {
        try { await resolveSignatureRequest(done.id, "Baking reopened by the requester"); } catch (e) { console.error(e); }
      }
      toast.success(M.reopened(lot, product));
      setBusy(false);
      onSaved();
    } catch (e) {
      console.error(e);
      toast.error(e instanceof Error ? e.message : M.openFailed);
      if (live.current) setBusy(false);
    }
  };

  const num = (v: string) => (v.trim() !== "" && Number.isFinite(Number(v)) ? Number(v) : undefined);
  const entered: BakeReading | null = (() => {
    const temp = num(entry.temp), minutes = num(entry.minutes), probe = num(entry.probe);
    if (temp === undefined || minutes === undefined || (entry.probe.trim() !== "" && probe === undefined)) return null;
    return { ok: true, transcript: "", lang, temp, minutes, probe, last: choice === "none" ? undefined : choice };
  })();

  const listening = speech.state === "listening";
  const card = BAKE_READING_TEXT[lang].card;
  const finished = state.done !== "open";
  const lastOf = (p: Pending | null) => p?.last ?? (mode !== "speak" && choice !== "none" ? choice : undefined);
  const needsReviewer = (which: LastLoad | undefined) => which === "lot" && !reviewerId;

  const reviewerSelect = (
    <label className="block space-y-1">
      <span className="text-xs opacity-70">{M.sendTo}</span>
      {reviewers !== null && reviewers.length === 0 ? (
        <p className="text-amber-800">{M.noReviewers}</p>
      ) : (
        <select
          className="w-full rounded-md border bg-background px-2 py-2 text-sm"
          value={reviewerId} onChange={e => setReviewerPick(e.target.value)} disabled={reviewers === null}
        >
          <option value="">{M.choose}</option>
          {(reviewers ?? []).map(r => <option key={r.id} value={r.id}>{r.name}</option>)}
        </select>
      )}
    </label>
  );

  const lastChoice = (options: (LastLoad | "none")[]) => (
    <div className="space-y-2">
      <p className="text-xs opacity-70">{M.lastLabel}</p>
      <div className="flex flex-wrap gap-2">
        {options.map(o => (
          <Button
            key={o} type="button" size="sm" variant="outline" onClick={() => setChoice(o)} aria-pressed={choice === o}
            className={choice === o ? "border-emerald-600 bg-emerald-50 text-emerald-800" : ""}
          >
            {o === "none" ? M.lastNone : o === "batch" ? M.lastBatch : M.lastLot}
          </Button>
        ))}
      </div>
      {choice !== "none" && <p className="text-xs opacity-80">{choice === "batch" ? M.lastBatchHelp : M.lastLotHelp}</p>}
      {choice === "lot" && reviewerSelect}
    </div>
  );

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          {finished ? (
            // Finished for the operator: small and green, the label kept for a hover and a screen reader.
            <Button
              size="sm" variant="outline" disabled={disabled || busy} title={M.doneTip} aria-label={M.doneTip}
              className="px-2 border-emerald-600/50 bg-emerald-50 text-emerald-800 hover:bg-emerald-100 hover:text-emerald-900"
            >
              {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Flame className="w-4 h-4" />}
              <ChevronDown className="w-3.5 h-3.5 ml-0.5 opacity-70" />
            </Button>
          ) : (
            <Button size="sm" variant="outline" disabled={disabled || busy}>
              {busy ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : <Flame className="w-4 h-4 mr-1" />}
              {M.button}
              <ChevronDown className="w-3.5 h-3.5 ml-1 opacity-70" />
            </Button>
          )}
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem onSelect={() => open("speak")}><Mic className="w-4 h-4 mr-2" />{M.speak}</DropdownMenuItem>
          <DropdownMenuItem onSelect={() => open("enter")}><Keyboard className="w-4 h-4 mr-2" />{M.enter}</DropdownMenuItem>
          {canMark && state.loads > 0 && state.done !== "lot" && (
            <DropdownMenuItem onSelect={() => open("done")}><CheckCircle2 className="w-4 h-4 mr-2" />{M.done}</DropdownMenuItem>
          )}
          {canMark && finished && (
            <DropdownMenuItem onSelect={reopen}><RotateCcw className="w-4 h-4 mr-2" />{M.notDone}</DropdownMenuItem>
          )}
          <DropdownMenuSeparator />
          <DropdownMenuItem onSelect={() => openRecord(startedBakeFill({ product, lot }, new Date(), lang), "")}>
            <FilePenLine className="w-4 h-4 mr-2" />{M.open}
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <Dialog open={showing} onOpenChange={o => { if (!o) close(); }}>
        <DialogContent className="max-w-md" lang={lang}>
          <DialogHeader>
            <DialogTitle className="text-base">{mode === "done" ? M.doneTitle(lot, product) : M.title(lot, product)}</DialogTitle>
            <DialogDescription>
              {mode === "speak" ? `${M.say(card.say, card.sayWithProbe)}${canMark ? ` ${M.sayLast}` : ""}` : mode === "done" ? M.lastLabel : M.enter}
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
              {reading && reading.transcript && <p className="italic opacity-80">{M.heard(reading.transcript)}</p>}
              {reading && !reading.ok && !reading.markOnly && <p className="text-amber-800">{reading.message}</p>}

              {pending && (
                <div className="rounded-md border p-3 space-y-2">
                  {pending.fill ? (
                    <>
                      <p className="font-medium text-emerald-700">{M.passLead}</p>
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
                    <p className="font-medium text-emerald-700">{M.markOnly(LAST_LOAD_VALUES[pending.last as LastLoad])}</p>
                  )}
                  {pending.last && <p className="text-xs opacity-80">{pending.last === "batch" ? M.lastBatchHelp : M.lastLotHelp}</p>}
                  {pending.last === "lot" && reviewerSelect}
                </div>
              )}

              {!pending && (
                <form className="flex items-center gap-2" onSubmit={e => { e.preventDefault(); if (typed.trim()) { speech.reset(); take(parseBakeAlternatives([typed], lang, lang), false); } }}>
                  <Input value={typed} onChange={e => setTyped(e.target.value)} placeholder={M.typeHere} aria-label={M.typeHere} />
                  <Button type="submit" size="sm" variant="outline" disabled={!typed.trim() || busy}>{M.use}</Button>
                </form>
              )}
            </div>
          )}

          {mode === "enter" && (
            <form
              id="bake-entry" className="space-y-3 text-sm"
              onSubmit={e => { e.preventDefault(); if (entered && !needsReviewer(entered.last) && !busy) take(entered, true); }}
            >
              <div className="grid grid-cols-3 gap-2">
                <label className="space-y-1">
                  <span className="text-xs opacity-70">{M.temp}</span>
                  <Input inputMode="decimal" autoFocus value={entry.temp} onChange={e => setEntry({ ...entry, temp: e.target.value })} />
                </label>
                <label className="space-y-1">
                  <span className="text-xs opacity-70">{M.minutes}</span>
                  <Input inputMode="decimal" value={entry.minutes} onChange={e => setEntry({ ...entry, minutes: e.target.value })} />
                </label>
                <label className="space-y-1">
                  <span className="text-xs opacity-70">{M.probe}</span>
                  <Input inputMode="decimal" placeholder={M.optional} value={entry.probe} onChange={e => setEntry({ ...entry, probe: e.target.value })} />
                </label>
              </div>
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
                <Button type="submit" form="bake-entry" size="sm" disabled={busy || !entered || needsReviewer(entered.last)} className={GOLD}>
                  {busy && <Loader2 className="w-4 h-4 animate-spin mr-1" />}{M.save}
                </Button>
              </>
            )}
            {mode === "done" && (
              <>
                <Button variant="ghost" size="sm" disabled={busy} onClick={close}>{M.cancel}</Button>
                <Button
                  size="sm" disabled={busy || choice === "none" || needsReviewer(lastOf(null))} className={GOLD}
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
