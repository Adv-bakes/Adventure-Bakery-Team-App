import { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { TeamPage } from "@/components/team/TeamPage";
import { toast } from "sonner";
import { ArrowLeft, Mail, Phone, ChevronDown, ChevronUp, ShieldCheck, ShieldAlert, Plus, AlertTriangle, Check, X, Pencil } from "lucide-react";
import { AddOrderDialog } from "@/components/sales/AddOrderDialog";
import { ClientOrders } from "./ClientOrders";

// ─── Tolling Inventory Tab ────────────────────────────────────────────────────

interface TollingRow {
  id?: string;
  ingredient_name: string;
  qty_on_hand: number;
  unit: string;
  lot_code: string | null;
  expiry_date: string | null;
  reserved: number; // computed from inventory_reservations
  fromBatchSheet?: boolean; // ingredient pulled from batch sheet but no inventory record yet
}

function TollingInventoryTab({ clientId, profileId, products }: {
  clientId: string;
  profileId: string | null;
  products: any[];
}) {
  const [rows, setRows] = useState<TollingRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingId, setEditingId] = useState<string | null>(null); // ingredient_name being edited
  const [editDraft, setEditDraft] = useState<Partial<TollingRow>>({});
  const [modifyWarning, setModifyWarning] = useState(false);
  const [addingNew, setAddingNew] = useState(false);
  const [newDraft, setNewDraft] = useState({ ingredient_name: "", qty_on_hand: "", unit: "lbs", lot_code: "", expiry_date: "" });
  const [saving, setSaving] = useState(false);

  const load = async () => {
    setLoading(true);

    // 1. Get all ingredient names from this client's batch sheets
    const productIds = products.map(p => p.id);
    const batchIngredients = new Set<string>();

    if (productIds.length) {
      const { data: prfRows } = await (supabase as any)
        .from("prf_submissions")
        .select("id, concept_id, lead_id")
        .in("id", productIds);

      const conceptIds = (prfRows ?? []).map((p: any) => p.concept_id).filter(Boolean);
      const leadIds = [...new Set((prfRows ?? []).map((p: any) => p.lead_id).filter(Boolean))];

      // Path 1: concept_id
      if (conceptIds.length) {
        const { data: sheets } = await (supabase as any)
          .from("batch_sheets")
          .select("data_json")
          .in("concept_id", conceptIds)
          .is("superseded_at", null);
        for (const s of sheets ?? []) {
          for (const ing of s.data_json?.recipe?.ingredients ?? []) {
            if (ing.name) batchIngredients.add(ing.name.trim());
          }
        }
      }

      // Path 2: lead_id fallback (prf has no concept_id)
      if (leadIds.length) {
        const { data: sheets } = await (supabase as any)
          .from("batch_sheets")
          .select("data_json")
          .in("lead_id", leadIds)
          .is("superseded_at", null);
        for (const s of sheets ?? []) {
          for (const ing of s.data_json?.recipe?.ingredients ?? []) {
            if (ing.name) batchIngredients.add(ing.name.trim());
          }
        }
      }
    }

    // 2. Load existing inventory_tolling rows for this client
    const { data: invRows } = await (supabase as any)
      .from("inventory_tolling")
      .select("id, ingredient_name, qty_on_hand, unit, lot_code, expiry_date")
      .eq("client_id", profileId ?? clientId);

    // 3. Load reserved quantities from inventory_reservations for active orders of this client
    const { data: reservations } = await (supabase as any)
      .from("inventory_reservations")
      .select("ingredient_name, reserved_lbs, order_id");

    // Get order IDs for this client to filter reservations
    const { data: clientOrders } = await (supabase as any)
      .from("production_orders")
      .select("id")
      .eq("client_id", profileId ?? clientId)
      .not("status", "in", '("Shipped","Archived")');

    const activeOrderIds = new Set((clientOrders ?? []).map((o: any) => o.id));
    const reservedByIngredient = new Map<string, number>();
    for (const r of reservations ?? []) {
      if (!activeOrderIds.has(r.order_id)) continue;
      const key = r.ingredient_name.toLowerCase().trim();
      reservedByIngredient.set(key, (reservedByIngredient.get(key) ?? 0) + r.reserved_lbs);
    }

    // 4. Merge: inventory rows + batch sheet ingredients (add missing ones at 0)
    const invMap = new Map<string, any>();
    for (const r of invRows ?? []) {
      invMap.set(r.ingredient_name.toLowerCase().trim(), r);
    }

    const merged: TollingRow[] = [];
    // First: all ingredients from batch sheets
    for (const name of batchIngredients) {
      const key = name.toLowerCase().trim();
      const inv = invMap.get(key);
      const reserved = reservedByIngredient.get(key) ?? 0;
      merged.push({
        id: inv?.id,
        ingredient_name: inv?.ingredient_name ?? name,
        qty_on_hand: inv?.qty_on_hand ?? 0,
        unit: inv?.unit ?? "lbs",
        lot_code: inv?.lot_code ?? null,
        expiry_date: inv?.expiry_date ?? null,
        reserved,
        fromBatchSheet: true,
      });
      invMap.delete(key); // don't double-count
    }
    // Then: any extra inventory rows not on a batch sheet
    for (const inv of invMap.values()) {
      const key = inv.ingredient_name.toLowerCase().trim();
      merged.push({
        id: inv.id,
        ingredient_name: inv.ingredient_name,
        qty_on_hand: inv.qty_on_hand,
        unit: inv.unit,
        lot_code: inv.lot_code,
        expiry_date: inv.expiry_date,
        reserved: reservedByIngredient.get(key) ?? 0,
        fromBatchSheet: false,
      });
    }

    merged.sort((a, b) => a.ingredient_name.localeCompare(b.ingredient_name));
    setRows(merged);
    setLoading(false);
  };

  useEffect(() => { load(); }, [clientId, profileId]);

  const startEdit = (row: TollingRow) => {
    setEditingId(row.ingredient_name);
    setEditDraft({ qty_on_hand: row.qty_on_hand, unit: row.unit, lot_code: row.lot_code, expiry_date: row.expiry_date });
    setModifyWarning(row.qty_on_hand > 0);
  };

  const cancelEdit = () => { setEditingId(null); setModifyWarning(false); };

  const saveEdit = async (row: TollingRow) => {
    setSaving(true);
    const payload = {
      client_id: profileId ?? clientId,
      ingredient_name: row.ingredient_name,
      qty_on_hand: Number(editDraft.qty_on_hand) || 0,
      unit: editDraft.unit || "lbs",
      lot_code: editDraft.lot_code || null,
      expiry_date: editDraft.expiry_date || null,
      updated_at: new Date().toISOString(),
    };

    let error;
    if (row.id) {
      ({ error } = await (supabase as any).from("inventory_tolling").update(payload).eq("id", row.id));
    } else {
      ({ error } = await (supabase as any).from("inventory_tolling").insert(payload));
    }
    setSaving(false);
    if (error) { toast.error(error.message); return; }
    toast.success("Saved");
    setEditingId(null);
    setModifyWarning(false);
    load();
  };

  const saveNew = async () => {
    if (!newDraft.ingredient_name.trim()) { toast.error("Ingredient name required"); return; }
    setSaving(true);
    const { error } = await (supabase as any).from("inventory_tolling").insert({
      client_id: profileId ?? clientId,
      ingredient_name: newDraft.ingredient_name.trim(),
      qty_on_hand: Number(newDraft.qty_on_hand) || 0,
      unit: newDraft.unit || "lbs",
      lot_code: newDraft.lot_code || null,
      expiry_date: newDraft.expiry_date || null,
    });
    setSaving(false);
    if (error) { toast.error(error.message); return; }
    toast.success("Ingredient added");
    setAddingNew(false);
    setNewDraft({ ingredient_name: "", qty_on_hand: "", unit: "lbs", lot_code: "", expiry_date: "" });
    load();
  };

  if (loading) return <div className="tp-surface p-6 text-sm text-[hsl(var(--tp-text-dim))]">Loading…</div>;

  return (
    <div className="space-y-4">
      <div className="tp-surface overflow-x-auto max-w-[66%]">
        <table className="text-sm border-collapse w-full">
          <thead>
            <tr className="border-b border-[hsl(var(--tp-hairline))]">
              <th className="text-left py-3 px-4 text-[10px] uppercase tracking-[0.14em] text-[hsl(var(--tp-text-dim))] font-semibold">Ingredient</th>
              <th className="text-right py-3 px-4 text-[10px] uppercase tracking-[0.14em] text-[hsl(var(--tp-text-dim))] font-semibold">On Hand</th>
              <th className="text-right py-3 px-4 text-[10px] uppercase tracking-[0.14em] text-[hsl(var(--tp-text-dim))] font-semibold">Reserved</th>
              <th className="text-right py-3 px-4 text-[10px] uppercase tracking-[0.14em] text-[hsl(var(--tp-text-dim))] font-semibold">Available</th>
              <th className="py-3 px-4 text-[10px] uppercase tracking-[0.14em] text-[hsl(var(--tp-text-dim))] font-semibold">Lot</th>
              <th className="py-3 px-4 text-[10px] uppercase tracking-[0.14em] text-[hsl(var(--tp-text-dim))] font-semibold">Expires</th>
              <th className="py-3 px-2 w-8" />
            </tr>
          </thead>
          <tbody className="divide-y divide-[hsl(var(--tp-hairline))]">
            {rows.map((row) => {
              const available = row.qty_on_hand - row.reserved;
              const isEditing = editingId === row.ingredient_name;
              return (
                <tr key={row.ingredient_name} className="group">
                  <td className="py-2.5 px-4 text-[hsl(var(--tp-text))] font-medium">
                    {row.ingredient_name}
                    {!row.fromBatchSheet && (
                      <span className="ml-2 text-[10px] text-[hsl(var(--tp-text-dim))] italic">manual</span>
                    )}
                  </td>

                  {isEditing ? (
                    <>
                      <td className="py-2 px-4 text-right" colSpan={4}>
                        <div className="flex flex-col gap-2">
                          {modifyWarning && (
                            <div className="flex items-center gap-1.5 text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded px-2 py-1">
                              <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
                              You are modifying an existing inventory record
                            </div>
                          )}
                          <div className="flex items-center gap-2 justify-end flex-wrap">
                            <input
                              type="number" min={0} step={0.01}
                              value={editDraft.qty_on_hand as number}
                              onChange={e => setEditDraft(d => ({ ...d, qty_on_hand: Number(e.target.value) }))}
                              className="w-24 h-8 text-right rounded border border-[hsl(var(--tp-hairline))] bg-background px-2 text-sm focus:border-[hsl(var(--tp-gold))] outline-none"
                              placeholder="lbs"
                            />
                            <input
                              type="text"
                              value={editDraft.lot_code ?? ""}
                              onChange={e => setEditDraft(d => ({ ...d, lot_code: e.target.value }))}
                              className="w-28 h-8 rounded border border-[hsl(var(--tp-hairline))] bg-background px-2 text-sm focus:border-[hsl(var(--tp-gold))] outline-none"
                              placeholder="Lot code"
                            />
                            <input
                              type="date"
                              value={editDraft.expiry_date ?? ""}
                              onChange={e => setEditDraft(d => ({ ...d, expiry_date: e.target.value }))}
                              className="w-36 h-8 rounded border border-[hsl(var(--tp-hairline))] bg-background px-2 text-sm focus:border-[hsl(var(--tp-gold))] outline-none"
                            />
                          </div>
                        </div>
                      </td>
                      <td className="py-2 px-2 text-right" colSpan={2}>
                        <div className="flex items-center gap-1 justify-end">
                          <button onClick={() => saveEdit(row)} disabled={saving} className="p-1.5 rounded bg-[hsl(var(--tp-gold))] text-black hover:opacity-90 disabled:opacity-40">
                            <Check className="w-3.5 h-3.5" />
                          </button>
                          <button onClick={cancelEdit} className="p-1.5 rounded border border-[hsl(var(--tp-hairline))] text-[hsl(var(--tp-text-dim))] hover:text-[hsl(var(--tp-text))]">
                            <X className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    </>
                  ) : (
                    <>
                      <td className="py-2.5 px-4 text-right tabular-nums text-[hsl(var(--tp-text-dim))]">
                        {row.qty_on_hand > 0 ? `${row.qty_on_hand} ${row.unit}` : <span className="text-[hsl(var(--tp-text-dim))] italic text-xs">—</span>}
                      </td>
                      <td className="py-2.5 px-4 text-right tabular-nums text-[hsl(var(--tp-text-dim))]">
                        {row.reserved > 0 ? `${row.reserved.toFixed(2)} lbs` : "—"}
                      </td>
                      <td className={`py-2.5 px-4 text-right tabular-nums font-semibold ${available < 0 ? "text-red-600" : available === 0 && row.qty_on_hand === 0 ? "text-[hsl(var(--tp-text-dim))]" : "text-[hsl(var(--tp-text))]"}`}>
                        {row.qty_on_hand === 0 && row.reserved === 0 ? "—" : `${available.toFixed(2)} lbs`}
                      </td>
                      <td className="py-2.5 px-4 text-xs text-[hsl(var(--tp-text-dim))]">{row.lot_code || "—"}</td>
                      <td className="py-2.5 px-4 text-xs text-[hsl(var(--tp-text-dim))]">
                        {row.expiry_date ? new Date(row.expiry_date).toLocaleDateString() : "—"}
                      </td>
                      <td className="py-2.5 px-2">
                        <button onClick={() => startEdit(row)} className="opacity-0 group-hover:opacity-100 p-1 rounded text-[hsl(var(--tp-text-dim))] hover:text-[hsl(var(--tp-text))] transition-opacity">
                          <Pencil className="w-3.5 h-3.5" />
                        </button>
                      </td>
                    </>
                  )}
                </tr>
              );
            })}

            {/* Add new ingredient row */}
            {addingNew && (
              <tr>
                <td className="py-2 px-4">
                  <input
                    type="text"
                    value={newDraft.ingredient_name}
                    onChange={e => setNewDraft(d => ({ ...d, ingredient_name: e.target.value }))}
                    className="w-full h-8 rounded border border-[hsl(var(--tp-gold))] bg-background px-2 text-sm outline-none"
                    placeholder="Ingredient name"
                    autoFocus
                  />
                </td>
                <td className="py-2 px-4 text-right">
                  <input
                    type="number" min={0} step={0.01}
                    value={newDraft.qty_on_hand}
                    onChange={e => setNewDraft(d => ({ ...d, qty_on_hand: e.target.value }))}
                    className="w-24 h-8 text-right rounded border border-[hsl(var(--tp-hairline))] bg-background px-2 text-sm focus:border-[hsl(var(--tp-gold))] outline-none"
                    placeholder="lbs"
                  />
                </td>
                <td className="py-2 px-4" />
                <td className="py-2 px-4" />
                <td className="py-2 px-4">
                  <input
                    type="text"
                    value={newDraft.lot_code}
                    onChange={e => setNewDraft(d => ({ ...d, lot_code: e.target.value }))}
                    className="w-28 h-8 rounded border border-[hsl(var(--tp-hairline))] bg-background px-2 text-sm focus:border-[hsl(var(--tp-gold))] outline-none"
                    placeholder="Lot code"
                  />
                </td>
                <td className="py-2 px-4">
                  <input
                    type="date"
                    value={newDraft.expiry_date}
                    onChange={e => setNewDraft(d => ({ ...d, expiry_date: e.target.value }))}
                    className="w-36 h-8 rounded border border-[hsl(var(--tp-hairline))] bg-background px-2 text-sm focus:border-[hsl(var(--tp-gold))] outline-none"
                  />
                </td>
                <td className="py-2 px-2">
                  <div className="flex items-center gap-1">
                    <button onClick={saveNew} disabled={saving} className="p-1.5 rounded bg-[hsl(var(--tp-gold))] text-black hover:opacity-90 disabled:opacity-40">
                      <Check className="w-3.5 h-3.5" />
                    </button>
                    <button onClick={() => setAddingNew(false)} className="p-1.5 rounded border border-[hsl(var(--tp-hairline))] text-[hsl(var(--tp-text-dim))]">
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {!addingNew && (
        <button
          onClick={() => setAddingNew(true)}
          className="flex items-center gap-1.5 text-xs text-[hsl(var(--tp-text-dim))] hover:text-[hsl(var(--tp-text))] transition-colors"
        >
          <Plus className="w-3.5 h-3.5" /> Add ingredient
        </button>
      )}
    </div>
  );
}

// ─── Overview Orders ─────────────────────────────────────────────────────────

function OverviewOrders({ leadId, profileId }: { leadId: string; profileId: string | null }) {
  const [orders, setOrders] = useState<any[]>([]);

  useEffect(() => {
    if (!leadId && !profileId) return;
    (supabase as any)
      .from("production_orders")
      .select("id, order_number, status, items, created_at, target_completion_date, payment_status")
      .or(`client_id.eq.${leadId}${profileId ? `,client_id.eq.${profileId}` : ""}`)
      .order("created_at", { ascending: false })
      .then(({ data }: any) => setOrders(data ?? []));
  }, [leadId, profileId]);

  if (orders.length === 0) return null;

  const STATUS_COLOR: Record<string, string> = {
    "Order Placed":  "bg-slate-400",
    "Confirmed":     "bg-blue-400",
    "Sourcing":      "bg-violet-400",
    "Scheduled":     "bg-amber-400",
    "In Production": "bg-orange-400",
    "Shipped":       "bg-emerald-400",
  };

  return (
    <div className="tp-surface overflow-hidden">
      <div className="px-5 py-3 border-b border-[hsl(var(--tp-hairline))] flex items-center justify-between">
        <p className="text-[10px] uppercase tracking-[0.18em] font-bold text-[hsl(var(--tp-text))]">Order History</p>
        <span className="text-[11px] text-[hsl(var(--tp-text-dim))]">{orders.length} order{orders.length !== 1 ? "s" : ""}</span>
      </div>
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-[hsl(var(--tp-hairline))]">
            {["Date", "Order #", "Products", "Status", "Target", "Payment"].map(h => (
              <th key={h} className="text-left py-2.5 px-4 text-[10px] uppercase tracking-[0.12em] text-[hsl(var(--tp-text-dim))] font-semibold">{h}</th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-[hsl(var(--tp-hairline))]">
          {orders.map(o => (
            <tr key={o.id} className="hover:bg-white/5 transition-colors">
              <td className="py-2.5 px-4 text-[hsl(var(--tp-text-dim))] text-xs whitespace-nowrap">
                {new Date(o.created_at).toLocaleDateString()}
              </td>
              <td className="py-2.5 px-4 font-medium text-[hsl(var(--tp-text))] text-xs whitespace-nowrap">
                {o.order_number ?? "—"}
              </td>
              <td className="py-2.5 px-4 text-[hsl(var(--tp-text-dim))] text-xs max-w-[240px] truncate">
                {Array.isArray(o.items) ? o.items.map((i: any) => `${i.product_name} (${i.qty} ${i.unit})`).join(", ") : "—"}
              </td>
              <td className="py-2.5 px-4">
                <span className={`inline-flex items-center gap-1.5 text-xs font-medium`}>
                  <span className={`w-2 h-2 rounded-full shrink-0 ${STATUS_COLOR[o.status] ?? "bg-slate-400"}`} />
                  {o.status}
                </span>
              </td>
              <td className="py-2.5 px-4 text-xs text-[hsl(var(--tp-text-dim))] whitespace-nowrap">
                {o.target_completion_date ? new Date(o.target_completion_date).toLocaleDateString() : "—"}
              </td>
              <td className="py-2.5 px-4">
                {o.payment_status && (
                  <span className={`text-xs font-semibold capitalize
                    ${o.payment_status === "paid"    ? "text-emerald-600" : ""}
                    ${o.payment_status === "pending" ? "text-amber-700"   : ""}
                    ${o.payment_status === "overdue" ? "text-red-600"     : ""}
                  `}>{o.payment_status}</span>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

interface Lead {
  id: string;
  email: string;
  contact_name: string | null;
  company_name: string | null;
  phone: string | null;
  profile_id: string | null;
  notes: string | null;
}

type TabId = "overview" | "documents_nda" | "tolling" | "orders" | "notes";

const SalesClientFolder = () => {
  const { id } = useParams();
  const [lead, setLead] = useState<Lead | null>(null);
  const [projects, setProjects] = useState<any[]>([]);   // presale (not Approved)
  const [products, setProducts] = useState<any[]>([]);   // Approved + quote_approved_at
  const [docs, setDocs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<TabId>("overview");
  const [contactExpanded, setContactExpanded] = useState(false);
  const [prfContactName, setPrfContactName] = useState("");
  const [prfPhone, setPrfPhone] = useState("");
  const [addOpen, setAddOpen] = useState(false);
  const [notesDraft, setNotesDraft] = useState("");
  const [savingNotes, setSavingNotes] = useState(false);

  const load = async () => {
    if (!id) return;
    setLoading(true);
    const { data: l } = await (supabase as any).from("sales_leads").select("*").eq("id", id).maybeSingle();
    setLead(l);
    setNotesDraft(l?.notes || "");

    const { data: prfs } = await supabase
      .from("prf_submissions")
      .select("id, product_name, project_type, status, sales_stage, quote_approved_at, product_approved_at, created_at, lead_id, email, founder_name, phone")
      .or(`lead_id.eq.${id}${l?.email ? `,email.eq.${l.email}` : ""}`)
      .order("created_at", { ascending: false });

    // Pull contact name + phone from PRF if not on lead record
    const firstPrf = (prfs ?? [])[0];
    if (!l?.contact_name && firstPrf?.founder_name) setPrfContactName(firstPrf.founder_name);
    if (!l?.phone && firstPrf?.phone) setPrfPhone(firstPrf.phone);

    const all = prfs ?? [];
    const isApproved = (p: any) => (p.sales_stage === "Approved" && p.quote_approved_at) || p.product_approved_at;
    setProjects(all.filter(p => !isApproved(p)));
    setProducts(all.filter(isApproved));

    if (l?.profile_id) {
      const { data: d } = await supabase
        .from("client_documents")
        .select("*")
        .eq("user_id", l.profile_id)
        .order("uploaded_at", { ascending: false });
      setDocs(d ?? []);
    } else {
      setDocs([]);
    }
    setLoading(false);
  };

  useEffect(() => { load(); }, [id]);

  const saveNotes = async () => {
    if (!lead) return;
    setSavingNotes(true);
    const { error } = await (supabase as any).from("sales_leads").update({ notes: notesDraft }).eq("id", lead.id);
    setSavingNotes(false);
    if (error) return toast.error(error.message);
    toast.success("Notes saved");
  };

  if (loading) return <TeamPage title="Loading…">…</TeamPage>;
  if (!lead) return (
    <TeamPage title="Not found">
      <Link to="/team/sales/dashboard" className="tp-btn"><ArrowLeft className="w-4 h-4" /> Back</Link>
    </TeamPage>
  );

  const ndaSigned = docs.some(d => (d.document_type || "").toLowerCase().includes("nda"));

  const tabs: Array<{ id: TabId; label: string; staffOnly?: boolean }> = [
    { id: "overview", label: "Overview" },
    { id: "documents_nda", label: "Documents & NDA" },
    { id: "tolling", label: "Tolling Inventory", staffOnly: true },
    { id: "orders", label: "Order History", staffOnly: true },
    { id: "notes", label: "Notes", staffOnly: true },
  ];

  return (
    <TeamPage
      eyebrow="Client folder"
      title={lead.company_name || lead.contact_name || lead.email}
      actions={
        <div className="flex items-center gap-2">
          <button onClick={() => setAddOpen(true)} className="tp-btn tp-btn-primary">
            <Plus className="w-4 h-4" /> Add Order
          </button>
          <Link to="/team/sales/dashboard" className="tp-btn"><ArrowLeft className="w-4 h-4" /> Back</Link>
        </div>
      }
    >
      {/* Contact bar + NDA alert on same row */}
      <div className="flex items-stretch gap-3 mb-4">
        <div className="tp-surface px-4 py-2.5 flex items-center gap-5 text-sm">
          <span className="font-semibold text-[hsl(var(--tp-text))]">
            {lead.contact_name || prfContactName || <span className="italic font-normal text-[hsl(var(--tp-text-dim))]">No contact name</span>}
          </span>
          {lead.email && (
            <span className="flex items-center gap-1.5 text-[hsl(var(--tp-text-dim))]">
              <Mail className="w-3.5 h-3.5 shrink-0" /> {lead.email}
            </span>
          )}
          <span className="flex items-center gap-1.5 text-[hsl(var(--tp-text-dim))]">
            <Phone className="w-3.5 h-3.5 shrink-0" />
            {lead.phone || prfPhone || <span className="italic">No phone</span>}
          </span>
        </div>

        {/* NDA alert — right-justified, white text */}
        <div className={`ml-auto px-4 py-2.5 rounded-lg flex items-center gap-2 text-xs font-semibold shrink-0 text-white
          ${ndaSigned ? "bg-emerald-600" : "bg-red-600"}`}>
          {ndaSigned
            ? <ShieldCheck className="w-4 h-4" />
            : <span className="bg-white rounded-full p-0.5 flex items-center justify-center"><ShieldAlert className="w-3.5 h-3.5 text-red-600" /></span>
          }
          {ndaSigned ? "NDA on file" : "No NDA — send from Documents & NDA"}
        </div>
      </div>

      {/* Tabs — compact, not full width */}
      <div className="tp-surface mb-4 inline-flex flex-wrap gap-1 p-1">
        {tabs.map(t => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`px-3 py-1.5 text-xs rounded ${tab === t.id ? "bg-[hsl(var(--tp-gold))] text-white font-semibold" : "text-[hsl(var(--tp-text-dim))]"}`}
          >
            {t.label}{t.staffOnly && " 🔒"}
          </button>
        ))}
      </div>

      {tab === "overview" && (
        <div className="space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Projects — products still in the sales channel */}
          <div className="tp-surface p-5">
            <p className="text-[10px] uppercase tracking-[0.18em] font-bold text-[hsl(var(--tp-text))] mb-1">
              Projects <span className="text-[hsl(var(--tp-text-dim))] font-normal">({projects.length})</span>
            </p>
            <p className="text-[11px] text-[hsl(var(--tp-text-dim))] mb-3 italic">In sales channel — not yet approved for production</p>
            {projects.length === 0 ? (
              <p className="text-sm italic text-[hsl(var(--tp-text-dim))]">None in pipeline.</p>
            ) : (
              <ul className="divide-y divide-[hsl(var(--tp-hairline))]">
                {projects.map(p => (
                  <li key={p.id}>
                    <Link to={`/team/sales/clients/${lead.id}/products/${p.id}`} className="flex items-center justify-between py-2.5 hover:opacity-80">
                      <div>
                        <p className="text-sm font-medium text-[hsl(var(--tp-text))] truncate">{p.product_name || "(unnamed)"}</p>
                        <p className="text-[11px] text-[hsl(var(--tp-text-dim))]">{p.sales_stage || "Lead In"} · {new Date(p.created_at).toLocaleDateString()}</p>
                      </div>
                      <span className="text-[11px] text-[hsl(var(--tp-gold))] shrink-0 ml-3">Open →</span>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </div>

          {/* Products — approved for production */}
          <div className="tp-surface p-5">
            <p className="text-[10px] uppercase tracking-[0.18em] font-bold text-[hsl(var(--tp-text))] mb-1">
              Products <span className="text-[hsl(var(--tp-text-dim))] font-normal">({products.length})</span>
            </p>
            <p className="text-[11px] text-[hsl(var(--tp-text-dim))] mb-3 italic">Approved for production</p>
            {products.length === 0 ? (
              <p className="text-sm italic text-[hsl(var(--tp-text-dim))]">No approved products yet.</p>
            ) : (
              <ul className="divide-y divide-[hsl(var(--tp-hairline))]">
                {products.map(p => (
                  <li key={p.id}>
                    <Link to={`/team/sales/clients/${lead.id}/products/${p.id}`} className="flex items-center justify-between py-2.5 hover:opacity-80">
                      <div>
                        <p className="text-sm font-medium text-[hsl(var(--tp-text))] truncate">{p.product_name || "(unnamed)"}</p>
                        <p className="text-[11px] text-[hsl(var(--tp-text-dim))]">
                          Approved {(p.product_approved_at || p.quote_approved_at)
                            ? new Date(p.product_approved_at || p.quote_approved_at).toLocaleDateString()
                            : "—"}
                        </p>
                      </div>
                      <span className="text-[11px] text-[hsl(var(--tp-gold))] shrink-0 ml-3">Open →</span>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>

          {/* Brand notes */}
          <div className="tp-surface p-5">
            <p className="text-[10px] uppercase tracking-[0.18em] font-bold text-[hsl(var(--tp-text))] mb-3">Brand Notes</p>
            <textarea
              value={notesDraft}
              onChange={e => setNotesDraft(e.target.value)}
              rows={4}
              placeholder="General notes about this brand — positioning, preferences, key contacts, context…"
              className="w-full rounded-lg border border-[hsl(var(--tp-hairline))] bg-[hsl(var(--tp-surface-2))] px-3 py-2 text-sm text-[hsl(var(--tp-text))] resize-none focus:border-[hsl(var(--tp-gold))] outline-none"
            />
            <div className="flex justify-end mt-2">
              <button onClick={saveNotes} disabled={savingNotes} className="tp-btn tp-btn-primary text-xs disabled:opacity-50">
                {savingNotes ? "Saving…" : "Save"}
              </button>
            </div>
          </div>
        </div>
      )}

      {tab === "documents_nda" && (
        <div className="tp-surface divide-y divide-[hsl(var(--tp-hairline))]">
          {docs.length === 0 && <p className="p-8 text-sm italic text-[hsl(var(--tp-text-dim))]">No documents on file.</p>}
          {docs.map(d => (
            <div key={d.id} className="p-4">
              <p className="text-sm text-[hsl(var(--tp-text))]">{d.file_name || d.document_type}</p>
              <p className="text-[11px] text-[hsl(var(--tp-text-dim))]">
                {d.document_type} · {d.uploaded_at ? new Date(d.uploaded_at).toLocaleDateString() : ""}
              </p>
            </div>
          ))}
        </div>
      )}

      {tab === "tolling" && (
        <TollingInventoryTab clientId={lead.id} profileId={lead.profile_id} products={products} />
      )}

      {tab === "orders" && (
        <ClientOrders clientId={lead.id} profileId={lead.profile_id} />
      )}

      {tab === "notes" && (
        <div className="tp-surface p-5">
          <textarea
            value={notesDraft}
            onChange={e => setNotesDraft(e.target.value)}
            rows={10}
            placeholder="Internal client-level notes…"
            className="tp-input w-full resize-none"
          />
          <button onClick={saveNotes} disabled={savingNotes} className="tp-btn tp-btn-primary mt-3 disabled:opacity-50">
            {savingNotes ? "Saving…" : "Save notes"}
          </button>
        </div>
      )}

      <AddOrderDialog
        open={addOpen}
        onOpenChange={setAddOpen}
        clientId={lead.id}
        profileId={lead.profile_id}
        clientName={lead.company_name || lead.contact_name || lead.email}
        clientEmail={lead.email}
        onCreated={() => { setTab("orders"); load(); }}
      />
    </TeamPage>
  );
};

export default SalesClientFolder;
