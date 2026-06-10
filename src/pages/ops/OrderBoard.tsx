import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { TeamPage, KpiTile } from "@/components/team/TeamPage";
import { NewOrderDialog } from "@/components/ops/NewOrderDialog";
import { Button } from "@/components/ui/button";
import { Plus, AlertTriangle, ArrowRight, Loader2, CheckCircle2, X } from "lucide-react";
import { toast } from "sonner";
import { runMaterialCalc } from "@/lib/materialCalc";
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

const STAGE_COLOR: Record<Stage, string> = {
  "Order Placed": "bg-slate-400",
  "Confirmed":    "bg-blue-400",
  "Sourcing":     "bg-violet-400",
  "Scheduled":    "bg-amber-400",
  "In Production":"bg-orange-400",
  "Shipped":      "bg-green-400",
};

interface StageEvent {
  order_id: string;
  stage: string;
  entered_at: string;
  exited_at: string | null;
}

interface OrderItem {
  product_id: string;
  product_name: string;
  qty: number;
  unit: string;
}

interface Order {
  id: string;
  status: Stage;
  client_id: string;
  items: OrderItem[];
  created_at: string;
  target_completion_date: string | null;
  scheduled_date: string | null;
  schedule_confirmed: boolean;
  payment_status: string;
  case_count: number;
  order_type: string;
  clientName?: string;
  stageEvents?: StageEvent[];
}

// ─── helpers ──────────────────────────────────────────────────────────────────

const daysBetween = (a: string, b: string | null) =>
  Math.max(0, Math.floor(((b ? new Date(b) : new Date()).getTime() - new Date(a).getTime()) / 86400000));

const fmtDate = (iso: string) =>
  new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric" });

const fmtDay = (d: Date) =>
  d.toLocaleDateString("en-US", { month: "short", day: "numeric" });

const isSameDay = (a: Date, b: Date) =>
  a.getFullYear() === b.getFullYear() &&
  a.getMonth() === b.getMonth() &&
  a.getDate() === b.getDate();

const productNames = (o: Order) =>
  Array.isArray(o.items) ? o.items.map(i => i.product_name).join(", ") : "—";

const stageAgeDays = (o: Order): number => {
  const ev = o.stageEvents?.find(e => e.stage === o.status && !e.exited_at);
  if (!ev) return daysBetween(o.created_at, null);
  return daysBetween(ev.entered_at, null);
};

// ─── calendar helpers ─────────────────────────────────────────────────────────

const getCalendarWeeks = (): Date[][] => {
  const today = new Date();
  const monday = new Date(today);
  monday.setDate(today.getDate() - ((today.getDay() + 6) % 7));
  monday.setHours(0, 0, 0, 0);
  return Array.from({ length: 4 }, (_, w) =>
    Array.from({ length: 5 }, (_, d) => {
      const day = new Date(monday);
      day.setDate(monday.getDate() + w * 7 + d);
      return day;
    })
  );
};

// ─── scheduling helpers ────────────────────────────────────────────────────────

const MAX_BATCH_SIZE_LBS = 121; // 110 lbs + 10% variance ceiling

function firstWeekdayFromNow(weeksOut: number): Date {
  const d = new Date();
  d.setDate(d.getDate() + weeksOut * 7);
  while (d.getDay() === 0 || d.getDay() === 6) d.setDate(d.getDate() + 1);
  return d;
}

function suggestBatchCount(productionLbs: number): number {
  return Math.max(1, Math.ceil(productionLbs / MAX_BATCH_SIZE_LBS));
}

function calcBatchSize(productionLbs: number, batchCount: number): number {
  return Math.round((productionLbs / batchCount) * 10) / 10;
}

function calcDaysNeeded(batchCount: number, maxPerDay: number): number {
  return Math.ceil(batchCount / maxPerDay) + 1; // +1 for packaging day
}

function fmtScheduleDate(d: Date): string {
  return d.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" });
}

// ─── confirm dialog state ─────────────────────────────────────────────────────

interface ConfirmDraft {
  order: Order;
  orderNum: string;
  productionLbs: number;
  wastePct: number;
  maxBatchesPerDay: number;
  batchCount: number;
  startDate: Date;
  calcJson: any;
}

// ─── component ────────────────────────────────────────────────────────────────

export default function OrderBoard() {
  const navigate = useNavigate();
  const { role } = useUserRole();
  const isManagement = role === "admin" || role === "owner";
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [confirmingId, setConfirmingId] = useState<string | null>(null);
  const [confirmDraft, setConfirmDraft] = useState<ConfirmDraft | null>(null);
  const [finalizing, setFinalizing] = useState(false);
  const weeks = useMemo(() => getCalendarWeeks(), []);
  const today = useMemo(() => new Date(), []);

  const load = async () => {
    setLoading(true);
    const [{ data: ordersData }, { data: eventsData }] = await Promise.all([
      (supabase as any)
        .from("production_orders")
        .select("id, status, client_id, items, created_at, target_completion_date, scheduled_date, schedule_confirmed, payment_status, case_count, order_type")
        .neq("status", "Archived")
        .order("created_at", { ascending: true }),
      (supabase as any)
        .from("order_stage_events")
        .select("order_id, stage, entered_at, exited_at")
        .order("entered_at", { ascending: true }),
    ]);

    const rows = (ordersData ?? []) as Order[];
    const events = (eventsData ?? []) as StageEvent[];

    const clientIds = [...new Set(rows.map(r => r.client_id).filter(Boolean))];
    let nameMap: Record<string, string> = {};
    if (clientIds.length) {
      const { data: leads } = await (supabase as any)
        .from("sales_leads")
        .select("profile_id, company_name, email")
        .in("profile_id", clientIds);
      for (const l of leads ?? [])
        nameMap[l.profile_id] = l.company_name || l.email || l.profile_id;
    }

    const eventsByOrder: Record<string, StageEvent[]> = {};
    for (const e of events) {
      if (!eventsByOrder[e.order_id]) eventsByOrder[e.order_id] = [];
      eventsByOrder[e.order_id].push(e);
    }

    setOrders(rows.map(o => ({
      ...o,
      clientName: nameMap[o.client_id] ?? "Unknown",
      stageEvents: eventsByOrder[o.id] ?? [],
    })));
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const goTo = (id: string) => navigate(`/team/ops/orders/${id}`);

  // Opens the confirmation dialog — fetches batch sheet data first
  const openConfirmDialog = async (o: Order, e: React.MouseEvent) => {
    e.stopPropagation();
    setConfirmingId(o.id);
    try {
      // Generate order number
      const name = o.clientName || "";
      const initials = name.trim().split(/\s+/).filter(Boolean).slice(0, 3).map(w => w[0].toUpperCase()).join("") || "AB";
      const d = new Date();
      const orderNum = `${initials}-${String(d.getMonth() + 1).padStart(2, "0")}${String(d.getDate()).padStart(2, "0")}${String(d.getFullYear()).slice(-2)}`;

      // Fetch batch sheet for first item with a batch_sheet_id to get waste_pct + max_batches_per_day
      const firstSheetId = (o.items ?? []).find(i => (i as any).batch_sheet_id)?.batch_sheet_id as string | undefined;
      let wastePct = 10;
      let maxBatchesPerDay = 2;
      if (firstSheetId) {
        const { data: sheet } = await (supabase as any)
          .from("batch_sheets").select("data_json").eq("id", firstSheetId).maybeSingle();
        if (sheet?.data_json?.production_notes?.waste_pct != null)
          wastePct = Number(sheet.data_json.production_notes.waste_pct);
        if (sheet?.data_json?.production_notes?.max_batches_per_day != null)
          maxBatchesPerDay = Number(sheet.data_json.production_notes.max_batches_per_day);
      }

      // Run material calc with correct waste %
      let calcJson: any = null;
      try {
        calcJson = await runMaterialCalc(
          o.id,
          (o.items ?? []).map((i: any) => ({
            product_id: i.product_id,
            product_name: i.product_name,
            batch_sheet_id: i.batch_sheet_id,
            qty: i.qty,
            unit: i.unit as "units" | "cases" | "lbs",
          })),
          wastePct,
          "jit",
          o.client_id,
        );
      } catch { /* continue anyway */ }

      const productionLbs = calcJson?.products?.reduce((s: number, p: any) => s + (p.production_lbs ?? 0), 0) ?? 0;
      const suggested = suggestBatchCount(productionLbs);

      setConfirmDraft({
        order: o,
        orderNum,
        productionLbs,
        wastePct,
        maxBatchesPerDay,
        batchCount: suggested,
        startDate: firstWeekdayFromNow(2),
        calcJson,
      });
    } catch (err: any) {
      toast.error(`Error: ${err?.message ?? String(err)}`);
    } finally {
      setConfirmingId(null);
    }
  };

  // Commits the production order after manager reviews dialog
  const finalizeConfirm = async () => {
    if (!confirmDraft) return;
    const { order: o, orderNum, batchCount, startDate, calcJson, wastePct } = confirmDraft;
    setFinalizing(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      const now = new Date().toISOString();
      const scheduledDateStr = startDate.toISOString().slice(0, 10);
      const batchSize = calcBatchSize(confirmDraft.productionLbs, batchCount);

      // Update order: status Scheduled, save number + calc + batch info
      await (supabase as any).from("production_orders").update({
        status: "Scheduled",
        order_number: orderNum,
        scheduled_date: scheduledDateStr,
        batch_count: batchCount,
        batch_size_lbs: batchSize,
        schedule_confirmed: false, // manager still needs to sign off
        ...(calcJson ? { material_calc_json: calcJson } : {}),
      }).eq("id", o.id);

      // Stage events: Order Placed → Confirmed → Sourcing → Scheduled
      await (supabase as any).from("order_stage_events")
        .update({ exited_at: now }).eq("order_id", o.id).eq("stage", "Order Placed").is("exited_at", null);
      await (supabase as any).from("order_stage_events").insert([
        { order_id: o.id, stage: "Confirmed", entered_at: now, exited_at: now, completed_by: user?.id ?? null },
        { order_id: o.id, stage: "Sourcing",  entered_at: now, exited_at: now, completed_by: user?.id ?? null },
        { order_id: o.id, stage: "Scheduled", entered_at: now, completed_by: user?.id ?? null },
      ]);

      // Reserve available inventory
      if (calcJson) {
        const rows = (calcJson.summary?.ingredients ?? [])
          .filter((ing: any) => ing.on_hand_lbs > 0)
          .map((ing: any) => ({
            order_id: o.id,
            ingredient_name: ing.name,
            reserved_lbs: Math.min(ing.total_need_lbs, ing.on_hand_lbs),
          }));
        if (rows.length > 0)
          await (supabase as any).from("inventory_reservations").insert(rows);
      }

      // Create production_batches rows
      const batchInserts = Array.from({ length: batchCount }, (_, i) => ({
        order_id: o.id,
        batch_sheet_id: (o.items as any[])?.[0]?.batch_sheet_id ?? null,
        product_name: o.items?.[0]?.product_name ?? "",
        batch_date: scheduledDateStr,
        target_batch_size_lbs: batchSize,
        status: "Scheduled",
      }));
      await (supabase as any).from("production_batches").insert(batchInserts);

      // Auto-seed tolling inventory — only for tolling orders; skip existing ingredients
      if ((o.order_type === "tolling_warehoused" || o.order_type === "tolling_external") && calcJson && o.client_id) {
        const ingredientNames = (calcJson.summary?.ingredients ?? []).map((i: any) => i.name);
        if (ingredientNames.length) {
          const { data: existing } = await (supabase as any)
            .from("inventory_tolling")
            .select("ingredient_name")
            .eq("client_id", o.client_id)
            .in("ingredient_name", ingredientNames);
          const existingSet = new Set((existing ?? []).map((r: any) => r.ingredient_name.toLowerCase().trim()));
          const toInsert = (calcJson.summary.ingredients as any[])
            .filter((ing: any) => !existingSet.has(ing.name.toLowerCase().trim()))
            .map((ing: any) => ({ client_id: o.client_id, ingredient_name: ing.name, qty_on_hand: 0, unit: "lbs" }));
          if (toInsert.length)
            await (supabase as any).from("inventory_tolling").insert(toInsert);
        }
      }

      toast.success(`${o.clientName} scheduled — ${batchCount} batch${batchCount !== 1 ? "es" : ""} starting ${fmtScheduleDate(startDate)}`);
      setConfirmDraft(null);
      await load();
    } catch (err: any) {
      toast.error(`Error: ${err?.message ?? String(err)}`);
    } finally {
      setFinalizing(false);
    }
  };

  // Manager sign-off: marks schedule_confirmed = true
  const signOffSchedule = async (orderId: string) => {
    await (supabase as any).from("production_orders")
      .update({ schedule_confirmed: true }).eq("id", orderId);
    await load();
    toast.success("Production plan signed off");
  };

  // ─── derived ───────────────────────────────────────────────────────────────

  const inQueue   = orders.filter(o => ["Order Placed", "Confirmed", "Sourcing"].includes(o.status));
  const scheduled = orders.filter(o => o.status === "Scheduled");
  const onFloor   = orders.filter(o => o.status === "In Production");
  const shippedMo = orders.filter(o => {
    if (o.status !== "Shipped") return false;
    const d = new Date(o.created_at);
    return d.getMonth() === today.getMonth() && d.getFullYear() === today.getFullYear();
  });

  const pendingConfirmation = orders.filter(o => o.status === "Order Placed");
  const pendingSignOff = orders.filter(o => o.status === "Scheduled" && !o.schedule_confirmed);

  const hotTopics = orders.filter(o => {
    // Awaiting payment but already in active production stages
    const activeStages = ["Confirmed", "Sourcing", "Scheduled", "In Production"];
    if (o.payment_status === "pending" && activeStages.includes(o.status)) return true;
    // ETA at risk — target date within 7 days and not yet shipped
    if (o.target_completion_date && o.status !== "Shipped") {
      const days = Math.floor((new Date(o.target_completion_date).getTime() - today.getTime()) / 86400000);
      if (days <= 7) return true;
    }
    // Stuck in same stage > 14 days
    if (stageAgeDays(o) > 14) return true;
    return false;
  });

  const hotReason = (o: Order): string => {
    const reasons: string[] = [];
    const activeStages = ["Confirmed", "Sourcing", "Scheduled", "In Production"];
    if (o.payment_status === "pending" && activeStages.includes(o.status))
      reasons.push("Awaiting payment release");
    if (o.target_completion_date && o.status !== "Shipped") {
      const days = Math.floor((new Date(o.target_completion_date).getTime() - today.getTime()) / 86400000);
      if (days <= 7)
        reasons.push(days < 0 ? `Past target date (${fmtDate(o.target_completion_date)})` : `Target date in ${days}d (${fmtDate(o.target_completion_date)})`);
    }
    const age = stageAgeDays(o);
    if (age > 14) reasons.push(`${age}d in ${o.status}`);
    return reasons.join(" · ");
  };

  // ─── render ────────────────────────────────────────────────────────────────

  return (
    <TeamPage
      eyebrow="Operations"
      title="Order Board"
      actions={
        <Button onClick={() => setDialogOpen(true)} size="sm" className="gap-1.5">
          <Plus className="w-4 h-4" /> New Order
        </Button>
      }
    >
      {/* KPI strip */}
      <div className="grid grid-cols-4 gap-4 mb-6">
        <KpiTile label="In Queue"      value={inQueue.length} />
        <KpiTile label="Scheduled"     value={scheduled.length} />
        <KpiTile label="On Floor"      value={onFloor.length} />
        <KpiTile label="Shipped / Mo." value={shippedMo.length} />
      </div>

      {/* Pending Review strip — compact, above calendar */}
      {pendingConfirmation.length > 0 && (
        <div className="mb-5">
          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-white mb-2">
            Pending Confirmation
          </p>
          <div className="tp-surface flex flex-wrap gap-2 p-3">
            {pendingConfirmation.map(o => (
              <div key={o.id} className="flex items-center gap-2 border border-[hsl(var(--tp-hairline))] rounded-lg px-3 py-2 bg-[hsl(var(--tp-surface-2))]">
                <button onClick={() => goTo(o.id)} className="text-sm font-medium text-[hsl(var(--tp-text))] hover:text-[hsl(var(--tp-gold))] transition-colors">
                  {o.clientName}
                </button>
                <span className="text-[hsl(var(--tp-hairline))]">·</span>
                <button
                  onClick={(e) => openConfirmDialog(o, e)}
                  disabled={confirmingId === o.id}
                  className="flex items-center gap-1 text-xs font-semibold text-[hsl(var(--tp-gold))] hover:opacity-80 disabled:opacity-40 transition-opacity"
                >
                  {confirmingId === o.id
                    ? <><Loader2 className="w-3 h-3 animate-spin" /> Working…</>
                    : <>Confirm <ArrowRight className="w-3 h-3" /></>}
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Calendar — full width */}
      <div className="mb-6">
        <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-white mb-3">
          Production Schedule
        </p>
        <div className="tp-surface overflow-hidden">
          <div className="grid grid-cols-5 border-b border-[hsl(var(--tp-hairline))]">
            {["Mon", "Tue", "Wed", "Thu", "Fri"].map(d => (
              <div key={d} className="py-2 text-center text-[10px] font-semibold uppercase tracking-[0.12em] text-[hsl(var(--tp-text-dim))]">
                {d}
              </div>
            ))}
          </div>
          {weeks.map((week, wi) => (
            <div key={wi} className="grid grid-cols-5 border-b border-[hsl(var(--tp-hairline))] last:border-0">
              {week.map((day, di) => {
                const isToday = isSameDay(day, today);
                const isPast  = day < today && !isToday;
                const dayOrders = orders.filter(o =>
                  o.scheduled_date && isSameDay(new Date(o.scheduled_date), day)
                );
                return (
                  <div
                    key={di}
                    className={`min-h-[72px] p-2 border-r border-[hsl(var(--tp-hairline))] last:border-0
                      ${isToday ? "bg-[hsl(var(--tp-gold))]/8" : ""}
                      ${isPast  ? "opacity-50" : ""}
                    `}
                  >
                    <p className={`text-[10px] mb-1.5 font-medium
                      ${isToday ? "text-[hsl(var(--tp-gold))]" : "text-[hsl(var(--tp-text-dim))]"}
                    `}>
                      {fmtDay(day)}
                    </p>
                    <div className="space-y-1">
                      {dayOrders.map(o => (
                        <button
                          key={o.id}
                          onClick={() => goTo(o.id)}
                          className={`w-full text-left text-[11px] leading-snug px-1.5 py-1 rounded
                            ${o.schedule_confirmed
                              ? "bg-[hsl(var(--tp-gold))]/15 text-[hsl(var(--tp-text))] font-medium"
                              : "text-[hsl(var(--tp-text-dim))] italic border border-dashed border-[hsl(var(--tp-hairline))]"
                            }
                          `}
                        >
                          <span className="truncate block">{o.clientName}</span>
                          <span className="truncate block text-[10px] opacity-70">{productNames(o)}</span>
                        </button>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          ))}
        </div>
      </div>

      {/* Hot Topics */}
      {hotTopics.length > 0 && (
        <div className="mb-8">
          <div className="flex items-center gap-2 mb-4">
            <div className="flex items-center gap-2 bg-red-600 text-white px-3 py-1 rounded-full">
              <AlertTriangle className="w-3.5 h-3.5" />
              <span className="text-xs font-semibold uppercase tracking-[0.18em]">Hot Topics</span>
              <span className="text-xs font-bold">{hotTopics.length}</span>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            {hotTopics.map(o => (
              <button
                key={o.id}
                onClick={() => goTo(o.id)}
                className="group tp-surface text-left p-4 hover:bg-red-600 transition-colors border border-red-500/30 hover:border-red-600 rounded-lg flex items-start gap-3"
              >
                <div className="w-2 h-2 rounded-full bg-red-400 group-hover:bg-white mt-1 shrink-0" />
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-[hsl(var(--tp-text))] group-hover:text-white truncate">{o.clientName}</p>
                  <p className="text-[11px] text-[hsl(var(--tp-text-dim))] group-hover:text-white/80 truncate mt-0.5">{productNames(o)}</p>
                  <p className="text-[11px] text-red-400 group-hover:text-white mt-1.5 leading-snug">{hotReason(o)}</p>
                </div>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Pipeline tracker */}
      <div>
        <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-white mb-3">
          Production Pipeline
        </p>
        {loading ? (
          <p className="text-sm text-[hsl(var(--tp-text-dim))] py-4">Loading…</p>
        ) : orders.length === 0 ? (
          <p className="text-sm italic text-[hsl(var(--tp-text-dim))] py-4">No active orders.</p>
        ) : (
          <div className="tp-surface overflow-x-auto">
            <table className="w-full text-sm border-collapse">
              <thead>
                <tr className="border-b border-[hsl(var(--tp-hairline))]">
                  <th className="text-left py-2.5 px-4 text-[10px] uppercase tracking-[0.14em] text-[hsl(var(--tp-text-dim))] font-semibold w-[200px]">
                    Order
                  </th>
                  {STAGES.map(s => (
                    <th key={s} className="text-center py-2.5 px-2 text-[10px] uppercase tracking-[0.12em] text-[hsl(var(--tp-text-dim))] font-semibold whitespace-nowrap">
                      {s}
                    </th>
                  ))}
                  <th className="text-right py-2.5 px-4 text-[10px] uppercase tracking-[0.14em] text-[hsl(var(--tp-text-dim))] font-semibold">
                    Target
                  </th>
                </tr>
              </thead>
              <tbody>
                {orders.map((order, i) => {
                  const currentIdx = STAGES.indexOf(order.status);
                  const isHot = hotTopics.some(h => h.id === order.id);
                  return (
                    <tr
                      key={order.id}
                      onClick={() => goTo(order.id)}
                      className={`border-b border-[hsl(var(--tp-hairline))] cursor-pointer hover:bg-white/5 transition-colors
                        ${isHot ? "bg-red-500/5" : i % 2 !== 0 ? "bg-white/[0.02]" : ""}
                      `}
                    >
                      <td className="py-3 px-4">
                        <p className={`font-medium leading-tight ${isHot ? "text-red-300" : "text-[hsl(var(--tp-text))]"}`}>
                          {order.clientName}
                        </p>
                        <p className="text-[11px] text-[hsl(var(--tp-text-dim))] leading-tight mt-0.5 truncate max-w-[180px]">
                          {productNames(order)}
                        </p>
                      </td>
                      {STAGES.map((stage, si) => {
                        const event = order.stageEvents?.find(e => e.stage === stage);
                        const isActive = si === currentIdx;
                        const isPast   = si < currentIdx;
                        const dur = event ? daysBetween(event.entered_at, event.exited_at) : null;
                        return (
                          <td key={stage} className="py-3 px-2 text-center align-middle">
                            {(isPast || isActive) ? (
                              <div className="flex flex-col items-center gap-0.5">
                                <div className={`w-2.5 h-2.5 rounded-full ${STAGE_COLOR[stage]} ${isActive ? "ring-2 ring-white/30 scale-110" : "opacity-60"}`} />
                                {event && (
                                  <span className="text-[9px] text-[hsl(var(--tp-text-dim))] leading-none">
                                    {fmtDate(event.entered_at)}
                                  </span>
                                )}
                                {dur !== null && event?.exited_at && (
                                  <span className="text-[9px] text-[hsl(var(--tp-text-dim))] opacity-60 leading-none">
                                    {dur}d
                                  </span>
                                )}
                              </div>
                            ) : (
                              <div className="w-2.5 h-2.5 rounded-full bg-white/10 mx-auto" />
                            )}
                          </td>
                        );
                      })}
                      <td className="py-3 px-4 text-right">
                        {order.target_completion_date ? (
                          <span className="text-xs font-medium text-red-400">
                            {fmtDate(order.target_completion_date)}
                          </span>
                        ) : (
                          <span className="text-[11px] text-[hsl(var(--tp-text-dim))]">—</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Pending Manager Sign-off — admin/owner only */}
      {isManagement && pendingSignOff.length > 0 && (
        <div className="mb-8">
          <div className="flex items-center gap-2 mb-3">
            <div className="flex items-center gap-2 bg-[hsl(var(--tp-gold))] text-black px-3 py-1 rounded-full">
              <CheckCircle2 className="w-3.5 h-3.5" />
              <span className="text-xs font-semibold uppercase tracking-[0.18em]">Pending Sign-off</span>
              <span className="text-xs font-bold">{pendingSignOff.length}</span>
            </div>
          </div>
          <div className="tp-surface divide-y divide-[hsl(var(--tp-hairline))]">
            {pendingSignOff.map(o => (
              <div key={o.id} className="px-4 py-3 flex items-center gap-4">
                <div className="flex-1 min-w-0 cursor-pointer" onClick={() => goTo(o.id)}>
                  <p className="text-sm font-medium text-[hsl(var(--tp-text))]">{o.clientName}</p>
                  <p className="text-[11px] text-[hsl(var(--tp-text-dim))] mt-0.5">{productNames(o)}</p>
                  {o.scheduled_date && (
                    <p className="text-[11px] text-[hsl(var(--tp-gold))] mt-0.5">
                      Starts {fmtDate(o.scheduled_date)}
                    </p>
                  )}
                </div>
                <button
                  onClick={() => signOffSchedule(o.id)}
                  className="shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded bg-[hsl(var(--tp-gold))] text-black text-xs font-semibold hover:opacity-90 transition-opacity"
                >
                  <CheckCircle2 className="w-3 h-3" /> Sign Off
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      <NewOrderDialog open={dialogOpen} onOpenChange={setDialogOpen} onCreated={load} />

      {/* Confirmation Dialog */}
      {confirmDraft && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
          <div className="tp-surface rounded-xl shadow-2xl w-full max-w-md mx-4 overflow-hidden">
            <div className="flex items-center justify-between px-5 py-4 border-b border-[hsl(var(--tp-hairline))]">
              <h2 className="font-semibold text-[hsl(var(--tp-text))]">Confirm Production Plan</h2>
              <button onClick={() => setConfirmDraft(null)} className="text-[hsl(var(--tp-text-dim))] hover:text-[hsl(var(--tp-text))]">
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="px-5 py-4 space-y-4">
              <div>
                <p className="text-xs uppercase tracking-wider text-[hsl(var(--tp-text-dim))] mb-0.5">Client</p>
                <p className="font-medium text-[hsl(var(--tp-text))]">{confirmDraft.order.clientName}</p>
                <p className="text-sm text-[hsl(var(--tp-text-dim))]">{productNames(confirmDraft.order)}</p>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="bg-[hsl(var(--tp-surface-2))] rounded-lg px-3 py-2">
                  <p className="text-[10px] uppercase tracking-wider text-[hsl(var(--tp-text-dim))]">Production lbs</p>
                  <p className="text-lg font-bold text-[hsl(var(--tp-text))]">{confirmDraft.productionLbs.toFixed(1)}</p>
                  <p className="text-[10px] text-[hsl(var(--tp-text-dim))]">{confirmDraft.wastePct}% waste included</p>
                </div>
                <div className="bg-[hsl(var(--tp-surface-2))] rounded-lg px-3 py-2">
                  <p className="text-[10px] uppercase tracking-wider text-[hsl(var(--tp-text-dim))]">Max per day</p>
                  <p className="text-lg font-bold text-[hsl(var(--tp-text))]">{confirmDraft.maxBatchesPerDay}</p>
                  <p className="text-[10px] text-[hsl(var(--tp-text-dim))]">batches / day</p>
                </div>
              </div>

              {/* Batch count — editable */}
              <div>
                <p className="text-xs uppercase tracking-wider text-[hsl(var(--tp-text-dim))] mb-1.5">Batch count</p>
                <div className="flex items-center gap-3">
                  <button
                    onClick={() => setConfirmDraft(d => d && d.batchCount > 1 ? { ...d, batchCount: d.batchCount - 1 } : d)}
                    className="w-8 h-8 rounded-full border border-[hsl(var(--tp-hairline))] text-[hsl(var(--tp-text))] flex items-center justify-center text-lg font-bold hover:border-[hsl(var(--tp-gold))]"
                  >−</button>
                  <span className="text-2xl font-bold text-[hsl(var(--tp-text))] w-8 text-center">{confirmDraft.batchCount}</span>
                  <button
                    onClick={() => setConfirmDraft(d => d ? { ...d, batchCount: d.batchCount + 1 } : d)}
                    className="w-8 h-8 rounded-full border border-[hsl(var(--tp-hairline))] text-[hsl(var(--tp-text))] flex items-center justify-center text-lg font-bold hover:border-[hsl(var(--tp-gold))]"
                  >+</button>
                  <span className="text-sm text-[hsl(var(--tp-text-dim))]">
                    × {calcBatchSize(confirmDraft.productionLbs, confirmDraft.batchCount).toFixed(1)} lbs each
                  </span>
                </div>
                <p className="text-[11px] text-[hsl(var(--tp-text-dim))] mt-1.5">
                  {calcDaysNeeded(confirmDraft.batchCount, confirmDraft.maxBatchesPerDay)} days needed
                  (incl. 1 packaging day)
                </p>
              </div>

              <div className="bg-[hsl(var(--tp-gold))]/10 border border-[hsl(var(--tp-gold))]/20 rounded-lg px-3 py-2">
                <p className="text-[10px] uppercase tracking-wider text-[hsl(var(--tp-gold))] mb-0.5">Proposed start date</p>
                <p className="font-semibold text-[hsl(var(--tp-text))]">{fmtScheduleDate(confirmDraft.startDate)}</p>
                <p className="text-[10px] text-[hsl(var(--tp-text-dim))] mt-0.5">
                  Order # {confirmDraft.orderNum} · Pending manager sign-off after confirmation
                </p>
              </div>
            </div>

            <div className="px-5 py-4 border-t border-[hsl(var(--tp-hairline))] flex justify-end gap-3">
              <button onClick={() => setConfirmDraft(null)} className="tp-btn text-sm">
                Cancel
              </button>
              <button
                onClick={finalizeConfirm}
                disabled={finalizing}
                className="tp-btn tp-btn-primary text-sm flex items-center gap-2 disabled:opacity-50"
              >
                {finalizing ? <><Loader2 className="w-3.5 h-3.5 animate-spin" /> Scheduling…</> : <>Confirm & Schedule <ArrowRight className="w-3.5 h-3.5" /></>}
              </button>
            </div>
          </div>
        </div>
      )}
    </TeamPage>
  );
}
