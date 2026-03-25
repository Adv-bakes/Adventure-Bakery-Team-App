import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Plus, Box, Trash2, Edit } from "lucide-react";
import { toast } from "@/hooks/use-toast";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { PackagingDialog } from "@/components/PackagingDialog";

const Packaging = () => {
  const [packagingData, setPackagingData] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingData, setEditingData] = useState<any>(null);

  useEffect(() => {
    loadPackagingData();
  }, []);

  const loadPackagingData = async () => {
    setIsLoading(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const { data, error } = await supabase
      .from("packaging")
      .select("*, product:products(product_name)")
      .eq("user_id", user.id);

    if (!error) {
      setPackagingData(data?.map((item: any) => ({
        ...item,
        baked_good_name: item.product?.product_name,
      })) || []);
    }
    setIsLoading(false);
  };

  const handleDelete = async (id: number) => {
    const { error } = await supabase.from("packaging").delete().eq("id", id);
    if (!error) {
      toast({ title: "Packaging deleted successfully" });
      loadPackagingData();
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-4xl font-bold tracking-tight flex items-center gap-3">
            <Box className="h-10 w-10 text-primary" />
            Packaging
          </h1>
          <p className="text-muted-foreground mt-2">Manage packaging materials and compliance</p>
        </div>
        <Button onClick={() => setDialogOpen(true)} size="lg">
          <Plus className="h-5 w-5 mr-2" />
          New Packaging
        </Button>
      </div>

      {packagingData.length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center justify-center py-12">
            <Box className="h-16 w-16 text-muted-foreground mb-4" />
            <h3 className="text-xl font-semibold mb-2">No packaging data yet</h3>
            <Button onClick={() => setDialogOpen(true)}>
              <Plus className="h-4 w-4 mr-2" />
              Add Packaging
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
                  <TableHead>Type</TableHead>
                  <TableHead>Material</TableHead>
                  <TableHead>Cost/Unit</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {packagingData.map((item) => (
                  <TableRow key={item.id}>
                    <TableCell className="font-medium">{item.baked_good_name || "N/A"}</TableCell>
                    <TableCell>{item.package_type || "-"}</TableCell>
                    <TableCell>{item.material || "-"}</TableCell>
                    <TableCell>${item.cost_per_unit?.toFixed(2) || "-"}</TableCell>
                    <TableCell className="text-right">
                      <Button variant="ghost" size="icon" onClick={() => { setEditingData(item); setDialogOpen(true); }}>
                        <Edit className="h-4 w-4" />
                      </Button>
                      <Button variant="ghost" size="icon" onClick={() => handleDelete(item.id)}>
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      <PackagingDialog open={dialogOpen} onClose={() => { setDialogOpen(false); setEditingData(null); loadPackagingData(); }} packagingData={editingData} />
    </div>
  );
};

export default Packaging;