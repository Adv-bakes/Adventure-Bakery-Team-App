import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Plus } from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";
import { getFormSchema, instanceTitle } from "@/lib/formSchema";
import { createResponse, fetchProfileNames, fetchResponses, type FormResponse } from "@/lib/formResponses";

const statusBadge: Record<string, string> = {
  draft: "bg-[#C89B3C]/20 text-[#9A6F1E] border-[#C89B3C]/40",
  submitted: "bg-green-500/20 text-green-700",
};

interface FormEntriesTabProps {
  doc: {
    id: string;
    sop_number: string | null;
    revision: string | null;
    content: any;
  };
}

/**
 * The drawer's Entries tab: this form's filled instances plus "New Entry".
 * Row click opens the dedicated entry editor route (view/edit happens there;
 * deletion too — some forms are non-deletable per settings.deletable).
 */
export function FormEntriesTab({ doc }: FormEntriesTabProps) {
  const navigate = useNavigate();
  const [entries, setEntries] = useState<FormResponse[]>([]);
  const [names, setNames] = useState<Map<string, string>>(new Map());
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const schema = getFormSchema(doc.content);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    fetchResponses(doc.id)
      .then(async rows => {
        if (cancelled) return;
        setEntries(rows);
        const map = await fetchProfileNames(rows.map(r => r.created_by));
        if (!cancelled) setNames(map);
      })
      .catch((e: any) => toast.error(e.message ?? "Failed to load entries"))
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [doc.id]);

  const newEntry = async () => {
    setCreating(true);
    try {
      const response = await createResponse(doc);
      navigate(`/team/compliance/forms/${doc.id}/entries/${response.id}`);
    } catch (e: any) {
      toast.error(e.message ?? "Failed to create entry");
    } finally {
      setCreating(false);
    }
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-xs text-muted-foreground">
          {loading ? "Loading entries…" : `${entries.length} entr${entries.length === 1 ? "y" : "ies"} recorded`}
        </p>
        <Button type="button" size="sm" onClick={newEntry} disabled={creating || !schema} className="bg-[#C89B3C] hover:bg-[#B8892C]">
          <Plus className="w-3.5 h-3.5 mr-1" />{creating ? "Creating…" : "New Entry"}
        </Button>
      </div>

      {!loading && entries.length === 0 ? (
        <div className="rounded-md border border-dashed p-6 text-center text-sm text-[#2A1F0E]/60" style={{ borderColor: "rgba(200,155,60,0.4)" }}>
          No entries yet. Click New Entry to fill this form out for the first time.
        </div>
      ) : entries.length > 0 && (
        <div className="rounded-md border overflow-hidden" style={{ borderColor: "rgba(200,155,60,0.25)" }}>
          <Table className="[&_td]:py-2 [&_th]:h-9">
            <TableHeader>
              <TableRow>
                <TableHead className="text-[#2A1F0E]/60">Entry</TableHead>
                <TableHead className="text-[#2A1F0E]/60">Filled by</TableHead>
                <TableHead className="text-[#2A1F0E]/60">Status</TableHead>
                <TableHead className="text-[#2A1F0E]/60">Updated</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {entries.map(entry => {
                const filler = names.get(entry.created_by) || "—";
                return (
                  <TableRow
                    key={entry.id}
                    className="cursor-pointer hover:bg-[#C89B3C]/5"
                    onClick={() => navigate(`/team/compliance/forms/${doc.id}/entries/${entry.id}`)}
                  >
                    <TableCell className="font-medium">
                      {instanceTitle(schema, entry, filler)}
                      {entry.form_revision && entry.form_revision !== doc.revision && (
                        <span className="ml-1.5 text-[10px] text-[#2A1F0E]/40">Rev {entry.form_revision}</span>
                      )}
                    </TableCell>
                    <TableCell>{filler}</TableCell>
                    <TableCell><Badge className={statusBadge[entry.status]}>{entry.status}</Badge></TableCell>
                    <TableCell className="text-xs text-[#2A1F0E]/60">
                      {format(new Date(entry.updated_at), "M/d/yyyy h:mm a")}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}
