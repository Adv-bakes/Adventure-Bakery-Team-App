import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface ClientOrdersProps {
  clientId: string;
  profileId: string | null;
}

interface Order {
  id: string;
  order_number: string | null;
  status: string;
  items: any;
  ship_to_kind: string | null;
  created_at: string;
  target_completion_date: string | null;
  scheduled_date: string | null;
}

const STATUS_DOT: Record<string, string> = {
  "Order Placed":  "bg-slate-400",
  "Confirmed":     "bg-blue-400",
  "Sourcing":      "bg-violet-400",
  "Scheduled":     "bg-amber-400",
  "In Production": "bg-orange-400",
  "Shipped":       "bg-emerald-500",
};

const fmt = (iso: string) =>
  new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });

export function ClientOrders({ clientId, profileId }: ClientOrdersProps) {
  const navigate = useNavigate();
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      if (!profileId && !clientId) { setLoading(false); return; }
      const { data, error } = await (supabase as any)
        .from("production_orders")
        .select("id, order_number, status, items, ship_to_kind, created_at, target_completion_date, scheduled_date")
        .or(`client_id.eq.${clientId}${profileId && profileId !== clientId ? `,client_id.eq.${profileId}` : ""}`)
        .neq("status", "Archived")
        .order("created_at", { ascending: false });
      if (error) toast.error(error.message);
      setOrders((data ?? []) as Order[]);
      setLoading(false);
    };
    load();
  }, [clientId, profileId]);

  if (loading) return <p className="text-sm text-[hsl(var(--tp-text-dim))] p-4">Loading…</p>;

  if (!orders.length) return (
    <p className="p-8 text-sm italic text-[hsl(var(--tp-text-dim))] tp-surface">
      No orders yet — use the "Add Order" button to create one.
    </p>
  );

  return (
    <div className="tp-surface overflow-x-auto">
      <table className="w-full text-sm border-collapse">
        <thead>
          <tr className="border-b border-[hsl(var(--tp-hairline))]">
            {["Order Date", "Order #", "Products", "Qty", "Stage", "Details"].map(h => (
              <th key={h} className="text-left py-2.5 px-4 text-[10px] uppercase tracking-[0.14em] text-[hsl(var(--tp-text-dim))] font-semibold whitespace-nowrap">
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-[hsl(var(--tp-hairline))]">
          {orders.map(o => {
            const items = Array.isArray(o.items) ? o.items : [];
            const productNames = items.map((i: any) => i.product_name).filter(Boolean).join(", ") || "—";
            const qtySummary = items.map((i: any) => `${i.qty} ${i.unit}`).join(", ") || "—";
            const isShipped = o.status === "Shipped";
            const destination = isShipped
              ? (o.ship_to_kind === "ab_warehouse" ? "Warehoused" : "Shipped to client")
              : null;

            return (
              <tr
                key={o.id}
                onClick={() => navigate(`/team/ops/orders/${o.id}`)}
                className="cursor-pointer hover:bg-white/5 transition-colors"
              >
                <td className="py-3 px-4 text-[hsl(var(--tp-text-dim))] whitespace-nowrap">
                  {fmt(o.created_at)}
                </td>
                <td className="py-3 px-4 font-semibold text-[hsl(var(--tp-text))] whitespace-nowrap">
                  {o.order_number ?? "—"}
                </td>
                <td className="py-3 px-4 text-[hsl(var(--tp-text))] max-w-[220px] truncate">
                  {productNames}
                </td>
                <td className="py-3 px-4 text-[hsl(var(--tp-text-dim))] whitespace-nowrap">
                  {qtySummary}
                </td>
                <td className="py-3 px-4 whitespace-nowrap">
                  <span className="flex items-center gap-1.5">
                    <span className={`w-2 h-2 rounded-full shrink-0 ${STATUS_DOT[o.status] ?? "bg-slate-400"}`} />
                    <span className="text-[hsl(var(--tp-text))]">{o.status}</span>
                  </span>
                  {isShipped && o.target_completion_date && (
                    <p className="text-[11px] text-[hsl(var(--tp-text-dim))] mt-0.5 pl-3.5">
                      {destination} · {fmt(o.target_completion_date)}
                    </p>
                  )}
                </td>
                <td className="py-3 px-4">
                  <span className="text-[11px] text-[hsl(var(--tp-gold))]">View →</span>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
