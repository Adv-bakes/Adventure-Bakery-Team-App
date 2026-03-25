import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Plus, Pencil, Trash2, Cookie } from "lucide-react";
import { toast } from "sonner";
import { Skeleton } from "@/components/ui/skeleton";
import BakedGoodDialog from "@/components/BakedGoodDialog";

interface BakedGood {
  id: number;
  product_name: string;
  category: string | null;
  yield_units: number | null;
  unit_size_oz: number | null;
  notes: string | null;
}

const BakedGoods = () => {
  const [bakedGoods, setBakedGoods] = useState<BakedGood[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<BakedGood | null>(null);

  useEffect(() => {
    loadBakedGoods();
  }, []);

  const loadBakedGoods = async () => {
    setIsLoading(true);
    const { data: { user } } = await supabase.auth.getUser();
    
    if (!user) return;

    const { data, error } = await supabase
      .from("products")
      .select("*")
      .eq("user_id", user.id)
      .order("product_name");

    if (error) {
      toast.error("Failed to load products");
      console.error(error);
    } else {
      setBakedGoods(data || []);
    }
    setIsLoading(false);
  };

  const handleDelete = async (id: number) => {
    if (!confirm("Are you sure you want to delete this item? This will also delete all associated formulas.")) {
      return;
    }

    const { error } = await supabase
      .from("products")
      .delete()
      .eq("id", id);

    if (error) {
      toast.error("Failed to delete");
      console.error(error);
    } else {
      toast.success("Deleted successfully");
      loadBakedGoods();
    }
  };

  const handleEdit = (item: BakedGood) => {
    setEditingItem(item);
    setDialogOpen(true);
  };

  const handleAdd = () => {
    setEditingItem(null);
    setDialogOpen(true);
  };

  const handleDialogClose = (shouldRefresh?: boolean) => {
    setDialogOpen(false);
    setEditingItem(null);
    if (shouldRefresh) {
      loadBakedGoods();
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-4xl font-bold tracking-tight">Products</h1>
          <p className="text-muted-foreground mt-2">
            Manage your product catalog
          </p>
        </div>
        <Button onClick={handleAdd}>
          <Plus className="w-4 h-4 mr-2" />
          Add Product
        </Button>
      </div>

      {isLoading ? (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {[1, 2, 3].map((i) => (
            <Card key={i}>
              <CardHeader>
                <Skeleton className="h-6 w-3/4" />
                <Skeleton className="h-4 w-1/2" />
              </CardHeader>
              <CardContent>
                <Skeleton className="h-20 w-full" />
              </CardContent>
            </Card>
          ))}
        </div>
      ) : bakedGoods.length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center justify-center py-12">
            <Cookie className="w-12 h-12 text-muted-foreground mb-4" />
            <p className="text-lg font-medium mb-2">No products yet</p>
            <p className="text-sm text-muted-foreground mb-4">Get started by adding your first product</p>
            <Button onClick={handleAdd}>
              <Plus className="w-4 h-4 mr-2" />
              Add Your First Product
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {bakedGoods.map((item) => (
            <Card key={item.id} className="transition-all hover:shadow-[var(--shadow-elegant)]">
              <CardHeader>
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <CardTitle className="text-xl">{item.product_name}</CardTitle>
                    {item.category && (
                      <CardDescription className="capitalize">{item.category}</CardDescription>
                    )}
                  </div>
                  <div className="flex gap-1">
                    <Button variant="ghost" size="icon" onClick={() => handleEdit(item)}>
                      <Pencil className="w-4 h-4" />
                    </Button>
                    <Button variant="ghost" size="icon" onClick={() => handleDelete(item.id)}>
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-2">
                {item.yield_units && (
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Yield:</span>
                    <span className="font-medium">{item.yield_units} units</span>
                  </div>
                )}
                {item.unit_size_oz && (
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Unit Size:</span>
                    <span className="font-medium">{item.unit_size_oz} oz</span>
                  </div>
                )}
                {item.notes && (
                  <p className="text-sm text-muted-foreground pt-2 border-t">
                    {item.notes}
                  </p>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <BakedGoodDialog
        open={dialogOpen}
        onOpenChange={handleDialogClose}
        editingItem={editingItem}
      />
    </div>
  );
};

export default BakedGoods;
