import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { toast } from "sonner";

interface BakedGood {
  id: number;
  product_name: string;
  category: string | null;
  yield_units: number | null;
  unit_size_oz: number | null;
  notes: string | null;
}

interface BakedGoodDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  editingItem: BakedGood | null;
  conceptId?: number;
}

const BakedGoodDialog = ({ open, onOpenChange, editingItem, conceptId }: BakedGoodDialogProps) => {
  const [isLoading, setIsLoading] = useState(false);
  const [formData, setFormData] = useState({
    product_name: "",
    category: "baked",
    yield_units: "",
    unit_size_oz: "",
    notes: "",
  });

  useEffect(() => {
    if (editingItem) {
      setFormData({
        product_name: editingItem.product_name,
        category: editingItem.category || "baked",
        yield_units: editingItem.yield_units?.toString() || "",
        unit_size_oz: editingItem.unit_size_oz?.toString() || "",
        notes: editingItem.notes || "",
      });
    } else {
      setFormData({
        product_name: "",
        category: "baked",
        yield_units: "",
        unit_size_oz: "",
        notes: "",
      });
    }
  }, [editingItem, open]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      toast.error("You must be logged in");
      setIsLoading(false);
      return;
    }

    const dataToSave = {
      product_name: formData.product_name,
      category: formData.category,
      yield_units: formData.yield_units ? parseFloat(formData.yield_units) : null,
      unit_size_oz: formData.unit_size_oz ? parseFloat(formData.unit_size_oz) : null,
      notes: formData.notes || null,
      user_id: user.id,
      concept_id: conceptId || null,
    };

    if (editingItem) {
      const { error } = await supabase
        .from("products")
        .update(dataToSave)
        .eq("id", editingItem.id);

      if (error) {
        toast.error("Failed to update");
        console.error(error);
      } else {
        toast.success("Updated successfully");
        onOpenChange(true);
      }
    } else {
      const { error } = await supabase
        .from("products")
        .insert([dataToSave as any]);

      if (error) {
        toast.error("Failed to create");
        console.error(error);
      } else {
        toast.success("Created successfully");
        onOpenChange(true);
      }
    }

    setIsLoading(false);
  };

  return (
    <Dialog open={open} onOpenChange={() => onOpenChange(false)}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{editingItem ? "Edit" : "Add"} Product</DialogTitle>
          <DialogDescription>
            {editingItem ? "Update the details below" : "Fill in the details for your new product"}
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="product_name">Product Name *</Label>
            <Input
              id="product_name"
              value={formData.product_name}
              onChange={(e) => setFormData({ ...formData, product_name: e.target.value })}
              placeholder="e.g., Chocolate Chip Cookie"
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="category">Category</Label>
            <Input
              id="category"
              value={formData.category}
              onChange={(e) => setFormData({ ...formData, category: e.target.value })}
              placeholder="e.g., baked, powder, sauce"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="yield_units">Yield (units)</Label>
              <Input
                id="yield_units"
                type="number"
                step="0.01"
                value={formData.yield_units}
                onChange={(e) => setFormData({ ...formData, yield_units: e.target.value })}
                placeholder="24"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="unit_size_oz">Unit Size (oz)</Label>
              <Input
                id="unit_size_oz"
                type="number"
                step="0.01"
                value={formData.unit_size_oz}
                onChange={(e) => setFormData({ ...formData, unit_size_oz: e.target.value })}
                placeholder="2.5"
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="notes">Notes</Label>
            <Textarea
              id="notes"
              value={formData.notes}
              onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
              placeholder="Add any additional notes..."
              rows={3}
            />
          </div>

          <div className="flex gap-2 pt-4">
            <Button type="button" variant="outline" className="flex-1" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" className="flex-1" disabled={isLoading}>
              {isLoading ? "Saving..." : editingItem ? "Update" : "Create"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
};

export default BakedGoodDialog;
