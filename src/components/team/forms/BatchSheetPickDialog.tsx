import { useEffect, useMemo, useState } from "react";
import { Loader2, Search } from "lucide-react";
import { toast } from "sonner";
import {
  Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { batchSheetProduct, batchSizeOf, expectedLines, type BatchSheetRow } from "@/lib/batchSheetFill";
import { fetchCurrentBatchSheets } from "@/lib/formResponses";

/**
 * Pick the product whose batch sheet starts this entry (settings.batchSheet). Lists the current
 * version of every batch sheet; a sheet with no standard batch size is still offered, and says so,
 * because its ingredient lines are worth having even without the quantities.
 */
export function BatchSheetPickDialog({
  open, onOpenChange, onPick,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onPick: (sheet: BatchSheetRow) => void;
}) {
  const [sheets, setSheets] = useState<BatchSheetRow[] | null>(null);
  const [query, setQuery] = useState("");

  useEffect(() => {
    if (!open) return;
    setQuery("");
    setSheets(null);
    fetchCurrentBatchSheets()
      .then(setSheets)
      .catch((e: any) => { toast.error(e.message ?? "Failed to load batch sheets"); setSheets([]); });
  }, [open]);

  const rows = useMemo(() => {
    const q = query.trim().toLowerCase();
    return (sheets ?? [])
      .map(s => ({ s, product: batchSheetProduct(s) || "(untitled)", client: String(s.data_json?.header?.company_name ?? "") }))
      .filter(({ product, client }) => !q || product.toLowerCase().includes(q) || client.toLowerCase().includes(q));
  }, [sheets, query]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Start from the batch sheet</DialogTitle>
          <DialogDescription>
            Pick the product. Its ingredient lines and expected quantities replace the table below; the lots and the weights are left blank for today.
          </DialogDescription>
        </DialogHeader>
        <div className="relative">
          <Search className="w-4 h-4 absolute left-2.5 top-1/2 -translate-y-1/2 text-[#2A1F0E]/40" />
          <Input value={query} onChange={e => setQuery(e.target.value)} placeholder="Search by product or customer" className="pl-8" />
        </div>
        <div className="max-h-[50vh] overflow-y-auto -mx-1">
          {sheets === null ? (
            <div className="flex items-center gap-2 p-4 text-sm text-[#2A1F0E]/60">
              <Loader2 className="w-4 h-4 animate-spin" />Loading batch sheets…
            </div>
          ) : rows.length === 0 ? (
            <p className="p-4 text-sm text-[#2A1F0E]/60">
              {sheets.length === 0 ? "There are no batch sheets yet." : "No batch sheet matches that search."}
            </p>
          ) : (
            rows.map(({ s, product, client }) => {
              const size = batchSizeOf(s);
              return (
                <button
                  key={s.id}
                  type="button"
                  onClick={() => onPick(s)}
                  className="w-full text-left px-3 py-2 rounded hover:bg-[#C89B3C]/10 flex items-center justify-between gap-2"
                >
                  <span className="min-w-0">
                    <span className="block text-sm font-medium text-[#2A1F0E] truncate">{product}</span>
                    <span className="block text-xs text-[#2A1F0E]/50">
                      {client ? `${client} · ` : ""}v{s.version} · {expectedLines(s).length} ingredients ·{" "}
                      {size ? `${size.qty} ${size.unit} batch` : <span className="text-amber-700">no batch size - quantities will be blank</span>}
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
