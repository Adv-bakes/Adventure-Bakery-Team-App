import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { AlertTriangle } from "lucide-react";

interface ApprovedProduct {
  id: string;            // prf_submissions.id
  product_name: string;
  quote_approved_at: string | null;
}

interface AddOrderDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  clientId: string;           // sales_leads.id
  profileId: string | null;   // for client_id on the order
  onCreated?: () => void;
}

type Warehouse = { id: string; name: string; address: string };

export function AddOrderDialog({ open, onOpenChange, clientId, profileId, onCreated }: AddOrderDialogProps) {
  const [products, setProducts] = useState<ApprovedProduct[]>([]);
  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
  const [items, setItems] = useState<Array<{ product_id: string; qty: number; unit: "units" | "cases" }>>([]);
  const [shipKind, setShipKind] = useState<"client" | "ab_warehouse">("client");
  const [warehouseId, setWarehouseId] = useState<string>("");
  const [notes, setNotes] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!open || !clientId) return;
    (async () => {
      const { data } = await supabase
        .from("prf_submissions")
        .select("id, product_name, quote_approved_at, sales_stage, lead_id, email")
        .eq("lead_id", clientId)
        .eq("sales_stage", "Approved")
        .not("quote_approved_at", "is", null);
      setProducts((data ?? []) as any);
      const { data: wh } = await supabase.from("ab_warehouses").select("id, name, address").eq("is_active", true);
      setWarehouses((wh ?? []) as any);
      setItems([]);
      setShipKind("client");
      setWarehouseId("");
      setNotes("");
    })();
  }, [open, clientId]);

  const oldestQuoteDays = useMemo(() => {
    const picks = products.filter(p => items.some(i => i.product_id === p.id));
    if (!picks.length) return 0;
    const oldest = picks.reduce<number>((min, p) => {
      if (!p.quote_approved_at) return min;
      const d = Math.floor((Date.now() - new Date(p.quote_approved_at).getTime()) / 86400000);
      return Math.max(min, d);
    }, 0);
    return oldest;
  }, [items, products]);

  const toggleProduct = (id: string) => {
    setItems(prev => prev.some(i => i.product_id === id)
      ? prev.filter(i => i.product_id !== id)
      : [...prev, { product_id: id, qty: 1, unit: "cases" }]);
  };

  const updateItem = (id: string, patch: Partial<{ qty: number; unit: "units" | "cases" }>) => {
    setItems(prev => prev.map(i => i.product_id === id ? { ...i, ...patch } : i));
  };

  const submit = async () => {
    if (!items.length) return toast.error("Pick at least one product");
    setSubmitting(true);
    const { data: { user } } = await supabase.auth.getUser();
    const { error } = await supabase.from("production_orders").insert({
      client_id: profileId,
      items: items as any,
      ship_to_kind: shipKind,
      ship_to_warehouse_id: shipKind === "ab_warehouse" ? warehouseId || null : null,
      notes: notes || null,
      status: "Awaiting QB Acceptance",
      created_by: user?.id,
      case_count: items.reduce((s, i) => s + (i.unit === "cases" ? i.qty : 0), 0) || 0,
    } as any);
    setSubmitting(false);
    if (error) return toast.error(error.message);
    toast.success("Order created — awaiting QB acceptance");
    onCreated?.();
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Add Order</DialogTitle>
        </DialogHeader>

        {oldestQuoteDays > 30 && (
          <div className="flex gap-2 items-start p-3 rounded border border-red-500/40 bg-red-500/10 text-sm">
            <AlertTriangle className="w-4 h-4 mt-0.5 text-red-500 shrink-0" />
            <div>
              <p className="font-semibold text-red-500">Pricing review required</p>
              <p className="text-muted-foreground">A selected product's quote is {oldestQuoteDays} days old (&gt;30). Confirm pricing before sending the QB estimate.</p>
            </div>
          </div>
        )}

        <div className="space-y-4">
          <div>
            <Label className="mb-2 block">Approved products</Label>
            {products.length === 0 ? (
              <p className="text-sm text-muted-foreground italic">This client has no approved products yet.</p>
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
                        <div className="flex items-center gap-2">
                          <Input
                            type="number"
                            min={1}
                            value={item.qty}
                            onChange={e => updateItem(p.id, { qty: Number(e.target.value) })}
                            className="w-20 h-8"
                          />
                          <select
                            value={item.unit}
                            onChange={e => updateItem(p.id, { unit: e.target.value as any })}
                            className="h-8 rounded border bg-background px-2 text-sm"
                          >
                            <option value="cases">cases</option>
                            <option value="units">units</option>
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
              <label className="flex items-center gap-2 text-sm">
                <input type="radio" checked={shipKind === "client"} onChange={() => setShipKind("client")} />
                Client's default shipping address (from profile)
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
