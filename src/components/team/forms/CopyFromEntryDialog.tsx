import { useEffect, useMemo, useState } from "react";
import { format } from "date-fns";
import { Loader2, Search } from "lucide-react";
import { toast } from "sonner";
import {
  Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { instanceTitle, type FormSchema } from "@/lib/formSchema";
import { fetchResponses, type FormResponse } from "@/lib/formResponses";

/**
 * Pick an earlier entry of the same form to copy from (settings.copyFrom). A
 * list, not "the last one": a product can have variants — a Coconut Rum Cake
 * with its own flavoring — and the right sheet to copy is the one for THAT
 * product, which is not necessarily the newest.
 */
export function CopyFromEntryDialog({
  open, onOpenChange, documentId, excludeId, schema, onPick,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  documentId: string;
  excludeId: string;
  schema: FormSchema;
  onPick: (entry: FormResponse, title: string) => void;
}) {
  const [entries, setEntries] = useState<FormResponse[] | null>(null);
  const [query, setQuery] = useState("");

  useEffect(() => {
    if (!open) return;
    setQuery("");
    setEntries(null);
    fetchResponses(documentId)
      .then(rows => setEntries(rows.filter(r => r.id !== excludeId)))
      .catch((e: any) => { toast.error(e.message ?? "Failed to load entries"); setEntries([]); });
  }, [open, documentId, excludeId]);

  const rows = useMemo(() => {
    const q = query.trim().toLowerCase();
    return (entries ?? [])
      .map(r => ({ r, title: instanceTitle(schema, r) }))
      .filter(({ title }) => !q || title.toLowerCase().includes(q));
  }, [entries, query, schema]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Copy from a previous entry</DialogTitle>
          <DialogDescription>
            Pick the entry to copy. Its product and ingredient lines come across; the lots are left blank for today.
          </DialogDescription>
        </DialogHeader>
        <div className="relative">
          <Search className="w-4 h-4 absolute left-2.5 top-1/2 -translate-y-1/2 text-[#2A1F0E]/40" />
          <Input value={query} onChange={e => setQuery(e.target.value)} placeholder="Search by product or lot code" className="pl-8" />
        </div>
        <div className="max-h-[50vh] overflow-y-auto -mx-1">
          {entries === null ? (
            <div className="flex items-center gap-2 p-4 text-sm text-[#2A1F0E]/60">
              <Loader2 className="w-4 h-4 animate-spin" />Loading entries…
            </div>
          ) : rows.length === 0 ? (
            <p className="p-4 text-sm text-[#2A1F0E]/60">
              {entries.length === 0 ? "There are no earlier entries of this form yet." : "No entry matches that search."}
            </p>
          ) : (
            rows.map(({ r, title }) => (
              <button
                key={r.id}
                type="button"
                onClick={() => onPick(r, title)}
                className="w-full text-left px-3 py-2 rounded hover:bg-[#C89B3C]/10 flex items-center justify-between gap-2"
              >
                <span className="min-w-0">
                  <span className="block text-sm font-medium text-[#2A1F0E] truncate">{title}</span>
                  <span className="block text-xs text-[#2A1F0E]/50">Created {format(new Date(r.created_at), "M/d/yyyy")}</span>
                </span>
                <Badge variant="outline" className="shrink-0 capitalize">{r.status}</Badge>
              </button>
            ))
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
