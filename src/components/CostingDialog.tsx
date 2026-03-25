import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";

interface CostingDialogProps {
  open: boolean;
  onClose: () => void;
  costingData?: any;
  conceptId?: number;
}

export function CostingDialog({ open, onClose, costingData, conceptId }: CostingDialogProps) {
  const [formData, setFormData] = useState({
    product_id: "",
    ingredient_cost: "",
    labor_cost: "",
    overhead_cost: "",
    packaging_cost: "",
    target_price: "",
    margin_percentage: "",
    notes: "",
  });
  const [bakedGoods, setBakedGoods] = useState<any[]>([]);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    loadBakedGoods();
  }, []);

  useEffect(() => {
    if (costingData) {
      setFormData({
        product_id: costingData.product_id?.toString() || "",
        ingredient_cost: costingData.ingredient_cost?.toString() || "",
        labor_cost: costingData.labor_cost?.toString() || "",
        overhead_cost: costingData.overhead_cost?.toString() || "",
        packaging_cost: costingData.packaging_cost?.toString() || "",
        target_price: costingData.target_price?.toString() || "",
        margin_percentage: costingData.margin_percentage?.toString() || "",
        notes: costingData.notes || "",
      });
    } else {
      setFormData({
        product_id: "",
        ingredient_cost: "",
        labor_cost: "",
        overhead_cost: "",
        packaging_cost: "",
        target_price: "",
        margin_percentage: "",
        notes: "",
      });
    }
  }, [costingData, open]);

  const loadBakedGoods = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const { data } = await supabase
      .from("products")
      .select("id, product_name")
      .eq("user_id", user.id)
      .order("product_name");

    setBakedGoods(data || []);
  };

  const calculateTotalCost = () => {
    const ingredient = parseFloat(formData.ingredient_cost) || 0;
    const labor = parseFloat(formData.labor_cost) || 0;
    const overhead = parseFloat(formData.overhead_cost) || 0;
    const packaging = parseFloat(formData.packaging_cost) || 0;
    return ingredient + labor + overhead + packaging;
  };

  const handleSave = async () => {
    if (!formData.product_id) {
      toast({ title: "Product is required", variant: "destructive" });
      return;
    }

    setIsSaving(true);
    const { data: { user } } = await supabase.auth.getUser();
    
    if (!user) {
      toast({ title: "You must be logged in", variant: "destructive" });
      setIsSaving(false);
      return;
    }

    const dataToSave = {
      product_id: parseInt(formData.product_id),
      ingredient_cost: formData.ingredient_cost ? parseFloat(formData.ingredient_cost) : null,
      labor_cost: formData.labor_cost ? parseFloat(formData.labor_cost) : null,
      overhead_cost: formData.overhead_cost ? parseFloat(formData.overhead_cost) : null,
      packaging_cost: formData.packaging_cost ? parseFloat(formData.packaging_cost) : null,
      target_price: formData.target_price ? parseFloat(formData.target_price) : null,
      margin_percentage: formData.margin_percentage ? parseFloat(formData.margin_percentage) : null,
      notes: formData.notes,
      user_id: user.id,
      concept_id: conceptId || null,
    };

    let error;
    if (costingData) {
      ({ error } = await supabase
        .from("costing")
        .update(dataToSave)
        .eq("id", costingData.id));
    } else {
      ({ error } = await supabase
        .from("costing")
        .insert([dataToSave as any]));
    }

    setIsSaving(false);

    if (error) {
      toast({ title: "Error saving costing data", variant: "destructive" });
    } else {
      toast({ title: `Costing data ${costingData ? "updated" : "created"} successfully` });
      onClose();
    }
  };

  const totalCost = calculateTotalCost();

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{costingData ? "Edit Costing" : "New Costing"}</DialogTitle>
          <DialogDescription>
            Calculate production costs and set pricing strategy
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div>
            <Label htmlFor="product_id">Product *</Label>
            <Select
              value={formData.product_id}
              onValueChange={(value) => setFormData({ ...formData, product_id: value })}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select a product" />
              </SelectTrigger>
              <SelectContent>
                {bakedGoods.map((bg) => (
                  <SelectItem key={bg.id} value={bg.id.toString()}>
                    {bg.product_name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="ingredient_cost">Ingredient Cost ($)</Label>
              <Input
                id="ingredient_cost"
                type="number"
                step="0.01"
                value={formData.ingredient_cost}
                onChange={(e) => setFormData({ ...formData, ingredient_cost: e.target.value })}
                placeholder="0.00"
              />
            </div>
            <div>
              <Label htmlFor="labor_cost">Labor Cost ($)</Label>
              <Input
                id="labor_cost"
                type="number"
                step="0.01"
                value={formData.labor_cost}
                onChange={(e) => setFormData({ ...formData, labor_cost: e.target.value })}
                placeholder="0.00"
              />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="overhead_cost">Overhead Cost ($)</Label>
              <Input
                id="overhead_cost"
                type="number"
                step="0.01"
                value={formData.overhead_cost}
                onChange={(e) => setFormData({ ...formData, overhead_cost: e.target.value })}
                placeholder="0.00"
              />
            </div>
            <div>
              <Label htmlFor="packaging_cost">Packaging Cost ($)</Label>
              <Input
                id="packaging_cost"
                type="number"
                step="0.01"
                value={formData.packaging_cost}
                onChange={(e) => setFormData({ ...formData, packaging_cost: e.target.value })}
                placeholder="0.00"
              />
            </div>
          </div>
          <div className="p-4 bg-muted rounded-lg">
            <p className="text-sm font-medium mb-1">Total Cost</p>
            <p className="text-2xl font-bold">${totalCost.toFixed(2)}</p>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="target_price">Target Price ($)</Label>
              <Input
                id="target_price"
                type="number"
                step="0.01"
                value={formData.target_price}
                onChange={(e) => setFormData({ ...formData, target_price: e.target.value })}
                placeholder="0.00"
              />
            </div>
            <div>
              <Label htmlFor="margin_percentage">Target Margin (%)</Label>
              <Input
                id="margin_percentage"
                type="number"
                step="0.1"
                value={formData.margin_percentage}
                onChange={(e) => setFormData({ ...formData, margin_percentage: e.target.value })}
                placeholder="0"
              />
            </div>
          </div>
          <div>
            <Label htmlFor="notes">Notes</Label>
            <Textarea
              id="notes"
              value={formData.notes}
              onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
              placeholder="Pricing strategy notes"
              rows={3}
            />
          </div>
        </div>
        <div className="flex justify-end gap-3 mt-6">
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={handleSave} disabled={isSaving}>
            {isSaving ? "Saving..." : costingData ? "Update" : "Create"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}