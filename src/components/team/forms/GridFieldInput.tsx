import { Controller, useFieldArray, type Control } from "react-hook-form";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Plus, Trash2 } from "lucide-react";
import type { GridColumn, GridField } from "@/lib/formSchema";
import { PassFailInput } from "./FormFieldInput";

function GridCell({ column, value, onChange, disabled }: {
  column: GridColumn;
  value: any;
  onChange: (v: any) => void;
  disabled?: boolean;
}) {
  switch (column.type) {
    case "checkbox":
      return (
        <div className="flex justify-center">
          <Checkbox checked={value === true} disabled={disabled} onCheckedChange={c => onChange(!!c)} />
        </div>
      );
    case "select":
      return (
        <Select value={value || undefined} onValueChange={onChange} disabled={disabled}>
          <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="—" /></SelectTrigger>
          <SelectContent>
            {(column.options ?? []).map(opt => <SelectItem key={opt} value={opt}>{opt}</SelectItem>)}
          </SelectContent>
        </Select>
      );
    case "pass_fail":
      return <PassFailInput field={{}} value={value} onChange={onChange} disabled={disabled} compact />;
    case "number":
      return (
        <Input
          type="number"
          className="h-8 text-xs"
          value={value ?? ""}
          disabled={disabled}
          step="any"
          onChange={e => onChange(e.target.value)}
        />
      );
    case "date":
    case "time":
      return (
        <Input
          type={column.type}
          className="h-8 text-xs"
          value={value ?? ""}
          disabled={disabled}
          onChange={e => onChange(e.target.value)}
        />
      );
    default:
      return (
        <Textarea
          className="min-h-[32px] text-xs py-1.5 px-2 leading-snug resize-y break-words"
          rows={1}
          value={value ?? ""}
          disabled={disabled}
          onChange={e => onChange(e.target.value)}
        />
      );
  }
}

/**
 * Fixed row labels can carry a title + description + target line joined by
 * "\n" (the AI extractor's convention for a paper form's review-item cell —
 * see generate-form-schema). Split them back out so the hierarchy the PDF
 * export shows (bold title / italic description / gold target) survives here
 * too, instead of one flat run-on line.
 */
function FixedRowLabel({ label }: { label: string }) {
  const lines = label.split("\n").map(l => l.trim()).filter(Boolean);
  if (lines.length === 0) return null;
  const [title, ...rest] = lines;
  return (
    <div className="space-y-0.5 py-0.5">
      <p className="text-xs font-semibold text-[#2A1F0E]">{title}</p>
      {rest.map((line, i) => {
        const isTarget = /^target:/i.test(line);
        return (
          <p
            key={i}
            className={isTarget ? "text-[11px] font-medium text-[#9A6F1E]" : "text-[11px] italic text-[#2A1F0E]/70"}
          >
            {line}
          </p>
        );
      })}
    </div>
  );
}

interface GridFieldInputProps {
  field: GridField;
  control: Control<Record<string, any>>;
  disabled?: boolean;
}

/**
 * The table field — structural fidelity for paper log grids. Dynamic mode adds/
 * removes rows (respecting min/max); fixed mode renders one row per configured
 * label with a read-only leading label column.
 */
export function GridFieldInput({ field, control, disabled }: GridFieldInputProps) {
  const { fields: rows, append, remove } = useFieldArray({ control, name: field.id });
  const fixed = field.rows.mode === "fixed";
  const fixedLabels = fixed ? (field.rows as { labels: string[] }).labels : [];
  const maxRows = !fixed ? (field.rows as { max?: number }).max : undefined;
  const minRows = !fixed ? (field.rows as { min?: number }).min ?? 1 : fixedLabels.length;
  const addLabel = !fixed ? (field.rows as { addLabel?: string }).addLabel : undefined;
  const columnWeight = field.columns.reduce((sum, c) => sum + (c.width ?? 1), 0);
  // The read-only label column has no configurable width — give it a share
  // proportional to the average data column so it doesn't collapse under
  // table-fixed layout (labels can be full sentences, e.g. review-item text).
  const labelWeight = fixed ? (columnWeight / field.columns.length) * 1.4 : 0;
  const totalWeight = columnWeight + labelWeight;

  return (
    <Controller
      control={control}
      name={field.id}
      render={({ fieldState }) => (
        <div className="space-y-1.5">
          <Label className="text-xs text-[#2A1F0E]/90">
            {field.label}
            {field.required && <span className="text-red-600 ml-0.5">*</span>}
          </Label>
          <div className="rounded-md border overflow-x-auto" style={{ borderColor: "rgba(200,155,60,0.35)" }}>
            <Table className="[&_td]:py-1.5 [&_td]:px-2 [&_th]:h-8 [&_th]:px-2 table-fixed w-full">
              <TableHeader>
                <TableRow className="bg-[#C89B3C]/8">
                  {fixed && (
                    <TableHead
                      className="text-[#2A1F0E]/80 text-xs font-semibold"
                      style={{ width: `${(labelWeight / totalWeight) * 100}%`, minWidth: 140 }}
                    />
                  )}
                  {field.columns.map(col => (
                    <TableHead
                      key={col.id}
                      className="text-[#2A1F0E]/80 text-xs font-semibold whitespace-nowrap"
                      style={{ width: `${((col.width ?? 1) / totalWeight) * 100}%`, minWidth: col.type === "pass_fail" ? 130 : 90 }}
                    >
                      {col.label}
                      {col.required && <span className="text-red-600 ml-0.5">*</span>}
                      {col.unit && <span className="font-normal text-[#2A1F0E]/55 ml-1">({col.unit})</span>}
                    </TableHead>
                  ))}
                  {!fixed && !disabled && <TableHead className="w-8" />}
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((row, rowIdx) => (
                  <TableRow key={row.id}>
                    {fixed && (
                      <TableCell className="align-top whitespace-normal bg-[#C89B3C]/8">
                        <FixedRowLabel label={fixedLabels[rowIdx] ?? ""} />
                      </TableCell>
                    )}
                    {field.columns.map(col => (
                      <TableCell key={col.id}>
                        <Controller
                          control={control}
                          name={`${field.id}.${rowIdx}.${col.id}`}
                          render={({ field: cell, fieldState: cellState }) => (
                            <div>
                              <GridCell column={col} value={cell.value} onChange={cell.onChange} disabled={disabled} />
                              {cellState.error?.message && (
                                <p className="text-[10px] text-red-600 mt-0.5">{cellState.error.message}</p>
                              )}
                            </div>
                          )}
                        />
                      </TableCell>
                    ))}
                    {!fixed && !disabled && (
                      <TableCell className="w-8">
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7"
                          disabled={rows.length <= Math.max(minRows, 1)}
                          onClick={() => remove(rowIdx)}
                          title="Remove row"
                        >
                          <Trash2 className="w-3.5 h-3.5 text-[#2A1F0E]/40" />
                        </Button>
                      </TableCell>
                    )}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
          {!fixed && !disabled && (
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={maxRows != null && rows.length >= maxRows}
              onClick={() => append({})}
            >
              <Plus className="w-3.5 h-3.5 mr-1" />{addLabel ?? "Add Row"}
            </Button>
          )}
          {field.help && <p className="text-xs text-muted-foreground">{field.help}</p>}
          {fieldState.error?.message && <p className="text-xs text-red-600">{fieldState.error.message}</p>}
        </div>
      )}
    />
  );
}
