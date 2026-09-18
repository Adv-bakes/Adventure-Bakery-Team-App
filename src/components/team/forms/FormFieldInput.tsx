import { useEffect, useRef, useState } from "react";
import { Controller, useWatch, type Control } from "react-hook-form";
import { format, parseISO } from "date-fns";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { deriveDateValue, nextDerivedFill } from "@/lib/formSchema";
import { loadSelectOptions } from "@/lib/formReport";
import type {
  CheckboxField, DateDerivation, DateField, DerivedFillState, FormField, NumberField, SelectField,
  PassFailField, SelectOptionsFrom, SignatureField, TextField, TextareaField,
} from "@/lib/formSchema";
import { SignatureFieldInput, type Signer } from "./SignatureFieldInput";
import { DictationTextarea } from "./DictationTextarea";

const PASS_FAIL_STYLE: Record<string, string> = {
  pass: "data-[on=true]:bg-green-500/20 data-[on=true]:text-green-700 data-[on=true]:border-green-600/40",
  fail: "data-[on=true]:bg-red-500/15 data-[on=true]:text-red-700 data-[on=true]:border-red-600/40",
  na:   "data-[on=true]:bg-[#2A1F0E]/10 data-[on=true]:text-[#2A1F0E]/70 data-[on=true]:border-[#2A1F0E]/30",
};

/**
 * A date computed from another field — e.g. FRM-703's Discard due, thirty days
 * past the best-by printed on the pack, counting from the last day of a
 * month-coded pack (FSQM-014 Part 6).
 *
 * IT FILLS ITSELF, and STAYS IN STEP while it does. A one-shot fill is the trap
 * here: fill on scan, the filler then corrects the printed date, and the discard
 * date is silently stale — worse than leaving it empty, because the draft list
 * sorts by it. So the value is recomputed whenever the source changes, for as
 * long as the field still holds what this put there.
 *
 * The moment the filler types their own date it is THEIRS and this stops
 * touching it — the customer-agreement-requires-longer case is a real one, and
 * an override that kept being overwritten would be unusable. The link then
 * reappears offering the standard period back, which also tells a reader what
 * the standard period would have been.
 *
 * A source that cannot be parsed produces nothing at all: no fill, no link, and
 * the date is typed. `parsePrintedDate` returns null rather than guessing, so
 * the failure mode is an empty field, never a plausible wrong one.
 */
function DerivedDate({ derive, control, value, onChange }: {
  derive: DateDerivation;
  control: Control<Record<string, any>>;
  value: unknown;
  onChange: (value: string) => void;
}) {
  const source = useWatch({ control, name: derive.fromField });
  const computed = deriveDateValue(derive, source);
  const fill = useRef<DerivedFillState>({});

  useEffect(() => {
    const { write, state } = nextDerivedFill(typeof value === "string" ? value : "", computed, fill.current);
    fill.current = state;
    if (write !== undefined) onChange(write);
  }, [computed, value]); // eslint-disable-line react-hooks/exhaustive-deps

  // Nothing to offer when the field already agrees with the computation.
  if (!computed || value === computed) return null;
  return (
    <button
      type="button"
      onClick={() => { fill.current = { ours: computed, seeded: true }; onChange(computed); }}
      className="text-xs font-medium text-[#9A6F1E] hover:underline shrink-0 whitespace-nowrap"
      title={`The standard period, computed from ${derive.fromField.replace(/_/g, " ")}`}
    >
      {derive.label ?? "Due"} {format(parseISO(computed), "d MMM yyyy")}
    </button>
  );
}

/** Segmented Pass / Fail / N/A control shared by scalar fields and grid cells. */
export function PassFailInput({ field, value, onChange, disabled, compact }: {
  field: Pick<PassFailField, "naAllowed" | "labels">;
  value: string | null | undefined;
  onChange: (v: string) => void;
  disabled?: boolean;
  compact?: boolean;
}) {
  const options: Array<[string, string]> = [
    ["pass", field.labels?.pass ?? "Pass"],
    ["fail", field.labels?.fail ?? "Fail"],
    ...(field.naAllowed !== false ? [["na", field.labels?.na ?? "N/A"] as [string, string]] : []),
  ];
  return (
    <div className="inline-flex rounded-md border overflow-hidden" style={{ borderColor: "rgba(200,155,60,0.35)" }}>
      {options.map(([key, label]) => (
        <button
          key={key}
          type="button"
          disabled={disabled}
          data-on={value === key}
          onClick={() => onChange(value === key ? "" : key)}
          className={cn(
            "border-r last:border-r-0 font-medium transition-colors disabled:opacity-60",
            compact ? "px-2 py-1 text-[11px]" : "px-3 py-1.5 text-xs",
            "text-[#2A1F0E]/80 hover:bg-[#C89B3C]/10",
            PASS_FAIL_STYLE[key],
          )}
          style={{ borderColor: "rgba(200,155,60,0.25)" }}
        >
          {label}
        </button>
      ))}
    </div>
  );
}

interface FormFieldInputProps {
  field: FormField;
  control: Control<Record<string, any>>;
  disabled?: boolean;
  isAdmin?: boolean;
  signer?: Signer;
}

/**
 * The live half of a select's list (SelectField.optionsFrom): null while loading, [] when
 * nothing qualifies. Fetched on mount rather than cached, so an approval submitted in another
 * tab is choosable the next time the entry is opened.
 */
function useLinkedOptions(spec: SelectOptionsFrom | undefined) {
  const [state, setState] = useState<{ options: string[] | null; failed: boolean }>({ options: null, failed: false });
  const key = spec ? JSON.stringify(spec) : "";
  useEffect(() => {
    if (!spec) return;
    let live = true;
    loadSelectOptions(spec)
      .then(options => { if (live) setState({ options, failed: false }); })
      .catch(() => { if (live) setState({ options: [], failed: true }); });
    return () => { live = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);
  return state;
}

/**
 * Renders one scalar schema field wired to react-hook-form. Grid fields are
 * handled by GridFieldInput; heading/info by FormRenderer directly. Unknown
 * types render a placeholder box (forward-compat: never crash, never drop data).
 */
export function FormFieldInput({ field, control, disabled, isAdmin, signer }: FormFieldInputProps) {
  const linkedSpec = field.type === "select" ? (field as SelectField).optionsFrom : undefined;
  const linked = useLinkedOptions(linkedSpec);
  return (
    <Controller
      control={control}
      name={field.id}
      render={({ field: rhf, fieldState }) => {
        const labelEl = (
          <Label className="text-xs text-[#2A1F0E]/90">
            {field.label}
            {field.required && <span className="text-red-600 ml-0.5">*</span>}
            {field.type === "number" && (field as NumberField).unit && (
              <span className="text-[#2A1F0E]/55 ml-1">({(field as NumberField).unit})</span>
            )}
          </Label>
        );
        const error = fieldState.error?.message;

        let input: JSX.Element;
        switch (field.type) {
          case "text":
            input = (
              <Input
                value={rhf.value ?? ""}
                onChange={rhf.onChange}
                onBlur={rhf.onBlur}
                disabled={disabled}
                maxLength={(field as TextField).maxLength}
                placeholder={(field as TextField).placeholder}
              />
            );
            break;
          case "textarea":
            input = (
              <DictationTextarea
                value={rhf.value}
                onChange={rhf.onChange}
                onBlur={rhf.onBlur}
                disabled={disabled}
                rows={(field as TextareaField).rows ?? 3}
              />
            );
            break;
          case "number": {
            const f = field as NumberField;
            input = (
              <Input
                type="number"
                value={rhf.value ?? ""}
                onChange={rhf.onChange}
                onBlur={rhf.onBlur}
                disabled={disabled}
                min={f.min}
                max={f.max}
                step={f.step ?? "any"}
              />
            );
            break;
          }
          case "date":
          case "time":
            input = (
              <div className="flex items-center gap-1.5">
                <Input
                  type={field.type}
                  value={rhf.value ?? ""}
                  onChange={rhf.onChange}
                  onBlur={rhf.onBlur}
                  disabled={disabled}
                  className="flex-1"
                />
                {field.type === "date" && !disabled && (
                  <button
                    type="button"
                    onClick={() => rhf.onChange(format(new Date(), "yyyy-MM-dd"))}
                    className="text-xs font-medium text-[#9A6F1E] hover:underline shrink-0"
                  >
                    Today
                  </button>
                )}
                {field.type === "date" && !disabled && (field as DateField).derive && (
                  <DerivedDate
                    derive={(field as DateField).derive!}
                    control={control}
                    value={rhf.value}
                    onChange={rhf.onChange}
                  />
                )}
              </div>
            );
            break;
          case "datetime":
            input = (
              <div className="flex items-center gap-1.5">
                <Input
                  type="datetime-local"
                  value={rhf.value ?? ""}
                  onChange={rhf.onChange}
                  onBlur={rhf.onBlur}
                  disabled={disabled}
                  className="flex-1"
                />
                {!disabled && (
                  <button
                    type="button"
                    onClick={() => rhf.onChange(format(new Date(), "yyyy-MM-dd'T'HH:mm"))}
                    className="text-xs font-medium text-[#9A6F1E] hover:underline shrink-0"
                  >
                    Now
                  </button>
                )}
              </div>
            );
            break;
          case "checkbox":
            return (
              <div className="space-y-1">
                <div className="flex items-center gap-2 min-h-9">
                  <Checkbox
                    id={`fld-${field.id}`}
                    checked={rhf.value === true}
                    disabled={disabled}
                    onCheckedChange={c => rhf.onChange(!!c)}
                  />
                  <Label htmlFor={`fld-${field.id}`} className={cn("font-normal", !disabled && "cursor-pointer")}>
                    {field.label}
                    {field.required && <span className="text-red-600 ml-0.5">*</span>}
                  </Label>
                </div>
                {field.help && <p className="text-xs text-muted-foreground">{field.help}</p>}
                {(field as CheckboxField).clearOnScanOf && rhf.value !== true && (
                  <p className="text-xs text-amber-700">
                    Not yet checked. A label scan unticks this whenever it fills the text it covers.
                  </p>
                )}
                {error && <p className="text-xs text-red-600">{error}</p>}
              </div>
            );
          case "select": {
            const f = field as SelectField;
            const own = f.options ?? [];
            const offered = [...own, ...(linked.options ?? []).filter(o => !own.includes(o))];
            const chosen: string[] = f.multiple
              ? (Array.isArray(rhf.value) ? rhf.value : [])
              : (rhf.value ? [String(rhf.value)] : []);
            // A value saved earlier that the list no longer offers (e.g. a supplier since rejected)
            // stays visible and flagged — silently dropping it would rewrite the record.
            const stale = f.optionsFrom && linked.options !== null
              ? chosen.filter(v => !offered.includes(v))
              : [];
            const staleNote = f.optionsFrom ? ` — not on ${f.optionsFrom.form}'s current list` : "";
            const linkNote = f.optionsFrom && (
              linked.options === null ? (
                <p className="text-xs text-muted-foreground">Loading the list from {f.optionsFrom.form}…</p>
              ) : linked.failed ? (
                <p className="text-xs text-red-600">Couldn't load the list from {f.optionsFrom.form}. Reload the page to try again.</p>
              ) : offered.length === 0 ? (
                <p className="text-xs text-muted-foreground">
                  {f.optionsFrom.emptyText ?? `Nothing on ${f.optionsFrom.form} qualifies yet.`}
                </p>
              ) : null
            );
            if (f.multiple) {
              const values = chosen;
              input = (
                <div className="space-y-1">
                  <div className="flex flex-wrap gap-x-4 gap-y-1.5 pt-1">
                    {[...offered, ...stale].map(opt => (
                      <div key={opt} className="flex items-center gap-1.5">
                        <Checkbox
                          id={`fld-${field.id}-${opt}`}
                          checked={values.includes(opt)}
                          disabled={disabled}
                          onCheckedChange={c => rhf.onChange(c ? [...values, opt] : values.filter(v => v !== opt))}
                        />
                        <Label
                          htmlFor={`fld-${field.id}-${opt}`}
                          className={cn("font-normal text-sm", !disabled && "cursor-pointer", stale.includes(opt) && "text-amber-700")}
                        >
                          {opt}{stale.includes(opt) && staleNote}
                        </Label>
                      </div>
                    ))}
                  </div>
                  {linkNote}
                </div>
              );
            } else {
              input = (
                <div className="space-y-1">
                  <Select value={rhf.value || undefined} onValueChange={rhf.onChange} disabled={disabled}>
                    <SelectTrigger><SelectValue placeholder="Select…" /></SelectTrigger>
                    <SelectContent>
                      {offered.map(opt => <SelectItem key={opt} value={opt}>{opt}</SelectItem>)}
                      {stale.map(opt => <SelectItem key={opt} value={opt}>{opt}{staleNote}</SelectItem>)}
                    </SelectContent>
                  </Select>
                  {linkNote}
                </div>
              );
            }
            break;
          }
          case "pass_fail":
            input = (
              <div>
                <PassFailInput
                  field={field as PassFailField}
                  value={rhf.value}
                  onChange={rhf.onChange}
                  disabled={disabled}
                />
              </div>
            );
            break;
          case "signature":
            return (
              <div className="space-y-1">
                <SignatureFieldInput
                  field={field as SignatureField}
                  value={rhf.value ?? null}
                  onChange={rhf.onChange}
                  disabled={disabled}
                  isAdmin={isAdmin}
                  signer={signer}
                />
                {error && <p className="text-xs text-red-600">{error}</p>}
              </div>
            );
          default:
            return (
              <div className="rounded-md border border-dashed p-3 text-xs text-muted-foreground" style={{ borderColor: "rgba(200,155,60,0.35)" }}>
                {field.label} — unsupported field type "{field.type}" (answers are preserved)
              </div>
            );
        }

        return (
          <div className="space-y-1">
            {labelEl}
            {input}
            {field.help && <p className="text-xs text-muted-foreground">{field.help}</p>}
            {error && <p className="text-xs text-red-600">{error}</p>}
          </div>
        );
      }}
    />
  );
}
