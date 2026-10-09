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
import { useController, useWatch, type Control } from "react-hook-form";
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

/**
 * "Fill from FRM-207" under a cell whose value is already one of the listed choices while a cell it
 * could fill is still empty - a row typed before the list existed, or opened again after a reload.
 * Picking from the list fills by itself; this is the same fill for a value that is already there,
 * and it runs only when tapped.
 */
function FillOffer({ control, rowPath, targets, picked, last, form, onFill }: {
  control: Control<Record<string, any>>; rowPath: string; targets: string[];
  picked: PickOption; last: PickOption | null; form: string;
  onFill: (writes: Record<string, string>) => void;
}) {
  const values = useWatch({ control, name: targets.map(column => `${rowPath}.${column}`) }) as unknown[];
  const current: Record<string, unknown> = {};
  targets.forEach((column, i) => { current[column] = values?.[i]; });
  const writes = pickFills(picked, last, current);
  if (!Object.keys(writes).length) return null;
  return (
    <button
      type="button"
      className="block text-[11px] text-[#9A6F1E] underline underline-offset-2 hover:text-[#2A1F0E]"
      onClick={() => onFill(writes)}
    >
      Fill from {form}
    </button>
  );
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
  const matched = targets.length ? matchPick(options, value) : null;
  const apply = (picked: PickOption, writes: Record<string, string>) => {
    for (const [column, text] of Object.entries(writes)) handles.current[column]?.onChange(text);
    last.current = picked;
  };

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
        // The cell is one line, so a long name is cut off: hovering shows it whole.
        title={value || undefined}
        placeholder={options.length ? `Type, or pick from ${spec.form}` : undefined}
        onChange={(e) => {
          const v = e.target.value;
          onChange(v);
          const picked = matchPick(options, v);
          if (!picked) return;
          const current: Record<string, unknown> = {};
          for (const column of targets) current[column] = handles.current[column]?.value;
          apply(picked, pickFills(picked, last.current, current));
        }}
      />
      {matched && (
        <FillOffer
          control={control!} rowPath={rowPath!} targets={targets}
          picked={matched} last={last.current} form={spec.form}
          onFill={writes => apply(matched, writes)}
        />
      )}
      <datalist id={listId}>
        {options.map(o => <option key={o.value} value={o.value}>{o.hint}</option>)}
      </datalist>
    </>
  );
}
