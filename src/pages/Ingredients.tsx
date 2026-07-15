import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Plus, Package, Trash2, Edit } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { toast } from "@/hooks/use-toast";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { IngredientDialog } from "@/components/IngredientDialog";

interface Ingredient {
  id: string;
  ingredient_name: string;
  function_in_formula: string;
  specification_notes: string;
  allergens: any;
  certifications: any;
  sourceability: string;
  additional_notes: string;
}

const Ingredients = () => {
  const [ingredients, setIngredients] = useState<Ingredient[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingIngredient, setEditingIngredient] = useState<Ingredient | null>(null);

  useEffect(() => {
    loadIngredients();
  }, []);

  const loadIngredients = async () => {
    setIsLoading(true);
    const { data: { user } } = await supabase.auth.getUser();
    
    if (!user) return;

    const { data, error } = await supabase
      .from("ingredients")
      .select("*")
      .eq("user_id", user.id)
      .order("ingredient_name", { ascending: true });

    if (error) {
      toast({ title: "Error loading ingredients", variant: "destructive" });
    } else {
      setIngredients(data || []);
    }
    setIsLoading(false);
  };

  const handleDelete = async (id: string) => {
    const { error } = await supabase.from("ingredients").delete().eq("id", id);

    if (error) {
      toast({ title: "Error deleting ingredient", variant: "destructive" });
    } else {
      toast({ title: "Ingredient deleted successfully" });
      loadIngredients();
    }
  };

  const handleEdit = (ingredient: Ingredient) => {
    setEditingIngredient(ingredient);
    setDialogOpen(true);
  };

  const handleDialogClose = () => {
    setDialogOpen(false);
    setEditingIngredient(null);
    loadIngredients();
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-4xl font-bold tracking-tight flex items-center gap-3 tp-page-title">
            <Package className="h-10 w-10 text-primary" />
            Ingredients
          </h1>
          <p className="mt-2 tp-page-subtitle">
            Manage your ingredient library with suppliers, costs, and allergen information
          </p>
        </div>
        <Button onClick={() => setDialogOpen(true)} size="lg">
          <Plus className="h-5 w-5 mr-2" />
          New Ingredient
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
      ) : ingredients.length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center justify-center py-12">
            <Package className="h-16 w-16 text-muted-foreground mb-4" />
            <h3 className="text-xl font-semibold mb-2">No ingredients yet</h3>
            <p className="text-muted-foreground text-center mb-6 max-w-sm">
              Build your ingredient library to track costs, suppliers, and allergen information
            </p>
            <Button onClick={() => setDialogOpen(true)}>
              <Plus className="h-4 w-4 mr-2" />
              Add Your First Ingredient
            </Button>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardContent className="pt-6">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Ingredient</TableHead>
                  <TableHead>Supplier</TableHead>
                  <TableHead>Cost/Unit</TableHead>
                  <TableHead>Unit</TableHead>
                  <TableHead>Allergens</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {ingredients.map((ingredient) => (
                  <TableRow key={ingredient.id}>
                    <TableCell className="font-medium">{ingredient.ingredient_name}</TableCell>
                    <TableCell>{ingredient.function_in_formula || "-"}</TableCell>
                    <TableCell>
                      {ingredient.allergens && ingredient.allergens.length > 0 ? (
                        <div className="flex flex-wrap gap-1">
                          {ingredient.allergens.map((allergen) => (
                            <Badge key={allergen} variant="destructive" className="text-xs">
                              {allergen}
                            </Badge>
                          ))}
                        </div>
                      ) : (
                        "-"
                      )}
                    </TableCell>
                    <TableCell>
                      {ingredient.certifications && ingredient.certifications.length > 0 ? (
                        <div className="flex flex-wrap gap-1">
                          {ingredient.certifications.map((cert) => (
                            <Badge key={cert} variant="secondary" className="text-xs">
                              {cert}
                            </Badge>
                          ))}
                        </div>
                      ) : (
                        "-"
                      )}
                    </TableCell>
                    <TableCell>{ingredient.sourceability || "-"}</TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-2">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleEdit(ingredient)}
                        >
                          <Edit className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleDelete(ingredient.id)}
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

      <IngredientDialog
        open={dialogOpen}
        onClose={handleDialogClose}
        ingredient={editingIngredient}
      />
    </div>
  );
};

export default Ingredients;