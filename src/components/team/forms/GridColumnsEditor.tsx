import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ChevronLeft, ChevronRight, Plus, Trash2 } from "lucide-react";
import {
  GRID_COLUMN_TYPE_LABELS, slugifyFieldId,
  type GridColumn, type GridColumnType, type GridField,
} from "@/lib/formSchema";

interface GridColumnsEditorProps {
  field: GridField;
  onChange: (field: GridField) => void;
  /** Column ids that already carry saved answers — id stays locked. */
  savedIds: Set<string>;
}

/** Builder sub-editor for a grid field's columns and row mode. */
export function GridColumnsEditor({ field, onChange, savedIds }: GridColumnsEditorProps) {
  const takenIds = () => new Set(field.columns.map(c => c.id));

  const updateColumn = (idx: number, patch: Partial<GridColumn>) => {
    onChange({ ...field, columns: field.columns.map((c, i) => (i === idx ? { ...c, ...patch } : c)) });
  };

  const updateColumnLabel = (idx: number, label: string) => {
    const col = field.columns[idx];
    const patch: Partial<GridColumn> = { label };
    // Auto-derive the id from the label until the column has saved answers
    if (!savedIds.has(`${field.id}.${col.id}`)) {
      const taken = takenIds();
      taken.delete(col.id);
      patch.id = slugifyFieldId(label || "column", taken);
    }
    updateColumn(idx, patch);
  };

  const addColumn = () => {
    const id = slugifyFieldId("column", takenIds());
    onChange({ ...field, columns: [...field.columns, { id, label: "", type: "text" }] });
  };

  const removeColumn = (idx: number) => {
    onChange({ ...field, columns: field.columns.filter((_, i) => i !== idx) });
  };

  const moveColumn = (idx: number, dir: -1 | 1) => {
    const target = idx + dir;
    if (target < 0 || target >= field.columns.length) return;
    const next = [...field.columns];
    [next[idx], next[target]] = [next[target], next[idx]];
    onChange({ ...field, columns: next });
  };

  const setRowMode = (mode: "dynamic" | "fixed") => {
    if (mode === (field.rows.mode as string)) return;
    onChange({
      ...field,
      rows: mode === "fixed" ? { mode: "fixed", labels: [""] } : { mode: "dynamic", min: 1 },
    });
  };

  return (
    <div className="space-y-3 rounded-md border p-3" style={{ borderColor: "rgba(200,155,60,0.2)", background: "rgba(200,155,60,0.03)" }}>
      <Label className="text-xs font-medium">Columns</Label>
      {field.columns.length === 0 && (
        <p className="text-xs text-muted-foreground">No columns yet — a grid needs at least one.</p>
      )}
      <div className="space-y-2">
        {field.columns.map((col, idx) => (
          <div key={idx} className="flex flex-wrap items-end gap-2 rounded border bg-white p-2" style={{ borderColor: "rgba(200,155,60,0.2)" }}>
            <div className="flex-1 min-w-32">
              <Label className="text-[10px] text-muted-foreground">Column label</Label>
              <Input className="h-8 text-xs" value={col.label} onChange={e => updateColumnLabel(idx, e.target.value)} />
            </div>
            <div className="w-28">
              <Label className="text-[10px] text-muted-foreground">Type</Label>
              <Select value={col.type} onValueChange={v => updateColumn(idx, { type: v as GridColumnType })}>
                <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {(Object.keys(GRID_COLUMN_TYPE_LABELS) as GridColumnType[]).map(t => (
                    <SelectItem key={t} value={t}>{GRID_COLUMN_TYPE_LABELS[t]}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="w-16">
              <Label className="text-[10px] text-muted-foreground">Width</Label>
              <Input
                type="number" min={1} step={1} className="h-8 text-xs"
                value={col.width ?? 1}
                onChange={e => updateColumn(idx, { width: e.target.value === "" ? undefined : Number(e.target.value) })}
                title="Relative width weight — a column with 2 gets twice the width of one with 1"
              />
            </div>
            {col.type === "number" && (
              <div className="w-20">
                <Label className="text-[10px] text-muted-foreground">Unit</Label>
                <Input className="h-8 text-xs" value={col.unit ?? ""} onChange={e => updateColumn(idx, { unit: e.target.value || undefined })} />
              </div>
            )}
            {col.type === "select" && (
              <div className="w-full">
                <Label className="text-[10px] text-muted-foreground">Options (one per line)</Label>
                <Textarea
                  className="text-xs h-16"
                  value={(col.options ?? []).join("\n")}
                  onChange={e => updateColumn(idx, { options: e.target.value.split("\n").map(s => s.trim()).filter(Boolean) })}
                />
              </div>
            )}
            <div className="flex items-center gap-1.5 pb-1.5">
              <Checkbox
                id={`col-req-${field.id}-${idx}`}
                checked={col.required ?? false}
                onCheckedChange={c => updateColumn(idx, { required: !!c || undefined })}
              />
              <Label htmlFor={`col-req-${field.id}-${idx}`} className="text-[10px] font-normal cursor-pointer">Required</Label>
            </div>
            <div className="flex items-center ml-auto">
              <Button type="button" variant="ghost" size="icon" className="h-7 w-7" disabled={idx === 0} onClick={() => moveColumn(idx, -1)} title="Move left">
                <ChevronLeft className="w-3.5 h-3.5 text-[#9A6F1E]" />
              </Button>
              <Button type="button" variant="ghost" size="icon" className="h-7 w-7" disabled={idx === field.columns.length - 1} onClick={() => moveColumn(idx, 1)} title="Move right">
                <ChevronRight className="w-3.5 h-3.5 text-[#9A6F1E]" />
              </Button>
              <Button type="button" variant="ghost" size="icon" className="h-7 w-7" onClick={() => removeColumn(idx)} title="Remove column">
                <Trash2 className="w-3.5 h-3.5 text-red-500" />
              </Button>
            </div>
          </div>
        ))}
      </div>
      <Button type="button" variant="outline" size="sm" onClick={addColumn}>
        <Plus className="w-3.5 h-3.5 mr-1" />Add Column
      </Button>

      <div className="space-y-2 border-t pt-2" style={{ borderColor: "rgba(200,155,60,0.2)" }}>
        <Label className="text-xs font-medium">Rows</Label>
        <Select value={field.rows.mode} onValueChange={v => setRowMode(v as "dynamic" | "fixed")}>
          <SelectTrigger className="h-8 text-xs w-56"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="dynamic">Dynamic — filler adds rows</SelectItem>
            <SelectItem value="fixed">Fixed — one row per label</SelectItem>
          </SelectContent>
        </Select>
        {field.rows.mode === "dynamic" ? (
          <div className="flex gap-3">
            <div>
              <Label className="text-[10px] text-muted-foreground">Min rows</Label>
              <Input
                type="number" min={0} className="h-8 w-20 text-xs"
                value={field.rows.min ?? ""}
                onChange={e => onChange({ ...field, rows: { ...field.rows, mode: "dynamic", min: e.target.value === "" ? undefined : Number(e.target.value) } })}
              />
            </div>
            <div>
              <Label className="text-[10px] text-muted-foreground">Max rows</Label>
              <Input
                type="number" min={1} className="h-8 w-20 text-xs"
                value={(field.rows as { max?: number }).max ?? ""}
                onChange={e => onChange({ ...field, rows: { ...field.rows, mode: "dynamic", max: e.target.value === "" ? undefined : Number(e.target.value) } })}
              />
            </div>
          </div>
        ) : (
          <div>
            <Label className="text-[10px] text-muted-foreground">Row labels (one per line, e.g. equipment names)</Label>
            <Textarea
              className="text-xs h-20"
              value={field.rows.labels.join("\n")}
              onChange={e => onChange({ ...field, rows: { mode: "fixed", labels: e.target.value.split("\n") } })}
              onBlur={e => onChange({ ...field, rows: { mode: "fixed", labels: e.target.value.split("\n").map(s => s.trim()).filter(Boolean) } })}
            />
          </div>
        )}
      </div>
    </div>
  );
}
