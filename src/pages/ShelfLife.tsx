import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Plus, Clock, Trash2, Edit } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "@/hooks/use-toast";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ShelfLifeDialog } from "@/components/ShelfLifeDialog";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";

interface ShelfLife {
  id: number;
  product_id: number;
  storage_condition: string;
  shelf_life_days: number;
  test_date: string;
  notes: string;
  aw_test_result?: number;
  moisture_pct?: number;
  ph_level?: number;
  preservation_strategy?: string;
  functional_ingredients?: any;
  barrier_type?: any;
  packaging_material?: string;
  baked_good_name?: string;
}

const ShelfLife = () => {
  const [shelfLifeData, setShelfLifeData] = useState<ShelfLife[]>([]);
  const [filteredData, setFilteredData] = useState<ShelfLife[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingData, setEditingData] = useState<ShelfLife | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [shelfLifeFilter, setShelfLifeFilter] = useState<"all" | "short" | "medium" | "long">("all");

  useEffect(() => {
    loadShelfLifeData();
  }, []);

  useEffect(() => {
    let filtered = [...shelfLifeData];

    // Search filter
    if (searchQuery) {
      filtered = filtered.filter((item) =>
        item.baked_good_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        item.storage_condition?.toLowerCase().includes(searchQuery.toLowerCase())
      );
    }

    // Shelf life duration filter
    if (shelfLifeFilter !== "all") {
      filtered = filtered.filter((item) => {
        const days = item.shelf_life_days || 0;
        if (shelfLifeFilter === "short") return days <= 7;
        if (shelfLifeFilter === "medium") return days > 7 && days <= 30;
        if (shelfLifeFilter === "long") return days > 30;
        return true;
      });
    }

    setFilteredData(filtered);
  }, [shelfLifeData, searchQuery, shelfLifeFilter]);

  const loadShelfLifeData = async () => {
    setIsLoading(true);
    const { data: { user } } = await supabase.auth.getUser();
    
    if (!user) return;

    const { data, error } = await supabase
      .from("shelf_life")
      .select("*, product:products(product_name)")
      .eq("user_id", user.id)
      .order("test_date", { ascending: false });

    if (error) {
      toast({ title: "Error loading shelf life data", variant: "destructive" });
    } else {
      const formatted = data?.map((item: any) => ({
        ...item,
        baked_good_name: item.product?.product_name,
      })) || [];
      setShelfLifeData(formatted);
    }
    setIsLoading(false);
  };

  const handleDelete = async (id: number) => {
    const { error } = await supabase.from("shelf_life").delete().eq("id", id);

    if (error) {
      toast({ title: "Error deleting shelf life data", variant: "destructive" });
    } else {
      toast({ title: "Shelf life data deleted successfully" });
      loadShelfLifeData();
    }
  };

  const handleEdit = (data: ShelfLife) => {
    setEditingData(data);
    setDialogOpen(true);
  };

  const handleDialogClose = () => {
    setDialogOpen(false);
    setEditingData(null);
    loadShelfLifeData();
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-4xl font-bold tracking-tight flex items-center gap-3">
            <Clock className="h-10 w-10 text-primary" />
            Shelf-Life Tracker
          </h1>
          <p className="text-muted-foreground mt-2">
            Manage testing data and learn the science behind product stability
          </p>
        </div>
      </div>

      <div className="space-y-6 mt-6">
          <div className="flex items-center justify-between">
            <p className="text-muted-foreground">
              Track and manage your product stability testing records
            </p>
            <Button onClick={() => setDialogOpen(true)} size="lg">
              <Plus className="h-5 w-5 mr-2" />
              New Test
            </Button>
          </div>

          {/* Filters */}
          <Card>
            <CardContent className="pt-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-medium mb-2 block">Search by Product or Condition</label>
                  <Input
                    placeholder="Search..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                  />
                </div>
                <div>
                  <label className="text-sm font-medium mb-2 block">Filter by Duration</label>
                  <div className="flex gap-2">
                    <Badge
                      variant={shelfLifeFilter === "all" ? "default" : "outline"}
                      className="cursor-pointer"
                      onClick={() => setShelfLifeFilter("all")}
                    >
                      All
                    </Badge>
                    <Badge
                      variant={shelfLifeFilter === "short" ? "default" : "outline"}
                      className="cursor-pointer"
                      onClick={() => setShelfLifeFilter("short")}
                    >
                      ≤7 days
                    </Badge>
                    <Badge
                      variant={shelfLifeFilter === "medium" ? "default" : "outline"}
                      className="cursor-pointer"
                      onClick={() => setShelfLifeFilter("medium")}
                    >
                      8-30 days
                    </Badge>
                    <Badge
                      variant={shelfLifeFilter === "long" ? "default" : "outline"}
                      className="cursor-pointer"
                      onClick={() => setShelfLifeFilter("long")}
                    >
                      &gt;30 days
                    </Badge>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {isLoading ? (
            <Card>
              <CardContent className="pt-6">
                {[1, 2, 3].map((i) => (
                  <Skeleton key={i} className="h-12 w-full mb-2" />
                ))}
              </CardContent>
            </Card>
          ) : filteredData.length === 0 ? (
            <Card className="border-dashed">
              <CardContent className="flex flex-col items-center justify-center py-12">
                <Clock className="h-16 w-16 text-muted-foreground mb-4" />
                <h3 className="text-xl font-semibold mb-2">
                  {shelfLifeData.length === 0 ? "No shelf life tests yet" : "No matching records"}
                </h3>
                <p className="text-muted-foreground text-center mb-6 max-w-sm">
                  {shelfLifeData.length === 0
                    ? "Start testing your products under different storage conditions to determine optimal shelf life"
                    : "Try adjusting your search or filter criteria"}
                </p>
                {shelfLifeData.length === 0 && (
                  <Button onClick={() => setDialogOpen(true)}>
                    <Plus className="h-4 w-4 mr-2" />
                    Record Your First Test
                  </Button>
                )}
              </CardContent>
            </Card>
          ) : (
            <Card>
              <CardContent className="pt-6">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Product</TableHead>
                      <TableHead>Storage</TableHead>
                      <TableHead>Shelf Life</TableHead>
                      <TableHead>Water Activity</TableHead>
                      <TableHead>Moisture %</TableHead>
                      <TableHead>pH</TableHead>
                      <TableHead>Packaging</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredData.map((item) => (
                      <TableRow key={item.id}>
                        <TableCell className="font-medium">{item.baked_good_name || "N/A"}</TableCell>
                        <TableCell>{item.storage_condition}</TableCell>
                        <TableCell>
                          <Badge variant={
                            (item.shelf_life_days || 0) <= 7 ? "destructive" :
                            (item.shelf_life_days || 0) <= 30 ? "secondary" : "default"
                          }>
                            {item.shelf_life_days ? `${item.shelf_life_days} days` : "-"}
                          </Badge>
                        </TableCell>
                        <TableCell>{item.aw_test_result ? item.aw_test_result.toFixed(3) : "-"}</TableCell>
                        <TableCell>{item.moisture_pct ? `${item.moisture_pct}%` : "-"}</TableCell>
                        <TableCell>{item.ph_level ? item.ph_level.toFixed(2) : "-"}</TableCell>
                        <TableCell className="max-w-[150px] truncate">{item.packaging_material || "-"}</TableCell>
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
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          )}
      </div>

      <ShelfLifeDialog
        open={dialogOpen}
        onClose={handleDialogClose}
        shelfLifeData={editingData}
      />
    </div>
  );
};

export default ShelfLife;