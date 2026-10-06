// A text input with a pick-list: focusing it shows every suggestion, typing narrows the list, and
// anything can still be typed that is not on it. Used where a form's caller supplies suggestions
// for a text field (FormRenderer `suggest`) - first for Product and Lot on the release record.
//
// It reports a choice through `onPick`, both when a line is clicked and when the field is left with
// a value in it, so a code typed by hand is looked up exactly as a picked one is.

import { useMemo, useRef, useState } from "react";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

export interface SuggestOption {
  value: string;
  hint?: string;
  /** Other answers this line settles, by field id - a lot's line also names its product. */
  set?: Record<string, string>;
}

interface SuggestInputProps {
  value: string;
  onChange: (value: string) => void;
  onBlur?: () => void;
  /** A line was chosen from the list (with what else it settles), or the field was left holding a value. */
  onPick?: (value: string, set?: Record<string, string>) => void;
  options: SuggestOption[];
  /** Shown in the list when there is nothing to suggest ("Choose the product first"). */
  emptyText?: string;
  disabled?: boolean;
  maxLength?: number;
  placeholder?: string;
}

const fold = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();

export function SuggestInput({ value, onChange, onBlur, onPick, options, emptyText, disabled, maxLength, placeholder }: SuggestInputProps) {
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(-1);
  // What onPick was last told, so leaving the field without changing it does not look it up again.
  const told = useRef<string | null>(null);

  const shown = useMemo(() => {
    const q = fold(value ?? "");
    // An exact match means the person is looking at their choice: show the whole list to switch.
    if (!q || options.some(o => fold(o.value) === q)) return options;
    return options.filter(o => fold(o.value).includes(q) || fold(o.hint ?? "").includes(q));
  }, [options, value]);

  const tell = (v: string, set?: Record<string, string>) => {
    // A chosen line is always reported: two lines can share a value and differ in what they set.
    if (!onPick || (!set && told.current === v)) return;
    told.current = v;
    onPick(v, set);
  };

  const choose = (o: SuggestOption) => {
    onChange(o.value);
    setOpen(false);
    setActive(-1);
    tell(o.value, o.set ?? {});
  };

  return (
    <div className="relative">
      <Input
        value={value ?? ""}
        disabled={disabled}
        maxLength={maxLength}
        placeholder={placeholder}
        autoComplete="off"
        role="combobox"
        aria-expanded={open}
        aria-autocomplete="list"
        onFocus={() => { setOpen(true); if (told.current === null) told.current = value ?? ""; }}
        onChange={(e) => { onChange(e.target.value); setOpen(true); setActive(-1); }}
        onBlur={() => {
          setOpen(false);
          setActive(-1);
          onBlur?.();
          if ((value ?? "").trim()) tell(value);
        }}
        onKeyDown={(e) => {
          if (e.key === "ArrowDown") { e.preventDefault(); setOpen(true); setActive(i => Math.min(i + 1, shown.length - 1)); }
          else if (e.key === "ArrowUp") { e.preventDefault(); setActive(i => Math.max(i - 1, 0)); }
          else if (e.key === "Enter" && open && active >= 0 && shown[active]) { e.preventDefault(); choose(shown[active]); }
          else if (e.key === "Escape") { setOpen(false); setActive(-1); }
        }}
      />
      {open && !disabled && (shown.length > 0 || emptyText) && (
        <ul
          role="listbox"
          className="absolute z-50 left-0 right-0 mt-1 max-h-64 overflow-auto rounded-md border bg-white shadow-md py-1"
        >
          {shown.length === 0 && (
            <li className="px-3 py-2 text-xs text-muted-foreground">{emptyText}</li>
          )}
          {shown.map((o, i) => (
            <li
              key={`${o.value}|${o.hint ?? ""}`}
              role="option"
              aria-selected={i === active}
              // mousedown, not click: the input's blur would close the list before a click lands.
              onMouseDown={(e) => { e.preventDefault(); choose(o); }}
              onMouseEnter={() => setActive(i)}
              className={cn("px-3 py-2 cursor-pointer text-sm text-[#2A1F0E]", i === active && "bg-[#C89B3C]/15")}
            >
              <span className="font-medium">{o.value}</span>
              {o.hint && <span className="block text-xs text-muted-foreground">{o.hint}</span>}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

/** Suggestions a form's caller supplies for some of its text fields, keyed by field id. */
export interface FieldSuggest {
  options: Record<string, SuggestOption[]>;
  emptyText?: Record<string, string>;
  onPick: (fieldId: string, value: string, set?: Record<string, string>) => void;
}
