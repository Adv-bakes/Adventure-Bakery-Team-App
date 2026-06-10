import { useEffect, useState } from "react";
import { useNavigate, Link } from "react-router-dom";
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
  lead_id: string | null;
  concept_id: number | null;
  pss_document_id: string | null;
}

const STATUS_BADGE: Record<string, string> = {
  draft:      "bg-amber-500/15 text-amber-600 border-amber-500/30",
  in_review:  "bg-blue-500/15 text-blue-600 border-blue-500/30",
  approved:   "bg-emerald-500/15 text-emerald-700 border-emerald-500/30",
  final:      "bg-emerald-500/15 text-emerald-700 border-emerald-500/30",
  superseded: "bg-slate-500/15 text-slate-500 border-slate-500/30",
};

const BatchSheets = () => {
  const navigate = useNavigate();
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const { data, error } = await (supabase as any)
        .from("batch_sheets")
        .select("id, status, version, updated_at, data_json, lead_id, concept_id, pss_document_id")
        .is("superseded_at", null)
        .order("updated_at", { ascending: false })
        .limit(200);
      if (error) { toast.error(error.message); setLoading(false); return; }

      // For rows missing lead_id, resolve via pss_submissions
      const resolved = await Promise.all((data || []).map(async (r: Row) => {
        if (r.lead_id) return r;
        if (!r.pss_document_id) return r;
        const { data: pss } = await (supabase as any)
          .from("pss_submissions").select("lead_id").eq("id", r.pss_document_id).maybeSingle();
        return { ...r, lead_id: pss?.lead_id ?? null };
      }));

      setRows(resolved as Row[]);
      setLoading(false);
    })();
  }, []);

  return (
    <TeamPage
      eyebrow="Operations"
      title="Batch sheets"
      description="All active batch sheets. Click a row to open, or View product to go back to the product page."
    >
      {loading ? (
        <p className="text-sm text-[hsl(var(--tp-text-dim))]">Loading…</p>
      ) : rows.length === 0 ? (
        <div className="tp-surface border border-[hsl(var(--tp-hairline))] rounded-lg p-12 text-center">
          <FileSpreadsheet className="w-10 h-10 mx-auto text-[hsl(var(--tp-text-dim))] mb-3" />
          <p className="text-sm text-[hsl(var(--tp-text-dim))]">No batch sheets yet.</p>
        </div>
      ) : (
        <div className="tp-surface border border-[hsl(var(--tp-hairline))] rounded-lg overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-[hsl(var(--tp-surface-2))] text-xs uppercase tracking-wider text-[hsl(var(--tp-text-dim))]">
              <tr>
                <th className="text-left px-4 py-3">Product</th>
                <th className="text-left px-4 py-3">Client</th>
                <th className="text-left px-4 py-3">Version</th>
                <th className="text-left px-4 py-3">Status</th>
                <th className="text-left px-4 py-3">Updated</th>
                <th className="px-4 py-3"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[hsl(var(--tp-hairline))]">
              {rows.map((r) => {
                const d = r.data_json || {};
                const productUrl = r.lead_id && r.concept_id
                  ? `/team/sales/clients/${r.lead_id}/products/${r.concept_id}`
                  : r.lead_id
                  ? `/team/sales/clients/${r.lead_id}`
                  : null;
                return (
                  <tr
                    key={r.id}
                    onClick={() => navigate(`/team/operations/batch-sheets/${r.id}`)}
                    className="cursor-pointer hover:bg-white/5 transition-colors"
                  >
                    <td className="px-4 py-3 font-semibold text-[hsl(var(--tp-text))]">
                      {d.header?.product_name || "(untitled)"}
                    </td>
                    <td className="px-4 py-3 text-[hsl(var(--tp-text-dim))]">
                      {d.header?.company_name || "—"}
                    </td>
                    <td className="px-4 py-3 text-[hsl(var(--tp-text))]">v{r.version}</td>
                    <td className="px-4 py-3">
                      <span className={`inline-block px-2 py-0.5 rounded text-xs border ${STATUS_BADGE[r.status] ?? STATUS_BADGE.superseded}`}>
                        {r.status}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-[hsl(var(--tp-text-dim))]">
                      {new Date(r.updated_at).toLocaleDateString()}
                    </td>
                    <td className="px-4 py-3 text-right" onClick={(e) => e.stopPropagation()}>
                      {productUrl && (
                        <Link
                          to={productUrl}
                          className="text-[11px] text-[hsl(var(--tp-gold))] hover:underline"
                        >
                          View product →
                        </Link>
                      )}
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
