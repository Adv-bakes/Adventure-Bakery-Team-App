import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Lock, Check, Send, Calculator } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

interface ClientOrdersProps {
  clientId: string;        // sales_leads.id
  profileId: string | null;
}

interface Order {
  id: string;
  status: string;
  items: any;
  ship_to_kind: string | null;
  notes: string | null;
  qb_estimate_sent_at: string | null;
  qb_estimate_accepted_at: string | null;
  waste_pct: number | null;
  created_at: string;
}

export function ClientOrders({ clientId, profileId }: ClientOrdersProps) {
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [wasteDrafts, setWasteDrafts] = useState<Record<string, string>>({});

  const load = async () => {
    if (!profileId) { setOrders([]); setLoading(false); return; }
    setLoading(true);
    const { data, error } = await supabase
      .from("production_orders")
      .select("id, status, items, ship_to_kind, notes, qb_estimate_sent_at, qb_estimate_accepted_at, waste_pct, created_at")
      .eq("client_id", profileId)
      .order("created_at", { ascending: false });
    if (error) toast.error(error.message);
    setOrders((data ?? []) as any);
    setLoading(false);
  };

  useEffect(() => { load(); }, [profileId, clientId]);

  const markSent = async (id: string) => {
    setBusyId(id);
    const { error } = await supabase
      .from("production_orders")
      .update({ qb_estimate_sent_at: new Date().toISOString(), status: "QB Estimate Sent" })
      .eq("id", id);
    setBusyId(null);
    if (error) return toast.error(error.message);
    toast.success("Marked QB estimate sent");
    load();
  };

  const markAccepted = async (id: string) => {
    setBusyId(id);
    const { error } = await supabase
      .from("production_orders")
      .update({ qb_estimate_accepted_at: new Date().toISOString(), status: "QB Accepted" })
      .eq("id", id);
    setBusyId(null);
    if (error) return toast.error(error.message);
    toast.success("QB estimate accepted — material estimator unlocked");
    load();
  };

  const calculate = async (id: string) => {
    const pct = Number(wasteDrafts[id] ?? "0");
    setBusyId(id);
    const { error } = await supabase
      .from("production_orders")
      .update({ waste_pct: pct, status: "In Estimation" })
      .eq("id", id);
    setBusyId(null);
    if (error) return toast.error(error.message);
    toast.success("Scout Bot stub: ingredient calc queued");
    load();
  };

  if (loading) return <p className="text-sm text-[hsl(var(--tp-text-dim))]">Loading orders…</p>;

  if (!orders.length) {
    return <p className="p-8 text-sm italic text-[hsl(var(--tp-text-dim))] tp-surface">No orders yet. Use the “Add Order” button at the top to create one.</p>;
  }

  return (
    <div className="space-y-4">
      {orders.map(o => {
        const accepted = !!o.qb_estimate_accepted_at;
        const items = Array.isArray(o.items) ? o.items : [];
        return (
          <div key={o.id} className="tp-surface p-5">
            <div className="flex items-center justify-between mb-3">
              <div>
                <p className="text-[10px] uppercase tracking-[0.18em] text-[hsl(var(--tp-text-dim))]">
                  Order · {new Date(o.created_at).toLocaleDateString()}
                </p>
                <p className="font-display text-base text-[hsl(var(--tp-text))]">{o.status}</p>
              </div>
              <p className="text-xs text-[hsl(var(--tp-text-muted))]">
                Ship to: {o.ship_to_kind === "ab_warehouse" ? "AB warehouse" : "Client default"}
              </p>
            </div>

            {items.length > 0 && (
              <div className="text-sm text-[hsl(var(--tp-text-muted))] mb-3">
                {items.map((it: any, i: number) => (
                  <span key={i} className="tp-chip text-[11px] mr-2">{it.qty} {it.unit}</span>
                ))}
              </div>
            )}

            {/* Step 1: Sent */}
            <div className="flex items-center gap-3 py-2 border-t border-[hsl(var(--tp-hairline))]">
              <span className="text-xs w-44 text-[hsl(var(--tp-text-dim))]">1. QB Estimate sent</span>
              {o.qb_estimate_sent_at ? (
                <span className="text-xs text-[hsl(var(--tp-text))] flex items-center gap-1">
                  <Check className="w-3.5 h-3.5 text-green-500" />
                  {new Date(o.qb_estimate_sent_at).toLocaleString()}
                </span>
              ) : (
                <Button size="sm" variant="outline" onClick={() => markSent(o.id)} disabled={busyId === o.id}>
                  <Send className="w-3.5 h-3.5 mr-1" /> Mark sent
                </Button>
              )}
            </div>

            {/* Step 2: Accepted — THE GATE */}
            <div className="flex items-center gap-3 py-2 border-t border-[hsl(var(--tp-hairline))]">
              <span className="text-xs w-44 text-[hsl(var(--tp-text-dim))]">2. QB Estimate accepted</span>
              {accepted ? (
                <span className="text-xs text-[hsl(var(--tp-text))] flex items-center gap-1">
                  <Check className="w-3.5 h-3.5 text-green-500" />
                  {new Date(o.qb_estimate_accepted_at!).toLocaleString()}
                </span>
              ) : (
                <Button size="sm" onClick={() => markAccepted(o.id)} disabled={busyId === o.id || !o.qb_estimate_sent_at}>
                  Mark accepted
                </Button>
              )}
            </div>

            {/* Step 3: Material Estimator — gated */}
            <div className="flex items-center gap-3 py-2 border-t border-[hsl(var(--tp-hairline))]">
              <span className="text-xs w-44 text-[hsl(var(--tp-text-dim))]">3. Material Estimator</span>
              {!accepted ? (
                <span className="text-xs text-[hsl(var(--tp-text-dim))] flex items-center gap-1">
                  <Lock className="w-3.5 h-3.5" /> Locked until QB acceptance
                </span>
              ) : (
                <div className="flex items-center gap-2">
                  <Input
                    type="number"
                    min={0}
                    step="0.1"
                    placeholder="Waste %"
                    value={wasteDrafts[o.id] ?? (o.waste_pct ?? "")}
                    onChange={e => setWasteDrafts(d => ({ ...d, [o.id]: e.target.value }))}
                    className="w-24 h-8"
                  />
                  <Button size="sm" variant="outline" onClick={() => calculate(o.id)} disabled={busyId === o.id}>
                    <Calculator className="w-3.5 h-3.5 mr-1" /> Calculate ingredients
                  </Button>
                  {o.waste_pct != null && (
                    <span className="text-xs text-[hsl(var(--tp-text-muted))]">Last run: {o.waste_pct}% waste</span>
                  )}
                </div>
              )}
            </div>

            {o.notes && (
              <p className="mt-3 text-xs text-[hsl(var(--tp-text-muted))] italic">Note: {o.notes}</p>
            )}
          </div>
        );
      })}
    </div>
  );
}
