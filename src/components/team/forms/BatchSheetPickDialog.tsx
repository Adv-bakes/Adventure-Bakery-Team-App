import { useEffect, useMemo, useState } from "react";
import { AlertTriangle, Loader2, Search } from "lucide-react";
import { toast } from "sonner";
import {
  Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { batchSheetSource, formulaEntrySource, type FormulaSource } from "@/lib/batchSheetFill";
import { fetchCurrentBatchSheets, fetchFormulaEntries } from "@/lib/formResponses";

/**
 * Pick the product whose formula starts this entry (settings.batchSheet). `formNumber` set = the
 * entries of that form (FRM-501); absent = the current version of every batch sheet. Drafts are
 * listed and labelled - a product whose formula is not signed off yet is still baked. A formula
 * with no quantities is still offered, and says so, because its ingredient lines are worth having.
 */
export function BatchSheetPickDialog({
  open, onOpenChange, formNumber, onPick,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  formNumber?: string;
  onPick: (source: FormulaSource) => void;
}) {
  const [sources, setSources] = useState<FormulaSource[] | null>(null);
  const [problem, setProblem] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const what = formNumber ? `formula sheet (${formNumber})` : "batch sheet";

  useEffect(() => {
    if (!open) return;
    setQuery("");
    setSources(null);
    setProblem(null);
    const load = formNumber
      ? fetchFormulaEntries(formNumber).then(({ entries, missing }) => {
          if (missing.length) setProblem(`${formNumber} no longer has: ${missing.join(", ")}. The list below may be incomplete.`);
          // An entry with no product name is one somebody opened and left.
          return entries.map(formulaEntrySource).filter(s => s.product);
        })
      : fetchCurrentBatchSheets().then(rows => rows.map(batchSheetSource));
    load
      .then(setSources)
      .catch((e: any) => { toast.error(e.message ?? "Failed to load formulas"); setSources([]); });
  }, [open, formNumber]);

  const rows = useMemo(() => {
    const q = query.trim().toLowerCase();
    return (sources ?? []).filter(s => !q || `${s.product} ${s.client} ${s.label}`.toLowerCase().includes(q));
  }, [sources, query]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Start from the {what}</DialogTitle>
          <DialogDescription>
            Pick the product. Its ingredient lines and expected quantities replace the table below; the lots and the weights are left blank for today.
          </DialogDescription>
        </DialogHeader>
        {problem && (
          <p className="flex items-start gap-1.5 text-xs text-amber-800">
            <AlertTriangle className="w-3.5 h-3.5 mt-0.5 shrink-0" />{problem}
          </p>
        )}
        <div className="relative">
          <Search className="w-4 h-4 absolute left-2.5 top-1/2 -translate-y-1/2 text-[#2A1F0E]/40" />
          <Input value={query} onChange={e => setQuery(e.target.value)} placeholder="Search by product" className="pl-8" />
        </div>
        <div className="max-h-[50vh] overflow-y-auto -mx-1">
          {sources === null ? (
            <div className="flex items-center gap-2 p-4 text-sm text-[#2A1F0E]/60">
              <Loader2 className="w-4 h-4 animate-spin" />Loading…
            </div>
          ) : rows.length === 0 ? (
            <p className="p-4 text-sm text-[#2A1F0E]/60">
              {sources.length === 0
                ? formNumber
                  ? `No ${formNumber} entry names a product yet. Add the product's formula on ${formNumber} first.`
                  : "There are no batch sheets yet."
                : "Nothing matches that search."}
            </p>
          ) : (
            rows.map(s => {
              const withQty = s.lines.filter(l => l.expected !== "").length;
              return (
                <button
                  key={s.key}
                  type="button"
                  onClick={() => onPick(s)}
                  className="w-full text-left px-3 py-2 rounded hover:bg-[#C89B3C]/10 flex items-center justify-between gap-2"
                >
                  <span className="min-w-0">
                    <span className="block text-sm font-medium text-[#2A1F0E] truncate">{s.product}</span>
                    <span className="block text-xs text-[#2A1F0E]/50">
                      {s.client ? `${s.client} · ` : ""}{s.label} · {s.lines.length} ingredient{s.lines.length === 1 ? "" : "s"}
                      {s.batch ? ` · ${s.batch}` : ""}
                      {withQty === 0 && s.lines.length > 0 && <span className="text-amber-700"> · no quantities</span>}
                    </span>
                  </span>
                  <Badge variant="outline" className="shrink-0 capitalize">{s.status}</Badge>
                </button>
              );
            })
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
