// "Follow this lot": one lot + product, one step at a time, from mixing to release (owner's
// request, 2026-10-12). The Today page stays as it is; this page is the same work for a single
// lot, always showing the next piece of information the records need.
//
//  - Nothing is stored for the flow. Each step's state is read from the records (lotFlow.ts), and
//    the step in view is in the address, so Back from a full record returns to the same step.
//  - The inputs are the Today buttons' own (useBakeLoad, useSealCheck, usePacking), shown on the
//    page instead of in a pop-up. What they save, and when they refuse to, is unchanged.
//  - The arrows are always free: sealing often starts while later loads are still baking. The page
//    moves on by itself only when the person says a step is finished (lotFlow.advancesAfter).
//  - It is outside the team layout on purpose: the page is this lot and nothing else, and it sizes
//    itself to the tablet the way the visitor kiosk does.

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link, useNavigate, useParams, useSearchParams } from "react-router-dom";
import {
  AlertTriangle, ArrowLeft, Calculator, Camera, CheckCircle2, ChevronLeft, ChevronRight, Circle, CircleDot, ClipboardCheck,
  FilePenLine, Keyboard, Loader2, Mic, RotateCcw, Scale, ShieldAlert,
} from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { useUserRole } from "@/hooks/useUserRole";
import { useBakeLoad } from "@/components/team/today/BakeLoadButton";
import { useSealCheck } from "@/components/team/today/SealCheckButton";
import { usePacking } from "@/components/team/today/PackingButton";
import {
  createResponse, fetchProfileNames, fetchResponse, loadTodayRecords, saveResponseData, StaleResponseError, submitResponse,
} from "@/lib/formResponses";
import { buildZodSchema, deriveDateValue, emptyValues, getFormSchema, valueFields, type FormSchema, type GridField } from "@/lib/formSchema";
import { resolveSignatureRequest, withdrawFieldSignatureRequests } from "@/lib/notifications";
import { packCounts, packCountsReady } from "@/lib/packCounts";
import { releaseStepHref } from "@/lib/releaseStart";
import { blanksFilled, retentionDefaults } from "@/lib/retentionStart";
import { startedBakeFill } from "@/lib/voiceCommands";
import {
  localDay, lotSummaries, preopState, productionOpen, TODAY_FORMS,
  type LotSummary, type TodayKind, type TodayRecords,
} from "@/lib/today";
import {
  advancesAfter, flowSteps, isFlowStep, LOT_FLOW, lotBackQuery, lotBakeState, lotSealState, mixProgress,
  nextOpenStep, stepAfter, stepBefore,
  type FlowStep, type FlowStepKey,
} from "@/lib/lotFlow";
import { TODAY_MSG, type TodayLang } from "@/lib/todayMessages";

type Doc = { id: string; sop_number: string; revision: string | null; content: any };
type Saved = { last?: "batch" | "lot"; step?: string } | undefined;

const LANG_KEY = "today.lang";
const GOLD = "bg-[#C89B3C] text-[#2A1F0E] hover:bg-[#C89B3C]/90";
/** The steps that are production records: closed until the day's pre-op check is submitted. */
const GATED: FlowStepKey[] = ["mixing", "baking", "sealing", "packing", "submit"];

const entryHref = (docId: string, id: string, back: string) => `/team/compliance/forms/${docId}/entries/${id}?${back}`;

/** A choice of how to enter, or a side action, above a step's input. */
function Choice({ icon, active, children, ...rest }: React.ComponentProps<typeof Button> & { icon: React.ReactNode; active?: boolean }) {
  return (
    <Button type="button" variant="outline" {...rest} aria-pressed={active}
      className={`border-[#2A1F0E]/40 bg-white/70 text-[#2A1F0E] hover:bg-white ${active ? "border-[#C89B3C] bg-[#C89B3C]/20" : ""}`}>
      {icon}{children}
    </Button>
  );
}

const Status = ({ done, children }: { done?: boolean; children: React.ReactNode }) => (
  <p className={`flex items-center gap-1.5 text-sm ${done ? "font-medium text-emerald-800" : "opacity-80"}`}>
    {done && <CheckCircle2 className="w-4 h-4" />}{children}
  </p>
);

// ---------- Baking ----------

function BakeStep({ doc, lot, today, lang, records, back, onSaved }: {
  doc: Doc; lot: LotSummary; today: string; lang: TodayLang; records: TodayRecords; back: string; onSaved: (s: Saved) => void;
}) {
  const M = TODAY_MSG[lang].bake;
  const F = TODAY_MSG[lang].flow;
  const state = lotBakeState(records, lot, today);
  const h = useBakeLoad({ doc, lot: lot.lotCode, product: lot.product, today, state, lang, onSaved, backTo: back, inline: true });
  // The typed input is what the step opens on. The microphone only ever starts from a tap.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { h.open("enter"); }, []);
  return (
    <div className="space-y-4">
      <div className="space-y-1">
        <Status>{F.loads(state.loads)}</Status>
        {h.finished && <Status done>{F.bakeDone}</Status>}
      </div>
      <div className="flex flex-wrap gap-2">
        <Choice icon={<Keyboard className="w-4 h-4 mr-1.5" />} active={h.mode === "enter"} disabled={h.busy} onClick={() => h.open("enter")}>{M.enter}</Choice>
        <Choice icon={<Mic className="w-4 h-4 mr-1.5" />} active={h.mode === "speak"} disabled={h.busy} onClick={() => h.open("speak")}>{M.speak}</Choice>
        {h.canMark && state.loads > 0 && state.done !== "lot" && (
          <Choice icon={<CheckCircle2 className="w-4 h-4 mr-1.5" />} active={h.mode === "done"} disabled={h.busy} onClick={() => h.open("done")}>{M.done}</Choice>
        )}
        {h.canMark && h.finished && (
          <Choice icon={<RotateCcw className="w-4 h-4 mr-1.5" />} disabled={h.busy} onClick={h.reopen}>{M.notDone}</Choice>
        )}
        <Choice icon={<FilePenLine className="w-4 h-4 mr-1.5" />} disabled={h.busy}
          onClick={() => h.openRecord(startedBakeFill({ product: lot.product, lot: lot.lotCode }, new Date(), lang), "")}>{M.open}</Choice>
      </div>
      {h.mode !== "enter" && <p className="text-sm opacity-80">{h.description}</p>}
      {h.body}
      <div className="flex flex-wrap justify-end gap-2">{h.footer}</div>
    </div>
  );
}

// ---------- Seal checks ----------

function SealStep({ doc, lot, today, lang, records, back, onSaved }: {
  doc: Doc; lot: LotSummary; today: string; lang: TodayLang; records: TodayRecords; back: string; onSaved: (s: Saved) => void;
}) {
  const S = TODAY_MSG[lang].seal;
  const F = TODAY_MSG[lang].flow;
  const state = lotSealState(records, lot, today);
  const h = useSealCheck({ doc, lot: lot.lotCode, product: lot.product, today, state, lang, onSaved, backTo: back, inline: true });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { h.open("enter"); }, []);
  return (
    <div className="space-y-4">
      <div className="space-y-1">
        <Status>{F.checks(state.loads)}</Status>
        {h.finished && <Status done>{F.sealDone}</Status>}
      </div>
      <div className="flex flex-wrap gap-2">
        <Choice icon={<Keyboard className="w-4 h-4 mr-1.5" />} active={h.mode === "enter"} disabled={h.busy} onClick={() => h.open("enter")}>{S.enter}</Choice>
        <Choice icon={<Mic className="w-4 h-4 mr-1.5" />} active={h.mode === "speak"} disabled={h.busy} onClick={() => h.open("speak")}>{S.speak}</Choice>
        {h.canMark && state.loads > 0 && state.done !== "lot" && (
          <Choice icon={<CheckCircle2 className="w-4 h-4 mr-1.5" />} active={h.mode === "done"} disabled={h.busy} onClick={() => h.open("done")}>{S.done}</Choice>
        )}
        {h.canMark && h.finished && (
          <Choice icon={<RotateCcw className="w-4 h-4 mr-1.5" />} disabled={h.busy} onClick={h.reopen}>{S.notDone}</Choice>
        )}
        <Choice icon={<FilePenLine className="w-4 h-4 mr-1.5" />} disabled={h.busy} onClick={() => h.openRecord(null, "")}>{S.open}</Choice>
      </div>
      {h.mode !== "enter" && <p className="text-sm opacity-80">{h.description}</p>}
      {h.body}
      <div className="flex flex-wrap justify-end gap-2">{h.footer}</div>
    </div>
  );
}

// ---------- Packing ----------

function PackStep({ doc, lot, today, lang, back, older, onSaved }: {
  doc: Doc; lot: LotSummary; today: string; lang: TodayLang; back: string;
  /** The lot record was started on an earlier revision of the form: its packing is finished on the record. */
  older: boolean; onSaved: (s: Saved) => void;
}) {
  const P = TODAY_MSG[lang].pack;
  const F = TODAY_MSG[lang].flow;
  const state = lot.packing;
  const h = usePacking({ doc, entryId: lot.id, lot: lot.lotCode, product: lot.product, today, state, lang, onSaved, backTo: back, inline: true });
  // With the first pack answered, the counts are what is left: they are shown without a tap. The
  // camera is never opened for the person - a browser only allows it from a tap.
  // Then the three packs to weigh. Each is opened once, so putting one away does not bring it back.
  const opened = useRef<"" | "counts" | "weights">("");
  useEffect(() => {
    // Nothing is opened for a record on an earlier revision: the input would only hand over to the
    // record, and the page must never leave by itself.
    if (h.showing || older) return;
    const answered = state.checked || !h.canPhoto;
    if (h.canCount && answered && !state.counted) {
      if (opened.current === "") { opened.current = "counts"; void h.openCounts(); }
    } else if (h.canWeigh && answered && (state.counted || !h.canCount) && !state.weighed) {
      if (opened.current !== "weights") { opened.current = "weights"; void h.openWeights(); }
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.checked, state.counted, state.weighed, h.showing]);
  return (
    <div className="space-y-4">
      {h.fileInput}
      <div className="space-y-1">
        {state.checked && <Status done>{F.firstPackDone}</Status>}
        {state.counted && <Status done>{F.countsDone}</Status>}
        {state.weighed && <Status done>{P.weighDone}.</Status>}
        {state.counted && !state.checked && <p className="flex items-center gap-1.5 text-sm font-medium text-amber-800"><AlertTriangle className="w-4 h-4" />{F.firstPackNeeded}</p>}
      </div>
      {older && <p className="flex items-start gap-1.5 text-sm text-amber-800"><AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" />{F.olderRecord}</p>}
      <div className="flex flex-wrap gap-2">
        {!older && (
          <>
            {h.canPhoto && <Choice icon={<Camera className="w-4 h-4 mr-1.5" />} active={h.showing && h.mode === "photo"} disabled={h.busy} onClick={h.pickPhoto}>{P.photo}</Choice>}
            {h.canAnswer && <Choice icon={<ClipboardCheck className="w-4 h-4 mr-1.5" />} active={h.showing && h.mode === "answer"} disabled={h.busy} onClick={() => { void h.openAnswer(); }}>{P.answer}</Choice>}
            {h.canCount && <Choice icon={<Calculator className="w-4 h-4 mr-1.5" />} active={h.showing && h.mode === "counts"} disabled={h.busy} onClick={() => { void h.openCounts(); }}>{P.counts}</Choice>}
            {h.canWeigh && <Choice icon={<Scale className="w-4 h-4 mr-1.5" />} active={h.showing && h.mode === "weights"} disabled={h.busy} onClick={() => { void h.openWeights(); }}>{P.weigh}</Choice>}
          </>
        )}
        <Choice icon={<FilePenLine className="w-4 h-4 mr-1.5" />} disabled={h.busy} onClick={h.openRecord}>{P.open}</Choice>
      </div>
      {h.showing && (
        <>
          <p className="text-sm opacity-80">{h.description}</p>
          {h.body}
          <div className="flex flex-wrap justify-end gap-2">{h.footer}</div>
        </>
      )}
    </div>
  );
}

// ---------- Mixing (the one-ingredient-at-a-time input follows; for now the lot record holds it) ----------

function MixStep({ lot, lang, records, back }: { lot: LotSummary; lang: TodayLang; records: TodayRecords; back: string }) {
  const F = TODAY_MSG[lang].flow;
  const p = mixProgress(records.lots.find(e => e.id === lot.id)?.data);
  return (
    <div className="space-y-4">
      <p className="text-sm">{F.mixingLater}</p>
      {p.lines > 0 && p.batches > 0 && <Status done={p.state === "done"}>{F.mixingProgress(p.linesDone, p.lines)}</Status>}
      <Button asChild className={GOLD}><Link to={entryHref(lot.docId, lot.id, back)}><FilePenLine className="w-4 h-4 mr-1.5" />{F.openLotRecord}</Link></Button>
    </div>
  );
}

// ---------- Sign and submit the lot record ----------

/** What still stops a lot record being submitted, in the form's own words. */
function missingAnswers(schema: FormSchema, values: Record<string, any>, line: (table: string, n: number, column: string) => string): string[] {
  const res = buildZodSchema(schema).safeParse(values);
  const out: string[] = [];
  if (!res.success) {
    const fields = new Map(valueFields(schema).map(f => [f.id, f]));
    for (const issue of res.error.issues) {
      const f = fields.get(String(issue.path[0]));
      if (!f) continue;
      const col = f.type === "grid" && typeof issue.path[1] === "number" && issue.path[2] !== undefined
        ? (f as GridField).columns.find(c => c.id === issue.path[2]) : undefined;
      out.push(col ? line(f.label, Number(issue.path[1]) + 1, col.label) : f.label);
    }
  }
  if (packCountsReady(schema)) {
    const counts = packCounts(values);
    if (counts.needsNote) out.push(counts.text);
  }
  return [...new Set(out)];
}

function SubmitStep({ doc, lot, lang, isAdmin, back, version, onSaved }: {
  doc: Doc; lot: LotSummary; lang: TodayLang; isAdmin: boolean; back: string; version: number; onSaved: (s: Saved) => void;
}) {
  const F = TODAY_MSG[lang].flow;
  const navigate = useNavigate();
  const schema = getFormSchema(doc.content);
  const [signer, setSigner] = useState<{ id: string; name: string } | null>(null);
  const [missing, setMissing] = useState<string[] | null>(null);
  const [needsRecord, setNeedsRecord] = useState(false);
  const [busy, setBusy] = useState(false);
  const submitted = lot.status === "submitted";
  const href = entryHref(lot.docId, lot.id, back);

  /** The record as it would be submitted: its answers, with this person's signature if it has none. */
  const ready = (data: Record<string, any> | null | undefined, who: { id: string; name: string } | null) => {
    const values: Record<string, any> = { ...emptyValues(schema as FormSchema), ...(data ?? {}) };
    if (who?.name && !values[LOT_FLOW.signature]?.signed_at) {
      values[LOT_FLOW.signature] = { user_id: who.id, name: who.name, signed_at: new Date().toISOString() };
    }
    return values;
  };

  useEffect(() => {
    if (submitted || !schema) return;
    let live = true;
    (async () => {
      try {
        const { data } = await supabase.auth.getUser();
        const id = data?.user?.id ?? "";
        const name = id ? (await fetchProfileNames([id]).catch(() => new Map<string, string>())).get(id) ?? "" : "";
        const r = await fetchResponse(lot.id);
        if (!live) return;
        const who = id && name ? { id, name } : null;
        setSigner(who);
        // A draft on an earlier revision of the form has its own layout: the entry page resolves it.
        if (!r || r.status !== "draft" || r.form_revision !== doc.revision) { setNeedsRecord(true); return; }
        setNeedsRecord(false);
        setMissing(missingAnswers(schema, ready(r.data, who), F.missingLine));
      } catch (e) {
        console.error(e);
        if (live) setNeedsRecord(true);
      }
    })();
    return () => { live = false; };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lot.id, version, submitted]);

  const submit = async () => {
    if (!schema || !signer || busy) return;
    setBusy(true);
    try {
      const r = await fetchResponse(lot.id);
      if (!r || r.status !== "draft" || r.form_revision !== doc.revision) { toast.message(F.needsRecord); navigate(href); return; }
      const values = ready(r.data, signer);
      const gaps = missingAnswers(schema, values, F.missingLine);
      if (gaps.length) { setMissing(gaps); setBusy(false); return; }
      const parsed = buildZodSchema(schema).parse(values);
      await submitResponse(r.id, parsed, r.updated_at);
      // A submitted entry can no longer be signed, so an outstanding request is finished either way.
      try { await resolveSignatureRequest(r.id, "Entry submitted"); } catch { /* prompt only */ }
      try { await withdrawFieldSignatureRequests(r.id, null, "Entry submitted"); } catch { /* prompt only */ }
      toast.success(F.submitted(lot.lotCode, lot.product));
      setBusy(false);
      onSaved(undefined);
    } catch (e) {
      console.error(e);
      toast.error(e instanceof StaleResponseError ? e.message : F.submitFailed);
      setBusy(false);
    }
  };

  if (submitted) {
    return (
      <div className="space-y-2">
        <Status done>{F.alreadySubmitted}</Status>
        <p className="text-sm">{isAdmin ? F.adminNext : F.finished}</p>
      </div>
    );
  }
  return (
    <div className="space-y-4">
      <p className="text-sm">{F.submitLead}</p>
      {needsRecord ? (
        <p className="flex items-start gap-1.5 text-sm text-amber-800"><AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" />{F.needsRecord}</p>
      ) : missing === null ? (
        <Loader2 className="w-5 h-5 animate-spin text-[#C89B3C]" />
      ) : missing.length > 0 ? (
        <div className="rounded-md border border-amber-500 bg-amber-50 p-3 text-sm text-amber-900">
          <p className="font-medium">{F.missing}</p>
          <ul className="list-disc pl-5 mt-1 space-y-0.5">{missing.map(m => <li key={m}>{m}</li>)}</ul>
        </div>
      ) : (
        <div className="rounded-md border border-emerald-600/50 bg-emerald-50 p-3 text-sm space-y-1">
          <Status done>{F.submitReady}</Status>
          <p className="italic">"{F.statement}"</p>
        </div>
      )}
      <div className="flex flex-wrap justify-end gap-2">
        <Button asChild variant="outline" className="border-[#2A1F0E]/40 bg-white/70 text-[#2A1F0E] hover:bg-white">
          <Link to={href}><FilePenLine className="w-4 h-4 mr-1.5" />{F.openLotRecord}</Link>
        </Button>
        {!needsRecord && signer && (
          <Button onClick={submit} disabled={busy || missing === null || missing.length > 0} className={GOLD}>
            {busy && <Loader2 className="w-4 h-4 animate-spin mr-1.5" />}{F.signAndSubmit(signer.name)}
          </Button>
        )}
      </div>
    </div>
  );
}

// ---------- Retention sample: logged here, without opening the form ----------

/** The answers of FRM-703's first section the step shows. Rename a field on the form, update this. */
const SAMPLE = {
  shown: ["product_name", "lot_code", "upc", "customer", "date_produced", "date_taken"],
  typed: ["units_retained", "printed_date", "storage_location"],
  discard: "discard_due",
  printed: "printed_date",
  taken: "date_taken",
  signature: "taken_by",
  required: ["product_name", "lot_code", "date_taken", "printed_date", "discard_due", "storage_location"],
} as const;

/**
 * FRM-703 is kept as a draft while the sample is on the shelf, and the sample counts as logged once
 * "Sample taken by" is signed (today.ts retentionStep). Nearly all of its first section is looked
 * up (retentionStart.ts), so the person reads the answers against the pack in their hand, corrects
 * the three that are theirs to state, and signs - one tap, the same record as the form would make.
 * Anything this cannot do (another revision of the form, a date it cannot read) opens the record.
 */
function RetentionStep({ doc, step, lot, lang, back, onSaved }: {
  doc: Doc; step: FlowStep; lot: LotSummary; lang: TodayLang; back: string; onSaved: (s: Saved) => void;
}) {
  const F = TODAY_MSG[lang].flow;
  const R = TODAY_MSG[lang].releaseSteps;
  const navigate = useNavigate();
  const schema = getFormSchema(doc.content);
  const fields = useMemo(() => new Map((schema ? valueFields(schema) : []).map(f => [f.id, f])), [schema]);
  const usable = !!schema && [...SAMPLE.required, SAMPLE.signature].every(id => fields.has(id));
  const existing = step.release?.entryId ?? null;
  const [values, setValues] = useState<Record<string, any> | null>(null);
  const [signer, setSigner] = useState<{ id: string; name: string } | null>(null);
  const [needsRecord, setNeedsRecord] = useState(!usable);
  const [busy, setBusy] = useState(false);

  const openRecord = async () => {
    if (!step.release) return;
    setBusy(true);
    try {
      const href = await releaseStepHref(step.release, lot, { retention: doc }, back);
      if (href) { navigate(href); return; }
    } catch (e) {
      console.error(e);
      toast.error(e instanceof Error ? e.message : R.startFailed);
    }
    setBusy(false);
  };

  useEffect(() => {
    if (!usable || !schema) return;
    let live = true;
    (async () => {
      try {
        const { data } = await supabase.auth.getUser();
        const id = data?.user?.id ?? "";
        const name = id ? (await fetchProfileNames([id]).catch(() => new Map<string, string>())).get(id) ?? "" : "";
        const defaults = await retentionDefaults(lot, schema);
        const r = existing ? await fetchResponse(existing) : null;
        if (!live) return;
        // A sample started on an earlier revision of the form has its own layout: the entry page resolves it.
        if (existing && (!r || r.status !== "draft" || r.form_revision !== doc.revision)) { setNeedsRecord(true); return; }
        const start: Record<string, any> = { ...emptyValues(schema), ...(r?.data ?? {}) };
        // What the records can answer goes into BLANK answers only; nothing typed on a started sample is touched.
        for (const [k, v] of Object.entries(blanksFilled(start, defaults))) start[k] = v;
        if (!String(start[SAMPLE.taken] ?? "").trim()) start[SAMPLE.taken] = localDay();
        setSigner(id && name ? { id, name } : null);
        setValues(start);
      } catch (e) {
        console.error(e);
        if (live) setNeedsRecord(true);
      }
    })();
    return () => { live = false; };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lot.id, existing]);

  const label = (id: string) => fields.get(id)?.label ?? id;
  const text = (id: string) => String(values?.[id] ?? "").trim();
  /** The best-by date is read off the pack; the discard date is the form's own rule applied to it. */
  const setPrinted = (v: string) => setValues(cur => {
    if (!cur) return cur;
    const derive = (fields.get(SAMPLE.discard) as { derive?: Parameters<typeof deriveDateValue>[0] } | undefined)?.derive;
    return { ...cur, [SAMPLE.printed]: v, [SAMPLE.discard]: derive ? deriveDateValue(derive, v) ?? "" : cur[SAMPLE.discard] };
  });
  const missing = values ? SAMPLE.required.filter(id => text(id) === "") : [];
  const units = Number(values?.units_retained);
  const ready = !!values && !!signer && missing.length === 0 && (!fields.has("units_retained") || (Number.isFinite(units) && units >= 1));

  const sign = async () => {
    if (!ready || !values || !signer || !schema || busy) return;
    setBusy(true);
    try {
      const signed: Record<string, any> = { ...values, ...(fields.has("units_retained") ? { units_retained: units } : {}), [SAMPLE.signature]: { user_id: signer.id, name: signer.name, signed_at: new Date().toISOString() } };
      if (existing) {
        const r = await fetchResponse(existing);
        if (!r || r.status !== "draft" || r.form_revision !== doc.revision) { toast.message(F.needsRecord); await openRecord(); return; }
        await saveResponseData(r.id, { ...(r.data ?? {}), ...signed }, r.updated_at);
      } else {
        await createResponse(doc, signed);
      }
      toast.success(F.sampleLogged(lot.lotCode, lot.product, text(SAMPLE.discard)));
      setBusy(false);
      onSaved({ step: "logged" });
    } catch (e) {
      console.error(e);
      toast.error(e instanceof StaleResponseError ? e.message : F.sampleFailed);
      setBusy(false);
    }
  };

  const openButton = (
    <Button variant="outline" disabled={busy} onClick={openRecord} className="border-[#2A1F0E]/40 bg-white/70 text-[#2A1F0E] hover:bg-white">
      <FilePenLine className="w-4 h-4 mr-1.5" />{F.openStep}
    </Button>
  );
  if (needsRecord) {
    return (
      <div className="space-y-4">
        <p className="flex items-start gap-1.5 text-sm text-amber-800"><AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" />{F.sampleNeedsRecord}</p>
        {openButton}
      </div>
    );
  }
  if (!values) return <Loader2 className="w-5 h-5 animate-spin text-[#C89B3C]" />;
  const FIELD = "w-full rounded-md border border-[#2A1F0E]/75 bg-white text-[#2A1F0E] font-medium px-2 py-2 text-sm";
  return (
    <div className="space-y-4">
      <p className="text-sm">{F.sampleLead}</p>
      <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-sm">
        {SAMPLE.shown.filter(id => fields.has(id)).map(id => (
          <div key={id} className="contents">
            <dt className="opacity-70">{label(id)}</dt>
            <dd className="font-medium">{text(id) || "—"}</dd>
          </div>
        ))}
      </dl>
      <div className="grid gap-3 sm:grid-cols-3">
        {fields.has("units_retained") && (
          <label className="flex flex-col justify-end gap-1">
            <span className="text-xs font-medium">{label("units_retained")}</span>
            <input className={FIELD} inputMode="numeric" value={values.units_retained ?? ""} onChange={e => setValues({ ...values, units_retained: e.target.value })} />
          </label>
        )}
        <label className="flex flex-col justify-end gap-1">
          <span className="text-xs font-medium">{label(SAMPLE.printed)}</span>
          <input className={FIELD} value={values[SAMPLE.printed] ?? ""} onChange={e => setPrinted(e.target.value)} />
        </label>
        <label className="flex flex-col justify-end gap-1">
          <span className="text-xs font-medium">{label("storage_location")}</span>
          <input className={FIELD} value={values.storage_location ?? ""} onChange={e => setValues({ ...values, storage_location: e.target.value })} />
        </label>
      </div>
      <p className={`text-sm ${text(SAMPLE.discard) ? "" : "text-amber-800"}`}>
        {text(SAMPLE.discard) ? <>{label(SAMPLE.discard)}: <span className="font-medium">{text(SAMPLE.discard)}</span></> : F.sampleNoDiscard}
      </p>
      {fields.get(SAMPLE.signature) && <p className="text-sm italic">"{(fields.get(SAMPLE.signature) as { statement?: string }).statement}"</p>}
      <div className="flex flex-wrap justify-end gap-2">
        {openButton}
        {signer && (
          <Button onClick={sign} disabled={busy || !ready} className={GOLD}>
            {busy && <Loader2 className="w-4 h-4 animate-spin mr-1.5" />}{F.signSample(signer.name)}
          </Button>
        )}
      </div>
    </div>
  );
}

// ---------- A retention sample already on the shelf, and the release (the SQF Practitioner's) ----------

function ReleasePanel({ step, lot, lang, docs, back }: {
  step: FlowStep; lot: LotSummary; lang: TodayLang; docs: { retention?: Doc; release?: Doc }; back: string;
}) {
  const R = TODAY_MSG[lang].releaseSteps;
  const F = TODAY_MSG[lang].flow;
  const navigate = useNavigate();
  const [busy, setBusy] = useState(false);
  const r = step.release;
  if (!r) return null;
  const status = r.sample
    ? (r.sample.stage === "started" ? R.sampleStarted : r.sample.stage === "on_shelf" ? R.sampleOnShelf(r.sample.discardDue) : R.sampleDisposed)
    : r.state === "done" ? R.done : r.state === "open" ? R.open : R.start;
  const go = async () => {
    setBusy(true);
    try {
      const href = await releaseStepHref(r, lot, docs, back);
      if (href) { navigate(href); return; }
      toast.message(R.noRecord[r.key]);
    } catch (e) {
      console.error(e);
      toast.error(e instanceof Error ? e.message : R.startFailed);
    }
    setBusy(false);
  };
  return (
    <div className="space-y-4">
      <p className="text-sm font-medium">{R.step[r.key]}</p>
      <Status done={r.state === "done"}>{status}</Status>
      <Button onClick={go} disabled={busy} className={GOLD}>
        {busy ? <Loader2 className="w-4 h-4 animate-spin mr-1.5" /> : <FilePenLine className="w-4 h-4 mr-1.5" />}
        {r.entryId ? F.openStep : F.startStep}
      </Button>
    </div>
  );
}

// ---------- The page ----------

export default function LotFlow() {
  const { entryId = "" } = useParams<{ entryId: string }>();
  const [params, setParams] = useSearchParams();
  const { role } = useUserRole();
  const isAdmin = role === "admin" || role === "owner";

  const [lang, setLang] = useState<TodayLang>(() => {
    try { const v = localStorage.getItem(LANG_KEY); if (v === "en" || v === "es") return v; } catch { /* no storage */ }
    return "en";
  });
  const M = TODAY_MSG[lang];
  const F = M.flow;
  const switchLang = (l: TodayLang) => { setLang(l); try { localStorage.setItem(LANG_KEY, l); } catch { /* no storage */ } };

  const [records, setRecords] = useState<TodayRecords | null>(null);
  const [docs, setDocs] = useState<Record<string, Doc>>({});
  const [failed, setFailed] = useState(false);
  // Counts the loads, so a step that reads the record itself knows to read it again.
  const [version, setVersion] = useState(0);
  const [dir, setDir] = useState<"next" | "prev">("next");
  const today = localDay();

  /** Read the records again. After the first load the page is never swapped for a spinner: the step in hand stays. */
  const load = useCallback(async (): Promise<TodayRecords | null> => {
    try {
      const { records, docs } = await loadTodayRecords();
      setRecords(records); setDocs(docs); setVersion(v => v + 1);
      return records;
    } catch (e) {
      console.error(e);
      setFailed(true);
      return null;
    }
  }, []);
  useEffect(() => { void load(); }, [load]);

  // The page is rem-sized, so the tablet gets larger type and larger buttons from one setting.
  useEffect(() => {
    const root = document.documentElement;
    const before = root.style.fontSize;
    root.style.fontSize = "clamp(16px, 1.5vw, 22px)";
    return () => { root.style.fontSize = before; };
  }, []);

  const lot = useMemo(() => records ? lotSummaries(records).find(l => l.id === entryId) ?? null : null, [records, entryId]);
  const steps = useMemo(() => records && lot ? flowSteps(records, lot, today, isAdmin, docs[TODAY_FORMS.lots.form]?.revision) : [], [records, lot, today, isAdmin, docs]);
  const asked = params.get("step");
  const stepKey: FlowStepKey | null = steps.length === 0 ? null
    : isFlowStep(asked) && steps.some(s => s.key === asked) ? asked : nextOpenStep(steps);
  const open = records ? productionOpen(preopState(records.preops, today)) : false;

  const go = useCallback((key: FlowStepKey | null, list: FlowStep[] = steps) => {
    if (!key) return;
    const from = list.findIndex(s => s.key === stepKey);
    const to = list.findIndex(s => s.key === key);
    setDir(to < from ? "prev" : "next");
    setParams({ step: key }, { replace: true });
  }, [steps, stepKey, setParams]);

  const saved = (key: FlowStepKey) => async (what: Saved) => {
    const fresh = await load();
    const now = fresh ? lotSummaries(fresh).find(l => l.id === entryId) : null;
    if (!fresh || !now) return;
    const after = flowSteps(fresh, now, today, isAdmin, docs[TODAY_FORMS.lots.form]?.revision);
    if (advancesAfter(key, what, after)) go(stepAfter(after, key), after);
  };

  // The arrow keys move between steps, unless something is being typed.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement | null;
      if (t && (t.isContentEditable || ["INPUT", "TEXTAREA", "SELECT"].includes(t.tagName))) return;
      if (!stepKey || e.altKey || e.ctrlKey || e.metaKey) return;
      if (e.key === "ArrowRight") go(stepAfter(steps, stepKey));
      if (e.key === "ArrowLeft") go(stepBefore(steps, stepKey));
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [steps, stepKey, go]);

  const docOf = (kind: TodayKind): Doc | undefined => docs[TODAY_FORMS[kind].form];
  const back = stepKey ? lotBackQuery(entryId, stepKey) : "from=today";
  const prev = stepKey ? stepBefore(steps, stepKey) : null;
  const next = stepKey ? stepAfter(steps, stepKey) : null;

  const body = () => {
    if (!records || !lot || !stepKey) return null;
    if (!open && GATED.includes(stepKey) && lot.status !== "submitted") {
      return (
        <div className="rounded-md border border-red-700 bg-red-50 p-4 text-sm space-y-2 text-[#2A1F0E]">
          <div className="flex items-center gap-2 font-semibold text-red-700"><ShieldAlert className="w-5 h-5" />{M.blockedTitle}</div>
          <p>{M.blockedBody}</p>
          <Button asChild variant="destructive"><Link to="/team/today">{F.backToToday}</Link></Button>
        </div>
      );
    }
    const lots = docOf("lots");
    switch (stepKey) {
      case "mixing": return <MixStep lot={lot} lang={lang} records={records} back={back} />;
      case "baking": return docOf("baking") ? <BakeStep doc={docOf("baking")!} lot={lot} today={today} lang={lang} records={records} back={back} onSaved={saved("baking")} /> : null;
      case "sealing": return docOf("sealing") ? <SealStep doc={docOf("sealing")!} lot={lot} today={today} lang={lang} records={records} back={back} onSaved={saved("sealing")} /> : null;
      case "packing": return lots ? (
        <PackStep
          doc={lots} lot={lot} today={today} lang={lang} back={back} onSaved={saved("packing")}
          older={(() => { const rev = records.lots.find(e => e.id === lot.id)?.revision; return rev != null && rev !== lots.revision; })()}
        />
      ) : null;
      case "submit": return lots ? <SubmitStep doc={lots} lot={lot} lang={lang} isAdmin={isAdmin} back={back} version={version} onSaved={saved("submit")} /> : null;
      default: {
        const step = steps.find(s => s.key === stepKey);
        // A sample not yet on the shelf is logged here; once it is, the step shows where it stands.
        if (step && stepKey === "retention" && step.state !== "done" && docOf("retention")) {
          return <RetentionStep doc={docOf("retention")!} step={step} lot={lot} lang={lang} back={back} onSaved={saved("retention")} />;
        }
        return step ? <ReleasePanel step={step} lot={lot} lang={lang} docs={{ retention: docOf("retention"), release: docOf("releases") }} back={back} /> : null;
      }
    }
  };

  const arrow = (to: FlowStepKey | null, label: string, Icon: typeof ChevronLeft) => (
    <button
      type="button" onClick={() => go(to)} disabled={!to} aria-label={label} title={label}
      className={`shrink-0 w-14 md:w-20 self-stretch min-h-[14rem] rounded-xl border-2 flex items-center justify-center transition-colors ${to
        ? "border-[#C89B3C] bg-black/35 text-[#F5F1E6] hover:bg-[#C89B3C] hover:text-[#2A1F0E]" : "border-transparent text-transparent"}`}
    >
      <Icon className="w-10 h-10 md:w-14 md:h-14" />
    </button>
  );

  return (
    <div className="team-portal team-portal-bg min-h-screen" lang={lang}>
      <style>{`
        @keyframes lotSlideNext { from { opacity: 0; transform: translateX(2.5rem); } to { opacity: 1; transform: none; } }
        @keyframes lotSlidePrev { from { opacity: 0; transform: translateX(-2.5rem); } to { opacity: 1; transform: none; } }
        .lot-slide-next { animation: lotSlideNext .22s ease-out; }
        .lot-slide-prev { animation: lotSlidePrev .22s ease-out; }
        @media (prefers-reduced-motion: reduce) { .lot-slide-next, .lot-slide-prev { animation: none; } }
      `}</style>
      <div className="max-w-6xl mx-auto p-4 md:p-6 space-y-4">
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <Link to="/team/today" className="flex items-center gap-1.5 text-sm font-medium tp-on-bg hover:underline">
            <ArrowLeft className="w-4 h-4" />{F.backToToday}
          </Link>
          <div className="flex items-center gap-1 text-xs">
            {(["en", "es"] as TodayLang[]).map(l => (
              <button key={l} type="button" onClick={() => switchLang(l)} aria-pressed={lang === l}
                className={`px-2.5 py-1 rounded border font-medium ${lang === l ? "border-[hsl(var(--tp-gold))] bg-[hsl(var(--tp-gold))] text-[#2A1F0E]" : "border-[#F5F1E6]/60 bg-black/35 text-[#F5F1E6] hover:bg-black/55"}`}>
                {l === "en" ? "English" : "Español"}
              </button>
            ))}
          </div>
        </div>

        {!records ? (
          <div className="flex items-center gap-2 tp-on-bg py-10">
            {failed ? <><AlertTriangle className="w-5 h-5" />{M.loadError}</> : <><Loader2 className="w-5 h-5 animate-spin" />{M.loading}</>}
          </div>
        ) : !lot || !stepKey ? (
          <p className="tp-on-bg py-10">{F.notFound}</p>
        ) : (
          <>
            <h1 className="text-2xl md:text-3xl font-semibold tp-on-bg">
              Lot {lot.lotCode || "—"} · {lot.product || "—"}
              {lot.onHold && <span className="ml-3 text-base font-medium text-red-300">{M.onHold}</span>}
            </h1>

            <ol className="flex flex-wrap gap-2">
              {steps.map((s, i) => {
                const current = s.key === stepKey;
                const Icon = s.state === "done" ? CheckCircle2 : s.state === "open" ? CircleDot : Circle;
                return (
                  <li key={s.key}>
                    <button
                      type="button" onClick={() => go(s.key)} aria-current={current ? "step" : undefined}
                      title={F.state[s.state]}
                      className={`flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-sm font-medium ${current
                        ? "border-[#C89B3C] bg-[#C89B3C] text-[#2A1F0E]" : "border-[#F5F1E6]/50 bg-black/35 text-[#F5F1E6] hover:bg-black/55"}`}
                    >
                      <Icon className={`w-4 h-4 ${current ? "" : s.state === "done" ? "text-emerald-400" : s.state === "open" ? "text-amber-300" : "opacity-60"}`} />
                      {i + 1}. {F.step[s.key]}
                      <span className="sr-only"> - {F.state[s.state]}</span>
                    </button>
                  </li>
                );
              })}
            </ol>

            <div className="flex items-stretch gap-3">
              {arrow(prev, F.previous, ChevronLeft)}
              <div key={stepKey} className={`flex-1 min-w-0 rounded-xl bg-[#F5F1E6] text-[#2A1F0E] p-5 md:p-6 shadow-lg ${dir === "next" ? "lot-slide-next" : "lot-slide-prev"}`}>
                <h2 className="text-xl font-semibold mb-3">
                  {steps.findIndex(s => s.key === stepKey) + 1}. {F.step[stepKey]}
                </h2>
                {body()}
              </div>
              {arrow(next, F.next, ChevronRight)}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
