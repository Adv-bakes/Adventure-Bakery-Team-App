import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { TeamPage } from "@/components/team/TeamPage";
import { toast } from "sonner";
import { FileSpreadsheet } from "lucide-react";

interface Row {
  id: string;
  status: string;
  version: number;
  updated_at: string;
  data_json: any;
  client_user_id: string | null;
}

const BatchSheets = () => {
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const { data, error } = await (supabase as any)
        .from("batch_sheets")
        .select("id, status, version, updated_at, data_json, client_user_id")
        .is("superseded_at", null)
        .order("updated_at", { ascending: false })
        .limit(200);
      if (error) toast.error(error.message);
      setRows((data || []) as Row[]);
      setLoading(false);
    })();
  }, []);

  const statusColor = (s: string) => ({
    draft: "bg-amber-500/15 text-amber-700 border-amber-500/30",
    in_review: "bg-blue-500/15 text-blue-700 border-blue-500/30",
    approved: "bg-emerald-500/15 text-emerald-700 border-emerald-500/30",
    superseded: "bg-muted text-muted-foreground border-border",
  }[s] || "bg-muted text-muted-foreground border-border");

  return (
    <TeamPage eyebrow="Operations" title="Batch sheets" description="Auto-generated from approved PSS submissions. Edit, version, and export for the costing engine.">
      {loading ? (
        <p className="text-sm text-[hsl(var(--tp-text-muted))]">Loading…</p>
      ) : rows.length === 0 ? (
        <div className="border border-border rounded-lg p-12 text-center">
          <FileSpreadsheet className="w-10 h-10 mx-auto text-muted-foreground mb-3" />
          <p className="text-sm text-muted-foreground">No batch sheets yet. Submitting a PSS will generate one automatically.</p>
        </div>
      ) : (
        <div className="border border-border rounded-lg overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-muted/40 text-xs uppercase tracking-wider text-muted-foreground">
              <tr>
                <th className="text-left px-4 py-3">Product</th>
                <th className="text-left px-4 py-3">Client</th>
                <th className="text-left px-4 py-3">Version</th>
                <th className="text-left px-4 py-3">Status</th>
                <th className="text-left px-4 py-3">Updated</th>
                <th className="px-4 py-3"></th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => {
                const d = r.data_json || {};
                return (
                  <tr key={r.id} className="border-t border-border hover:bg-muted/20">
                    <td className="px-4 py-3 font-medium">{d.header?.product_name || "(untitled)"}</td>
                    <td className="px-4 py-3 text-muted-foreground">{d.header?.company_name || "—"}</td>
                    <td className="px-4 py-3">v{r.version}</td>
                    <td className="px-4 py-3">
                      <span className={`inline-block px-2 py-0.5 rounded text-xs border ${statusColor(r.status)}`}>{r.status}</span>
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">{new Date(r.updated_at).toLocaleDateString()}</td>
                    <td className="px-4 py-3 text-right">
                      <Link to={`/team/operations/batch-sheets/${r.id}`} className="text-primary hover:underline">Open</Link>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </TeamPage>
  );
};

export default BatchSheets;
