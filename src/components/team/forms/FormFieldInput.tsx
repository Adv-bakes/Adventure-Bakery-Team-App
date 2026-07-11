import { Controller, type Control } from "react-hook-form";
import { format } from "date-fns";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { cn } from "@/lib/utils";
import type {
  FormField, NumberField, SelectField, PassFailField, SignatureField,
  TextField, TextareaField,
} from "@/lib/formSchema";
import { SignatureFieldInput, type Signer } from "./SignatureFieldInput";

const PASS_FAIL_STYLE: Record<string, string> = {
  pass: "data-[on=true]:bg-green-500/20 data-[on=true]:text-green-700 data-[on=true]:border-green-600/40",
  fail: "data-[on=true]:bg-red-500/15 data-[on=true]:text-red-700 data-[on=true]:border-red-600/40",
  na:   "data-[on=true]:bg-[#2A1F0E]/10 data-[on=true]:text-[#2A1F0E]/70 data-[on=true]:border-[#2A1F0E]/30",
};

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
 * Renders one scalar schema field wired to react-hook-form. Grid fields are
 * handled by GridFieldInput; heading/info by FormRenderer directly. Unknown
 * types render a placeholder box (forward-compat: never crash, never drop data).
 */
export function FormFieldInput({ field, control, disabled, isAdmin, signer }: FormFieldInputProps) {
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
              <Textarea
                value={rhf.value ?? ""}
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
                {error && <p className="text-xs text-red-600">{error}</p>}
              </div>
            );
          case "select": {
            const f = field as SelectField;
            if (f.multiple) {
              const values: string[] = Array.isArray(rhf.value) ? rhf.value : [];
              input = (
                <div className="flex flex-wrap gap-x-4 gap-y-1.5 pt-1">
                  {f.options.map(opt => (
                    <div key={opt} className="flex items-center gap-1.5">
                      <Checkbox
                        id={`fld-${field.id}-${opt}`}
                        checked={values.includes(opt)}
                        disabled={disabled}
                        onCheckedChange={c => rhf.onChange(c ? [...values, opt] : values.filter(v => v !== opt))}
                      />
                      <Label htmlFor={`fld-${field.id}-${opt}`} className={cn("font-normal text-sm", !disabled && "cursor-pointer")}>
                        {opt}
                      </Label>
                    </div>
                  ))}
                </div>
              );
            } else {
              input = (
                <Select value={rhf.value || undefined} onValueChange={rhf.onChange} disabled={disabled}>
                  <SelectTrigger><SelectValue placeholder="Select…" /></SelectTrigger>
                  <SelectContent>
                    {f.options.map(opt => <SelectItem key={opt} value={opt}>{opt}</SelectItem>)}
                  </SelectContent>
                </Select>
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
