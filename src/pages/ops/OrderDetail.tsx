import { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { TeamPage } from "@/components/team/TeamPage";
import { Button } from "@/components/ui/button";
import { ArrowLeft, ArrowRight, Loader2, FlaskConical, Pencil } from "lucide-react";
import { toast } from "sonner";
import { runMaterialCalc, type MaterialCalcJson } from "@/lib/materialCalc";
import { MaterialCalcResults } from "@/components/sales/MaterialCalcResults";
import { useUserRole } from "@/hooks/useUserRole";

const STAGES = [
  "Order Placed",
  "Confirmed",
  "Sourcing",
  "Scheduled",
  "In Production",
  "Shipped",
] as const;
type Stage = (typeof STAGES)[number];

interface OrderItem {
  product_id: string;
  product_name: string;
  batch_sheet_id?: string;
  qty: number;
  unit: string;
}

interface Order {
  id: string;
  status: Stage;
  client_id: string;
  items: OrderItem[];
  created_at: string;
  notes: string | null;
  case_count: number;
  ship_to_kind: "client" | "ab_warehouse" | null;
  payment_status: string | null;
  material_calc_json: MaterialCalcJson | null;
  waste_pct: number | null;
  order_type: string | null;
  batch_count: number | null;
  batch_size_lbs: number | null;
  order_number: string | null;
}

const DEFAULT_BATCH_SIZE = 110;

export default function OrderDetail() {
  const { orderId } = useParams();
  const { role } = useUserRole();
  const isManagement = role === "admin" || role === "owner";

  const [order, setOrder] = useState<Order | null>(null);
  const [clientName, setClientName] = useState("");
  const [advancing, setAdvancing] = useState(false);
  const [notesDraft, setNotesDraft] = useState("");
  const [savingNotes, setSavingNotes] = useState(false);
  const [batchEditOpen, setBatchEditOpen] = useState(false);
  const [batchCountDraft, setBatchCountDraft] = useState("1");
  const [batchSizeDraft, setBatchSizeDraft] = useState("110");
  const [rerunning, setRerunning] = useState(false);

  useEffect(() => {
    if (!orderId) return;
    (async () => {
      const { data } = await (supabase as any)
        .from("production_orders")
        .select("*, order_number")
        .eq("id", orderId)
        .maybeSingle();
      if (!data) return;
      setOrder(data as Order);
      setNotesDraft(data.notes || "");

      let leadName = "";
      if (data.client_id) {
        const { data: lead } = await (supabase as any)
          .from("sales_leads")
          .select("company_name, email")
          .eq("profile_id", data.client_id)
          .maybeSingle();
        leadName = lead?.company_name || lead?.email || data.client_id;
        setClientName(leadName);
      }

      // Generate order number if missing and order is past Order Placed
      if (!data.order_number && data.status !== "Order Placed") {
        const words = leadName.trim().split(/\s+/).filter(Boolean);
        const initials = words.slice(0, 3).map((w: string) => w[0].toUpperCase()).join("") || "AB";
        const d = new Date(data.created_at);
        const orderNum = `${initials}-${String(d.getMonth() + 1).padStart(2, "0")}${String(d.getDate()).padStart(2, "0")}${String(d.getFullYear()).slice(-2)}`;
        await (supabase as any).from("production_orders").update({ order_number: orderNum }).eq("id", data.id);
        data.order_number = orderNum;
      }

      // "Confirmed" is never a resting state — auto-advance to Sourcing immediately
      if (data.status === "Confirmed") {
        const now = new Date().toISOString();
        const { data: { user } } = await supabase.auth.getUser();
        let calcJson = data.material_calc_json ?? null;
        if (!calcJson && Array.isArray(data.items) && data.items.length > 0) {
          try {
            calcJson = await runMaterialCalc(
              data.id,
              data.items.map((i: any) => ({
                product_id: i.product_id,
                product_name: i.product_name,
                batch_sheet_id: i.batch_sheet_id,
                qty: i.qty,
                unit: i.unit as "units" | "cases" | "lbs",
              })),
              data.waste_pct ?? 10,
              (data.order_type ?? "jit") as "jit" | "tolling_warehoused" | "tolling_external",
              data.client_id,
            );
          } catch { /* advance anyway */ }
        }
        // Generate order number if missing
        const resolvedClientName = leadName;
        const words = resolvedClientName.trim().split(/\s+/).filter(Boolean);
        const initials = words.slice(0, 3).map((w: string) => w[0].toUpperCase()).join("");
        const d = new Date();
        const orderNum = data.order_number || `${initials || "AB"}-${String(d.getMonth() + 1).padStart(2, "0")}${String(d.getDate()).padStart(2, "0")}${String(d.getFullYear()).slice(-2)}`;

        await (supabase as any).from("production_orders")
          .update({ status: "Sourcing", order_number: orderNum, ...(calcJson ? { material_calc_json: calcJson } : {}) })
          .eq("id", data.id);
        await (supabase as any).from("order_stage_events")
          .update({ exited_at: now }).eq("order_id", data.id).eq("stage", "Confirmed").is("exited_at", null);
        await (supabase as any).from("order_stage_events")
          .insert({ order_id: data.id, stage: "Sourcing", entered_at: now, completed_by: user?.id ?? null });
        // Reserve inventory
        if (calcJson && data.order_type !== "tolling_external") {
          const rows = (calcJson.summary?.ingredients ?? [])
            .filter((ing: any) => ing.on_hand_lbs > 0)
            .map((ing: any) => ({
              order_id: data.id,
              ingredient_name: ing.name,
              reserved_lbs: Math.min(ing.total_need_lbs, ing.on_hand_lbs),
            }));
          if (rows.length > 0) {
            await (supabase as any).from("inventory_reservations").insert(rows);
          }
        }
        setOrder({ ...data, status: "Sourcing", order_number: orderNum, material_calc_json: calcJson } as Order);
        toast.success("Order confirmed — materials estimated, inventory reserved");
      }
    })();
  }, [orderId]);

  const currentIdx = order ? STAGES.indexOf(order.status) : -1;
  const nextStage = currentIdx >= 0 && currentIdx < STAGES.length - 1
    ? STAGES[currentIdx + 1]
    : null;

  const buttonLabel = (() => {
    if (!nextStage) return "";
    if (order?.status === "Order Placed") return "Confirm Order";
    if (order?.status === "Sourcing") return "Confirm Sourcing";
    return `Advance to ${nextStage}`;
  })();

  function generateOrderNumber(companyName: string): string {
    const words = (companyName || "").trim().split(/\s+/).filter(Boolean);
    const initials = words.slice(0, 3).map(w => w[0].toUpperCase()).join("");
    const now = new Date();
    const mm = String(now.getMonth() + 1).padStart(2, "0");
    const dd = String(now.getDate()).padStart(2, "0");
    const yy = String(now.getFullYear()).slice(-2);
    return `${initials || "AB"}-${mm}${dd}${yy}`;
  }

  async function reserveInventory(orderId: string, calcJson: MaterialCalcJson): Promise<string | null> {
    if (!calcJson?.summary?.ingredients?.length) return "No ingredients in calc";
    const rows = calcJson.summary.ingredients
      .filter(ing => ing.total_need_lbs > 0)
      .map(ing => ({
        order_id: orderId,
        ingredient_name: ing.name,
        reserved_lbs: ing.total_need_lbs, // full need — Available = on_hand - reserved goes negative when short
      }));
    if (rows.length === 0) return "No ingredients need reserving";
    const { error } = await (supabase as any).from("inventory_reservations").insert(rows);
    if (error) return error.message;
    return null;
  }

  const advance = async () => {
    if (!order || !nextStage) return;
    setAdvancing(true);
    try {
    const { data: { user } } = await supabase.auth.getUser();
    const now = new Date().toISOString();

    // Special flow: Order Placed → run calc → jump straight to Sourcing
    if (order.status === "Order Placed") {
      // Generate order number
      const orderNum = order.order_number || generateOrderNumber(clientName);

      // Run material calc
      let calcJson: MaterialCalcJson | null = null;
      try {
        calcJson = await runMaterialCalc(
          order.id,
          order.items.map(i => ({
            product_id: i.product_id,
            product_name: i.product_name,
            batch_sheet_id: i.batch_sheet_id,
            qty: i.qty,
            unit: i.unit as "units" | "cases" | "lbs",
          })),
          order.waste_pct ?? 10,
          (order.order_type ?? "jit") as "jit" | "tolling_warehoused" | "tolling_external",
          order.client_id,
        );
      } catch (e) {
        toast.warning("Material estimate failed — advancing anyway");
      }

      // Auto-calculate batch plan from calc results
      let batchCount = 1;
      let orderBatchSizeLbs = DEFAULT_BATCH_SIZE;
      const batchInserts: any[] = [];
      for (const item of order.items) {
        const prodCalc = calcJson?.products.find(p => p.product_id === item.product_id);
        const productionLbs = prodCalc?.production_lbs ?? 0;
        // Whole-number batch count — ceil so we never exceed capacity per batch
        const itemBatches = Math.max(1, Math.ceil(productionLbs / DEFAULT_BATCH_SIZE));
        // Distribute production lbs evenly: batch_count × size = production_lbs exactly
        const sizePerBatch = productionLbs > 0
          ? Math.round((productionLbs / itemBatches) * 1000) / 1000
          : DEFAULT_BATCH_SIZE;
        if (itemBatches > batchCount) {
          batchCount = itemBatches;
          orderBatchSizeLbs = sizePerBatch;
        }
        for (let b = 0; b < itemBatches; b++) {
          batchInserts.push({
            product_name: item.product_name,
            batch_date: new Date().toISOString().slice(0, 10),
            target_batch_size_lbs: sizePerBatch,
            status: "Scheduled",
            order_id: order.id,
            batch_sheet_id: item.batch_sheet_id ?? null,
          });
        }
      }
      if (batchInserts.length > 0) {
        await (supabase as any).from("production_batches").insert(batchInserts);
      }

      // Move to Confirmed + store calc + batch plan + order number
      const { error: e1 } = await (supabase as any)
        .from("production_orders")
        .update({
          status: "Confirmed",
          order_number: orderNum,
          batch_count: batchCount,
          batch_size_lbs: orderBatchSizeLbs,
          ...(calcJson ? { material_calc_json: calcJson } : {}),
        })
        .eq("id", order.id);
      if (e1) { setAdvancing(false); toast.error(e1.message); return; }

      // Close "Order Placed" stage event, record Confirmed as instant pass-through
      await (supabase as any)
        .from("order_stage_events")
        .update({ exited_at: now })
        .eq("order_id", order.id).eq("stage", "Order Placed").is("exited_at", null);

      await (supabase as any)
        .from("order_stage_events")
        .insert({ order_id: order.id, stage: "Confirmed", entered_at: now, exited_at: now, completed_by: user?.id ?? null });

      // Auto-advance to Sourcing
      const { error: e2 } = await (supabase as any)
        .from("production_orders")
        .update({ status: "Sourcing" })
        .eq("id", order.id);
      if (e2) { setAdvancing(false); toast.error(e2.message); return; }

      await (supabase as any)
        .from("order_stage_events")
        .insert({ order_id: order.id, stage: "Sourcing", entered_at: now, completed_by: user?.id ?? null });

      // Reserve inventory for JIT orders
      if (calcJson && order.order_type !== "tolling_external") {
        await reserveInventory(order.id, calcJson);
      }

      setAdvancing(false);
      setOrder(o => o ? {
        ...o,
        status: "Sourcing",
        order_number: orderNum,
        material_calc_json: calcJson,
        batch_count: batchCount,
        batch_size_lbs: orderBatchSizeLbs,
      } : o);
      toast.success("Order confirmed — materials estimated and inventory reserved");
      return;
    }

    // Confirmed → Sourcing: run calc if not already done
    if (order.status === "Confirmed") {
      let calcJson = order.material_calc_json;
      if (!calcJson) {
        try {
          calcJson = await runMaterialCalc(
            order.id,
            order.items.map(i => ({
              product_id: i.product_id,
              product_name: i.product_name,
              batch_sheet_id: i.batch_sheet_id,
              qty: i.qty,
              unit: i.unit as "units" | "cases" | "lbs",
            })),
            order.waste_pct ?? 10,
            (order.order_type ?? "jit") as "jit" | "tolling_warehoused" | "tolling_external",
            order.client_id,
          );
        } catch { toast.warning("Material estimate failed — advancing anyway"); }
      }
      const { error } = await (supabase as any)
        .from("production_orders")
        .update({ status: "Sourcing", ...(calcJson ? { material_calc_json: calcJson } : {}) })
        .eq("id", order.id);
      if (error) { setAdvancing(false); toast.error(error.message); return; }
      await (supabase as any).from("order_stage_events")
        .update({ exited_at: now }).eq("order_id", order.id).eq("stage", "Confirmed").is("exited_at", null);
      await (supabase as any).from("order_stage_events")
        .insert({ order_id: order.id, stage: "Sourcing", entered_at: now, completed_by: user?.id ?? null });
      setAdvancing(false);
      setOrder(o => o ? { ...o, status: "Sourcing", material_calc_json: calcJson } : o);
      toast.success("Materials estimated — moved to Sourcing");
      return;
    }

    // Block In Production unless at least 50% paid
    if (nextStage === "In Production" && order.payment_status !== "partial" && order.payment_status !== "paid") {
      setAdvancing(false);
      toast.error("50% deposit required before production — contact management.");
      return;
    }

    // Block shipping until fully paid
    if (nextStage === "Shipped" && order.payment_status !== "paid") {
      setAdvancing(false);
      toast.error("Full payment required before shipping — contact management.");
      return;
    }

    // Normal advance for all other stages
    const { error } = await (supabase as any)
      .from("production_orders")
      .update({ status: nextStage })
      .eq("id", order.id);

    if (error) { setAdvancing(false); toast.error(error.message); return; }

    await (supabase as any)
      .from("order_stage_events")
      .update({ exited_at: now })
      .eq("order_id", order.id).eq("stage", order.status).is("exited_at", null);

    await (supabase as any)
      .from("order_stage_events")
      .insert({ order_id: order.id, stage: nextStage, entered_at: now, completed_by: user?.id ?? null });

    setAdvancing(false);
    setOrder((o) => o ? { ...o, status: nextStage } : o);
    toast.success(order.status === "Sourcing" ? "Sourcing confirmed — ready to schedule" : `Moved to ${nextStage}`);
    } catch (err: any) {
      setAdvancing(false);
      toast.error(`Error: ${err?.message ?? String(err)}`);
      console.error("advance() error:", err);
    }
  };

  const saveBatchEdit = async () => {
    if (!order) return;
    const count = Math.max(1, parseInt(batchCountDraft) || 1);
    const size  = Math.max(1, parseFloat(batchSizeDraft) || DEFAULT_BATCH_SIZE);
    const { error } = await (supabase as any)
      .from("production_orders")
      .update({ batch_count: count, batch_size_lbs: size })
      .eq("id", order.id);
    if (error) { toast.error(error.message); return; }
    setOrder(o => o ? { ...o, batch_count: count, batch_size_lbs: size } : o);
    setBatchEditOpen(false);
    toast.success("Batch plan updated");
  };

  const rerunEstimate = async () => {
    if (!order || !Array.isArray(order.items) || order.items.length === 0) return;
    setRerunning(true);
    try {
      const calcJson = await runMaterialCalc(
        order.id,
        order.items.map(i => ({
          product_id: i.product_id,
          product_name: i.product_name,
          batch_sheet_id: i.batch_sheet_id,
          qty: i.qty,
          unit: i.unit as "units" | "cases" | "lbs",
        })),
        order.waste_pct ?? 10,
        (order.order_type ?? "jit") as "jit" | "tolling_warehoused" | "tolling_external",
        order.client_id,
      );
      const { error } = await (supabase as any)
        .from("production_orders")
        .update({ material_calc_json: calcJson })
        .eq("id", order.id);
      if (error) { toast.error(error.message); return; }

      // Replace reservations with fresh numbers — scoped to this order only
      const { error: delErr } = await (supabase as any)
        .from("inventory_reservations")
        .delete()
        .eq("order_id", order.id);
      if (delErr) { toast.error(`Could not clear old reservations: ${delErr.message}`); return; }

      const reserveErr = await reserveInventory(order.id, calcJson);
      if (reserveErr) {
        toast.warning(`Estimate saved but reservations skipped: ${reserveErr}`);
      } else {
        toast.success("Estimate updated — inventory reservations refreshed");
      }

      setOrder(o => o ? { ...o, material_calc_json: calcJson } : o);
    } catch (err: any) {
      toast.error(`Calc failed: ${err?.message ?? String(err)}`);
    } finally {
      setRerunning(false);
    }
  };

  const saveNotes = async () => {
    if (!order) return;
    setSavingNotes(true);
    const { error } = await (supabase as any)
      .from("production_orders")
      .update({ notes: notesDraft || null })
      .eq("id", order.id);
    setSavingNotes(false);
    if (error) { toast.error(error.message); return; }
    setOrder(o => o ? { ...o, notes: notesDraft || null } : o);
    toast.success("Notes saved");
  };

  if (!order) return (
    <TeamPage title="Loading…" eyebrow="Operations">
      <p className="text-sm text-[hsl(var(--tp-text-dim))]">Loading order…</p>
    </TeamPage>
  );

  const showStationCards = isManagement || order.status === "In Production";

  return (
    <TeamPage
      eyebrow="Operations"
      title={clientName || "Order"}
      titleNode={
        <span className="flex items-center gap-4 flex-wrap">
          <span className="font-display text-3xl md:text-4xl tp-h1-underline text-[hsl(var(--tp-text))]">
            {clientName || "Order"}
          </span>
          {order.order_number && (
            <span className="inline-flex items-center px-3 py-1 rounded-md bg-neutral-900 text-white text-base font-bold tracking-widest shadow">
              {order.order_number}
            </span>
          )}
        </span>
      }
      description={`Created ${new Date(order.created_at).toLocaleDateString()}`}
      actions={
        <div className="flex items-center gap-3 flex-wrap">
          <Link to="/team/ops/orders" className="tp-btn">
            <ArrowLeft className="w-4 h-4" /> Back to Board
          </Link>
          {nextStage && (
            <Button onClick={advance} disabled={advancing} className="gap-2">
              {advancing
                ? <><Loader2 className="w-4 h-4 animate-spin" /> Working…</>
                : <>{buttonLabel} <ArrowRight className="w-4 h-4" /></>}
            </Button>
          )}
          {!nextStage && order.status === "Shipped" && (
            <span className="text-sm text-[hsl(var(--tp-text-dim))] italic">Order complete</span>
          )}
        </div>
      }
    >
      {/* Stage progress bar */}
      <div className="tp-surface p-4 mb-6">
        <div className="flex items-center gap-1 overflow-x-auto">
          {STAGES.map((s, i) => {
            const passed = i < currentIdx;
            const active = i === currentIdx;
            return (
              <div key={s} className="flex items-center gap-1 shrink-0">
                <div className={`px-3 py-1.5 rounded text-[11px] font-medium whitespace-nowrap
                  ${active ? "bg-[hsl(var(--tp-gold))] text-black" : ""}
                  ${passed ? "bg-[hsl(var(--tp-gold))]/20 text-[hsl(var(--tp-text-dim))]" : ""}
                  ${!active && !passed ? "text-[hsl(var(--tp-text-dim))]" : ""}
                `}>
                  {s}
                </div>
                {i < STAGES.length - 1 && (
                  <div className={`w-4 h-px shrink-0 ${i < currentIdx ? "bg-[hsl(var(--tp-gold))]/40" : "bg-[hsl(var(--tp-hairline))]"}`} />
                )}
              </div>
            );
          })}
        </div>
      </div>

      <div className="grid md:grid-cols-2 gap-6">
        {/* Products + station card links */}
        <div className="tp-surface p-6">
          <p className="text-[11px] uppercase tracking-[0.14em] text-[hsl(var(--tp-text-dim))] mb-4">Products</p>
          {Array.isArray(order.items) && order.items.length > 0 ? (
            <div className="divide-y divide-[hsl(var(--tp-hairline))]">
              {order.items.map((item) => (
                <div key={item.product_id} className="flex items-center justify-between py-2.5">
                  <p className="text-sm text-[hsl(var(--tp-text))]">{item.product_name}</p>
                  <span className="text-sm font-medium text-[hsl(var(--tp-text-dim))] shrink-0 ml-4">
                    {item.qty} {item.unit}
                  </span>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm italic text-[hsl(var(--tp-text-dim))]">No products listed.</p>
          )}

          {/* Station cards — appear once order is past Order Placed */}
          {order.status !== "Order Placed" && (
            <div className="mt-4 pt-4 border-t border-[hsl(var(--tp-hairline))]">
              <p className="text-[11px] uppercase tracking-[0.14em] text-[hsl(var(--tp-text-dim))] mb-2">Station Cards</p>
              <div className="flex flex-wrap gap-2">
                {showStationCards ? (
                  <>
                    <Link
                      to={`/team/ops/orders/${order.id}/station/measuring`}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded border border-[hsl(var(--tp-hairline))] text-xs text-[hsl(var(--tp-text))] hover:border-[hsl(var(--tp-gold))]/50 hover:bg-[hsl(var(--tp-gold))]/5 transition-colors"
                    >
                      <FlaskConical className="w-3.5 h-3.5 text-[hsl(var(--tp-gold))]" />
                      Measuring
                    </Link>
                    {isManagement && order.batch_count && (
                      <button
                        onClick={() => {
                          setBatchCountDraft(String(order.batch_count ?? 1));
                          setBatchSizeDraft(String(order.batch_size_lbs ?? DEFAULT_BATCH_SIZE));
                          setBatchEditOpen(true);
                        }}
                        className="flex items-center gap-1 px-2 py-1.5 text-xs text-[hsl(var(--tp-text-dim))] hover:text-[hsl(var(--tp-text))]"
                      >
                        <Pencil className="w-3 h-3" />
                        {order.batch_count} batch{order.batch_count !== 1 ? "es" : ""} × {order.batch_size_lbs} lbs
                      </button>
                    )}
                  </>
                ) : (
                  <span className="text-xs text-[hsl(var(--tp-text-dim))] italic">Available on production day</span>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Details */}
        <div className="tp-surface p-6">
          <p className="text-[11px] uppercase tracking-[0.14em] text-[hsl(var(--tp-text-dim))] mb-4">Details</p>
          <dl className="space-y-3 text-sm">
            <div className="flex justify-between">
              <dt className="text-[hsl(var(--tp-text-dim))]">Client</dt>
              <dd className="text-[hsl(var(--tp-text))]">{clientName}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-[hsl(var(--tp-text-dim))]">Stage</dt>
              <dd className="text-[hsl(var(--tp-text))]">{order.status}</dd>
            </div>
            <div className="flex justify-between items-center">
              <dt className="text-[hsl(var(--tp-text-dim))]">Ingredient type</dt>
              <dd>
                <select
                  className="tp-input text-sm"
                  value={order.order_type ?? "jit"}
                  onChange={async (e) => {
                    const val = e.target.value;
                    const { error } = await (supabase as any)
                      .from("production_orders")
                      .update({ order_type: val })
                      .eq("id", order.id);
                    if (error) { toast.error(error.message); return; }
                    setOrder((prev: any) => ({ ...prev, order_type: val }));
                    toast.success("Ingredient type updated");
                  }}
                >
                  <option value="jit">JIT</option>
                  <option value="tolling_warehoused">Tolling (warehoused)</option>
                  <option value="tolling_external">Tolling (external)</option>
                </select>
              </dd>
            </div>
            {isManagement && (
              <div className="flex justify-between items-center">
                <dt className="text-[hsl(var(--tp-text-dim))]">Payment</dt>
                <dd>
                  <select
                    className="tp-input text-sm"
                    value={order.payment_status ?? "pending"}
                    onChange={async (e) => {
                      const val = e.target.value;
                      const { error } = await (supabase as any)
                        .from("production_orders")
                        .update({ payment_status: val })
                        .eq("id", order.id);
                      if (error) { toast.error(error.message); return; }
                      setOrder((prev: any) => ({ ...prev, payment_status: val }));
                      toast.success("Payment status updated");
                    }}
                  >
                    <option value="pending">Pending</option>
                    <option value="partial">50% Paid</option>
                    <option value="paid">100% Paid</option>
                    <option value="overdue">Overdue</option>
                  </select>
                </dd>
              </div>
            )}
            <div className="flex justify-between">
              <dt className="text-[hsl(var(--tp-text-dim))]">Ship to</dt>
              <dd className="text-[hsl(var(--tp-text))]">
                {order.ship_to_kind === "ab_warehouse" ? "AB Warehouse" : "Client address"}
              </dd>
            </div>
            {order.case_count > 0 && (
              <div className="flex justify-between">
                <dt className="text-[hsl(var(--tp-text-dim))]">Cases</dt>
                <dd className="text-[hsl(var(--tp-text))]">{order.case_count}</dd>
              </div>
            )}
          </dl>
        </div>
      </div>

      {/* Material Estimate — show whenever calc data exists */}
      {order.material_calc_json && (
        <div className="tp-surface p-6 mt-6">
          <div className="flex items-center justify-between mb-3 gap-4">
            <p className="text-[11px] uppercase tracking-[0.14em] text-[hsl(var(--tp-text-dim))]">
              Material Estimate
              {order.order_type === "tolling_external" && (
                <span className="ml-2 text-amber-700 normal-case tracking-normal font-normal">
                  — send this list to client
                </span>
              )}
            </p>
          </div>

          <MaterialCalcResults calc={order.material_calc_json} onRerun={rerunEstimate} rerunning={rerunning} />
        </div>
      )}

      {/* Notes */}
      <div className="tp-surface p-6 mt-6">
        <p className="text-[11px] uppercase tracking-[0.14em] text-[hsl(var(--tp-text-dim))] mb-3">Notes</p>
        <textarea
          value={notesDraft}
          onChange={e => setNotesDraft(e.target.value)}
          rows={3}
          placeholder="Internal notes for this order…"
          className="w-full rounded border bg-background p-2 text-sm resize-none"
        />
        <div className="flex justify-end mt-2">
          <button
            onClick={saveNotes}
            disabled={savingNotes || notesDraft === (order.notes || "")}
            className="tp-btn tp-btn-primary text-xs disabled:opacity-40"
          >
            {savingNotes ? "Saving…" : "Save notes"}
          </button>
        </div>
      </div>

      {/* Batch Edit Modal */}
      {batchEditOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60">
          <div className="bg-background border border-[hsl(var(--tp-hairline))] rounded-xl p-6 w-full max-w-sm shadow-2xl">
            <p className="text-base font-semibold text-[hsl(var(--tp-text))] mb-1">Edit batch plan</p>
            <p className="text-sm text-[hsl(var(--tp-text-dim))] mb-5">
              Adjust the batch count or size for this production run.
            </p>
            <div className="space-y-4">
              <div>
                <label className="text-xs uppercase tracking-wider text-[hsl(var(--tp-text-dim))] block mb-1">
                  Number of batches
                </label>
                <input
                  type="number" min={1} max={50}
                  value={batchCountDraft}
                  onChange={e => setBatchCountDraft(e.target.value)}
                  className="w-full h-10 rounded border border-[hsl(var(--tp-hairline))] bg-background px-3 text-sm text-[hsl(var(--tp-text))] focus:border-[hsl(var(--tp-gold))] outline-none"
                />
              </div>
              <div>
                <label className="text-xs uppercase tracking-wider text-[hsl(var(--tp-text-dim))] block mb-1">
                  Batch size (lbs)
                </label>
                <input
                  type="number" min={1} step={0.5}
                  value={batchSizeDraft}
                  onChange={e => setBatchSizeDraft(e.target.value)}
                  className="w-full h-10 rounded border border-[hsl(var(--tp-hairline))] bg-background px-3 text-sm text-[hsl(var(--tp-text))] focus:border-[hsl(var(--tp-gold))] outline-none"
                />
              </div>
            </div>
            <div className="flex justify-end gap-3 mt-6">
              <button
                onClick={() => setBatchEditOpen(false)}
                className="tp-btn text-sm"
              >
                Cancel
              </button>
              <button
                onClick={saveBatchEdit}
                className="tp-btn tp-btn-primary text-sm"
              >
                Save
              </button>
            </div>
          </div>
        </div>
      )}
    </TeamPage>
  );
}
