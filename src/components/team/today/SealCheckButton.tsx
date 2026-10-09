// "Record seal check" on a lot's row of the Today page: one CCP 2 check for that lot + product on
// its FRM-606 for the day (one record per lot).
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
// "The lot's record" is the signed-in person's FRM-606 draft dated today for this product and lot
// code; with none, one is created with those three answers filled in.

import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ChevronDown, FilePenLine, Loader2, Mic, Wind } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import {
  createResponse, fetchProfileNames, saveResponseData, StaleResponseError, type FormResponse,
} from "@/lib/formResponses";
import { emptyValues, getFormSchema, initialsFromName, type FillContext } from "@/lib/formSchema";
import { applyVoiceFill, sameProduct, type VoiceFill } from "@/lib/voiceCommands";
import { handsFreeFailed, parseSealButton, sealButtonFill } from "@/lib/voiceHandsFree";
import { findTodaysDrafts, newVoiceState } from "@/lib/voiceCommandTarget";
import { normLot } from "@/lib/releaseAssist";
import { speechRecognitionSupported, useSpeechCommand } from "@/hooks/useSpeechCommand";
import { TODAY_MSG, type TodayLang } from "@/lib/todayMessages";

type Doc = { id: string; sop_number: string; revision: string | null; content: any };

/** Warnings from applying the row that mean a person should look at the record before it is saved. */
const NEEDS_RECORD = new Set(["limits_changed", "no_column", "no_initials", "product_mismatch", "lot_mismatch", "date_mismatch"]);

/** What was heard, and whether it named a check. */
type Heard = { transcript: string; ok: boolean };

export function SealCheckButton({ doc, lot, product, today, lang, disabled, onSaved }: {
  doc: Doc;
  lot: string;
  product: string;
  /** yyyy-MM-dd on the device: the production date of the day's record. */
  today: string;
  lang: TodayLang;
  disabled?: boolean;
  onSaved: () => void;
}) {
  // The dialog's common wording (Accept, Try again, Heard ...) is shared with the bake button.
  const M = TODAY_MSG[lang].bake;
  const S = TODAY_MSG[lang].seal;
  const navigate = useNavigate();
  const [busy, setBusy] = useState(false);
  const [dialog, setDialog] = useState(false);
  const [reading, setReading] = useState<Heard | null>(null);
  const [fill, setFill] = useState<VoiceFill | null>(null);
  const [typed, setTyped] = useState("");
  const [ctx, setCtx] = useState<FillContext>({ userInitials: "" });
  const live = useRef(true);
  useEffect(() => () => { live.current = false; }, []);

  /** The lot's record for today, created if there is none. Only ever called after a tap that needs it. */
  const dayRecord = async (): Promise<FormResponse> => {
    const mine = (await findTodaysDrafts(doc.id, today))
      .find(d => sameProduct(String(d.data?.product ?? ""), product) && normLot(d.data?.lot_code) === normLot(lot));
    return mine ?? (await createResponse(doc, { production_date: today, product, lot_code: lot }));
  };

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
      toast.error(e instanceof Error ? e.message : S.openFailed);
      if (live.current) setBusy(false);
    }
  };

  const heard = (alternatives: string[]) => {
    const transcript = alternatives.find(a => a && a.trim()) ?? "";
    const h = parseSealButton(alternatives, lang);
    if (!h || h.kind !== "row" || !h.row) { setReading({ transcript, ok: false }); setFill(null); return; }
    setReading({ transcript, ok: true });
    const f = sealButtonFill({ product, lot }, h.row, new Date(), lang);
    setFill(f);
    // A failed check is never accepted from a summary: it goes to the record, with Section 3.
    if (handsFreeFailed(h.row)) {
      toast.error(S.failLead);
      setDialog(false);
      openRecord(f, transcript);
    }
  };

  const speech = useSpeechCommand(alternatives => heard(alternatives), { lang });

  const startSpeaking = () => {
    setReading(null); setFill(null); setTyped("");
    // Started inside the tap, which is what lets a browser open the microphone.
    if (speechRecognitionSupported) speech.start();
    // The dialog opens once the menu has finished closing: opened in the same tick, the two fight
    // over focus and the page can be left not taking taps.
    setTimeout(() => { if (live.current) setDialog(true); }, 0);
    // Whose initials go on the row: shown in the summary before it is accepted.
    supabase.auth.getUser().then(async ({ data }) => {
      const id = data?.user?.id;
      if (!id) return;
      const names = await fetchProfileNames([id]).catch(() => new Map<string, string>());
      if (live.current) setCtx({ userInitials: initialsFromName(names.get(id)) });
    });
  };

  const again = () => {
    setReading(null); setFill(null); setTyped("");
    if (speechRecognitionSupported) speech.start();
  };

  const accept = async () => {
    if (!fill || !reading) return;
    setBusy(true);
    try {
      const save = async (): Promise<"saved" | "open"> => {
        const r = await dayRecord();
        const schema = getFormSchema(doc.content);
        // A draft started on an earlier revision of the form has its own layout: the entry page resolves it.
        if (!schema || r.form_revision !== doc.revision) return "open";
        const values = { ...emptyValues(schema, ctx), ...(r.data ?? {}) };
        const res = applyVoiceFill(schema, values, fill, ctx, lang);
        if (!res.ok || (res.warnings ?? []).some(w => NEEDS_RECORD.has(w.code ?? ""))) return "open";
        await saveResponseData(r.id, res.values as Record<string, any>, r.updated_at);
        return "saved";
      };
      let outcome: "saved" | "open";
      try { outcome = await save(); }
      catch (e) {
        // Somebody saved the record in between: read it again and add the row to what is there now.
        if (!(e instanceof StaleResponseError)) throw e;
        outcome = await save();
      }
      if (outcome === "open") {
        toast.message(M.needsRecord);
        setDialog(false);
        await openRecord(fill, reading.transcript);
        return;
      }
      toast.success(S.saved(lot, product));
      setDialog(false);
      setBusy(false);
      onSaved();
    } catch (e) {
      console.error(e);
      toast.error(e instanceof Error ? e.message : S.openFailed);
      if (live.current) setBusy(false);
    }
  };

  const listening = speech.state === "listening";
  const passed = !!(reading?.ok && fill && fill.warnings.length === 0);

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button size="sm" variant="outline" disabled={disabled || busy}>
            {busy ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : <Wind className="w-4 h-4 mr-1" />}
            {S.button}
            <ChevronDown className="w-3.5 h-3.5 ml-1 opacity-70" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem onSelect={startSpeaking}><Mic className="w-4 h-4 mr-2" />{S.speak}</DropdownMenuItem>
          <DropdownMenuItem onSelect={() => openRecord(null, "")}>
            <FilePenLine className="w-4 h-4 mr-2" />{S.open}
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <Dialog open={dialog} onOpenChange={o => { if (!o) { speech.reset(); setDialog(false); } }}>
        <DialogContent className="max-w-md" lang={lang}>
          <DialogHeader>
            <DialogTitle className="text-base">{S.title(lot, product)}</DialogTitle>
            <DialogDescription>{S.say}</DialogDescription>
          </DialogHeader>

          <div className="space-y-3 text-sm">
            {!speechRecognitionSupported && <p className="text-amber-800">{M.noSpeech}</p>}
            {listening && (
              <p className="flex items-center gap-2 font-medium">
                <Mic className="w-4 h-4 text-[#C89B3C] animate-pulse" />{M.listening}
                {speech.interim && <span className="font-normal italic opacity-80">{speech.interim}</span>}
              </p>
            )}
            {speech.error && !listening && <p className="text-destructive">{speech.error}</p>}
            {reading && <p className="italic opacity-80">{M.heard(reading.transcript)}</p>}
            {reading && !reading.ok && <p className="text-amber-800">{S.unclear}</p>}

            {passed && fill && (
              <div className="rounded-md border p-3 space-y-2">
                <p className="font-medium text-emerald-700">{S.passLead}</p>
                <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1">
                  {fill.summary.map(line => (
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
              </div>
            )}

            {!(reading?.ok && fill) && (
              <form className="flex items-center gap-2" onSubmit={e => { e.preventDefault(); if (typed.trim()) { speech.reset(); heard([typed]); } }}>
                <Input value={typed} onChange={e => setTyped(e.target.value)} placeholder={M.typeHere} aria-label={M.typeHere} />
                <Button type="submit" size="sm" variant="outline" disabled={!typed.trim() || busy}>{M.use}</Button>
              </form>
            )}
          </div>

          <DialogFooter className="gap-2 sm:gap-2 flex-wrap">
            {reading?.ok && fill ? (
              <>
                <Button variant="ghost" size="sm" disabled={busy} onClick={() => { setDialog(false); openRecord(fill, reading.transcript); }}>{M.openInstead}</Button>
                <Button variant="outline" size="sm" disabled={busy} onClick={again}>{M.again}</Button>
                <Button size="sm" disabled={busy} onClick={accept} className="bg-[#C89B3C] text-[#2A1F0E] hover:bg-[#C89B3C]/90">
                  {busy && <Loader2 className="w-4 h-4 animate-spin mr-1" />}{M.accept}
                </Button>
              </>
            ) : (
              <>
                <Button variant="ghost" size="sm" onClick={() => { speech.reset(); setDialog(false); }}>{M.cancel}</Button>
                {!listening && speechRecognitionSupported && <Button variant="outline" size="sm" onClick={again}>{M.again}</Button>}
              </>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
