import { useState } from "react";
import { Controller, useFieldArray, useWatch, type Control } from "react-hook-form";
import { format } from "date-fns";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ArrowDown, ArrowUp, ArrowUpDown, Plus, Trash2 } from "lucide-react";
import type { GridColumn, GridField, GridRowValue } from "@/lib/formSchema";
import { PassFailInput } from "./FormFieldInput";
import { DictationTextarea } from "./DictationTextarea";

/** Numeric-aware compare with blanks sorted last, for click-to-sort grid columns. */
function compareCellValues(a: any, b: any): number {
  const aBlank = a == null || a === "";
  const bBlank = b == null || b === "";
  if (aBlank && bBlank) return 0;
  if (aBlank) return 1;
  if (bBlank) return -1;
  const an = Number(a), bn = Number(b);
  if (a !== true && a !== false && b !== true && b !== false && !Number.isNaN(an) && !Number.isNaN(bn)) return an - bn;
  return String(a).localeCompare(String(b));
}

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
        <div className="flex items-center gap-1">
          <Input
            type={column.type}
            className="h-8 text-xs flex-1"
            value={value ?? ""}
            disabled={disabled}
            onChange={e => onChange(e.target.value)}
          />
          {column.type === "date" && !disabled && (
            <button
              type="button"
              onClick={() => onChange(format(new Date(), "yyyy-MM-dd"))}
              className="text-[10px] font-medium text-[#9A6F1E] hover:underline shrink-0 px-0.5"
            >
              Today
            </button>
          )}
        </div>
      );
    default:
      return (
        <DictationTextarea
          className="min-h-[32px] text-xs py-1.5 px-2 leading-snug break-words"
          rows={1}
          value={value}
          disabled={disabled}
          onChange={onChange}
          compact
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
  const { fields: rows, append, remove, replace } = useFieldArray({ control, name: field.id });
  const fixed = field.rows.mode === "fixed";
  const fixedLabels = fixed ? (field.rows as { labels: string[] }).labels : [];
  // Registers where known items can be renamed/removed over time (as opposed
  // to a fixed checklist that must always list every item) opt every row
  // into the same editable-label + delete-button treatment normally reserved
  // for filler-appended rows past the end of fixedLabels.
  const fixedDeletable = fixed && (field.rows as { deletable?: boolean }).deletable === true;
  const labelHeader = fixed ? (field.rows as { labelHeader?: string }).labelHeader : undefined;
  const maxRows = !fixed ? (field.rows as { max?: number }).max : undefined;
  const minRows = !fixed ? (field.rows as { min?: number }).min ?? 1 : fixedLabels.length;
  const addLabel = (field.rows as { addLabel?: string }).addLabel;
  const columnWeight = field.columns.reduce((sum, c) => sum + (c.width ?? 1), 0);
  // The read-only label column has no configurable width — give it a share
  // proportional to the average data column so it doesn't collapse under
  // table-fixed layout (labels can be full sentences, e.g. review-item text).
  const labelWeight = fixed ? (columnWeight / field.columns.length) * 1.4 : 0;
  const totalWeight = columnWeight + labelWeight;

  // Click-to-sort: safe whenever row order carries no positional meaning —
  // i.e. dynamic grids, or fixed grids whose label lives IN the row data
  // (_label, when deletable) rather than being derived from schema position.
  // A non-deletable fixed grid's label is `fixedLabels[rowIdx]` — reordering
  // rows there would scramble the label/data pairing, so sorting is hidden.
  const sortable = !fixed || fixedDeletable;
  const watchedRows = useWatch({ control, name: field.id }) as GridRowValue[] | undefined;
  const [sort, setSort] = useState<{ key: string; dir: "asc" | "desc" } | null>(null);
  const LABEL_SORT_KEY = "__label__";

  const handleSort = (key: string) => {
    const dir: "asc" | "desc" = sort?.key === key && sort.dir === "asc" ? "desc" : "asc";
    const current = Array.isArray(watchedRows) ? watchedRows : [];
    const withLabel = current.map((r, i) => ({ r, label: fixed ? (r?._label ?? fixedLabels[i] ?? "") : "" }));
    const getVal = (item: (typeof withLabel)[number]) => (key === LABEL_SORT_KEY ? item.label : item.r?.[key]);
    withLabel.sort((a, b) => {
      const cmp = compareCellValues(getVal(a), getVal(b));
      return dir === "asc" ? cmp : -cmp;
    });
    replace(withLabel.map(x => x.r));
    setSort({ key, dir });
  };

  const SortIcon = ({ sortKey }: { sortKey: string }) => {
    if (sort?.key !== sortKey) return <ArrowUpDown className="w-3 h-3 opacity-40" />;
    return sort.dir === "asc" ? <ArrowUp className="w-3 h-3" /> : <ArrowDown className="w-3 h-3" />;
  };

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
                    >
                      {sortable ? (
                        <button
                          type="button"
                          className="inline-flex items-center gap-1 hover:text-[#9A6F1E]"
                          onClick={() => handleSort(LABEL_SORT_KEY)}
                        >
                          {labelHeader}
                          <SortIcon sortKey={LABEL_SORT_KEY} />
                        </button>
                      ) : labelHeader}
                    </TableHead>
                  )}
                  {field.columns.map(col => (
                    <TableHead
                      key={col.id}
                      className="text-[#2A1F0E]/80 text-xs font-semibold whitespace-nowrap"
                      style={{ width: `${((col.width ?? 1) / totalWeight) * 100}%`, minWidth: col.type === "pass_fail" ? 130 : 90 }}
                    >
                      {sortable ? (
                        <button
                          type="button"
                          className="inline-flex items-center gap-1 hover:text-[#9A6F1E]"
                          onClick={() => handleSort(col.id)}
                        >
                          {col.label}
                          {col.unit && <span className="font-normal text-[#2A1F0E]/55">({col.unit})</span>}
                          <SortIcon sortKey={col.id} />
                        </button>
                      ) : (
                        <>
                          {col.label}
                          {col.unit && <span className="font-normal text-[#2A1F0E]/55 ml-1">({col.unit})</span>}
                        </>
                      )}
                      {col.required && <span className="text-red-600 ml-0.5">*</span>}
                    </TableHead>
                  ))}
                  {!disabled && <TableHead className="w-8" />}
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((row, rowIdx) => {
                  const rowEditable = fixed && (fixedDeletable || rowIdx >= fixedLabels.length);
                  return (
                  <TableRow key={row.id}>
                    {fixed && (
                      <TableCell className="align-top whitespace-normal bg-[#C89B3C]/8">
                        {rowEditable ? (
                          <Controller
                            control={control}
                            name={`${field.id}.${rowIdx}._label`}
                            render={({ field: cell }) => (
                              <Input
                                className="h-8 text-xs"
                                placeholder="New item"
                                value={cell.value ?? ""}
                                disabled={disabled}
                                onChange={cell.onChange}
                              />
                            )}
                          />
                        ) : (
                          <FixedRowLabel label={fixedLabels[rowIdx] ?? ""} />
                        )}
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
                    {!disabled && (
                      <TableCell className="w-8">
                        {(!fixed || rowEditable) && (
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7"
                            disabled={!fixed && rows.length <= Math.max(minRows, 1)}
                            onClick={() => remove(rowIdx)}
                            title="Remove row"
                          >
                            <Trash2 className="w-3.5 h-3.5 text-[#2A1F0E]/40" />
                          </Button>
                        )}
                      </TableCell>
                    )}
                  </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
          {!disabled && (
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={!fixed && maxRows != null && rows.length >= maxRows}
              onClick={() => append({})}
            >
              <Plus className="w-3.5 h-3.5 mr-1" />{addLabel ?? (fixed ? "Add Item" : "Add Row")}
            </Button>
          )}
          {field.help && <p className="text-xs text-muted-foreground">{field.help}</p>}
          {fieldState.error?.message && <p className="text-xs text-red-600">{fieldState.error.message}</p>}
        </div>
      )}
    />
  );
}
