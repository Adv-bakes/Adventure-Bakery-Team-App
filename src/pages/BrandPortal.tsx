import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { FileText, Plus, Package } from "lucide-react";
import { useNavigate } from "react-router-dom";
import logo from "@/assets/logo.png";

interface Concept {
  id: number;
  product_name: string;
  product_type: string | null;
  product_description: string | null;
  target_market: string | null;
  created_at: string;
}

const BrandPortal = () => {
  const navigate = useNavigate();
  const [concepts, setConcepts] = useState<Concept[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchConcepts = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        navigate("/k2f-login");
        return;
      }

      const { data } = await supabase
        .from("concepts")
        .select("id, product_name, product_type, product_description, target_market, created_at")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false });

      setConcepts(data || []);
      setLoading(false);
    };

    fetchConcepts();
  }, [navigate]);

  return (
    <div
      className="min-h-screen"
      style={{
        background: "linear-gradient(135deg, #F5F1E6 0%, #FFFDF8 50%, #F5F1E6 100%)",
      }}
    >
      <header
        className="sticky top-0 z-50 w-full border-b backdrop-blur-sm"
        style={{
          background: "linear-gradient(135deg, rgba(245, 241, 230, 0.98) 0%, rgba(255, 253, 250, 0.98) 100%)",
          borderColor: "rgba(200, 155, 60, 0.2)",
          boxShadow: "0 2px 12px rgba(200, 155, 60, 0.08)",
        }}
      >
        <div className="container flex h-16 items-center justify-between">
          <div className="flex items-center gap-3">
            <img src={logo} alt="Adventure Bakery" className="w-10 h-10" />
            <span className="font-semibold text-lg" style={{ color: "#2C1810" }}>
              Brand Portal
            </span>
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={async () => {
              await supabase.auth.signOut();
              navigate("/k2f-login");
            }}
            style={{ color: "#8B7355" }}
          >
            Sign Out
          </Button>
        </div>
      </header>

      <main className="container py-10 max-w-4xl">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-2xl font-bold" style={{ color: "#2C1810" }}>
              Your Projects
            </h1>
            <p className="text-sm mt-1" style={{ color: "#8B7355" }}>
              View your product specs and submit new inquiries.
            </p>
          </div>
          <Button
            onClick={() => navigate("/product-request-form")}
            className="bg-gradient-to-r from-[#C89B3C] to-[#D4A855] hover:from-[#B8892C] hover:to-[#C89B3C] text-white gap-2"
          >
            <Plus className="w-4 h-4" />
            New Inquiry
          </Button>
        </div>

        {loading ? (
          <div className="flex justify-center py-20">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-accent" />
          </div>
        ) : concepts.length === 0 ? (
          <Card className="border-0" style={{ background: "rgba(255,255,255,0.8)" }}>
            <CardContent className="flex flex-col items-center py-16 text-center">
              <Package className="w-12 h-12 mb-4" style={{ color: "#C89B3C" }} />
              <h3 className="text-lg font-semibold mb-2" style={{ color: "#2C1810" }}>
                No projects yet
              </h3>
              <p className="text-sm mb-6" style={{ color: "#8B7355" }}>
                Submit a product inquiry to get started with Adventure Bakery.
              </p>
              <Button
                onClick={() => navigate("/product-request-form")}
                className="bg-gradient-to-r from-[#C89B3C] to-[#D4A855] text-white gap-2"
              >
                <Plus className="w-4 h-4" />
                Submit Inquiry
              </Button>
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-4">
            {concepts.map((concept) => (
              <Card
                key={concept.id}
                className="border-0 hover:shadow-lg transition-shadow"
                style={{ background: "rgba(255,255,255,0.9)" }}
              >
                <CardHeader className="pb-3">
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-3">
                      <div className="p-2 rounded-lg" style={{ background: "rgba(200, 155, 60, 0.12)" }}>
                        <FileText className="w-5 h-5" style={{ color: "#C89B3C" }} />
                      </div>
                      <div>
                        <CardTitle className="text-base" style={{ color: "#2C1810" }}>
                          {concept.product_name}
                        </CardTitle>
                        {concept.product_type && (
                          <CardDescription>{concept.product_type}</CardDescription>
                        )}
                      </div>
                    </div>
                    <Badge variant="secondary" className="text-xs">
                      {new Date(concept.created_at).toLocaleDateString()}
                    </Badge>
                  </div>
                </CardHeader>
                {(concept.product_description || concept.target_market) && (
                  <CardContent className="pt-0">
                    {concept.product_description && (
                      <p className="text-sm" style={{ color: "#8B7355" }}>
                        {concept.product_description}
                      </p>
                    )}
                    {concept.target_market && (
                      <p className="text-xs mt-2" style={{ color: "#A89580" }}>
                        Target: {concept.target_market}
                      </p>
                    )}
                  </CardContent>
                )}
              </Card>
            ))}
          </div>
        )}
      </main>
    </div>
  );
};

export default BrandPortal;
