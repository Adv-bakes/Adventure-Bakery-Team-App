// The release helper on an FRM-701 entry (settings.releaseAssist; FSQM-020).
//
// The entry starts from the LOT CODE, because that is what is printed on the pack in the releaser's
// hand. Lot and Product become pick-lists fed by the site's own records, and choosing them fills in
// what those records say: the product (from the lot), the batch reference and date from the
// Production Lot Record, the customer, label and packaging figures from the product's last release,
// and - for the checks the records can speak to - the EVIDENCE in the Note.
//
// It never answers a check and never enters a pack weight. FSQM-020 has the SQF Practitioner
// confirm each check; the helper shows them what the records say and leaves the confirming to them.
// What it fills arrives unsaved, with one Undo, the same as "Copy from a previous entry".

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useWatch, type UseFormReturn } from "react-hook-form";
import { AlertTriangle, Loader2, PackageCheck, Undo2 } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { loadReleaseRecords } from "@/lib/formResponses";
import { emptyValues, valueFields, type FormSchema, type GridField } from "@/lib/formSchema";
import {
  RELEASE_TARGET, applyReleaseFill, autoFromFill, productOptionsForLot, productsForLot, releaseFill,
  sameProduct, unreleasedLots, type ReleaseRecords,
} from "@/lib/releaseAssist";
import type { FieldSuggest } from "@/components/team/forms/SuggestInput";

interface Args {
  /** The entry is editable and its form has opted in. */
  enabled: boolean;
  form: UseFormReturn<Record<string, any>>;
  schema: FormSchema | null;
  responseId: string | null;
}

type Auto = Record<string, string | number>;
interface Applied { changed: string[]; warnings: string[]; prev: Record<string, any>; prevAuto: Auto }

/** "Product, Customer and evidence for 4 checks" - the fields by name, the check notes as a count. */
function summary(changed: string[]): string {
  const fields = changed.filter(c => !c.startsWith("evidence for"));
  const notes = changed.length - fields.length;
  const parts = [...fields];
  if (notes) parts.push(`evidence for ${notes} check${notes === 1 ? "" : "s"}`);
  return parts.length > 1 ? `${parts.slice(0, -1).join(", ")} and ${parts[parts.length - 1]}` : parts.join("");
}

const PRODUCT = RELEASE_TARGET.product;
const LOT = RELEASE_TARGET.lot;

export function useReleaseAssist({ enabled, form, schema, responseId }: Args): { suggest?: FieldSuggest; card: JSX.Element | null } {
  const [records, setRecords] = useState<ReleaseRecords | null>(null);
  const [problems, setProblems] = useState<string[]>([]);
  const [failed, setFailed] = useState(false);
  const [applied, setApplied] = useState<Applied | null>(null);
  // What the helper wrote most recently, so a different lot can update it without touching typing.
  const auto = useRef<Auto>({});
  // The product and lot the looked-up cells currently reflect.
  const reflects = useRef<{ product: string; lot: string } | null>(null);

  useEffect(() => {
    if (!enabled) return;
    let live = true;
    loadReleaseRecords()
      .then(r => { if (live) { setRecords(r.records); setProblems(r.problems); } })
      .catch(() => { if (live) setFailed(true); });
    return () => { live = false; };
  }, [enabled]);

  const lot = useWatch({ control: form.control, name: LOT }) as string | undefined;

  const { checkLabels, fieldLabels } = useMemo(() => {
    const fields = schema ? valueFields(schema) : [];
    const grid = fields.find(f => f.id === RELEASE_TARGET.checks && f.type === "grid") as GridField | undefined;
    return {
      checkLabels: grid && grid.rows.mode === "fixed" ? grid.rows.labels : [],
      fieldLabels: Object.fromEntries(fields.map(f => [f.id, f.label])),
    };
  }, [schema]);

  const options = useMemo(() => {
    if (!records) return null;
    return {
      // A lot's line also settles the product, which is how one code on two products is told apart.
      [LOT]: unreleasedLots(records, responseId).map(l => ({ value: l.value, hint: l.hint, set: { [PRODUCT]: l.product } })),
      [PRODUCT]: productOptionsForLot(records, lot ?? ""),
    };
  }, [records, lot, responseId]);

  const onPick = useCallback((fieldId: string, value: string, set?: Record<string, string>) => {
    if (!records || !schema) return;
    if (fieldId !== PRODUCT && fieldId !== LOT) return;
    const stored = form.getValues();
    const before: Record<string, any> = { ...emptyValues(schema), ...stored, [fieldId]: value };
    const warnings: string[] = [];
    const changed: string[] = [];

    // On a reopened entry nothing remembers the last lookup, so cells that still match what would
    // have been looked up for the saved product and lot are treated as the helper's own.
    const was = reflects.current ?? { product: String(stored[PRODUCT] ?? ""), lot: String(stored[LOT] ?? "") };
    const lastAuto: Auto = {
      ...autoFromFill(before, releaseFill(records, was.product, was.lot, responseId), checkLabels),
      ...auto.current,
    };

    // The product follows the lot - from the line that was picked, or, for a typed code, from the
    // lot record when exactly one product carries it. A product somebody typed is never replaced.
    const nextAuto: Auto = {};
    if (fieldId === LOT) {
      const typed = String(before[PRODUCT] ?? "").trim();
      const mine = typed === "" || (PRODUCT in lastAuto && String(lastAuto[PRODUCT]) === typed);
      const candidates = set?.[PRODUCT] ? [set[PRODUCT]] : productsForLot(records, value);
      if (candidates.length === 1 && mine) {
        if (!sameProduct(typed, candidates[0]) || typed === "") changed.push(fieldLabels[PRODUCT] ?? "Product");
        before[PRODUCT] = candidates[0];
        nextAuto[PRODUCT] = candidates[0];
      } else if (candidates.length > 1 && mine) {
        if (typed !== "") { before[PRODUCT] = ""; }
        warnings.push(`Lot ${value} is on the Production Lot Record for ${candidates.length} products (${candidates.join(", ")}). Choose the product.`);
      } else if (candidates.length > 0 && !candidates.some(c => sameProduct(c, typed))) {
        warnings.push(`Lot ${value} is on the Production Lot Record for ${candidates.join(", ")}, not for ${typed}. Check the product.`);
      } else if (PRODUCT in lastAuto && String(lastAuto[PRODUCT]) === typed) {
        nextAuto[PRODUCT] = typed;
      }
    }

    const nowProduct = String(before[PRODUCT] ?? "");
    const nowLot = String(before[LOT] ?? "");
    const fill = releaseFill(records, nowProduct, nowLot, responseId);
    const res = applyReleaseFill(before, fill, lastAuto, checkLabels, fieldLabels);
    reflects.current = { product: nowProduct, lot: nowLot };
    auto.current = { ...res.auto, ...nextAuto };
    changed.push(...res.changed);
    warnings.push(...fill.warnings);

    const productMoved = String(stored[PRODUCT] ?? "") !== nowProduct && fieldId === LOT;
    if (changed.length === 0 && !productMoved) {
      setApplied(warnings.length ? { changed: [], warnings, prev: { ...emptyValues(schema), ...stored, [fieldId]: value }, prevAuto: lastAuto } : null);
      return;
    }
    // keepDefaultValues: the loaded record stays the baseline, so what was filled counts as unsaved.
    form.reset(res.values, { keepDefaultValues: true });
    setApplied({ changed, warnings, prev: { ...emptyValues(schema), ...stored, [fieldId]: value }, prevAuto: lastAuto });
  }, [records, schema, form, responseId, checkLabels, fieldLabels]);

  const undo = () => {
    if (!applied) return;
    form.reset(applied.prev, { keepDefaultValues: true });
    auto.current = applied.prevAuto;
    reflects.current = null;
    setApplied(null);
  };

  const suggest = useMemo<FieldSuggest | undefined>(() => {
    if (!enabled || !options) return undefined;
    return {
      options,
      emptyText: {
        [LOT]: "No unreleased lot on the Production Lot Record (FRM-520) - type the code.",
        [PRODUCT]: "No products on record yet - type the name.",
      },
      onPick,
    };
  }, [enabled, options, onPick]);

  if (!enabled) return { card: null };

  const card = (
    <Card className="p-3 space-y-2 border" style={{ background: "#FFF", borderColor: "rgba(200,155,60,0.4)" }}>
      <div className="flex flex-wrap items-center gap-2">
        <PackageCheck className="w-4 h-4 text-[#9A6F1E]" />
        <p className="text-sm font-medium text-[#2A1F0E]">Filled in from your records</p>
        {!records && !failed && <Loader2 className="w-3.5 h-3.5 animate-spin text-[#9A6F1E]" />}
      </div>
      <p className="text-xs text-[#2A1F0E]/70">
        Start with the lot code on the pack. The product, batch reference, date, customer, label and packaging
        figures are looked up, and each check the records can speak to gets a note saying what they show. You
        still answer every check and enter the three pack weights.
      </p>
      {failed && (
        <p className="text-xs text-red-700">The records could not be loaded. Fill the form in by hand, or reload the page to try again.</p>
      )}
      {problems.length > 0 && (
        <div className="flex gap-2 text-xs rounded border border-amber-400 bg-amber-50 text-amber-900 p-2">
          <AlertTriangle className="w-3.5 h-3.5 mt-0.5 shrink-0" />
          <div>
            <p>A form this reads has changed, so part of the lookup may be missing:</p>
            <ul className="list-disc pl-4">{problems.map(p => <li key={p}>{p}</li>)}</ul>
          </div>
        </div>
      )}
      {applied && (
        <div className="space-y-2 text-xs rounded border p-2" style={{ borderColor: "rgba(200,155,60,0.4)", background: "rgba(200,155,60,0.08)" }}>
          {applied.changed.length > 0 && (
            <div className="flex flex-wrap items-start justify-between gap-2">
              <p className="text-[#2A1F0E] flex-1 min-w-[240px]">
                Filled in: {summary(applied.changed)}. <strong>Not saved yet.</strong> Read each one, answer the checks, then Save Draft.
              </p>
              <Button type="button" size="sm" variant="outline" onClick={undo}>
                <Undo2 className="w-3.5 h-3.5 mr-1.5" />Undo
              </Button>
            </div>
          )}
          {applied.warnings.map(w => (
            <p key={w} className="flex gap-1.5 text-amber-900">
              <AlertTriangle className="w-3.5 h-3.5 mt-0.5 shrink-0" />{w}
            </p>
          ))}
        </div>
      )}
    </Card>
  );

  return { suggest, card };
}
