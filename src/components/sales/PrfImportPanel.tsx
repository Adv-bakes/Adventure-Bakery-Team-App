import { AlertTriangle, FileSearch, Loader2 } from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";
import { cn } from "@/lib/utils";
import type { PrfImportResult, PrfImportValue } from "@/lib/prfPdfImport";

interface PrfImportPanelProps {
  busy: boolean;
  result: PrfImportResult | null;
  /** columns the user has accepted; everything read starts accepted */
  accepted: Set<string>;
  onToggle: (column: string) => void;
  onToggleAll: (on: boolean) => void;
}

const renderValue = (v: PrfImportValue) => {
  if (typeof v === "boolean") return v ? "Yes" : "No";
  if (Array.isArray(v)) return v.join(", ");
  return v ?? "";
};

/**
 * Shows what was read out of an attached PRF as a proposal. Nothing here writes — the parent only
 * saves the fields still ticked when the deal is created, so a misread is one click from being
 * dropped rather than something to correct after the fact.
 */
export const PrfImportPanel = ({ busy, result, accepted, onToggle, onToggleAll }: PrfImportPanelProps) => {
  if (busy) {
    return (
      <div className="rounded-md border bg-muted/30 px-3 py-2 text-xs flex items-center gap-2">
        <Loader2 className="w-3.5 h-3.5 animate-spin" />
        Reading the PRF…
      </div>
    );
  }

  if (!result) return null;

  if (!result.ok) {
    // Not an error worth blocking on — the file still attaches, it just cannot be read.
    return (
      <div className="rounded-md border px-3 py-2 text-xs text-muted-foreground">
        {result.reason}
      </div>
    );
  }

  const allOn = result.fields.every((f) => accepted.has(f.column));

  return (
    <div className="rounded-md border border-primary/30 bg-primary/5">
      <div className="flex items-center justify-between gap-2 px-3 py-2 border-b border-primary/20">
        <div className="flex items-center gap-2 text-xs font-medium">
          <FileSearch className="w-3.5 h-3.5 text-primary" />
          Read {result.fields.length} field{result.fields.length === 1 ? "" : "s"} from this PRF
        </div>
        <button
          type="button"
          onClick={() => onToggleAll(!allOn)}
          className="text-xs text-primary underline underline-offset-2"
        >
          {allOn ? "Clear all" : "Select all"}
        </button>
      </div>

      {result.warnings.length > 0 && (
        <div className="px-3 py-2 border-b border-primary/20 flex flex-col gap-1">
          {result.warnings.map((w) => (
            <p key={w} className="text-[11px] text-muted-foreground flex items-start gap-1.5">
              <AlertTriangle className="w-3 h-3 mt-0.5 shrink-0" />
              {w}
            </p>
          ))}
        </div>
      )}

      <ul className="max-h-64 overflow-auto divide-y divide-primary/10">
        {result.fields.map((f) => {
          const on = accepted.has(f.column);
          return (
            <li key={f.column} className="px-3 py-2">
              <label className="flex items-start gap-2.5 cursor-pointer">
                <Checkbox
                  checked={on}
                  onCheckedChange={() => onToggle(f.column)}
                  className="mt-0.5"
                  aria-label={`Import ${f.label}`}
                />
                <span className="min-w-0 flex-1">
                  <span className="flex flex-wrap items-baseline gap-x-2">
                    <span className="text-xs text-muted-foreground">{f.label}</span>
                    <span className={cn("text-sm break-words", !on && "line-through opacity-50")}>
                      {renderValue(f.value)}
                    </span>
                  </span>
                  {f.review && (
                    <span className="mt-0.5 flex items-start gap-1.5 text-[11px] text-amber-700 dark:text-amber-500">
                      <AlertTriangle className="w-3 h-3 mt-0.5 shrink-0" />
                      {f.review}
                    </span>
                  )}
                </span>
              </label>
            </li>
          );
        })}
      </ul>
    </div>
  );
};

export default PrfImportPanel;
