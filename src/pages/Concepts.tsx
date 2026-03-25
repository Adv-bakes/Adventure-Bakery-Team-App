import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Plus, Lightbulb, Trash2, Edit, Package, Ruler } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { toast } from "@/hooks/use-toast";
import { ConceptDialog } from "@/components/ConceptDialog";

interface Concept {
  id: number;
  product_name: string;
  product_type: string;
  target_market: string;
  core_problem_solved: string;
  desired_claims: any;
  notes: string;
  net_weight: string | null;
  net_weight_unit: string | null;
  unit_length: string | null;
  unit_width: string | null;
  unit_height: string | null;
  shape: string | null;
}

const Concepts = () => {
  const [concepts, setConcepts] = useState<Concept[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingConcept, setEditingConcept] = useState<Concept | null>(null);

  useEffect(() => {
    loadConcepts();
  }, []);

  const loadConcepts = async () => {
    setIsLoading(true);
    const { data: { user } } = await supabase.auth.getUser();
    
    if (!user) return;

    const { data, error } = await supabase
      .from("concepts")
      .select("*")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false });

    if (error) {
      toast({ title: "Error loading concepts", variant: "destructive" });
    } else {
      setConcepts(data || []);
    }
    setIsLoading(false);
  };

  const handleDelete = async (id: number) => {
    const { error } = await supabase.from("concepts").delete().eq("id", id);

    if (error) {
      toast({ title: "Error deleting concept", variant: "destructive" });
    } else {
      toast({ title: "Concept deleted successfully" });
      loadConcepts();
    }
  };

  const handleEdit = (concept: Concept) => {
    setEditingConcept(concept);
    setDialogOpen(true);
  };

  const handleDialogClose = (newConceptId?: number | null) => {
    setDialogOpen(false);
    setEditingConcept(null);
    loadConcepts();
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-4xl font-bold tracking-tight flex items-center gap-3">
            <Lightbulb className="h-10 w-10 text-primary" />
            Concepts
          </h1>
          <p className="text-muted-foreground mt-2">
            Define your product ideas and validate your market opportunity
          </p>
        </div>
        <Button onClick={() => setDialogOpen(true)} size="lg">
          <Plus className="h-5 w-5 mr-2" />
          New Concept
        </Button>
      </div>

      {isLoading ? (
        <div className="grid gap-6 md:grid-cols-2">
          {[1, 2, 3, 4].map((i) => (
            <Card key={i}>
              <CardHeader>
                <Skeleton className="h-6 w-3/4" />
                <Skeleton className="h-4 w-1/2 mt-2" />
              </CardHeader>
              <CardContent>
                <Skeleton className="h-20 w-full" />
              </CardContent>
            </Card>
          ))}
        </div>
      ) : concepts.length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center justify-center py-12">
            <Lightbulb className="h-16 w-16 text-muted-foreground mb-4" />
            <h3 className="text-xl font-semibold mb-2">No concepts yet</h3>
            <p className="text-muted-foreground text-center mb-6 max-w-sm">
              Start your journey by defining your first product concept. What problem will you solve?
            </p>
            <Button onClick={() => setDialogOpen(true)}>
              <Plus className="h-4 w-4 mr-2" />
              Create Your First Concept
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-6 md:grid-cols-2">
          {concepts.map((concept) => (
            <Card key={concept.id} className="hover:shadow-[var(--shadow-elegant)] transition-shadow">
              <CardHeader>
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <CardTitle className="text-xl">{concept.product_name}</CardTitle>
                    <CardDescription className="mt-1">{concept.product_type}</CardDescription>
                  </div>
                  <div className="flex gap-2">
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => handleEdit(concept)}
                    >
                      <Edit className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => handleDelete(concept.id)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <p className="text-sm font-medium mb-1">Target Market</p>
                  <p className="text-sm text-muted-foreground">{concept.target_market}</p>
                </div>
                {concept.core_problem_solved && (
                  <div>
                    <p className="text-sm font-medium mb-1">Problem Solved</p>
                    <p className="text-sm text-muted-foreground">{concept.core_problem_solved}</p>
                  </div>
                )}
                {concept.desired_claims && concept.desired_claims.length > 0 && (
                  <div>
                    <p className="text-sm font-medium mb-2">Desired Claims</p>
                    <div className="flex flex-wrap gap-2">
                      {concept.desired_claims.map((claim, idx) => (
                        <Badge key={idx} variant="secondary">{claim}</Badge>
                      ))}
                    </div>
                  </div>
                )}
                
                {/* Product Specifications */}
                {(concept.net_weight || concept.shape || (concept.unit_length && concept.unit_width && concept.unit_height)) && (
                  <div className="border-t pt-4 mt-4">
                    <p className="text-sm font-semibold mb-3 flex items-center gap-2">
                      <Package className="h-4 w-4" />
                      Product Specifications
                    </p>
                    <div className="grid grid-cols-2 gap-3">
                      {concept.net_weight && (
                        <div className="flex items-start gap-2">
                          <div className="min-w-0">
                            <p className="text-xs text-muted-foreground">Net Weight</p>
                            <p className="text-sm font-medium">
                              {concept.net_weight} {concept.net_weight_unit || 'g'}
                            </p>
                          </div>
                        </div>
                      )}
                      {concept.shape && (
                        <div className="flex items-start gap-2">
                          <div className="min-w-0">
                            <p className="text-xs text-muted-foreground">Shape</p>
                            <p className="text-sm font-medium">{concept.shape}</p>
                          </div>
                        </div>
                      )}
                      {concept.unit_length && concept.unit_width && concept.unit_height && (
                        <div className="col-span-2 flex items-start gap-2">
                          <Ruler className="h-4 w-4 text-muted-foreground flex-shrink-0 mt-0.5" />
                          <div className="min-w-0">
                            <p className="text-xs text-muted-foreground">Dimensions (L × W × H)</p>
                            <p className="text-sm font-medium">
                              {concept.unit_length} × {concept.unit_width} × {concept.unit_height}
                            </p>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <ConceptDialog
        open={dialogOpen}
        onClose={handleDialogClose}
        concept={editingConcept}
      />
    </div>
  );
};

export default Concepts;