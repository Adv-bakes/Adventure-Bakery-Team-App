import { Delete } from "lucide-react";

interface VirtualKeyboardProps {
  value: string;
  onChange: (v: string) => void;
  onDone: () => void;
  label?: string;
  unit?: string;
}

export function VirtualKeyboard({ value, onChange, onDone, label = "Enter weight", unit = "lbs" }: VirtualKeyboardProps) {
  const press = (key: string) => {
    if (key === "⌫") { onChange(value.slice(0, -1)); return; }
    if (key === "C")  { onChange(""); return; }
    if (key === ".") {
      if (!value.includes(".")) onChange(value + ".");
      return;
    }
    if (value.length < 8) onChange(value + key);
  };

  const keys = ["7","8","9","4","5","6","1","2","3","C","0","."] as const;

  return (
    <div className="fixed bottom-0 left-0 right-0 z-50 bg-background border-t border-[hsl(var(--tp-hairline))] shadow-2xl">
      {/* Display row */}
      <div className="flex items-center justify-between px-6 py-3 border-b border-[hsl(var(--tp-hairline))]">
        <span className="text-[11px] uppercase tracking-widest text-[hsl(var(--tp-text-dim))] max-w-[40%] truncate">
          {label}
        </span>
        <div className="flex items-baseline gap-2">
          <span className="text-3xl font-mono font-bold text-[hsl(var(--tp-text))] min-w-[6ch] text-right tabular-nums">
            {value || "0"}
          </span>
          <span className="text-sm text-[hsl(var(--tp-text-dim))]">{unit}</span>
        </div>
        <button
          onPointerDown={e => { e.preventDefault(); onDone(); }}
          className="px-5 py-2 rounded-lg bg-[hsl(var(--tp-gold))] text-black font-bold text-sm shrink-0"
        >
          Done
        </button>
      </div>

      {/* Keys */}
      <div className="grid grid-cols-3 gap-2 p-4 max-w-xs mx-auto">
        {keys.map(key => (
          <button
            key={key}
            onPointerDown={e => { e.preventDefault(); press(key); }}
            className={`h-14 rounded-xl text-xl font-semibold select-none transition-colors
              ${key === "C"
                ? "bg-red-500/20 text-red-400 active:bg-red-500/40"
                : "bg-[hsl(var(--tp-surface))] text-[hsl(var(--tp-text))] active:bg-[hsl(var(--tp-gold))]/30"
              }`}
          >
            {key}
          </button>
        ))}
        <button
          onPointerDown={e => { e.preventDefault(); press("⌫"); }}
          className="col-span-3 h-11 rounded-xl bg-[hsl(var(--tp-surface))] text-[hsl(var(--tp-text-dim))] flex items-center justify-center gap-2 active:bg-red-500/20"
        >
          <Delete className="w-4 h-4" />
          <span className="text-sm">Backspace</span>
        </button>
      </div>
    </div>
  );
}
