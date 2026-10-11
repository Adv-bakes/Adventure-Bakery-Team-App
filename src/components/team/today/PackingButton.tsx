// "Record packing" on a lot's row of the Today page: the packing part of the lot's own Production
// Lot Record (FRM-520), without opening the form.
//
// The sibling of BakeLoadButton and SealCheckButton, and it keeps their rules: the row supplies the
// record; nothing is saved by looking; a tap the operator has read is what saves.
//
// The menu:
//  - PHOTOGRAPH THE FIRST PACK: the camera opens, the photo is kept on the lot record and read,
//    and the four points are shown (flavor, lot code, best-by month, bar code - firstPackCheck.ts).
//    When all agree, "I checked the pack - it matches" saves the answer with the person's name.
//    A mismatch saves no answer and says to stop packing. The app never answers by itself.
//  - ENTER THE COUNTS: counted on the rack, units packed, not packed (and the film lot). The app
//    only adds them up (packCounts.ts); a difference needs a reason in Notes before it is saved.
//  - OPEN THE RECORD.
//
// "Done" - the small green button - is read back from the record (packingState in today.ts): the
// first pack answered and all three counts entered. Nothing else is stored.
//
// The record is the row's own FRM-520 entry. It is opened instead when it is on an earlier
// revision of the form, or when the save is refused (a draft somebody else started).

import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { AlertTriangle, Calculator, Camera, CheckCircle2, ChevronDown, Eye, FilePenLine, Loader2, MinusCircle, Package } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { fetchProfileNames, fetchResponse, saveResponseData, StaleResponseError, type FormResponse } from "@/lib/formResponses";
import { getFormSchema } from "@/lib/formSchema";
import { FIRST_PACK, firstPackReady, packVerdict, type PackLine, type PackState } from "@/lib/firstPackCheck";
import { photographFirstPack } from "@/lib/firstPackPhoto";
import { PACK_COUNTS, packCounts, packCountsReady } from "@/lib/packCounts";
import type { PackingState } from "@/lib/today";
import { TODAY_MSG, type TodayLang } from "@/lib/todayMessages";

type Doc = { id: string; sop_number: string; revision: string | null; content: any };
type Mode = "photo" | "counts";

const FIELD = "bg-white border-[#2A1F0E]/75 text-[#2A1F0E] font-medium placeholder:font-normal placeholder:text-[#2A1F0E]/55 focus-visible:ring-[#C89B3C]";
const LABEL = "text-xs font-medium text-[#2A1F0E]";
const GOLD = "bg-[#C89B3C] text-[#2A1F0E] hover:bg-[#C89B3C]/90";
const GREEN = "bg-[#2E7D32] text-white hover:bg-[#256628]";

const ICON: Record<PackState, typeof CheckCircle2> = { match: CheckCircle2, mismatch: AlertTriangle, check: Eye, unread: Eye, skipped: MinusCircle };
const TONE: Record<PackState, string> = {
  match: "text-[#2A1F0E]", mismatch: "text-red-700 font-medium", check: "text-amber-800", unread: "text-amber-800", skipped: "text-[#2A1F0E]/70",
};

const blank = { racked: "", packed: "", notPacked: "", film: "", notes: "" };
const text = (v: unknown) => (v == null ? "" : String(v));

export function PackingButton({ doc, entryId, lot, product, today, state, lang, disabled, onSaved }: {
  doc: Doc;
  /** The row's own FRM-520 entry. */
  entryId: string;
  lot: string;
  product: string;
  /** yyyy-MM-dd on the device: written as "Packed on" when that is still blank. */
  today: string;
  state: PackingState;
  lang: TodayLang;
  disabled?: boolean;
  onSaved: () => void;
}) {
  const M = TODAY_MSG[lang].bake;   // the dialogs' common wording (Save, Cancel)
  const P = TODAY_MSG[lang].pack;
  const navigate = useNavigate();
  const schema = getFormSchema(doc.content);
  const canPhoto = firstPackReady(schema);
  const canCount = packCountsReady(schema);
  const input = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [mode, setMode] = useState<Mode>("photo");
  const [showing, setShowing] = useState(false);
  const [lines, setLines] = useState<PackLine[] | null>(null);
  const [failed, setFailed] = useState(false);
  const [counts, setCounts] = useState(blank);
  const [loaded, setLoaded] = useState(false);
  const live = useRef(true);
  useEffect(() => () => { live.current = false; }, []);

  const href = `/team/compliance/forms/${doc.id}/entries/${entryId}?from=today`;
  const openRecord = () => navigate(href);

  /** The lot record as it is now; null when it has to be opened instead (another revision, or gone). */
  const record = async (): Promise<FormResponse | null> => {
    const r = await fetchResponse(entryId);
    return r && r.status === "draft" && r.form_revision === doc.revision ? r : null;
  };

  /** Save some answers onto the record as it is now; one more try if somebody saved in between. */
  const save = async (change: (data: Record<string, any>) => Record<string, any>): Promise<boolean> => {
    const run = async () => {
      const r = await record();
      if (!r) return false;
      await saveResponseData(r.id, change({ ...(r.data ?? {}) }), r.updated_at);
      return true;
    };
    try { return await run(); }
    catch (e) { if (!(e instanceof StaleResponseError)) throw e; return await run(); }
  };

  const fail = (e: unknown) => {
    console.error(e);
    toast.error(P.openFailed);
    if (live.current) setBusy(false);
  };

  // ---- the first pack, from a photo

  const takePhoto = async (file: File | undefined) => {
    if (input.current) input.current.value = "";
    if (!file || busy) return;
    setMode("photo"); setLines(null); setFailed(false); setShowing(true); setBusy(true);
    try {
      const r = await record();
      if (!r) { toast.message(P.needsRecord); setShowing(false); setBusy(false); openRecord(); return; }
      const res = await photographFirstPack(r, file, r.data ?? {}, lang);
      if (!live.current) return;
      setLines(res.lines);
      setFailed(!res.lines);
      setBusy(false);
      onSaved();   // the photo is on the record either way
    } catch (e) { setShowing(false); fail(e); }
  };

  const acceptMatch = async () => {
    setBusy(true);
    try {
      const { data } = await supabase.auth.getUser();
      const id = data?.user?.id ?? "";
      const name = id ? (await fetchProfileNames([id]).catch(() => new Map<string, string>())).get(id) ?? "" : "";
      const ok = await save(d => ({
        ...d,
        [FIRST_PACK.answer]: FIRST_PACK.matches,
        // Whoever answers is the person who checked - never over a name already there.
        [FIRST_PACK.checkedBy]: text(d[FIRST_PACK.checkedBy]).trim() || name,
        pack_date: text(d.pack_date) || today,
      }));
      if (!ok) { toast.message(P.needsRecord); setShowing(false); setBusy(false); openRecord(); return; }
      toast.success(P.saved(lot, product));
      setShowing(false); setBusy(false);
      onSaved();
    } catch (e) { fail(e); }
  };

  // ---- the three counts

  const openCounts = async () => {
    setMode("counts"); setCounts(blank); setLoaded(false);
    setTimeout(() => { if (live.current) setShowing(true); }, 0);   // after the menu has closed
    try {
      const r = await record();
      if (!live.current) return;
      if (!r) { toast.message(P.needsRecord); setShowing(false); openRecord(); return; }
      const d = r.data ?? {};
      // What the record already holds is shown as it is: these are the person's own counts, not suggestions.
      setCounts({ racked: text(d[PACK_COUNTS.racked]), packed: text(d[PACK_COUNTS.packed]), notPacked: text(d[PACK_COUNTS.notPacked]), film: text(d.film_lot), notes: text(d[PACK_COUNTS.notes]) });
      setLoaded(true);
    } catch (e) { setShowing(false); fail(e); }
  };

  const sum = packCounts({
    [PACK_COUNTS.racked]: counts.racked, [PACK_COUNTS.packed]: counts.packed, [PACK_COUNTS.notPacked]: counts.notPacked, [PACK_COUNTS.notes]: counts.notes,
  });
  const whole = (v: string) => /^\d+$/.test(v.trim());
  const countsReady = loaded && whole(counts.racked) && whole(counts.notPacked) && counts.packed.trim() !== "" && sum.state !== "unreadable" && !sum.needsNote;
  const sumText = (() => {
    if (sum.state === "incomplete") return "";
    if (sum.state === "unreadable") return P.notANumber;
    const packed = Number(counts.racked) - Number(counts.notPacked) - (sum.diff ?? 0);
    const shown = `${packed} + ${Number(counts.notPacked)} = ${packed + Number(counts.notPacked)}`;
    if (sum.state === "adds_up") return P.addsUp(shown, Number(counts.racked));
    const line = sum.state === "short" ? P.short(sum.diff ?? 0, shown, Number(counts.racked)) : P.over(-(sum.diff ?? 0), shown, Number(counts.racked));
    return sum.needsNote ? `${line} ${P.sayWhy}` : line;
  })();

  const saveCounts = async () => {
    if (!countsReady || busy) return;
    setBusy(true);
    try {
      const ok = await save(d => ({
        ...d,
        [PACK_COUNTS.racked]: Number(counts.racked),
        [PACK_COUNTS.packed]: counts.packed.trim(),
        [PACK_COUNTS.notPacked]: Number(counts.notPacked),
        film_lot: counts.film.trim(),
        [PACK_COUNTS.notes]: counts.notes,
        pack_date: text(d.pack_date) || today,
      }));
      if (!ok) { toast.message(P.needsRecord); setShowing(false); setBusy(false); openRecord(); return; }
      toast.success(P.savedCounts(lot, product));
      setShowing(false); setBusy(false);
      onSaved();
    } catch (e) { fail(e); }
  };

  const verdict = lines ? packVerdict(lines) : null;
  const tick = (done: boolean) => done ? <CheckCircle2 className="w-3.5 h-3.5 ml-2 text-emerald-700" aria-hidden /> : null;

  return (
    <>
      <input ref={input} type="file" accept="image/*" capture="environment" className="hidden" onChange={e => takePhoto(e.target.files?.[0])} />
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          {state.done ? (
            <Button
              size="sm" variant="outline" disabled={disabled || busy} title={P.doneTip} aria-label={P.doneTip}
              className="px-2 border-emerald-600/50 bg-emerald-50 text-emerald-800 hover:bg-emerald-100 hover:text-emerald-900"
            >
              {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Package className="w-4 h-4" />}
              <ChevronDown className="w-3.5 h-3.5 ml-0.5 opacity-70" />
            </Button>
          ) : (
            <Button size="sm" variant="outline" disabled={disabled || busy}>
              {busy ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : <Package className="w-4 h-4 mr-1" />}
              {P.button}
              <ChevronDown className="w-3.5 h-3.5 ml-1 opacity-70" />
            </Button>
          )}
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          {canPhoto && (
            // The file picker has to be opened inside the tap, or a browser refuses the camera.
            <DropdownMenuItem onSelect={() => input.current?.click()} title={state.checked ? P.firstPackDone : undefined}>
              <Camera className="w-4 h-4 mr-2" />{P.photo}{tick(state.checked)}
            </DropdownMenuItem>
          )}
          {canCount && (
            <DropdownMenuItem onSelect={openCounts} title={state.counted ? P.countsDone : undefined}>
              <Calculator className="w-4 h-4 mr-2" />{P.counts}{tick(state.counted)}
            </DropdownMenuItem>
          )}
          {(canPhoto || canCount) && <DropdownMenuSeparator />}
          <DropdownMenuItem onSelect={openRecord}><FilePenLine className="w-4 h-4 mr-2" />{P.open}</DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <Dialog open={showing} onOpenChange={o => { if (!o && !busy) setShowing(false); }}>
        <DialogContent className="max-w-md" lang={lang}>
          <DialogHeader>
            <DialogTitle className="text-base">{mode === "photo" ? P.title(lot, product) : P.countsTitle(lot, product)}</DialogTitle>
            <DialogDescription>{mode === "photo" ? P.photoHelp : P.countsHelp}</DialogDescription>
          </DialogHeader>

          {mode === "photo" && (
            <div className="space-y-2 text-sm">
              {busy && !lines && <p className="flex items-center gap-2 font-medium"><Loader2 className="w-4 h-4 animate-spin text-[#C89B3C]" />{P.reading}</p>}
              {failed && <p className="text-amber-800">{P.unreadable}</p>}
              {lines?.map(l => {
                const Icon = ICON[l.state];
                return (
                  <p key={l.point} className={`flex items-start gap-1.5 ${TONE[l.state]}`}>
                    <Icon className={`w-4 h-4 mt-0.5 shrink-0 ${l.state === "match" ? "text-green-700" : ""}`} />
                    <span>{l.text}</span>
                  </p>
                );
              })}
              {verdict === "incomplete" && <p className="text-xs text-amber-800">{P.incomplete}</p>}
              {verdict === "mismatch" && <p className="text-xs text-red-700">{P.mismatch}</p>}
              {verdict === "match" && state.checked && <p className="text-xs opacity-80">{P.alreadyChecked}</p>}
            </div>
          )}

          {mode === "counts" && (
            <form id="pack-counts" className="space-y-3 text-sm" onSubmit={e => { e.preventDefault(); void saveCounts(); }}>
              {!loaded ? <Loader2 className="w-4 h-4 animate-spin text-[#C89B3C]" /> : (
                <>
                  <div className="grid grid-cols-3 gap-2">
                    <label className="flex flex-col justify-end gap-1">
                      <span className={LABEL}>{P.racked}</span>
                      <Input className={FIELD} inputMode="numeric" value={counts.racked} onChange={e => setCounts({ ...counts, racked: e.target.value })} />
                    </label>
                    <label className="flex flex-col justify-end gap-1">
                      <span className={LABEL}>{P.packed}</span>
                      <Input className={FIELD} inputMode="numeric" value={counts.packed} onChange={e => setCounts({ ...counts, packed: e.target.value })} />
                    </label>
                    <label className="flex flex-col justify-end gap-1">
                      <span className={LABEL}>{P.notPacked}</span>
                      <Input className={FIELD} inputMode="numeric" value={counts.notPacked} onChange={e => setCounts({ ...counts, notPacked: e.target.value })} />
                    </label>
                  </div>
                  {sumText && <p className={`flex items-start gap-1.5 ${sum.state === "adds_up" ? "text-[#2A1F0E]" : sum.state === "incomplete" ? "opacity-70" : sum.needsNote || sum.state === "unreadable" ? "text-red-700 font-medium" : "text-amber-800"}`}>
                    {sum.state === "adds_up" ? <CheckCircle2 className="w-4 h-4 mt-0.5 shrink-0 text-green-700" /> : sum.state !== "incomplete" ? <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" /> : null}
                    <span>{sumText}</span>
                  </p>}
                  {(sum.state === "short" || sum.state === "over" || counts.notes.trim() !== "") && (
                    <label className="block space-y-1">
                      <span className={LABEL}>{P.notes}</span>
                      <textarea
                        className="w-full rounded-md border border-[#2A1F0E]/75 bg-white text-[#2A1F0E] px-2 py-1.5 text-sm min-h-[4rem]"
                        value={counts.notes} onChange={e => setCounts({ ...counts, notes: e.target.value })}
                      />
                    </label>
                  )}
                  <label className="block space-y-1">
                    <span className={LABEL}>{P.filmLot} <span className="font-normal opacity-70">({P.optional})</span></span>
                    <Input className={FIELD} value={counts.film} onChange={e => setCounts({ ...counts, film: e.target.value })} />
                  </label>
                </>
              )}
            </form>
          )}

          <DialogFooter className="gap-2 sm:gap-2 flex-wrap">
            {mode === "photo" && (
              <>
                <Button variant="ghost" size="sm" disabled={busy} onClick={() => setShowing(false)}>{M.cancel}</Button>
                {(lines || failed) && <Button variant="ghost" size="sm" disabled={busy} onClick={() => { setShowing(false); openRecord(); }}>{P.open}</Button>}
                {(lines || failed) && verdict !== "match" && (
                  <Button variant="outline" size="sm" disabled={busy} onClick={() => input.current?.click()}><Camera className="w-4 h-4 mr-1" />{P.again}</Button>
                )}
                {verdict === "match" && !state.checked && (
                  <Button size="sm" disabled={busy} onClick={acceptMatch} className={GREEN}>
                    {busy && <Loader2 className="w-4 h-4 animate-spin mr-1" />}{P.matches}
                  </Button>
                )}
              </>
            )}
            {mode === "counts" && (
              <>
                <Button variant="ghost" size="sm" disabled={busy} onClick={() => setShowing(false)}>{M.cancel}</Button>
                <Button type="submit" form="pack-counts" size="sm" disabled={busy || !countsReady} className={GOLD}>
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
