import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Lightbulb, Package, Cookie, FlaskConical, Clock, DollarSign, Box, CheckCircle2 } from "lucide-react";
import { useNavigate } from "react-router-dom";

interface ModuleStats {
  concepts: number;
  ingredients: number;
  bakedGoods: number;
  formulas: number;
  shelfLife: number;
  costing: number;
  packaging: number;
  readiness: number;
}

const FounderDashboard = () => {
  const [stats, setStats] = useState<ModuleStats>({
    concepts: 0,
    ingredients: 0,
    bakedGoods: 0,
    formulas: 0,
    shelfLife: 0,
    costing: 0,
    packaging: 0,
    readiness: 0,
  });
  const [isLoading, setIsLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    loadStats();
  }, []);

  const loadStats = async () => {
    setIsLoading(true);
    const { data: { user } } = await supabase.auth.getUser();
    
    if (!user) return;

    const [
      conceptsResult,
      ingredientsResult,
      bakedGoodsResult,
      formulasResult,
      shelfLifeResult,
      costingResult,
      packagingResult,
      readinessResult,
    ] = await Promise.all([
      supabase.from("concepts").select("id", { count: "exact" }).eq("user_id", user.id),
      supabase.from("ingredients").select("id", { count: "exact" }).eq("user_id", user.id),
      supabase.from("products").select("id", { count: "exact" }).eq("user_id", user.id),
      supabase.from("formulas").select("id", { count: "exact" }).eq("user_id", user.id),
      supabase.from("shelf_life").select("id", { count: "exact" }).eq("user_id", user.id),
      supabase.from("costing").select("id", { count: "exact" }).eq("user_id", user.id),
      supabase.from("packaging").select("id", { count: "exact" }).eq("user_id", user.id),
      supabase.from("readiness").select("overall_readiness_percent").eq("user_id", user.id),
    ]);

    const avgReadiness = readinessResult.data?.length 
      ? Math.round(readinessResult.data.reduce((acc, r) => acc + (r.overall_readiness_percent || 0), 0) / readinessResult.data.length)
      : 0;

    setStats({
      concepts: conceptsResult.count || 0,
      ingredients: ingredientsResult.count || 0,
      bakedGoods: bakedGoodsResult.count || 0,
      formulas: formulasResult.count || 0,
      shelfLife: shelfLifeResult.count || 0,
      costing: costingResult.count || 0,
      packaging: packagingResult.count || 0,
      readiness: avgReadiness,
    });
    setIsLoading(false);
  };

  const modules = [
    {
      icon: Lightbulb,
      title: "Concepts",
      count: stats.concepts,
      color: "from-amber-500/20 to-amber-600/20",
      path: "/concepts",
      description: "Product ideas & market validation",
    },
    {
      icon: Package,
      title: "Ingredients",
      count: stats.ingredients,
      color: "from-green-500/20 to-green-600/20",
      path: "/ingredients",
      description: "Sourcing & allergen tracking",
    },
    {
      icon: Cookie,
      title: "Baked Goods",
      count: stats.bakedGoods,
      color: "from-orange-500/20 to-orange-600/20",
      path: "/baked-goods",
      description: "Your product catalog",
    },
    {
      icon: FlaskConical,
      title: "Formulas",
      count: stats.formulas,
      color: "from-blue-500/20 to-blue-600/20",
      path: "/formulas",
      description: "Recipes & ingredient ratios",
    },
    {
      icon: Clock,
      title: "Shelf-Life",
      count: stats.shelfLife,
      color: "from-purple-500/20 to-purple-600/20",
      path: "/shelf-life",
      description: "Storage & testing data",
    },
    {
      icon: DollarSign,
      title: "Costing",
      count: stats.costing,
      color: "from-emerald-500/20 to-emerald-600/20",
      path: "/costing",
      description: "Pricing & margins",
    },
    {
      icon: Box,
      title: "Packaging",
      count: stats.packaging,
      color: "from-pink-500/20 to-pink-600/20",
      path: "/packaging",
      description: "Labels & compliance",
    },
    {
      icon: CheckCircle2,
      title: "Readiness",
      count: `${stats.readiness}%`,
      color: "from-indigo-500/20 to-indigo-600/20",
      path: "/readiness",
      description: "Overall progress tracker",
    },
  ];

  return (
    <div className="space-y-8 relative">
      {/* Bakery Shelf Background */}
      <div className="absolute inset-0 opacity-5 pointer-events-none">
        <div className="h-full w-full" style={{
          backgroundImage: `repeating-linear-gradient(
            0deg,
            hsl(var(--muted)) 0px,
            hsl(var(--muted)) 2px,
            transparent 2px,
            transparent 120px
          )`,
        }} />
      </div>

      <div className="relative">
        <h1 className="text-4xl font-bold tracking-tight" style={{ color: "#F5F1E6" }}>Founder Dashboard</h1>
        <p className="mt-2" style={{ color: "rgba(245,241,230,0.7)" }}>
          Your journey from kitchen to factory - track progress across all modules
        </p>
      </div>

      {/* Overall Progress */}
      <Card className="relative border-primary/20 bg-gradient-to-br from-primary/5 to-accent/5">
        <CardHeader>
          <CardTitle>Overall Readiness</CardTitle>
          <CardDescription>Average completion across all products</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium">Progress to Factory Scale</span>
              <Badge variant={stats.readiness > 80 ? "default" : "secondary"}>
                {stats.readiness}%
              </Badge>
            </div>
            <Progress value={stats.readiness} className="h-3" />
          </div>
        </CardContent>
      </Card>

      {/* Module Grid - Styled as Bakery Shelves */}
      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4 relative">
        {modules.map((module, index) => {
          const Icon = module.icon;
          return (
            <Card
              key={module.title}
              className={`cursor-pointer transition-all hover:shadow-[var(--shadow-elegant)] hover:scale-105 relative overflow-hidden bg-gradient-to-br ${module.color} backdrop-blur-sm border-2`}
              onClick={() => navigate(module.path)}
              style={{
                animationDelay: `${index * 50}ms`,
              }}
            >
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <Icon className="h-8 w-8 text-primary" />
                  <Badge variant="secondary" className="text-lg font-bold">
                    {isLoading ? "..." : module.count}
                  </Badge>
                </div>
                <CardTitle className="text-lg mt-2">{module.title}</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground">{module.description}</p>
              </CardContent>
              
              {/* Shelf effect */}
              <div className="absolute bottom-0 left-0 right-0 h-1 bg-gradient-to-r from-transparent via-foreground/10 to-transparent" />
            </Card>
          );
        })}
      </div>

      {/* Quick Actions */}
      <Card>
        <CardHeader>
          <CardTitle>Next Steps</CardTitle>
          <CardDescription>Recommended actions to move forward</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {stats.concepts === 0 && (
            <div className="flex items-start gap-3 p-3 rounded-lg bg-muted/50 hover:bg-muted transition-colors cursor-pointer" onClick={() => navigate("/concepts")}>
              <Lightbulb className="h-5 w-5 text-primary mt-0.5" />
              <div>
                <p className="font-medium">Start with a Concept</p>
                <p className="text-sm text-muted-foreground">Define your product idea and target market</p>
              </div>
            </div>
          )}
          {stats.concepts > 0 && stats.ingredients === 0 && (
            <div className="flex items-start gap-3 p-3 rounded-lg bg-muted/50 hover:bg-muted transition-colors cursor-pointer" onClick={() => navigate("/ingredients")}>
              <Package className="h-5 w-5 text-primary mt-0.5" />
              <div>
                <p className="font-medium">Add Your Ingredients</p>
                <p className="text-sm text-muted-foreground">Build your ingredient library with suppliers and costs</p>
              </div>
            </div>
          )}
          {stats.ingredients > 0 && stats.bakedGoods === 0 && (
            <div className="flex items-start gap-3 p-3 rounded-lg bg-muted/50 hover:bg-muted transition-colors cursor-pointer" onClick={() => navigate("/baked-goods")}>
              <Cookie className="h-5 w-5 text-primary mt-0.5" />
              <div>
                <p className="font-medium">Create Your First Product</p>
                <p className="text-sm text-muted-foreground">Define your baked goods with yield and unit size</p>
              </div>
            </div>
          )}
          {stats.bakedGoods > 0 && stats.formulas === 0 && (
            <div className="flex items-start gap-3 p-3 rounded-lg bg-muted/50 hover:bg-muted transition-colors cursor-pointer" onClick={() => navigate("/formulas")}>
              <FlaskConical className="h-5 w-5 text-primary mt-0.5" />
              <div>
                <p className="font-medium">Build Your Formulas</p>
                <p className="text-sm text-muted-foreground">Add ingredient weights and percentages</p>
              </div>
            </div>
          )}
          {stats.formulas > 0 && stats.costing === 0 && (
            <div className="flex items-start gap-3 p-3 rounded-lg bg-muted/50 hover:bg-muted transition-colors cursor-pointer" onClick={() => navigate("/costing")}>
              <DollarSign className="h-5 w-5 text-primary mt-0.5" />
              <div>
                <p className="font-medium">Calculate Your Costs</p>
                <p className="text-sm text-muted-foreground">Determine pricing and profit margins</p>
              </div>
            </div>
          )}
          {stats.readiness >= 80 && (
            <div className="flex items-start gap-3 p-3 rounded-lg bg-primary/10 border border-primary/20">
              <CheckCircle2 className="h-5 w-5 text-primary mt-0.5" />
              <div>
                <p className="font-medium text-primary">You're Ready!</p>
                <p className="text-sm text-muted-foreground">Your products are factory-ready. Time to scale!</p>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default FounderDashboard;