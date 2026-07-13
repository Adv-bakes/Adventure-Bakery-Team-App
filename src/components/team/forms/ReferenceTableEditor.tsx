import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Plus, Trash2 } from "lucide-react";
import type { ReferenceTableField } from "@/lib/formSchema";

interface ReferenceTableEditorProps {
  field: ReferenceTableField;
  onChange: (patch: Partial<ReferenceTableField>) => void;
}

/**
 * Authoring UI for a static legend/key table (e.g. a paper form's "Risk
 * Rating Key") — every cell is fixed content printed on the form, so unlike
 * GridColumnsEditor there's no column type/options, just plain header +
 * cell strings.
 */
export function ReferenceTableEditor({ field, onChange }: ReferenceTableEditorProps) {
  const columns = field.columns ?? [];
  const rows = field.rows ?? [];

  const setColumn = (idx: number, value: string) => {
    const next = [...columns];
    next[idx] = value;
    onChange({ columns: next });
  };
  const addColumn = () => onChange({ columns: [...columns, ""], rows: rows.map(r => [...r, ""]) });
  const removeColumn = (idx: number) =>
    onChange({ columns: columns.filter((_, i) => i !== idx), rows: rows.map(r => r.filter((_, i) => i !== idx)) });

  const setCell = (rIdx: number, cIdx: number, value: string) => {
    const next = rows.map(r => [...r]);
    next[rIdx][cIdx] = value;
    onChange({ rows: next });
  };
  const addRow = () => onChange({ rows: [...rows, columns.map(() => "")] });
  const removeRow = (rIdx: number) => onChange({ rows: rows.filter((_, i) => i !== rIdx) });

  return (
    <div className="space-y-2">
      <div>
        <Label className="text-[10px] text-muted-foreground">Columns</Label>
        <div className="flex flex-wrap gap-1.5 mt-1">
          {columns.map((c, i) => (
            <div key={i} className="flex items-center gap-1">
              <Input className="h-8 text-xs w-32" value={c} onChange={e => setColumn(i, e.target.value)} placeholder={`Column ${i + 1}`} />
              <Button type="button" variant="ghost" size="icon" className="h-7 w-7" onClick={() => removeColumn(i)}>
                <Trash2 className="w-3.5 h-3.5 text-red-500" />
              </Button>
            </div>
          ))}
          <Button type="button" variant="outline" size="sm" onClick={addColumn}>
            <Plus className="w-3.5 h-3.5 mr-1" />Column
          </Button>
        </div>
      </div>

      <div>
        <Label className="text-[10px] text-muted-foreground">Rows</Label>
        <div className="space-y-1.5 mt-1">
          {rows.map((row, rIdx) => (
            <div key={rIdx} className="flex items-center gap-1.5">
              {columns.map((_, cIdx) => (
                <Input
                  key={cIdx}
                  className="h-8 text-xs flex-1"
                  value={row[cIdx] ?? ""}
                  onChange={e => setCell(rIdx, cIdx, e.target.value)}
                  placeholder={columns[cIdx] || `Col ${cIdx + 1}`}
                />
              ))}
              <Button type="button" variant="ghost" size="icon" className="h-7 w-7 shrink-0" onClick={() => removeRow(rIdx)}>
                <Trash2 className="w-3.5 h-3.5 text-red-500" />
              </Button>
            </div>
          ))}
          <Button type="button" variant="outline" size="sm" onClick={addRow} disabled={columns.length === 0}>
            <Plus className="w-3.5 h-3.5 mr-1" />Row
          </Button>
        </div>
      </div>
    </div>
  );
}
