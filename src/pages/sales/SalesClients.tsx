import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { TeamPage } from "@/components/team/TeamPage";
import { Search } from "lucide-react";

interface Row {
  id: string;
  full_name: string | null;
  business_name: string | null;
  email: string | null;
  sales_stage: string | null;
  sales_stage_updated_at: string | null;
}

const SalesClients = () => {
  const [rows, setRows] = useState<Row[]>([]);
  const [q, setQ] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select("id, full_name, business_name, email, sales_stage, sales_stage_updated_at")
        .eq("role", "Client" as any)
        .order("sales_stage_updated_at", { ascending: false });
      if (error) toast.error(error.message);
      setRows((data as any) || []);
      setLoading(false);
    })();
  }, []);

  const filtered = useMemo(() => {
    const s = q.trim().toLowerCase();
    if (!s) return rows;
    return rows.filter((r) => [r.full_name, r.business_name, r.email].some((v) => v && v.toLowerCase().includes(s)));
  }, [rows, q]);

  return (
    <TeamPage
      eyebrow="Sales"
      title="Clients"
      description="Every client account at a glance. Open a folder for documents, PRFs, concepts, and activity."
      actions={
        <div className="relative">
          <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-[hsl(var(--tp-text-dim))]" />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search…"
            className="tp-input pl-9 w-[260px]"
          />
        </div>
      }
    >
      <div className="tp-surface overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-[11px] uppercase tracking-[0.12em] text-[hsl(var(--tp-text-dim))] border-b border-[hsl(var(--tp-hairline))]">
              <th className="px-5 py-3 font-medium">Company</th>
              <th className="px-5 py-3 font-medium">Contact</th>
              <th className="px-5 py-3 font-medium">Email</th>
              <th className="px-5 py-3 font-medium">Stage</th>
              <th className="px-5 py-3 font-medium">Updated</th>
            </tr>
          </thead>
          <tbody>
            {loading && (
              <tr><td colSpan={5} className="px-5 py-10 text-center text-[hsl(var(--tp-text-dim))]">Loading…</td></tr>
            )}
            {!loading && filtered.length === 0 && (
              <tr><td colSpan={5} className="px-5 py-10 text-center text-[hsl(var(--tp-text-dim))]">No clients found.</td></tr>
            )}
            {filtered.map((r) => (
              <tr key={r.id} className="border-t border-[hsl(var(--tp-hairline))] hover:bg-white/[0.025] transition">
                <td className="px-5 py-3.5">
                  <Link to={`/team/sales/clients/${r.id}`} className="font-display font-semibold text-[hsl(var(--tp-text))] hover:text-[hsl(var(--tp-gold-soft))]">
                    {r.business_name || "—"}
                  </Link>
                </td>
                <td className="px-5 py-3.5 text-[hsl(var(--tp-text))]">{r.full_name || "—"}</td>
                <td className="px-5 py-3.5 text-[hsl(var(--tp-text-muted))]">{r.email || "—"}</td>
                <td className="px-5 py-3.5"><span className="tp-chip">{r.sales_stage || "Lead In"}</span></td>
                <td className="px-5 py-3.5 text-[hsl(var(--tp-text-dim))] text-xs">
                  {r.sales_stage_updated_at ? new Date(r.sales_stage_updated_at).toLocaleDateString() : "—"}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </TeamPage>
  );
};

export default SalesClients;
