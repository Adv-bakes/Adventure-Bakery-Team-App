import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { AlertTriangle } from "lucide-react";

interface ApprovedProduct {
  id: string;
  product_name: string;
  quote_approved_at: string | null;
}

interface AddOrderDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  clientId: string;
  profileId: string | null;
  clientName: string;
  clientEmail: string;
  onCreated?: () => void;
}

type Warehouse = { id: string; name: string; address: string };

const UOM_OPTIONS = ["cases", "units", "lbs"] as const;
type UOM = typeof UOM_OPTIONS[number];

export function AddOrderDialog({
  open, onOpenChange, clientId, profileId, clientName, clientEmail, onCreated,
}: AddOrderDialogProps) {
  const [products, setProducts] = useState<ApprovedProduct[]>([]);
  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
  const [items, setItems] = useState<Array<{ product_id: string; qty: number; unit: UOM; batch_sheet_id: string | null }>>([]);
  const [batchSheetMap, setBatchSheetMap] = useState<Map<string, string>>(new Map());
  const [shipKind, setShipKind] = useState<"client" | "ab_warehouse">("client");
  const [warehouseId, setWarehouseId] = useState<string>("");
  const [orderType, setOrderType] = useState<"jit" | "tolling_warehoused" | "tolling_external">("jit");
  const [notes, setNotes] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!open || !clientId) return;
    (async () => {
      const { data } = await supabase
        .from("prf_submissions")
        .select("id, product_name, quote_approved_at, sales_stage, lead_id, product_approved_at, concept_id")
        .eq("lead_id", clientId)
        .or(`and(sales_stage.eq.Approved,quote_approved_at.not.is.null),product_approved_at.not.is.null`);
      setProducts((data ?? []) as any);

      // Build batch_sheet_id map: product_id → latest active batch sheet id
      const conceptIds = (data ?? []).map((p: any) => p.concept_id).filter(Boolean);
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
        for (const p of data ?? []) {
          if ((p as any).concept_id && sheetByConcept.has((p as any).concept_id)) {
            newMap.set((p as any).id, sheetByConcept.get((p as any).concept_id)!);
          }
        }
        setBatchSheetMap(newMap);
      }

      const { data: wh } = await (supabase as any)
        .from("ab_warehouses").select("id, name, address").eq("is_active", true);
      setWarehouses((wh ?? []) as any);
      setItems([]);
      setBatchSheetMap(new Map());
      setShipKind("client");
      setWarehouseId("");
      setOrderType("jit");
      setNotes("");
    })();
  }, [open, clientId]);

  const oldestQuoteDays = useMemo(() => {
    const picks = products.filter(p => items.some(i => i.product_id === p.id));
    if (!picks.length) return 0;
    return picks.reduce<number>((max, p) => {
      if (!p.quote_approved_at) return max;
      const d = Math.floor((Date.now() - new Date(p.quote_approved_at).getTime()) / 86400000);
      return Math.max(max, d);
    }, 0);
  }, [items, products]);

  const toggleProduct = (id: string) => {
    setItems(prev =>
      prev.some(i => i.product_id === id)
        ? prev.filter(i => i.product_id !== id)
        : [...prev, { product_id: id, qty: 1, unit: "cases", batch_sheet_id: batchSheetMap.get(id) ?? null }]
    );
  };

  const updateItem = (id: string, patch: Partial<{ qty: number; unit: UOM }>) => {
    setItems(prev => prev.map(i => i.product_id === id ? { ...i, ...patch } : i));
  };

  const submit = async () => {
    if (!items.length) return toast.error("Select at least one product");
    setSubmitting(true);

    const { data: { user } } = await supabase.auth.getUser();

    const { data: order, error } = await (supabase as any)
      .from("production_orders")
      .insert({
        client_id: profileId,
        items: items as any,
        ship_to_kind: shipKind,
        ship_to_warehouse_id: shipKind === "ab_warehouse" ? warehouseId || null : null,
        notes: notes || null,
        status: "Order Placed",
        order_type: orderType,
        created_by: user?.id,
        case_count: items.reduce((s, i) => s + (i.unit === "cases" ? i.qty : 0), 0) || 0,
      } as any)
      .select("id, created_at")
      .single();

    if (error) {
      setSubmitting(false);
      return toast.error(error.message);
    }

    // Enrich items with product names for the email
    const enrichedItems = items.map(item => ({
      product_name: products.find(p => p.id === item.product_id)?.product_name ?? "(unnamed)",
      qty: item.qty,
      unit: item.unit,
    }));

    // Notify accounting — fire and forget (don't block the UI on email)
    (supabase as any).functions.invoke("notify-accounting-new-order", {
      body: {
        orderId: order.id,
        clientName,
        clientEmail,
        items: enrichedItems,
        shipToKind: shipKind,
        notes: notes || undefined,
        createdAt: order.created_at,
      },
    }).catch((err: any) => console.error("Accounting email failed:", err));

    setSubmitting(false);
    toast.success("Order created — accounting notified");
    onCreated?.();
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>New Order — {clientName}</DialogTitle>
        </DialogHeader>

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

        <div className="space-y-4">
          {/* Product list */}
          <div>
            <Label className="mb-2 block">Products</Label>
            {products.length === 0 ? (
              <p className="text-sm text-muted-foreground italic">
                This client has no approved products yet.
              </p>
            ) : (
              <div className="border rounded divide-y max-h-64 overflow-y-auto">
                {products.map(p => {
                  const item = items.find(i => i.product_id === p.id);
                  return (
                    <div key={p.id} className="p-3 flex items-center gap-3">
                      <input
                        type="checkbox"
                        checked={!!item}
                        onChange={() => toggleProduct(p.id)}
                        className="w-4 h-4 shrink-0"
                      />
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
                            type="number"
                            min={1}
                            value={item.qty}
                            onChange={e => updateItem(p.id, { qty: Math.max(1, Number(e.target.value)) })}
                            className="w-20 h-8"
                          />
                          <select
                            value={item.unit}
                            onChange={e => updateItem(p.id, { unit: e.target.value as UOM })}
                            className="h-8 rounded border bg-background px-2 text-sm"
                          >
                            {UOM_OPTIONS.map(u => (
                              <option key={u} value={u}>{u}</option>
                            ))}
                          </select>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Ingredient type */}
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

          {/* Ship to */}
          <div>
            <Label className="mb-2 block">Ship to</Label>
            <div className="space-y-2">
              <label className="flex items-center gap-2 text-sm">
                <input type="radio" checked={shipKind === "client"} onChange={() => setShipKind("client")} />
                Client's default shipping address
              </label>
              <label className="flex items-center gap-2 text-sm">
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
                  {warehouses.map(w => (
                    <option key={w.id} value={w.id}>{w.name}</option>
                  ))}
                </select>
              )}
            </div>
          </div>

          {/* Notes */}
          <div>
            <Label className="mb-2 block">Notes (optional)</Label>
            <textarea
              value={notes}
              onChange={e => setNotes(e.target.value)}
              rows={3}
              className="w-full rounded border bg-background p-2 text-sm"
              placeholder="Internal notes for this order…"
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={submit} disabled={submitting || !items.length}>
            {submitting ? "Creating…" : "Create order"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
