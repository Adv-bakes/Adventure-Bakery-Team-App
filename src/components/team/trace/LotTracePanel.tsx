import { useEffect, useMemo, useState, type ReactNode } from "react";
import { AlertTriangle, ExternalLink, Loader2, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { loadTraceRecords, type TraceData } from "@/lib/formResponses";
import {
  normLot, normName, runTrace, startOptions,
  type ContactRow, type LotTrace, type RecordRef, type TraceResult, type TraceStart,
} from "@/lib/lotTrace";

const HAIR = "rgba(200,155,60,0.35)";

/** The trace records, loaded once per mount. `reload` refetches (a record filled in another tab). */
export function useTraceData(): { data: TraceData | null; error: string | null; loading: boolean; reload: () => void } {
  const [data, setData] = useState<TraceData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [tick, setTick] = useState(0);
  useEffect(() => {
    let live = true;
    setLoading(true);
    loadTraceRecords()
      .then(d => { if (live) { setData(d); setError(null); } })
      .catch(e => { if (live) setError(e?.message ?? "Couldn't load the records"); })
      .finally(() => { if (live) setLoading(false); });
    return () => { live = false; };
  }, [tick]);
  return { data, error, loading, reload: () => setTick(t => t + 1) };
}

function RecordLink({ r }: { r: RecordRef }) {
  return (
    <a
      href={`/team/compliance/forms/${r.docId}/entries/${r.id}`}
      target="_blank"
      rel="noopener noreferrer"
      className="inline-flex items-center gap-1 text-xs font-medium text-[#9A6F1E] hover:underline"
      title="Open this record in a new tab"
    >
      {r.title}
      <ExternalLink className="h-3 w-3 opacity-60" />
      {r.draft && <span className="rounded bg-amber-100 px-1 text-[10px] font-semibold uppercase text-amber-800">draft - not submitted</span>}
    </a>
  );
}

const Th = ({ children }: { children: ReactNode }) => <th className="px-2 py-1 text-left font-semibold text-[#2A1F0E]/70">{children}</th>;
const Td = ({ children, className }: { children: ReactNode; className?: string }) => <td className={cn("px-2 py-1 align-top", className)}>{children}</td>;

function LotCard({ lot }: { lot: LotTrace }) {
  return (
    <div className="rounded-lg border bg-white p-3 space-y-3" style={{ borderColor: HAIR }}>
      <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
        <h3 className="text-base font-semibold text-[#2A1F0E]">Lot {lot.lotCode}{lot.product && ` - ${lot.product}`}</h3>
        {lot.bakeDate && <span className="text-xs text-[#2A1F0E]/60">baked {lot.bakeDate}</span>}
        {lot.unitsPacked && <span className="text-xs text-[#2A1F0E]/60">packed {lot.unitsPacked}</span>}
        <span className="flex flex-wrap gap-x-3">{lot.records.map(r => <RecordLink key={r.id} r={r} />)}</span>
      </div>

      <div className="space-y-1">
        <p className="text-xs font-semibold text-[#2A1F0E]">What went in - one step back</p>
        {lot.inputs.length === 0 ? (
          <p className="text-xs text-amber-700">No Production Lot Record, so the supplier lots are not known.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead><tr className="border-b" style={{ borderColor: HAIR }}><Th>Ingredient</Th><Th>Supplier lot</Th><Th>Received (FRM-301)</Th></tr></thead>
              <tbody>
                {lot.inputs.map((i, n) => (
                  <tr key={n} className={cn("border-b last:border-0", i.trigger && "bg-amber-50")} style={{ borderColor: "rgba(200,155,60,0.15)" }}>
                    <Td>{i.ingredient}{i.brand && <span className="text-[#2A1F0E]/55"> ({i.brand})</span>}{i.trigger && <span className="ml-1 font-semibold text-amber-800">- the lot traced</span>}</Td>
                    <Td className="font-medium">{i.supplierLot || <span className="text-amber-700">none recorded</span>}</Td>
                    <Td>
                      {i.receipts.length === 0
                        ? (i.supplierLot && <span className="text-amber-700">no receipt found</span>)
                        : i.receipts.map((r, k) => (
                          <div key={k} className="flex flex-wrap items-center gap-x-2">
                            <span>{r.date}{r.supplier && ` - ${r.supplier}`}{r.qty && `, qty ${r.qty}`}</span>
                            <RecordLink r={r.ref} />
                          </div>
                        ))}
                    </Td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div className="space-y-1">
        <p className="text-xs font-semibold text-[#2A1F0E]">Where it went - one step forward</p>
        {lot.dispatches.length === 0 ? (
          <p className="text-xs text-amber-700">No dispatch recorded on FRM-801.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead><tr className="border-b" style={{ borderColor: HAIR }}><Th>Customer</Th><Th>Quantity</Th><Th>Collected</Th><Th>Record</Th></tr></thead>
              <tbody>
                {lot.dispatches.map((d, n) => (
                  <tr key={n} className="border-b last:border-0" style={{ borderColor: "rgba(200,155,60,0.15)" }}>
                    <Td className="font-medium">{d.customer || "-"}</Td><Td>{d.quantity || "-"}</Td><Td>{d.date}</Td><Td><RecordLink r={d.ref} /></Td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-1">
          <p className="text-xs font-semibold text-[#2A1F0E]">Retention sample (FRM-703)</p>
          {lot.retention.length === 0 ? <p className="text-xs text-amber-700">None recorded.</p> : lot.retention.map((r, n) => (
            <div key={n} className="text-xs">
              {r.units || "?"} unit(s){r.location && ` at ${r.location}`}{r.disposition && ` - ${r.disposition}`} <RecordLink r={r.ref} />
            </div>
          ))}
        </div>
        <div className="space-y-1">
          <p className="text-xs font-semibold text-[#2A1F0E]">Release (FRM-701)</p>
          {lot.releases.length === 0 ? <p className="text-xs text-[#2A1F0E]/55">None recorded.</p> : lot.releases.map((r, n) => (
            <div key={n} className="text-xs">{r.decision || "?"}{r.quantity && `, ${r.quantity}`} <RecordLink r={r.ref} /></div>
          ))}
        </div>
      </div>

      {lot.otherProduct.length > 0 && (
        <div className="space-y-1">
          <p className="text-xs font-semibold text-amber-800">Same lot code, different product name - check these</p>
          <div className="flex flex-wrap gap-x-3 gap-y-1">{lot.otherProduct.map(r => <RecordLink key={r.id + r.title} r={r} />)}</div>
        </div>
      )}
    </div>
  );
}

function ContactLine({ c }: { c: ContactRow }) {
  return (
    <div className="text-xs">
      <span className="font-medium text-[#2A1F0E]">{c.label}</span>
      {c.name && ` - ${c.name}`}
      {c.phone && <span className="ml-2 select-all">{c.phone}</span>}
      {c.email && <span className="ml-2 select-all">{c.email}</span>}
      {!c.phone && !c.email && <span className="ml-2 text-amber-700">no phone or email on the list</span>}
      {c.when && <div className="text-[#2A1F0E]/55">{c.when}</div>}
    </div>
  );
}

export function TraceContacts({ result, mock }: { result: TraceResult; mock?: boolean }) {
  return (
    <div className="rounded-lg border bg-white p-3 space-y-2" style={{ borderColor: HAIR }}>
      <div className="flex flex-wrap items-center gap-x-3">
        <h3 className="text-sm font-semibold text-[#2A1F0E]">Contacts</h3>
        {result.contactList && <RecordLink r={result.contactList} />}
      </div>
      {mock && (
        <p className="rounded bg-[#2A1F0E]/10 px-2 py-1 text-xs font-semibold text-[#2A1F0E]">
          MOCK RECALL - do not notify customers. Check each contact is current; contact nobody.
        </p>
      )}
      {!result.contactList && <p className="text-xs text-amber-700">No contact list (FRM-011) has been filled in yet.</p>}
      {result.customers.map(c => (
        <div key={c.customer} className="space-y-1">
          <p className="text-xs font-semibold text-[#2A1F0E]/80">Customer: {c.customer}</p>
          {c.matched
            ? c.rows.map((r, n) => <ContactLine key={n} c={r} />)
            : (
              <>
                <p className="text-xs text-amber-700">Not found by name on the contact list{c.rows.length ? " - the customers on the list are:" : "."}</p>
                {c.rows.map((r, n) => <ContactLine key={n} c={r} />)}
              </>
            )}
        </div>
      ))}
      {result.essential.length > 0 && (
        <div className="space-y-1">
          <p className="text-xs font-semibold text-[#2A1F0E]/80">Essential organizations (SQF 2.6.3.1 iv)</p>
          {result.essential.map((r, n) => <ContactLine key={n} c={r} />)}
        </div>
      )}
    </div>
  );
}

export interface LotTracePanelProps {
  data: TraceData | null;
  loading: boolean;
  error: string | null;
  onReload: () => void;
  /** Start the trace from this (the recall record's own trigger). */
  initialStart?: TraceStart | null;
  mock?: boolean;
  /** Rendered under a finished trace - the page's "Start a record" or the record's "Put into the record". */
  actions?: (result: TraceResult) => ReactNode;
}

/**
 * The lot trace: pick a supplier lot or one of our lots from what the records hold, and see every
 * finished lot involved with links to each source record, the contacts, and what the records cannot
 * show. Pure display over runTrace - nothing here writes.
 */
export function LotTracePanel({ data, loading, error, onReload, initialStart, mock, actions }: LotTracePanelProps) {
  const [kind, setKind] = useState<"material" | "lot">(initialStart?.kind ?? "material");
  const [text, setText] = useState(initialStart ? [initialStart.name, initialStart.lot].filter(Boolean).join(" ") : "");
  const [start, setStart] = useState<TraceStart | null>(initialStart ?? null);
  const [focused, setFocused] = useState(false);

  const options = useMemo(() => (data ? startOptions(data.records) : []), [data]);
  const shown = useMemo(() => {
    const words = normName(text).split(" ").filter(Boolean);
    const lotish = normLot(text);
    return options
      .filter(o => o.kind === kind)
      .filter(o => words.length === 0 || words.every(w => normName(o.label).includes(w)) || (lotish.length >= 2 && normLot(o.lot).includes(lotish)))
      .slice(0, 8);
  }, [options, kind, text]);
  const result = useMemo(() => (data && start && data.sourceProblems.length === 0 ? runTrace(data.records, start) : null), [data, start]);

  if (loading && !data) return <p className="flex items-center gap-2 text-sm text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" />Loading the records...</p>;
  if (error && !data) return <p className="text-sm text-red-600">{error} <button type="button" className="underline" onClick={onReload}>Try again</button></p>;
  if (!data) return null;

  if (data.sourceProblems.length > 0) {
    return (
      <div className="rounded-lg border-2 border-red-500 bg-red-50 p-3 space-y-1" role="alert">
        <p className="text-sm font-semibold text-red-900">The trace cannot run: a form it reads has changed.</p>
        <p className="text-xs text-red-900">Trace by hand from the records, and tell whoever maintains the Team Portal:</p>
        <ul className="list-disc pl-5 text-xs text-red-900">{data.sourceProblems.map(p => <li key={p}>{p}</li>)}</ul>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="space-y-2">
        <div className="flex flex-wrap gap-2">
          {([["material", "An ingredient or packaging lot"], ["lot", "One of our lots"]] as const).map(([k, label]) => (
            <Button key={k} type="button" size="sm" variant={kind === k ? "default" : "outline"} onClick={() => { setKind(k); setText(""); setStart(null); }}>
              {label}
            </Button>
          ))}
          <Button type="button" size="sm" variant="ghost" onClick={onReload} disabled={loading} title="Read the records again">
            {loading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : "Refresh records"}
          </Button>
        </div>
        <div className="relative">
          <div className="flex gap-2">
            <Input
              value={text}
              onChange={e => setText(e.target.value)}
              onFocus={() => setFocused(true)}
              onBlur={() => window.setTimeout(() => setFocused(false), 150)}
              onKeyDown={e => { if (e.key === "Enter" && normLot(text)) { e.preventDefault(); setStart({ kind, lot: text.trim() }); setFocused(false); } }}
              placeholder={kind === "material" ? "Type the ingredient or its lot, e.g. soybean oil" : "Type the lot code or product, e.g. 6273"}
              className="flex-1"
            />
            <Button type="button" onClick={() => { setStart({ kind, lot: text.trim() }); setFocused(false); }} disabled={!normLot(text)}>
              <Search className="mr-1.5 h-4 w-4" />Trace
            </Button>
          </div>
          {focused && shown.length > 0 && (
            <div className="absolute z-20 mt-1 w-full rounded-md border bg-white shadow-md" style={{ borderColor: HAIR }}>
              {shown.map(o => (
                <button
                  key={`${o.kind}|${o.lot}|${o.name}`}
                  type="button"
                  onMouseDown={e => e.preventDefault()}
                  onClick={() => { setText(o.label); setStart({ kind: o.kind, lot: o.lot, name: o.name || undefined }); setFocused(false); }}
                  className="block w-full px-3 py-1.5 text-left text-sm hover:bg-[#C89B3C]/10"
                >
                  {o.label}
                </button>
              ))}
            </div>
          )}
        </div>
        <p className="text-xs text-muted-foreground">
          Pick from the list - it is built from the lots already on the records - or type a lot and press Trace. Spaces, dashes and capitals do not matter.
        </p>
      </div>

      {result && (
        <div className="space-y-3">
          <p className="text-sm text-[#2A1F0E]">
            <span className="font-semibold">
              {result.lots.length === 0 ? "No finished lot found" : `${result.lots.length} finished lot${result.lots.length === 1 ? "" : "s"} involved`}
            </span>
            {" "}for {start!.kind === "material" ? "supplier lot" : "lot"} <span className="font-semibold">{start!.lot}</span>{start!.name && ` (${start!.name})`}.
          </p>

          {result.gaps.length > 0 && (
            <div className="rounded-lg border border-amber-400 bg-amber-50 p-3 space-y-1">
              <p className="flex items-center gap-1.5 text-sm font-semibold text-amber-900"><AlertTriangle className="h-4 w-4" />What the records do not show</p>
              <ul className="list-disc pl-5 text-xs text-amber-900 space-y-0.5">{result.gaps.map(g => <li key={g}>{g}</li>)}</ul>
            </div>
          )}

          {start!.kind === "material" && result.materialReceipts.length > 0 && (
            <div className="rounded-lg border bg-white p-3 space-y-1" style={{ borderColor: HAIR }}>
              <p className="text-xs font-semibold text-[#2A1F0E]">Receipts of supplier lot {start!.lot} (FRM-301)</p>
              {result.materialReceipts.map((r, n) => (
                <div key={n} className="flex flex-wrap items-center gap-x-2 text-xs">
                  <span>{r.date} - {r.material}{r.supplier && ` from ${r.supplier}`}{r.qty && `, qty ${r.qty}`}</span><RecordLink r={r.ref} />
                </div>
              ))}
            </div>
          )}

          {result.lots.map(l => <LotCard key={`${l.lotCode}|${l.product}`} lot={l} />)}

          {result.holds.length > 0 && (
            <div className="rounded-lg border bg-white p-3 space-y-1" style={{ borderColor: HAIR }}>
              <p className="text-xs font-semibold text-[#2A1F0E]">Holds already on record (FRM-702)</p>
              {result.holds.map((h, n) => (
                <div key={n} className="flex flex-wrap items-center gap-x-2 text-xs">
                  <span>{h.material}{h.lot && `, lot ${h.lot}`}{h.quantity && `, ${h.quantity}`}{h.disposition && ` - ${h.disposition}`}</span><RecordLink r={h.ref} />
                </div>
              ))}
            </div>
          )}

          {result.lots.length > 0 && <TraceContacts result={result} mock={mock} />}
          {actions?.(result)}
        </div>
      )}
    </div>
  );
}
