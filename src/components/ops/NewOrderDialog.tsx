import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { AlertTriangle } from "lucide-react";

interface Client {
  id: string;
  company_name: string | null;
  email: string;
  profile_id: string | null;
}

interface ApprovedProduct {
  id: string;
  product_name: string;
  quote_approved_at: string | null;
}

type Warehouse = { id: string; name: string; address: string };
const UOM_OPTIONS = ["cases", "units", "lbs"] as const;
type UOM = (typeof UOM_OPTIONS)[number];

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onCreated?: () => void;
}

export function NewOrderDialog({ open, onOpenChange, onCreated }: Props) {
  const [clients, setClients] = useState<Client[]>([]);
  const [selectedId, setSelectedId] = useState("");
  const [products, setProducts] = useState<ApprovedProduct[]>([]);
  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
  const [items, setItems] = useState<Array<{ product_id: string; product_name: string; batch_sheet_id: string | null; qty: number; unit: UOM }>>([]);
  const [batchSheetMap, setBatchSheetMap] = useState<Map<string, string>>(new Map());
  const [shipKind, setShipKind] = useState<"client" | "ab_warehouse">("client");
  const [warehouseId, setWarehouseId] = useState("");
  const [orderType, setOrderType] = useState<"jit" | "tolling_warehoused" | "tolling_external">("jit");
  const [notes, setNotes] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!open) return;
    (async () => {
      const { data } = await (supabase as any)
        .from("sales_leads")
        .select("id, company_name, email, profile_id")
        .neq("stage", "Archived")
        .order("company_name");
      setClients((data ?? []) as Client[]);
      setSelectedId(""); setProducts([]); setItems([]);
      setShipKind("client"); setWarehouseId(""); setOrderType("jit"); setNotes("");
    })();
  }, [open]);

  useEffect(() => {
    if (!selectedId) { setProducts([]); setItems([]); setBatchSheetMap(new Map()); return; }
    (async () => {
      const { data: prods } = await supabase
        .from("prf_submissions")
        .select("id, product_name, quote_approved_at, product_approved_at, concept_id")
        .eq("lead_id", selectedId)
        .or(`and(sales_stage.eq.Approved,quote_approved_at.not.is.null),product_approved_at.not.is.null`);
      setProducts((prods ?? []) as ApprovedProduct[]);
      setItems([]);

      // Build batch_sheet_id map: product_id → latest active batch sheet id
      const conceptIds = (prods ?? []).map((p: any) => p.concept_id).filter(Boolean);
      if (conceptIds.length) {
        const { data: sheets } = await (supabase as any)
          .from("batch_sheets")
          .select("id, concept_id, version")
          .in("concept_id", conceptIds)
          .is("superseded_at", null)
          .order("version", { ascending: false });
        const sheetByConcept = new Map<number, string>();
        for (const s of sheets ?? []) {
          if (!sheetByConcept.has(s.concept_id)) sheetByConcept.set(s.concept_id, s.id);
        }
        const newMap = new Map<string, string>();
        for (const p of prods ?? []) {
          if ((p as any).concept_id && sheetByConcept.has((p as any).concept_id)) {
            newMap.set((p as any).id, sheetByConcept.get((p as any).concept_id)!);
          }
        }
        setBatchSheetMap(newMap);
      }

      const { data: wh } = await (supabase as any)
        .from("ab_warehouses").select("id, name, address").eq("is_active", true);
      setWarehouses((wh ?? []) as Warehouse[]);
    })();
  }, [selectedId]);

  const selectedClient = clients.find(c => c.id === selectedId);

  const oldestQuoteDays = useMemo(() => {
    const picks = products.filter(p => items.some(i => i.product_id === p.id));
    if (!picks.length) return 0;
    return picks.reduce<number>((max, p) => {
      if (!p.quote_approved_at) return max;
      const d = Math.floor((Date.now() - new Date(p.quote_approved_at).getTime()) / 86400000);
      return Math.max(max, d);
    }, 0);
  }, [items, products]);

  const toggleProduct = (p: ApprovedProduct) =>
    setItems(prev =>
      prev.some(i => i.product_id === p.id)
        ? prev.filter(i => i.product_id !== p.id)
        : [...prev, { product_id: p.id, product_name: p.product_name || "(unnamed)", batch_sheet_id: batchSheetMap.get(p.id) ?? null, qty: 1, unit: "cases" }]
    );

  const updateItem = (id: string, patch: Partial<{ qty: number; unit: UOM }>) =>
    setItems(prev => prev.map(i => i.product_id === id ? { ...i, ...patch } : i));

  const submit = async () => {
    if (!selectedId) return toast.error("Select a client first");
    if (!items.length) return toast.error("Select at least one product");
    if (!selectedClient?.profile_id) return toast.error("This client has no linked user account yet");
    setSubmitting(true);

    const { data: { user } } = await supabase.auth.getUser();
    const { data: newOrder, error } = await (supabase as any).from("production_orders").insert({
      client_id: selectedClient.profile_id,
      items: items as any,
      ship_to_kind: shipKind,
      ship_to_warehouse_id: shipKind === "ab_warehouse" ? warehouseId || null : null,
      notes: notes || null,
      status: "Order Placed",
      order_type: orderType,
      created_by: user?.id,
      case_count: items.reduce((s, i) => s + (i.unit === "cases" ? i.qty : 0), 0) || 0,
    }).select("id").single();

    if (!error && newOrder?.id) {
      await (supabase as any).from("order_stage_events").insert({
        order_id: newOrder.id,
        stage: "Confirmed",
        entered_at: new Date().toISOString(),
        completed_by: user?.id ?? null,
      });
    }

    setSubmitting(false);
    if (error) return toast.error(error.message);
    toast.success("Order created");
    onCreated?.();
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>New Order</DialogTitle>
        </DialogHeader>

        <div className="space-y-5">
          <div>
            <Label className="mb-2 block">Client</Label>
            <select
              value={selectedId}
              onChange={e => setSelectedId(e.target.value)}
              className="w-full h-10 rounded border bg-background px-3 text-sm"
            >
              <option value="">— Select a company —</option>
              {clients.map(c => (
                <option key={c.id} value={c.id}>{c.company_name || c.email}</option>
              ))}
            </select>
          </div>

          {selectedId && (
            <>
              {oldestQuoteDays > 30 && (
                <div className="flex gap-2 items-start p-3 rounded border border-red-500/40 bg-red-500/10 text-sm">
                  <AlertTriangle className="w-4 h-4 mt-0.5 text-red-500 shrink-0" />
                  <div>
                    <p className="font-semibold text-red-500">Pricing review required</p>
                    <p className="text-muted-foreground">
                      A selected product's quote is {oldestQuoteDays} days old (&gt;30). Confirm pricing before proceeding.
                    </p>
                  </div>
                </div>
              )}

              <div>
                <Label className="mb-2 block">Products</Label>
                {products.length === 0 ? (
                  <p className="text-sm text-muted-foreground italic">No approved products for this client yet.</p>
                ) : (
                  <div className="border rounded divide-y max-h-64 overflow-y-auto">
                    {products.map(p => {
                      const item = items.find(i => i.product_id === p.id);
                      return (
                        <div key={p.id} className="p-3 flex items-center gap-3">
                          <input type="checkbox" checked={!!item} onChange={() => toggleProduct(p)} className="w-4 h-4 shrink-0" />
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium truncate">{p.product_name || "(unnamed)"}</p>
                            {p.quote_approved_at && (
                              <p className="text-xs text-muted-foreground">
                                Quote approved {new Date(p.quote_approved_at).toLocaleDateString()}
                              </p>
                            )}
                          </div>
                          {item && (
                            <div className="flex items-center gap-2 shrink-0">
                              <Input
                                type="number" min={1} value={item.qty}
                                onChange={e => updateItem(p.id, { qty: Math.max(1, Number(e.target.value)) })}
                                className="w-20 h-8"
                              />
                              <select
                                value={item.unit}
                                onChange={e => updateItem(p.id, { unit: e.target.value as UOM })}
                                className="h-8 rounded border bg-background px-2 text-sm"
                              >
                                {UOM_OPTIONS.map(u => <option key={u} value={u}>{u}</option>)}
                              </select>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              <div>
                <Label className="mb-2 block">Ship to</Label>
                <div className="space-y-2">
                  <label className="flex items-center gap-2 text-sm cursor-pointer">
                    <input type="radio" checked={shipKind === "client"} onChange={() => setShipKind("client")} />
                    Client's default shipping address
                  </label>
                  <label className="flex items-center gap-2 text-sm cursor-pointer">
                    <input type="radio" checked={shipKind === "ab_warehouse"} onChange={() => setShipKind("ab_warehouse")} />
                    Adventure Bakery warehouse
                  </label>
                  {shipKind === "ab_warehouse" && (
                    <select
                      value={warehouseId}
                      onChange={e => setWarehouseId(e.target.value)}
                      className="w-full h-10 rounded border bg-background px-3 text-sm"
                    >
                      <option value="">— Select warehouse —</option>
                      {warehouses.map(w => <option key={w.id} value={w.id}>{w.name}</option>)}
                    </select>
                  )}
                </div>
              </div>

              <div>
                <Label className="mb-2 block">Ingredient type</Label>
                <div className="space-y-2">
                  {(["jit", "tolling_warehoused", "tolling_external"] as const).map(v => (
                    <label key={v} className="flex items-center gap-2 text-sm cursor-pointer">
                      <input type="radio" checked={orderType === v} onChange={() => setOrderType(v)} />
                      {v === "jit" && "JIT — AB's own ingredients"}
                      {v === "tolling_warehoused" && "Tolling — client stock warehoused by AB"}
                      {v === "tolling_external" && "Tolling — client holds their own stock"}
                    </label>
                  ))}
                </div>
              </div>

              <div>
                <Label className="mb-2 block">Notes (optional)</Label>
                <textarea
                  value={notes}
                  onChange={e => setNotes(e.target.value)}
                  rows={3}
                  className="w-full rounded border bg-background p-2 text-sm resize-none"
                  placeholder="Internal notes for this order…"
                />
              </div>
            </>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={submit} disabled={submitting || !items.length}>
            {submitting ? "Creating…" : "Create Order"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
