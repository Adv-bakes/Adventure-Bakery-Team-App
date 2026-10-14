// The Mixing step of "Follow this lot": the lot record's (FRM-520) ingredients one screen at a
// time - how many batches, then batch by batch each ingredient (its lot on the container with the
// first batch, its weight with every batch), then the rework question.
//
//  - Every Save writes that one answer onto the lot record as it is NOW (read again first, one
//    more try if somebody saved in between), so nothing typed elsewhere is lost.
//  - A weight is never filled in for the person: the formula's figure is shown in grey and is
//    entered only by tapping "Use" or typing it (the owner's rule for anything measured).
//  - A label scan gives the lot code only, into a box the person reads before saving. The
//    ingredient and the brand are the formula's and are never written over.
//  - Which screen is next is read from the record (lotFlow.mixScreens); nothing is stored for it.

import { useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { AlertTriangle, Camera, CheckCircle2, ChevronLeft, FilePenLine, FlaskConical, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { BatchSheetPickDialog } from "@/components/team/forms/BatchSheetPickDialog";
import { batchSheetFill, type FormulaSource } from "@/lib/batchSheetFill";
import { fetchResponse, saveResponseData, StaleResponseError, type FormResponse } from "@/lib/formResponses";
import { getFormSchema, julianLotCode, valueFields, type GridField } from "@/lib/formSchema";
import {
  applyMixEntry, checkMixMapping, LOT_FLOW, LOT_SPEC, MIX_BATCH_CHOICES, mixProgress, mixScreenDone, mixScreens, nextMixScreen, noReworkOption,
  type MixScreen, type MixSpec,
} from "@/lib/lotFlow";
import { scanIngredientLot } from "@/lib/mixScan";
import { localDay, type LotSummary } from "@/lib/today";
import { TODAY_MSG, type TodayLang } from "@/lib/todayMessages";

type Doc = { id: string; sop_number: string; revision: string | null; content: any };
type Line = Extract<MixScreen, { kind: "line" }>;

const GOLD = "bg-[#C89B3C] text-[#2A1F0E] hover:bg-[#C89B3C]/90";
const PLAIN = "border-[#2A1F0E]/40 bg-white/70 text-[#2A1F0E] hover:bg-white";
const BIG = "h-12 text-lg bg-white";

const screenKey = (s: MixScreen | undefined) => (!s ? "" : s.kind === "line" ? `line:${s.batch}:${s.index}` : s.kind);

export function MixStep({ doc, lot, lang, back, version, onSaved, spec = LOT_SPEC }: {
  doc: Doc;
  /** The record being walked: its id and the form's document id (a lot record, or an FRM-530 batch). */
  lot: Pick<LotSummary, "id" | "docId">;
  lang: TodayLang;
  /** Batches and rework, or the one-batch FRM-530 (BATCH_SPEC). */
  spec?: MixSpec;
  /** The query that brings Back on the full record to this step. */
  back: string;
  /** Counts the page's loads of the records, so the record is read again after each. */
  version: number;
  onSaved: (saved: undefined) => void;
}) {
  const F = TODAY_MSG[lang].flow;
  const X = F.mix;
  const schema = getFormSchema(doc.content);
  const href = `/team/compliance/forms/${lot.docId}/entries/${lot.id}?${back}`;
  const mapping = useMemo(() => checkMixMapping(schema, spec), [schema, spec]);

  const [rec, setRec] = useState<FormResponse | null>(null);
  /** Why the step cannot write here, when it cannot. */
  const [closed, setClosed] = useState<"" | "record" | "submitted">("");
  const [loaded, setLoaded] = useState(false);
  /** The screen in view; null until the record has been read once. */
  const [at, setAt] = useState<number | null>(null);
  const [busy, setBusy] = useState(false);
  const [lotText, setLotText] = useState("");
  const [weight, setWeight] = useState("");
  const [unit, setUnit] = useState("");
  const [error, setError] = useState("");
  const [scanning, setScanning] = useState(false);
  const [scan, setScan] = useState<{ reads: string; chips: string[]; none: boolean } | null>(null);
  const [reworkYes, setReworkYes] = useState(false);
  const [picking, setPicking] = useState(false);
  /** Bumped to put the record's own values back into the boxes (after the record changed under the page). */
  const [reset, setReset] = useState(0);
  const scanned = useRef("");
  const file = useRef<HTMLInputElement>(null);
  const live = useRef(true);
  useEffect(() => () => { live.current = false; }, []);

  useEffect(() => {
    let on = true;
    (async () => {
      try {
        const r = await fetchResponse(lot.id);
        if (!on) return;
        if (!r || (r.status === "draft" && r.form_revision !== doc.revision)) { setClosed("record"); }
        else if (r.status !== "draft") { setClosed("submitted"); }
        else {
          setClosed("");
          setRec(r);
          setAt(a => a ?? nextMixScreen(r.data, spec));
        }
      } catch (e) {
        console.error(e);
        if (on) setClosed("record");
      } finally {
        if (on) setLoaded(true);
      }
    })();
    return () => { on = false; };
  }, [lot.id, doc.revision, version, spec]);

  const data = rec?.data;
  const screens = useMemo(() => mixScreens(data, spec), [data, spec]);
  const idx = Math.min(at ?? 0, screens.length - 1);
  const screen = screens[idx];
  const progress = useMemo(() => mixProgress(data, spec), [data, spec]);
  const key = screenKey(screen);

  // A new screen starts from what the record holds for it. The same screen keeps what is being typed.
  useEffect(() => {
    setLotText(screen?.kind === "line" ? screen.lot : "");
    setWeight(screen?.kind === "line" ? screen.weight : "");
    setUnit(screen?.kind === "line" ? screen.unit : "");
    setError(""); setScan(null); setReworkYes(false);
    scanned.current = "";
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, reset]);

  /** Write a change onto the record as it is now. "moved" = the change no longer fits the record. */
  const write = async (change: (d: Record<string, any>) => Record<string, any> | null): Promise<"saved" | "moved" | "record"> => {
    const run = async (): Promise<"saved" | "moved" | "record"> => {
      const r = await fetchResponse(lot.id);
      if (!r || r.status !== "draft" || r.form_revision !== doc.revision) return "record";
      const next = change({ ...(r.data ?? {}) });
      if (!next) { if (live.current) setRec(r); return "moved"; }
      const saved = await saveResponseData(r.id, next, r.updated_at);
      if (live.current) setRec(saved);
      return "saved";
    };
    try { return await run(); }
    catch (e) { if (!(e instanceof StaleResponseError)) throw e; return await run(); }
  };

  /** Run a save, and say what happened. `then` runs once it is on the record. */
  const commit = async (change: (d: Record<string, any>) => Record<string, any> | null, then: () => void) => {
    if (busy) return;
    setBusy(true);
    try {
      const outcome = await write(change);
      if (!live.current) return;
      if (outcome === "saved") { then(); onSaved(undefined); }
      else if (outcome === "moved") { toast.message(X.moved); setReset(n => n + 1); }
      else { toast.message(F.needsRecord); setClosed("record"); }
    } catch (e) {
      console.error(e);
      toast.error(X.saveFailed);
    } finally {
      if (live.current) setBusy(false);
    }
  };

  const saveBatches = (n: number) => commit(d => ({ ...d, [LOT_FLOW.batches]: n }), () => setAt(1));

  const saveLine = (s: Line) => {
    const typedLot = lotText.trim();
    if (s.asksLot && !typedLot) { setError(X.needLot); return; }
    const typed = weight.trim();
    const n = Number(typed);
    // A line the formula gives no quantity may be left unweighed; anything typed must still be a number.
    if (typed === "" ? s.needsWeight : (!Number.isFinite(n) || n < 0)) { setError(X.badWeight); return; }
    // Where the formula gives the line no unit, a weight needs the unit it was weighed in.
    const picksUnit = asksUnit(s) && typed !== "";
    if (picksUnit && !unit) { setError(X.needUnit); return; }
    setError("");
    void commit(
      d => applyMixEntry(d, { index: s.index, ingredient: s.ingredient, brand: s.brand }, {
        ...(s.asksLot ? { lot: typedLot } : {}),
        batch: s.batch, weight: typed === "" ? "" : n,
        ...(picksUnit ? { unit } : {}),
      }),
      () => setAt(idx + 1),
    );
  };

  const takePhoto = async (photo: File | undefined) => {
    if (file.current) file.current.value = "";
    if (!photo || !rec || scanning) return;
    setScanning(true);
    try {
      const r = await scanIngredientLot(rec.id, photo);
      if (!live.current) return;
      const chips = [...r.alternates];
      // The lot goes into the box only when the box is empty or still holds an earlier scan:
      // something typed is kept, and the reading is offered beside it.
      if (r.lot) {
        if (lotText.trim() === "" || lotText.trim() === scanned.current) { setLotText(r.lot); scanned.current = r.lot; setError(""); }
        else if (r.lot !== lotText.trim()) chips.unshift(r.lot);
      }
      setScan({ reads: r.reads, chips, none: !r.lot && chips.length === 0 });
    } catch (e) {
      console.error(e);
      toast.error(X.scanFailed);
    } finally {
      if (live.current) setScanning(false);
    }
  };

  // The units the lot record's own Unit column offers.
  const units = useMemo(() => {
    const grid = schema ? valueFields(schema).find(f => f.id === LOT_FLOW.grid) as GridField | undefined : undefined;
    const col = grid?.columns.find(c => c.id === LOT_FLOW.unit) as { options?: unknown[] } | undefined;
    return (col?.options ?? []).map(String);
  }, [schema]);
  /** The unit is the person's to give where the formula sheet gives the line no quantity, or no unit. */
  const asksUnit = (s: Line) => units.length > 0 && (!s.needsWeight || !s.unit);

  const cfg = schema?.settings?.batchSheet;
  const fromFormula = (source: FormulaSource) => {
    setPicking(false);
    if (!cfg || !schema) return;
    const grid = valueFields(schema).find(f => f.id === cfg.grid) as GridField | undefined;
    const columns = (grid?.columns ?? []).map(c => c.id);
    let filled = 0, warnings: string[] = [];
    void commit(
      d => {
        const res = batchSheetFill(cfg, columns, d, source);
        filled = res.lines; warnings = res.warnings;
        // A record started blank has no bake date: a lot started here is today's, and the date
        // gives the lot code (the form's own rule). A date or a code already there is kept.
        const v = res.values;
        if (!String(v[spec.dateField] ?? "").trim() && !String(v[LOT_FLOW.lotCode] ?? "").trim()) {
          const day = localDay();
          v[spec.dateField] = day;
          v[LOT_FLOW.lotCode] = julianLotCode(day) ?? "";
        }
        return v;
      },
      () => {
        toast.success(X.formulaFilled(filled));
        for (const w of warnings) toast.message(w);
        setAt(a => a ?? 0);
      },
    );
  };

  const openRecord = (
    <Button asChild variant="outline" className={PLAIN}>
      <Link to={href}><FilePenLine className="w-4 h-4 mr-1.5" />{spec.batches ? F.openLotRecord : F.batch.openRecord}</Link>
    </Button>
  );
  const amber = (text: string) => (
    <p className="flex items-start gap-1.5 text-sm text-amber-800"><AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" />{text}</p>
  );

  if (!loaded) return <Loader2 className="w-5 h-5 animate-spin text-[#C89B3C]" />;
  if (closed === "submitted") {
    return (
      <div className="space-y-4">
        <p className="flex items-center gap-1.5 text-sm font-medium text-emerald-800"><CheckCircle2 className="w-4 h-4" />{X.submitted}</p>
        {openRecord}
      </div>
    );
  }
  if (closed === "record" || mapping.length > 0 || !rec) {
    return (
      <div className="space-y-4">
        {amber(mapping.length > 0 ? X.mapping(mapping.join(", ")) : F.needsRecord)}
        {openRecord}
      </div>
    );
  }

  // A lot record started blank has no lines to walk through: they come from the formula sheet.
  if (progress.lines === 0) {
    return (
      <div className="space-y-4">
        {amber(X.noLines)}
        <div className="flex flex-wrap gap-2">
          {cfg && (
            <Button type="button" className={GOLD} disabled={busy} onClick={() => setPicking(true)}>
              {busy ? <Loader2 className="w-4 h-4 animate-spin mr-1.5" /> : <FlaskConical className="w-4 h-4 mr-1.5" />}{X.fromFormula}
            </Button>
          )}
          {openRecord}
        </div>
        {cfg && (
          <BatchSheetPickDialog open={picking} onOpenChange={setPicking} formNumber={cfg.source} onPick={fromFormula}
            title={X.fromFormula} description={TODAY_MSG[lang].pickFormula} />
        )}
      </div>
    );
  }

  const skipped = screens.filter(s => s.kind !== "rework" && !mixScreenDone(data, s, spec)).length;
  const nav = (save?: React.ReactNode) => (
    <div className="flex flex-wrap items-center justify-between gap-2 pt-2">
      <div className="flex flex-wrap gap-2">
        {idx > 0 && (
          <Button type="button" variant="outline" className={PLAIN} disabled={busy} onClick={() => setAt(idx - 1)}>
            <ChevronLeft className="w-4 h-4 mr-1" />{X.back}
          </Button>
        )}
        {openRecord}
      </div>
      <div className="flex flex-wrap gap-2">
        {idx < screens.length - 1 && screen.kind !== "batches" && (
          <Button type="button" variant="ghost" className="text-[#2A1F0E] hover:bg-black/5" disabled={busy} onClick={() => setAt(idx + 1)}>{X.skip}</Button>
        )}
        {save}
      </div>
    </div>
  );
  const status = progress.batches > 0 && (
    <p className={`flex items-center gap-1.5 text-sm ${progress.state === "done" ? "font-medium text-emerald-800" : "opacity-80"}`}>
      {progress.state === "done" && <CheckCircle2 className="w-4 h-4" />}
      {progress.state === "done" ? X.done : F.mixingProgress(progress.linesDone, progress.lines)}
    </p>
  );

  if (screen.kind === "batches") {
    return (
      <div className="space-y-4">
        {status}
        <div>
          <p className="text-lg font-semibold">{X.batchesQ}</p>
          <p className="text-sm opacity-80">{X.batchesHelp}</p>
        </div>
        <div className="flex flex-wrap gap-3">
          {MIX_BATCH_CHOICES.map(n => (
            <Button key={n} type="button" disabled={busy} onClick={() => saveBatches(n)} aria-pressed={progress.batches === n}
              className={`h-16 px-8 text-xl ${progress.batches === n ? GOLD : "border border-[#2A1F0E]/40 bg-white text-[#2A1F0E] hover:bg-[#C89B3C]/20"}`}>
              {X.batchN(n)}
            </Button>
          ))}
          {busy && <Loader2 className="w-5 h-5 animate-spin self-center text-[#C89B3C]" />}
        </div>
        {nav(progress.batches > 0 ? <Button type="button" className={GOLD} disabled={busy} onClick={() => setAt(idx + 1)}>{F.next}</Button> : undefined)}
      </div>
    );
  }

  if (screen.kind === "rework") {
    const answer = String(data?.[LOT_FLOW.rework] ?? "").trim();
    const no = noReworkOption(schema);
    return (
      <div className="space-y-4">
        {status}
        <p className="text-lg font-semibold">{X.reworkQ}</p>
        {answer && <p className="flex items-center gap-1.5 text-sm font-medium text-emerald-800"><CheckCircle2 className="w-4 h-4" />{X.answered(answer)}</p>}
        <div className="flex flex-wrap gap-3">
          {no && (
            <Button type="button" disabled={busy} onClick={() => commit(d => ({ ...d, [LOT_FLOW.rework]: no }), () => setReworkYes(false))}
              className={`h-14 px-6 text-lg ${GOLD}`}>
              {busy && <Loader2 className="w-4 h-4 animate-spin mr-1.5" />}{X.reworkNo}
            </Button>
          )}
          <Button type="button" variant="outline" disabled={busy} onClick={() => setReworkYes(true)} aria-pressed={reworkYes} className={`h-14 px-6 text-lg ${PLAIN}`}>
            {X.reworkYes}
          </Button>
        </div>
        {reworkYes && (
          <div className="rounded-md border border-amber-500 bg-amber-50 p-3 text-sm text-amber-900 space-y-2">
            <p>{X.reworkYesBody}</p>
            <Button asChild className={GOLD}><Link to={href}><FilePenLine className="w-4 h-4 mr-1.5" />{spec.batches ? F.openLotRecord : F.batch.openRecord}</Link></Button>
          </div>
        )}
        {skipped > 0 && (
          <div className="flex flex-wrap items-center gap-3">
            {amber(X.stillOpen(skipped))}
            <Button type="button" variant="outline" className={PLAIN} onClick={() => setAt(nextMixScreen(data, spec))}>{X.goToOpen}</Button>
          </div>
        )}
        {nav()}
      </div>
    );
  }

  const s = screen;
  return (
    <form className="space-y-4" onSubmit={e => { e.preventDefault(); saveLine(s); }}>
      <input ref={file} type="file" accept="image/*" capture="environment" className="hidden" onChange={e => { void takePhoto(e.target.files?.[0]); }} />
      {/* Where the person is says enough here; the count of complete lines is on the first and last screens. */}
      <p className="text-sm font-medium opacity-80">{spec.batches ? X.where(s.batch, progress.batches, s.position, s.of) : X.whereOne(s.position, s.of)}</p>
      <div>
        <p className="text-2xl font-semibold leading-tight">{s.ingredient}</p>
        {s.brand && <p className="text-sm opacity-80">{s.brand}</p>}
      </div>

      {s.asksLot ? (
        <div className="space-y-1.5">
          <label htmlFor="mix-lot" className="block text-sm font-medium">{X.lotLabel}</label>
          <div className="flex flex-wrap items-center gap-2">
            <Input id="mix-lot" value={lotText} onChange={e => { setLotText(e.target.value); setError(""); }} autoComplete="off" autoCapitalize="characters"
              className={`${BIG} max-w-xs`} disabled={busy} />
            <Button type="button" variant="outline" className={`h-12 ${PLAIN}`} disabled={busy || scanning} onClick={() => file.current?.click()}>
              {scanning ? <Loader2 className="w-4 h-4 animate-spin mr-1.5" /> : <Camera className="w-4 h-4 mr-1.5" />}{scanning ? X.scanning : X.scan}
            </Button>
          </div>
          {scan?.reads && <p className="text-sm opacity-80">{X.scanReads(scan.reads)}</p>}
          {scan?.none && amber(X.scanNone)}
          {scan && scan.chips.length > 0 && (
            <div className="flex flex-wrap items-center gap-2 text-sm">
              <span className="opacity-80">{X.scanOffer}</span>
              {scan.chips.map(c => (
                <button key={c} type="button" onClick={() => { setLotText(c); setError(""); }}
                  className="rounded-full border border-[#C89B3C] bg-white px-3 py-1 font-medium hover:bg-[#C89B3C]/20">{c}</button>
              ))}
            </div>
          )}
        </div>
      ) : s.lot ? (
        <div>
          <p className="text-sm font-medium">{X.lotIs(s.lot)}</p>
          <p className="text-xs opacity-70">{X.otherLot}</p>
        </div>
      ) : amber(X.noLotYet)}

      <div className="space-y-1.5">
        <label htmlFor="mix-weight" className="block text-sm font-medium">{spec.batches ? X.weightLabel(s.batch) : X.weighedOne}</label>
        <div className="flex flex-wrap items-center gap-2">
          {/* The formula's figure is a grey hint only: the box stays empty until it is typed or taken with the link. */}
          <Input id="mix-weight" type="number" inputMode="decimal" step="any" min={0} value={weight} placeholder={s.expected}
            onChange={e => { setWeight(e.target.value); setError(""); }} className={`${BIG} w-40`} disabled={busy} />
          {asksUnit(s) ? (
            <select aria-label={X.unitLabel} value={unit} disabled={busy} onChange={e => { setUnit(e.target.value); setError(""); }}
              className="h-12 rounded-md border border-input bg-white px-3 text-lg">
              <option value="">{X.unitLabel}</option>
              {[...new Set([...units, ...(unit ? [unit] : [])])].map(u => <option key={u} value={u}>{u}</option>)}
            </select>
          ) : s.unit && <span className="text-lg font-medium">{s.unit}</span>}
          {s.needsWeight && weight.trim() === "" && (
            <button type="button" disabled={busy} onClick={() => { setWeight(s.expected); setError(""); }}
              className="text-sm font-medium underline underline-offset-2 text-[#7a5a14] hover:text-[#2A1F0E]">{X.takeFigure(s.expected, s.unit)}</button>
          )}
        </div>
        <p className="text-xs opacity-70">{s.needsWeight ? X.formula(s.expected, s.unit) : X.optionalWeight}</p>
      </div>

      {error && <p className="text-sm font-medium text-red-700">{error}</p>}
      {nav(
        <Button type="submit" className={`h-12 px-6 text-base ${GOLD}`} disabled={busy || scanning}>
          {busy && <Loader2 className="w-4 h-4 animate-spin mr-1.5" />}{X.save}
        </Button>,
      )}
    </form>
  );
}
