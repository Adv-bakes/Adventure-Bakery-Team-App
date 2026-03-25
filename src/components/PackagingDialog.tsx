import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";

export function PackagingDialog({ open, onClose, packagingData, conceptId }: any) {
  const [formData, setFormData] = useState({ product_id: "", package_type: "", material: "", cost_per_unit: "" });
  const [bakedGoods, setBakedGoods] = useState<any[]>([]);

  useEffect(() => {
    loadBakedGoods();
    if (packagingData) {
      setFormData({
        product_id: packagingData.product_id?.toString() || "",
        package_type: packagingData.package_type || "",
        material: packagingData.material || "",
        cost_per_unit: packagingData.cost_per_unit?.toString() || "",
      });
    }
  }, [packagingData, open]);

  const loadBakedGoods = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    const { data } = await supabase.from("products").select("id, product_name").eq("user_id", user.id);
    setBakedGoods(data || []);
  };

  const handleSave = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const dataToSave = { ...formData, product_id: parseInt(formData.product_id), cost_per_unit: formData.cost_per_unit ? parseFloat(formData.cost_per_unit) : null, user_id: user.id, concept_id: conceptId || null };

    const { error } = packagingData 
      ? await supabase.from("packaging").update(dataToSave).eq("id", packagingData.id)
      : await supabase.from("packaging").insert([dataToSave as any]);

    if (!error) {
      toast({ title: `Packaging ${packagingData ? "updated" : "created"} successfully` });
      onClose();
    }
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent>
        <DialogHeader><DialogTitle>{packagingData ? "Edit" : "New"} Packaging</DialogTitle></DialogHeader>
        <div className="space-y-4">
          <div>
            <Label>Product</Label>
            <Select value={formData.product_id} onValueChange={(v) => setFormData({ ...formData, product_id: v })}>
              <SelectTrigger><SelectValue placeholder="Select product" /></SelectTrigger>
              <SelectContent>{bakedGoods.map((bg) => <SelectItem key={bg.id} value={bg.id.toString()}>{bg.product_name}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <Input placeholder="Package Type" value={formData.package_type} onChange={(e) => setFormData({ ...formData, package_type: e.target.value })} />
          <Input placeholder="Material" value={formData.material} onChange={(e) => setFormData({ ...formData, material: e.target.value })} />
          <Input type="number" step="0.01" placeholder="Cost per unit" value={formData.cost_per_unit} onChange={(e) => setFormData({ ...formData, cost_per_unit: e.target.value })} />
        </div>
        <div className="flex justify-end gap-3 mt-6">
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={handleSave}>Save</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}