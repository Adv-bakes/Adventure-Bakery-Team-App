import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import { Plus, Trash2 } from "lucide-react";

interface ShelfLifeDialogProps {
  open: boolean;
  onClose: () => void;
  shelfLifeData?: any;
  conceptId?: number;
}

export function ShelfLifeDialog({ open, onClose, shelfLifeData, conceptId }: ShelfLifeDialogProps) {
  const [formData, setFormData] = useState({
    product_id: "",
    storage_condition: "",
    shelf_life_days: "",
    test_date: "",
    notes: "",
    aw_test_result: "",
    moisture_pct: "",
    ph_level: "",
    preservation_strategy: "",
    packaging_material: "",
  });
  const [functionalIngredients, setFunctionalIngredients] = useState<Array<{ name: string; purpose: string }>>([]);
  const [barrierTypes, setBarrierTypes] = useState<Array<{ type: string; description: string }>>([]);
  const [bakedGoods, setBakedGoods] = useState<any[]>([]);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    loadBakedGoods();
  }, []);

  useEffect(() => {
    if (shelfLifeData) {
      setFormData({
        product_id: shelfLifeData.product_id?.toString() || "",
        storage_condition: shelfLifeData.storage_condition || "",
        shelf_life_days: shelfLifeData.shelf_life_days?.toString() || "",
        test_date: shelfLifeData.test_date || "",
        notes: shelfLifeData.notes || "",
        aw_test_result: shelfLifeData.aw_test_result?.toString() || "",
        moisture_pct: shelfLifeData.moisture_pct?.toString() || "",
        ph_level: shelfLifeData.ph_level?.toString() || "",
        preservation_strategy: shelfLifeData.preservation_strategy || "",
        packaging_material: shelfLifeData.packaging_material || "",
      });
      setFunctionalIngredients(shelfLifeData.functional_ingredients || []);
      setBarrierTypes(shelfLifeData.barrier_type || []);
    } else {
      setFormData({
        product_id: "",
        storage_condition: "",
        shelf_life_days: "",
        test_date: "",
        notes: "",
        aw_test_result: "",
        moisture_pct: "",
        ph_level: "",
        preservation_strategy: "",
        packaging_material: "",
      });
      setFunctionalIngredients([]);
      setBarrierTypes([]);
    }
  }, [shelfLifeData, open]);

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

  const handleSave = async () => {
    if (!formData.product_id || !formData.storage_condition) {
      toast({ title: "Product and storage condition are required", variant: "destructive" });
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
      storage_condition: formData.storage_condition,
      shelf_life_days: formData.shelf_life_days ? parseInt(formData.shelf_life_days) : null,
      test_date: formData.test_date || null,
      notes: formData.notes,
      aw_test_result: formData.aw_test_result ? parseFloat(formData.aw_test_result) : null,
      moisture_pct: formData.moisture_pct ? parseFloat(formData.moisture_pct) : null,
      ph_level: formData.ph_level ? parseFloat(formData.ph_level) : null,
      preservation_strategy: formData.preservation_strategy || null,
      packaging_material: formData.packaging_material || null,
      functional_ingredients: functionalIngredients.length > 0 ? functionalIngredients : null,
      barrier_type: barrierTypes.length > 0 ? barrierTypes : null,
      user_id: user.id,
      concept_id: conceptId || null,
    };

    let error;
    if (shelfLifeData) {
      ({ error } = await supabase
        .from("shelf_life")
        .update(dataToSave)
        .eq("id", shelfLifeData.id));
    } else {
      ({ error } = await supabase
        .from("shelf_life")
        .insert([dataToSave as any]));
    }

    setIsSaving(false);

    if (error) {
      toast({ title: "Error saving shelf life data", variant: "destructive" });
    } else {
      toast({ title: `Shelf life data ${shelfLifeData ? "updated" : "created"} successfully` });
      onClose();
    }
  };

  const addFunctionalIngredient = () => {
    setFunctionalIngredients([...functionalIngredients, { name: "", purpose: "" }]);
  };

  const updateFunctionalIngredient = (index: number, field: "name" | "purpose", value: string) => {
    const updated = [...functionalIngredients];
    updated[index][field] = value;
    setFunctionalIngredients(updated);
  };

  const removeFunctionalIngredient = (index: number) => {
    setFunctionalIngredients(functionalIngredients.filter((_, i) => i !== index));
  };

  const addBarrierType = () => {
    setBarrierTypes([...barrierTypes, { type: "", description: "" }]);
  };

  const updateBarrierType = (index: number, field: "type" | "description", value: string) => {
    const updated = [...barrierTypes];
    updated[index][field] = value;
    setBarrierTypes(updated);
  };

  const removeBarrierType = (index: number) => {
    setBarrierTypes(barrierTypes.filter((_, i) => i !== index));
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{shelfLifeData ? "Edit Shelf Life Test" : "New Shelf Life Test"}</DialogTitle>
          <DialogDescription>
            Record comprehensive product stability testing data
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-6">
          {/* Basic Information */}
          <div className="space-y-4">
            <h3 className="font-semibold text-lg">Basic Information</h3>
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
                <Label htmlFor="storage_condition">Storage Condition *</Label>
                <Input
                  id="storage_condition"
                  value={formData.storage_condition}
                  onChange={(e) => setFormData({ ...formData, storage_condition: e.target.value })}
                  placeholder="Room temp, Refrigerated, Frozen"
                />
              </div>
              <div>
                <Label htmlFor="shelf_life_days">Target Shelf Life (days)</Label>
                <Input
                  id="shelf_life_days"
                  type="number"
                  value={formData.shelf_life_days}
                  onChange={(e) => setFormData({ ...formData, shelf_life_days: e.target.value })}
                  placeholder="0"
                />
              </div>
            </div>
            <div>
              <Label htmlFor="test_date">Test Date</Label>
              <Input
                id="test_date"
                type="date"
                value={formData.test_date}
                onChange={(e) => setFormData({ ...formData, test_date: e.target.value })}
              />
            </div>
          </div>

          {/* Testing Parameters */}
          <div className="space-y-4">
            <h3 className="font-semibold text-lg">Testing Parameters</h3>
            <div className="grid grid-cols-3 gap-4">
              <div>
                <Label htmlFor="aw_test_result">Water Activity (Aw)</Label>
                <Input
                  id="aw_test_result"
                  type="number"
                  step="0.001"
                  value={formData.aw_test_result}
                  onChange={(e) => setFormData({ ...formData, aw_test_result: e.target.value })}
                  placeholder="0.000"
                />
              </div>
              <div>
                <Label htmlFor="moisture_pct">Moisture %</Label>
                <Input
                  id="moisture_pct"
                  type="number"
                  step="0.1"
                  value={formData.moisture_pct}
                  onChange={(e) => setFormData({ ...formData, moisture_pct: e.target.value })}
                  placeholder="0.0"
                />
              </div>
              <div>
                <Label htmlFor="ph_level">pH Level</Label>
                <Input
                  id="ph_level"
                  type="number"
                  step="0.01"
                  value={formData.ph_level}
                  onChange={(e) => setFormData({ ...formData, ph_level: e.target.value })}
                  placeholder="7.00"
                />
              </div>
            </div>
          </div>

          {/* Preservation & Packaging */}
          <div className="space-y-4">
            <h3 className="font-semibold text-lg">Preservation & Packaging</h3>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="preservation_strategy">Preservation Strategy</Label>
                <Input
                  id="preservation_strategy"
                  value={formData.preservation_strategy}
                  onChange={(e) => setFormData({ ...formData, preservation_strategy: e.target.value })}
                  placeholder="Natural acids, humectants, etc."
                />
              </div>
              <div>
                <Label htmlFor="packaging_material">Packaging Material</Label>
                <Input
                  id="packaging_material"
                  value={formData.packaging_material}
                  onChange={(e) => setFormData({ ...formData, packaging_material: e.target.value })}
                  placeholder="PET, metallized film, etc."
                />
              </div>
            </div>
          </div>

          {/* Functional Ingredients */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="font-semibold text-lg">Functional Ingredients</h3>
              <Button type="button" variant="outline" size="sm" onClick={addFunctionalIngredient}>
                <Plus className="h-4 w-4 mr-1" />
                Add
              </Button>
            </div>
            {functionalIngredients.map((ing, index) => (
              <div key={index} className="flex gap-2">
                <Input
                  placeholder="Ingredient name"
                  value={ing.name}
                  onChange={(e) => updateFunctionalIngredient(index, "name", e.target.value)}
                />
                <Input
                  placeholder="Purpose"
                  value={ing.purpose}
                  onChange={(e) => updateFunctionalIngredient(index, "purpose", e.target.value)}
                />
                <Button type="button" variant="ghost" size="icon" onClick={() => removeFunctionalIngredient(index)}>
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            ))}
          </div>

          {/* Barrier Types */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="font-semibold text-lg">Packaging Barriers</h3>
              <Button type="button" variant="outline" size="sm" onClick={addBarrierType}>
                <Plus className="h-4 w-4 mr-1" />
                Add
              </Button>
            </div>
            {barrierTypes.map((barrier, index) => (
              <div key={index} className="flex gap-2">
                <Input
                  placeholder="Barrier type (e.g., oxygen, UV)"
                  value={barrier.type}
                  onChange={(e) => updateBarrierType(index, "type", e.target.value)}
                />
                <Input
                  placeholder="Description"
                  value={barrier.description}
                  onChange={(e) => updateBarrierType(index, "description", e.target.value)}
                />
                <Button type="button" variant="ghost" size="icon" onClick={() => removeBarrierType(index)}>
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            ))}
          </div>

          {/* Notes */}
          <div>
            <Label htmlFor="notes">Additional Notes</Label>
            <Textarea
              id="notes"
              value={formData.notes}
              onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
              placeholder="Test conditions, observations, results"
              rows={4}
            />
          </div>
        </div>
        <div className="flex justify-end gap-3 mt-6">
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={handleSave} disabled={isSaving}>
            {isSaving ? "Saving..." : shelfLifeData ? "Update" : "Create"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}