// A grid cell that offers another form's register as a pick-list and fills the cells beside it
// (GridColumn.pickFrom - FRM-501's Ingredient, from the Material Specification Register FRM-207).
//
// Like TeamNameInput it is the browser's own list (<datalist>): the grid scrolls sideways and would
// clip a drawn one. The list is an offer - an ingredient with no specification entry yet is typed
// in as before, and then nothing beside it is filled.
//
// The options load once per page load and are shared by every cell of the column. If they cannot be
// read the cell is simply a text box.

import { useEffect, useId, useRef, useState } from "react";
import { useController, type Control } from "react-hook-form";
import { Input } from "@/components/ui/input";
import type { GridPickFrom } from "@/lib/formSchema";
import { loadPickOptions } from "@/lib/formReport";
import { matchPick, pickFills, type PickOption } from "@/lib/pickFrom";

const cache = new Map<string, Promise<PickOption[]>>();
function optionsFor(spec: GridPickFrom): Promise<PickOption[]> {
  const key = JSON.stringify(spec);
  let p = cache.get(key);
  if (!p) {
    p = loadPickOptions(spec).catch(() => { cache.delete(key); return []; });
    cache.set(key, p);
  }
  return p;
}

type CellHandle = { value: unknown; onChange: (v: string) => void };

/** Holds one neighbouring cell of the row, so a pick can read and write it without remounting the row. */
function FillTarget({ control, name, column, handles }: {
  control: Control<Record<string, any>>; name: string; column: string;
  handles: React.MutableRefObject<Record<string, CellHandle>>;
}) {
  const { field } = useController({ control, name });
  handles.current[column] = { value: field.value, onChange: field.onChange };
  return null;
}

export function LinkedPickInput({ spec, value, onChange, className, control, rowPath }: {
  spec: GridPickFrom;
  value: string;
  onChange: (value: string) => void;
  className?: string;
  /** With these, a pick fills the row's other cells; without them the cell only offers the list. */
  control?: Control<Record<string, any>>;
  rowPath?: string;
}) {
  const listId = useId();
  const [options, setOptions] = useState<PickOption[]>([]);
  useEffect(() => {
    let live = true;
    optionsFor(spec).then(o => { if (live) setOptions(o); });
    return () => { live = false; };
    // The spec comes from the form's schema and does not change while the entry is open.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [JSON.stringify(spec)]);

  const handles = useRef<Record<string, CellHandle>>({});
  // What this cell last picked, for this visit to the page: lets a changed pick carry its fills
  // along. After a reload every answer in the row counts as the person's and is kept.
  const last = useRef<PickOption | null>(null);
  const targets = control && rowPath ? Object.keys(spec.fill ?? {}) : [];

  return (
    <>
      {targets.map(column => (
        <FillTarget key={column} control={control!} name={`${rowPath}.${column}`} column={column} handles={handles} />
      ))}
      <Input
        className={className}
        value={value ?? ""}
        list={listId}
        autoComplete="off"
        onChange={(e) => {
          const v = e.target.value;
          onChange(v);
          const picked = matchPick(options, v);
          if (!picked) return;
          const current: Record<string, unknown> = {};
          for (const column of targets) current[column] = handles.current[column]?.value;
          const writes = pickFills(picked, last.current, current);
          for (const [column, text] of Object.entries(writes)) handles.current[column]?.onChange(text);
          last.current = picked;
        }}
      />
      <datalist id={listId}>
        {options.map(o => <option key={o.value} value={o.value}>{o.hint}</option>)}
      </datalist>
    </>
  );
}
