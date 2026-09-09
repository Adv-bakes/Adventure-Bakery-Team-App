import { useEffect, useRef, useState } from "react";
import type { UseFormReturn } from "react-hook-form";
import { Camera, ImagePlus, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  applyLabelScanToFields, resolveScanFactForField, scanWantedFactsForFields,
  type FormSchema, type FormSection, type FormField as SchemaField, type InfoField,
  type ReferenceTableField,
} from "@/lib/formSchema";
import { FormFieldInput } from "./FormFieldInput";
import { GridFieldInput, type GridFieldInputProps } from "./GridFieldInput";
import type { Signer } from "./SignatureFieldInput";

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
}

/**
 * Schema → interactive form. Pure rendering over an externally-owned RHF
 * instance (the caller decides defaultValues, resolver, and what save/submit
 * mean — the entry editor and the builder Preview both reuse this).
 */
export function FormRenderer({ schema, form, readOnly, isAdmin, signer, onScanLabel, fillContext }: FormRendererProps) {
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
            {field.label}
          </h3>
        );
        break;
      case "info":
        el = (
          <p className="text-xs text-[#2A1F0E]/80 whitespace-pre-wrap rounded-md bg-[#C89B3C]/5 p-2.5">
            {(field as InfoField).text || field.label}
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
          />
        );
        break;
      case "reference_table": {
        const t = field as ReferenceTableField;
        el = (
          <div className="space-y-1.5">
            {field.label && <p className="text-xs font-semibold text-[#2A1F0E]">{field.label}</p>}
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
          />
        );
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
        <div
          key={section.id}
          className="rounded-lg border p-4 space-y-3"
          style={{ borderColor: "rgba(200,155,60,0.3)", background: "#FFFFFF" }}
        >
          {(section.title || section.description || section.scanLabel) && (
            <div className="flex items-start justify-between gap-3">
              <div>
                {section.title && <h2 className="font-semibold text-[#2A1F0E]">{section.title}</h2>}
                {section.description && <p className="text-xs text-[#2A1F0E]/80 mt-0.5">{section.description}</p>}
              </div>
              {section.scanLabel && !readOnly && onScanLabel && (
                <SectionLabelScan section={section} form={form} onScanLabel={onScanLabel} />
              )}
            </div>
          )}
          <div className="grid grid-cols-1 md:grid-cols-6 gap-x-4 gap-y-3">
            {section.fields.map(renderField)}
          </div>
        </div>
      ))}
    </div>
  );
}

/** What the last section scan wrote, kept so it can be undone in one tap. */
interface SectionScan {
  prev: Record<string, any>;
  filled: string[];
  alternates: string[];
  unclaimed: string[];
  warnings: string[];
}

/**
 * "Scan the pack" for a section of SCALAR fields — the twin of the grid's
 * per-row camera button, for a form whose unit of record is the whole entry.
 *
 * TWO BUTTONS, NOT ONE, and this was a real bug on the grid path: `capture` is
 * all-or-nothing per input, so a single control either always opens the camera
 * (useless on a desktop reviewing a photo already taken) or never does (useless
 * on the floor). Two inputs, two buttons, no feature detection.
 */
function SectionLabelScan({ section, form, onScanLabel }: {
  section: FormSection;
  form: UseFormReturn<Record<string, any>>;
  onScanLabel: NonNullable<FormRendererProps["onScanLabel"]>;
}) {
  const cameraRef = useRef<HTMLInputElement>(null);
  const pickerRef = useRef<HTMLInputElement>(null);
  const [scanning, setScanning] = useState(false);
  const [scan, setScan] = useState<SectionScan | null>(null);

  useEffect(() => {
    if (!scan) return;
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
        wanted: scanWantedFactsForFields(section.fields),
        keepPhoto: true, // a finished pack IS the evidence for the record it identifies
        mode: section.scanMode ?? "ingredient",
      });
      if (!result) return; // the caller already surfaced the failure
      // Snapshot only the fields the scan could touch, so Undo restores exactly
      // what it changed and nothing the filler typed elsewhere in the meantime.
      const values = form.getValues();
      const { next, filled, unclaimed } = applyLabelScanToFields(section.fields, values, result);
      const prev: Record<string, any> = {};
      for (const id of Object.keys(next)) {
        if (next[id] !== values[id]) {
          prev[id] = values[id];
          form.setValue(id, next[id], { shouldDirty: true, shouldValidate: false });
        }
      }
      setScan({
        prev,
        filled,
        unclaimed,
        alternates: result.alternates?.lot_code ?? [],
        warnings: result.warnings ?? [],
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
          <span className="ml-1.5 text-xs">Scan pack</span>
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
                Nothing readable on that photo — nothing was changed. Try again in better light, or type it in.
              </span>
            )}
          </div>

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
            <p className="text-[#9A6F1E]">{scan.warnings.join(" · ")}</p>
          )}
        </div>
      )}
    </div>
  );
}
