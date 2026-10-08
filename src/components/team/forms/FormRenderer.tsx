import { Fragment, useEffect, useRef, useState, type ReactNode } from "react";
import { useFormState, useWatch, type UseFormReturn } from "react-hook-form";
import { Camera, ChevronDown, ChevronRight, ImagePlus, Loader2, AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  applyLabelScanToFields, relevantScanWarnings, resolveScanFactForField, scanTargetFields, scanWantedFactsForFields, sectionHasAnswers,
  type FormSchema, type FormSection, type FormField as SchemaField, type InfoField,
  type ReferenceTableField, type SelectField,
} from "@/lib/formSchema";
import { FormFieldInput } from "./FormFieldInput";
import type { FieldSuggest } from "./SuggestInput";
import { SqfSectionGuide } from "./SqfSectionGuide";
import { DocRefText } from "./DocRefText";
import { GridFieldInput, type GridFieldInputProps } from "./GridFieldInput";
import type { Signer } from "./SignatureFieldInput";

/**
 * A section that starts closed (FormSection.collapsed), for the part of a form that is only filled
 * in an exceptional case. Closed means a one-line header to tap. It is shown open whenever it holds
 * an answer or one of its fields failed validation, so a recorded exception is never hidden, and
 * the person can open or close it by hand. The fields stay mounted while closed (hidden, not
 * removed), so nothing about their values changes.
 */
function CollapsedSection({ section, form, children }: {
  section: FormSection; form: UseFormReturn<Record<string, any>>; children: ReactNode;
}) {
  const ids = section.fields.map(f => f.id);
  const watched = useWatch({ control: form.control, name: ids }) as unknown[];
  const { errors } = useFormState({ control: form.control, name: ids });
  const [manual, setManual] = useState<boolean | null>(null);

  const values: Record<string, any> = {};
  ids.forEach((id, i) => { values[id] = watched?.[i]; });
  const hasAnswers = sectionHasAnswers(section, values);
  const hasError = ids.some(id => errors?.[id]);
  const open = hasError || (manual ?? hasAnswers);

  return (
    <div
      id={`form-section-${section.id}`}
      className="rounded-lg border p-4 space-y-3 scroll-mt-4"
      style={{ borderColor: "rgba(200,155,60,0.3)", background: "#FFFFFF" }}
    >
      <button
        type="button"
        className="flex w-full items-start gap-2 text-left"
        aria-expanded={open}
        onClick={() => setManual(!open)}
      >
        {open
          ? <ChevronDown className="w-4 h-4 mt-1 shrink-0 text-[#9A6F1E]" />
          : <ChevronRight className="w-4 h-4 mt-1 shrink-0 text-[#9A6F1E]" />}
        <span className="flex-1">
          <span className="block font-semibold text-[#2A1F0E]">{section.title || "More"}</span>
          {open
            ? section.description && <span className="block text-xs text-[#2A1F0E]/80 mt-0.5">{section.description}</span>
            : <span className="block text-xs text-[#2A1F0E]/60 mt-0.5">
                {hasAnswers ? "Has entries - tap to show" : "Nothing entered - tap to open if you need it"}
              </span>}
        </span>
      </button>
      <div className={open ? undefined : "hidden"}>{children}</div>
    </div>
  );
}

/** How long the "scan filled X — Undo" strip stays up. Matches the grid's. */
const SCAN_UNDO_MS = 12000;

const WIDTH_CLASS: Record<string, string> = {
  full: "md:col-span-6",
  half: "md:col-span-3",
  third: "md:col-span-2",
};

interface FormRendererProps {
  schema: FormSchema;
  form: UseFormReturn<Record<string, any>>;
  readOnly?: boolean;
  isAdmin?: boolean;
  signer?: Signer;
  /** Fill a grid row from a photographed package label; omitted in the builder Preview. */
  onScanLabel?: GridFieldInputProps["onScanLabel"];
  /** Supplies grid columns whose `defaultTo` needs the filler's identity. */
  fillContext?: GridFieldInputProps["fillContext"];
  /** "Draft from records" for grid columns with `aiDraft`; omitted in the builder Preview. */
  onDraftCell?: GridFieldInputProps["onDraftCell"];
  /** Pick-lists for some text fields, keyed by field id (the release helper's Product and Lot). */
  suggest?: FieldSuggest;
  /** Something the entry page puts directly under one section (FRM-606's hands-free bar, under the production header). */
  afterSection?: { sectionId: string; node: ReactNode };
}

/**
 * Schema → interactive form. Pure rendering over an externally-owned RHF
 * instance (the caller decides defaultValues, resolver, and what save/submit
 * mean — the entry editor and the builder Preview both reuse this).
 */
export function FormRenderer({ schema, form, readOnly, isAdmin, signer, onScanLabel, fillContext, onDraftCell, suggest, afterSection }: FormRendererProps) {
  const renderField = (field: SchemaField) => {
    // Grids and reference tables always take the full row regardless of width hint
    const widthClass = field.type === "grid" || field.type === "reference_table"
      ? "md:col-span-6"
      : WIDTH_CLASS[field.width ?? "full"] ?? "md:col-span-6";

    let el: JSX.Element;
    switch (field.type) {
      case "heading":
        el = (
          <h3 className="text-sm font-semibold text-[#2A1F0E] border-b pb-1" style={{ borderColor: "rgba(200,155,60,0.3)" }}>
            <DocRefText text={field.label} />
          </h3>
        );
        break;
      case "info":
        el = (
          <p className="text-xs text-[#2A1F0E]/80 whitespace-pre-wrap rounded-md bg-[#C89B3C]/5 p-2.5">
            <DocRefText text={(field as InfoField).text || field.label} />
          </p>
        );
        break;
      case "grid":
        el = (
          <GridFieldInput
            field={field}
            control={form.control}
            disabled={readOnly}
            onScanLabel={onScanLabel}
            fillContext={fillContext}
            onDraftCell={onDraftCell}
          />
        );
        break;
      case "reference_table": {
        const t = field as ReferenceTableField;
        el = (
          <div className="space-y-1.5">
            {field.label && <p className="text-xs font-semibold text-[#2A1F0E]"><DocRefText text={field.label} /></p>}
            <div className="rounded-md border overflow-x-auto" style={{ borderColor: "rgba(200,155,60,0.3)" }}>
              <table className="w-full text-xs">
                <thead>
                  <tr style={{ background: "#2A1F0E" }}>
                    {t.columns.map((c, i) => (
                      <th key={i} className="text-left font-semibold text-white px-2.5 py-1.5">{c}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {t.rows.map((row, ri) => (
                    <tr key={ri} className={ri % 2 === 1 ? "bg-[#C89B3C]/8" : ""}>
                      {row.map((cell, ci) => (
                        <td key={ci} className="px-2.5 py-1.5 align-top whitespace-pre-wrap text-[#2A1F0E]">{cell}</td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        );
        break;
      }
      default:
        el = (
          <FormFieldInput
            field={field}
            control={form.control}
            disabled={readOnly}
            isAdmin={isAdmin}
            signer={signer}
            suggest={suggest}
          />
        );
        if (field.type === "select" && (field as SelectField).auditGuide) {
          el = (
            <div className="space-y-2">
              {el}
              <SqfSectionGuide field={field as SelectField} form={form} disabled={readOnly} />
            </div>
          );
        }
    }
    return (
      <div key={field.id} className={cn("col-span-1", widthClass)}>
        {el}
      </div>
    );
  };

  return (
    <div className="space-y-4">
      {schema.sections.map(section => (
        <Fragment key={section.id}>
        {section.collapsed ? (
          <CollapsedSection section={section} form={form}>
            <div className="grid grid-cols-1 md:grid-cols-6 gap-x-4 gap-y-3">
              {section.fields.map(renderField)}
            </div>
          </CollapsedSection>
        ) : (
        <div
          // Anchor for "Go to Section 3" when a voice-recorded CCP reading misses a limit.
          id={`form-section-${section.id}`}
          className="rounded-lg border p-4 space-y-3 scroll-mt-4"
          style={{ borderColor: "rgba(200,155,60,0.3)", background: "#FFFFFF" }}
        >
          {(section.title || section.description || section.scanLabel) && (
            <div className="flex items-start justify-between gap-3">
              <div>
                {section.title && <h2 className="font-semibold text-[#2A1F0E]"><DocRefText text={section.title} /></h2>}
                {section.description && <p className="text-xs text-[#2A1F0E]/80 mt-0.5"><DocRefText text={section.description} /></p>}
              </div>
              {section.scanLabel && !readOnly && onScanLabel && (
                <SectionLabelScan section={section} fields={scanTargetFields(schema, section)} form={form} onScanLabel={onScanLabel} />
              )}
            </div>
          )}
          <div className="grid grid-cols-1 md:grid-cols-6 gap-x-4 gap-y-3">
            {section.fields.map(renderField)}
          </div>
        </div>
        )}
        {afterSection?.sectionId === section.id && afterSection.node}
        </Fragment>
      ))}
    </div>
  );
}

/** What the last section scan wrote, kept so it can be undone in one tap. */
interface SectionScan {
  prev: Record<string, any>;
  /** What `scanned` held for the same fields before this shot, so Undo puts that back too. */
  prevScanned: Record<string, any>;
  filled: string[];
  alternates: string[];
  unclaimed: string[];
  warnings: string[];
  /** Read differently from an answer already on the form - kept, offered as a swap. */
  differing: { id: string; label: string; value: any }[];
  /** Scannable fields still empty: what another shot is for. */
  missing: string[];
}

const showScanValue = (v: any) => {
  const s = Array.isArray(v) ? v.join(", ") : String(v ?? "");
  return s.length > 60 ? `${s.slice(0, 57)}…` : s;
};

/**
 * "Scan the pack" for a section of SCALAR fields — the twin of the grid's
 * per-row camera button, for a form whose unit of record is the whole entry.
 *
 * TWO BUTTONS, NOT ONE, and this was a real bug on the grid path: `capture` is
 * all-or-nothing per input, so a single control either always opens the camera
 * (useless on a desktop reviewing a photo already taken) or never does (useless
 * on the floor). Two inputs, two buttons, no feature detection.
 *
 * SEVERAL SHOTS OF ONE PACK. A round bottle cannot be read in one photo, so each scan adds to
 * the last: it fills what is still empty and leaves every answer already there (see
 * applyLabelScanToFields). `scanned` remembers what the scans themselves wrote, which is what
 * lets a later, fuller reading replace an earlier partial one without ever replacing typing.
 */
function SectionLabelScan({ section, fields, form, onScanLabel }: {
  section: FormSection;
  /** What this scan may fill - the section's fields, or more with scanScope "form". */
  fields: SchemaField[];
  form: UseFormReturn<Record<string, any>>;
  onScanLabel: NonNullable<FormRendererProps["onScanLabel"]>;
}) {
  const cameraRef = useRef<HTMLInputElement>(null);
  const pickerRef = useRef<HTMLInputElement>(null);
  const [scanning, setScanning] = useState(false);
  const [scan, setScan] = useState<SectionScan | null>(null);
  const [shots, setShots] = useState(0);
  const scanned = useRef<Record<string, any>>({});

  useEffect(() => {
    if (!scan) return;
    // A scan that raised a warning stays until it is dismissed: a warning that the ingredient
    // statement may be missing an allergen must not vanish on a timer while the filler is
    // looking at the pack. So does one that left something to decide or to scan again for.
    if (scan.warnings.length > 0 || scan.differing.length > 0 || scan.missing.length > 0) return;
    const timer = window.setTimeout(() => setScan(null), SCAN_UNDO_MS);
    return () => window.clearTimeout(timer);
  }, [scan]);

  const lotField = section.fields.find(f => resolveScanFactForField(f) === "lot_code");

  const run = async (file: File) => {
    setScanning(true);
    setScan(null);
    try {
      const result = await onScanLabel(file, {
        label: section.title ?? "this section",
        wanted: scanWantedFactsForFields(fields),
        keepPhoto: true, // a finished pack IS the evidence for the record it identifies
        mode: section.scanMode ?? "ingredient",
      });
      if (!result) return; // the caller already surfaced the failure
      // Snapshot only the fields the scan could touch, so Undo restores exactly
      // what it changed and nothing the filler typed elsewhere in the meantime.
      const values = form.getValues();
      const { next, filled, unclaimed, differing, missing } =
        applyLabelScanToFields(fields, values, result, scanned.current);
      const prev: Record<string, any> = {};
      const prevScanned: Record<string, any> = {};
      for (const id of Object.keys(next)) {
        if (next[id] !== values[id]) {
          prev[id] = values[id];
          if (id in scanned.current) prevScanned[id] = scanned.current[id];
          scanned.current[id] = next[id];
          form.setValue(id, next[id], { shouldDirty: true, shouldValidate: false });
        }
      }
      setShots(n => n + 1);
      setScan({
        prev,
        prevScanned,
        filled,
        unclaimed,
        differing,
        missing,
        alternates: result.alternates?.lot_code ?? [],
        // Only what still applies: "could not read X" is noise once X is on the form.
        warnings: relevantScanWarnings(fields, next, result.warnings ?? []),
      });
    } catch {
      /* the caller owns error messaging; just drop the spinner */
    } finally {
      setScanning(false);
      if (cameraRef.current) cameraRef.current.value = "";
      if (pickerRef.current) pickerRef.current.value = "";
    }
  };

  const onPick = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) void run(file);
  };

  return (
    <div className="shrink-0 text-right">
      <input ref={cameraRef} type="file" accept="image/*" capture="environment" className="hidden" onChange={onPick} />
      <input ref={pickerRef} type="file" accept="image/*" className="hidden" onChange={onPick} />
      <div className="flex items-center gap-1.5 justify-end">
        <Button
          type="button" variant="outline" size="sm" className="h-8"
          disabled={scanning}
          onClick={() => cameraRef.current?.click()}
          title="Photograph the pack to fill the fields below"
        >
          {scanning
            ? <Loader2 className="w-3.5 h-3.5 animate-spin text-[#9A6F1E]" />
            : <Camera className="w-3.5 h-3.5 text-[#9A6F1E]" />}
          <span className="ml-1.5 text-xs">{shots > 0 ? "Scan another side" : "Scan pack"}</span>
        </Button>
        <Button
          type="button" variant="ghost" size="icon" className="h-8 w-8"
          disabled={scanning}
          onClick={() => pickerRef.current?.click()}
          title="Choose an existing photo of the pack"
        >
          <ImagePlus className="w-3.5 h-3.5 text-[#9A6F1E]" />
        </Button>
      </div>

      {scan && (
        <div
          className="mt-2 max-w-md rounded-md border px-2.5 py-1.5 text-xs text-left space-y-1"
          style={{ borderColor: "rgba(200,155,60,0.45)", background: "rgba(200,155,60,0.08)" }}
        >
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
            {scan.filled.length > 0 ? (
              <>
                <span className="text-[#2A1F0E]">
                  Label scan filled <strong>{scan.filled.join(", ")}</strong> — check it against the pack.
                </span>
                <button
                  type="button"
                  onClick={() => {
                    for (const [id, value] of Object.entries(scan.prev)) {
                      form.setValue(id, value, { shouldDirty: true, shouldValidate: false });
                      if (id in scan.prevScanned) scanned.current[id] = scan.prevScanned[id];
                      else delete scanned.current[id];
                    }
                    setScan(null);
                  }}
                  className="font-medium text-[#9A6F1E] hover:underline"
                >
                  Undo
                </button>
              </>
            ) : (
              <span className="text-[#2A1F0E]">
                {shots > 1
                  ? "Nothing new on that photo — nothing was changed."
                  : "Nothing readable on that photo — nothing was changed. Try again in better light, or type it in."}
              </span>
            )}
          </div>

          {/* Read, but the form already holds a different answer. The answer stays; the new
              reading is one tap away. */}
          {scan.differing.length > 0 && (
            <div className="space-y-1">
              <p className="text-[#2A1F0E]/70">Read differently from what is already entered — kept as entered:</p>
              {scan.differing.map(d => (
                <div key={d.id} className="flex flex-wrap items-center gap-1.5">
                  <span className="text-[#2A1F0E]"><strong>{d.label}:</strong> {showScanValue(d.value)}</span>
                  <button
                    type="button"
                    onClick={() => {
                      form.setValue(d.id, d.value, { shouldDirty: true, shouldValidate: false });
                      scanned.current[d.id] = d.value;
                      setScan(s => s && { ...s, differing: s.differing.filter(x => x.id !== d.id) });
                    }}
                    className="rounded border px-1.5 py-0.5 text-[11px] font-medium text-[#9A6F1E] hover:bg-[#C89B3C]/15"
                    style={{ borderColor: "rgba(200,155,60,0.45)" }}
                  >
                    Use this
                  </button>
                </div>
              ))}
            </div>
          )}

          {scan.missing.length > 0 && (
            <p className="text-[#2A1F0E]/70">
              Still blank: {scan.missing.join(", ")}. Turn the pack and scan another side, or type them in.
            </p>
          )}

          {/* The pack carries several numbers; if the wrong one was read as the
              lot, swapping it should not mean retyping it. */}
          {lotField && scan.alternates.length > 0 && (
            <div className="flex flex-wrap items-center gap-1">
              <span className="text-[#2A1F0E]/70">Other codes on the pack:</span>
              {scan.alternates.map(code => (
                <button
                  key={code}
                  type="button"
                  onClick={() => form.setValue(lotField.id, code, { shouldDirty: true })}
                  className="rounded border px-1.5 py-0.5 font-mono text-[11px] text-[#9A6F1E] hover:bg-[#C89B3C]/15"
                  style={{ borderColor: "rgba(200,155,60,0.45)" }}
                >
                  {code}
                </button>
              ))}
            </div>
          )}

          {/* Read but with no field to hold it. Shown rather than dropped — the
              filler may want it, and silently discarding it would hide that the
              model saw more than the form can record. */}
          {scan.unclaimed.length > 0 && (
            <p className="text-[#2A1F0E]/70">Also read: {scan.unclaimed.join(" · ")}</p>
          )}
          {scan.warnings.length > 0 && (
            <div className="space-y-1 pt-0.5">
              {scan.warnings.map(w => (
                <p key={w} className="flex gap-1.5 text-amber-800">
                  <AlertTriangle className="w-3.5 h-3.5 shrink-0 mt-px" />
                  <span>{w}</span>
                </p>
              ))}
              <button
                type="button"
                onClick={() => setScan(null)}
                className="font-medium text-[#9A6F1E] hover:underline"
              >
                Dismiss
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
