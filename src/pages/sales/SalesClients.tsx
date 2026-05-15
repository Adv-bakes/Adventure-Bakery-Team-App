import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";

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
    return rows.filter((r) =>
      [r.full_name, r.business_name, r.email]
        .some((v) => v && v.toLowerCase().includes(s))
    );
  }, [rows, q]);

  return (
    <div className="max-w-6xl">
      <h1 className="text-3xl font-semibold mb-2" style={{ color: "#F5F1E6" }}>
        Clients
      </h1>
      <p className="text-sm mb-6" style={{ color: "rgba(245,241,230,0.6)" }}>
        Search and open any client folder.
      </p>

      <div className="mb-4 max-w-md">
        <Input
          placeholder="Search by name, company, or email…"
          value={q}
          onChange={(e) => setQ(e.target.value)}
        />
      </div>

      <div
        className="rounded-lg border overflow-hidden"
        style={{
          background: "rgba(200,155,60,0.04)",
          borderColor: "rgba(200,155,60,0.15)",
        }}
      >
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left" style={{ color: "rgba(245,241,230,0.5)" }}>
              <th className="px-4 py-3 font-medium">Company</th>
              <th className="px-4 py-3 font-medium">Contact</th>
              <th className="px-4 py-3 font-medium">Email</th>
              <th className="px-4 py-3 font-medium">Stage</th>
              <th className="px-4 py-3 font-medium">Updated</th>
            </tr>
          </thead>
          <tbody>
            {loading && (
              <tr><td colSpan={5} className="px-4 py-6 text-center" style={{ color: "rgba(245,241,230,0.4)" }}>Loading…</td></tr>
            )}
            {!loading && filtered.length === 0 && (
              <tr><td colSpan={5} className="px-4 py-6 text-center" style={{ color: "rgba(245,241,230,0.4)" }}>No clients found.</td></tr>
            )}
            {filtered.map((r) => (
              <tr
                key={r.id}
                className="border-t hover:bg-white/5"
                style={{ borderColor: "rgba(200,155,60,0.1)", color: "#F5F1E6" }}
              >
                <td className="px-4 py-3">
                  <Link to={`/team/sales/clients/${r.id}`} className="hover:underline">
                    {r.business_name || "—"}
                  </Link>
                </td>
                <td className="px-4 py-3">{r.full_name || "—"}</td>
                <td className="px-4 py-3" style={{ color: "rgba(245,241,230,0.7)" }}>{r.email || "—"}</td>
                <td className="px-4 py-3">
                  <span className="px-2 py-0.5 rounded text-xs"
                    style={{ background: "rgba(200,155,60,0.15)", color: "#C89B3C" }}>
                    {r.sales_stage || "Lead In"}
                  </span>
                </td>
                <td className="px-4 py-3" style={{ color: "rgba(245,241,230,0.5)" }}>
                  {r.sales_stage_updated_at
                    ? new Date(r.sales_stage_updated_at).toLocaleDateString()
                    : "—"}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default SalesClients;
