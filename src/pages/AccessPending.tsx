import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Clock, LogOut } from "lucide-react";
import { toast } from "sonner";
import logo from "@/assets/logo.png";

const AccessPending = () => {
  const navigate = useNavigate();

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    toast.success("Signed out.");
    navigate("/k2f-login");
  };

  return (
    <div
      className="min-h-screen flex items-center justify-center p-6"
      style={{
        background: "linear-gradient(135deg, #F5F1E6 0%, #FFFDF8 50%, #F5F1E6 100%)",
      }}
    >
      <Card
        className="w-full max-w-md border-0 text-center"
        style={{
          background: "linear-gradient(135deg, rgba(245, 241, 230, 0.98) 0%, rgba(255, 253, 250, 0.98) 100%)",
          boxShadow: "0 8px 32px rgba(200, 155, 60, 0.15)",
        }}
      >
        <CardContent className="py-12 space-y-6">
          <img src={logo} alt="Adventure Bakery" className="w-16 h-16 mx-auto" />
          <div
            className="mx-auto w-16 h-16 rounded-full flex items-center justify-center"
            style={{ background: "rgba(200, 155, 60, 0.12)" }}
          >
            <Clock className="w-8 h-8" style={{ color: "#C89B3C" }} />
          </div>
          <div>
            <h1 className="text-xl font-semibold mb-2" style={{ color: "#2C1810" }}>
              Access Pending
            </h1>
            <p className="text-sm" style={{ color: "#8B7355" }}>
              Your account has been created, but access to the Brand Portal hasn't been activated yet.
              Please contact Adventure Bakery for assistance.
            </p>
          </div>
          <Button
            variant="outline"
            onClick={handleSignOut}
            className="gap-2"
          >
            <LogOut className="w-4 h-4" />
            Sign Out
          </Button>
        </CardContent>
      </Card>
    </div>
  );
};

export default AccessPending;
