import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

// Dropdown of existing categories with an escape hatch to type a brand-new one.
// null means uncategorized.
export function CategorySelect({ value, categories, onChange }: {
  value: string | null | undefined;
  categories: string[];
  onChange: (v: string | null) => void;
}) {
  const [adding, setAdding] = useState(false);
  const options = useMemo(() => {
    const set = new Set(categories);
    if (value) set.add(value);
    return Array.from(set).sort((a, b) => a.localeCompare(b));
  }, [categories, value]);

  if (adding) {
    return (
      <div className="flex gap-2">
        <Input
          autoFocus
          placeholder="New category name"
          value={value ?? ""}
          onChange={e => onChange(e.target.value || null)}
        />
        <Button type="button" variant="outline" size="sm" className="shrink-0" onClick={() => setAdding(false)}>
          Pick existing
        </Button>
      </div>
    );
  }
  return (
    <Select
      value={value ?? "__none__"}
      onValueChange={v => {
        if (v === "__new__") { onChange(null); setAdding(true); }
        else if (v === "__none__") onChange(null);
        else onChange(v);
      }}
    >
      <SelectTrigger><SelectValue placeholder="Select category" /></SelectTrigger>
      <SelectContent>
        <SelectItem value="__none__">Uncategorized</SelectItem>
        {options.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
        <SelectItem value="__new__">Add New Category…</SelectItem>
      </SelectContent>
    </Select>
  );
}
