import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Plus, DollarSign, Trash2, Edit } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "@/hooks/use-toast";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { CostingDialog } from "@/components/CostingDialog";
import { Badge } from "@/components/ui/badge";

interface Costing {
  id: number;
  product_id: number;
  ingredient_cost: number;
  labor_cost: number;
  overhead_cost: number;
  packaging_cost: number;
  total_cost: number;
  target_price: number;
  margin_percentage: number;
  notes: string;
  baked_good_name?: string;
}

const Costing = () => {
  const [costingData, setCostingData] = useState<Costing[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingData, setEditingData] = useState<Costing | null>(null);

  useEffect(() => {
    loadCostingData();
  }, []);

  const loadCostingData = async () => {
    setIsLoading(true);
    const { data: { user } } = await supabase.auth.getUser();
    
    if (!user) return;

    const { data, error } = await supabase
      .from("costing")
      .select("*, product:products(product_name)")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false });

    if (error) {
      toast({ title: "Error loading costing data", variant: "destructive" });
    } else {
      const formatted = data?.map((item: any) => ({
        ...item,
        baked_good_name: item.product?.product_name,
      })) || [];
      setCostingData(formatted);
    }
    setIsLoading(false);
  };

  const handleDelete = async (id: number) => {
    const { error } = await supabase.from("costing").delete().eq("id", id);

    if (error) {
      toast({ title: "Error deleting costing data", variant: "destructive" });
    } else {
      toast({ title: "Costing data deleted successfully" });
      loadCostingData();
    }
  };

  const handleEdit = (data: Costing) => {
    setEditingData(data);
    setDialogOpen(true);
  };

  const handleDialogClose = () => {
    setDialogOpen(false);
    setEditingData(null);
    loadCostingData();
  };

  const calculateMargin = (totalCost: number, targetPrice: number) => {
    if (!targetPrice || targetPrice === 0) return "0";
    return ((targetPrice - totalCost) / targetPrice * 100).toFixed(1);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-4xl font-bold tracking-tight flex items-center gap-3 tp-page-title">
            <DollarSign className="h-10 w-10 text-primary" />
            Costing & Pricing
          </h1>
          <p className="mt-2 tp-page-subtitle">
            Calculate production costs and set profitable prices
          </p>
        </div>
        <Button onClick={() => setDialogOpen(true)} size="lg">
          <Plus className="h-5 w-5 mr-2" />
          New Costing
        </Button>
      </div>

      {isLoading ? (
        <Card>
          <CardContent className="pt-6">
            {[1, 2, 3].map((i) => (
              <Skeleton key={i} className="h-12 w-full mb-2" />
            ))}
          </CardContent>
        </Card>
      ) : costingData.length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center justify-center py-12">
            <DollarSign className="h-16 w-16 text-muted-foreground mb-4" />
            <h3 className="text-xl font-semibold mb-2">No costing data yet</h3>
            <p className="text-muted-foreground text-center mb-6 max-w-sm">
              Calculate your production costs to determine profitable pricing strategies
            </p>
            <Button onClick={() => setDialogOpen(true)}>
              <Plus className="h-4 w-4 mr-2" />
              Create Your First Costing
            </Button>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardContent className="pt-6">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Product</TableHead>
                  <TableHead>Total Cost</TableHead>
                  <TableHead>Target Price</TableHead>
                  <TableHead>Margin</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {costingData.map((item) => {
                  const margin = calculateMargin(item.total_cost, item.target_price);
                  const marginNum = parseFloat(margin);
                  return (
                    <TableRow key={item.id}>
                      <TableCell className="font-medium">{item.baked_good_name || "N/A"}</TableCell>
                      <TableCell>${item.total_cost?.toFixed(2) || "0.00"}</TableCell>
                      <TableCell>${item.target_price?.toFixed(2) || "-"}</TableCell>
                      <TableCell>
                        {item.target_price ? (
                          <Badge variant={marginNum >= 30 ? "default" : marginNum >= 20 ? "secondary" : "destructive"}>
                            {margin}%
                          </Badge>
                        ) : (
                          "-"
                        )}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-2">
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleEdit(item)}
                          >
                            <Edit className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleDelete(item.id)}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      <CostingDialog
        open={dialogOpen}
        onClose={handleDialogClose}
        costingData={editingData}
      />
    </div>
  );
};

export default Costing;