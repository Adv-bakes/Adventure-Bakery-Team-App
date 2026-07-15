import type { UseFormReturn } from "react-hook-form";
import { cn } from "@/lib/utils";
import type { FormSchema, FormField as SchemaField, InfoField, ReferenceTableField } from "@/lib/formSchema";
import { FormFieldInput } from "./FormFieldInput";
import { GridFieldInput } from "./GridFieldInput";
import type { Signer } from "./SignatureFieldInput";

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
}

/**
 * Schema → interactive form. Pure rendering over an externally-owned RHF
 * instance (the caller decides defaultValues, resolver, and what save/submit
 * mean — the entry editor and the builder Preview both reuse this).
 */
export function FormRenderer({ schema, form, readOnly, isAdmin, signer }: FormRendererProps) {
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
        el = <GridFieldInput field={field} control={form.control} disabled={readOnly} />;
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
          {(section.title || section.description) && (
            <div>
              {section.title && <h2 className="font-semibold text-[#2A1F0E]">{section.title}</h2>}
              {section.description && <p className="text-xs text-[#2A1F0E]/80 mt-0.5">{section.description}</p>}
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
