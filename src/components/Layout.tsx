import { ReactNode, useEffect, useState } from "react";
import { useNavigate, useLocation, Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { LayoutDashboard, Cookie, LogOut, BookOpen, User as UserIcon, Settings2, Package, Shield } from "lucide-react";
import { toast } from "sonner";
import { User } from "@supabase/supabase-js";
import logo from "@/assets/logo.png";
import { CoachChat } from "@/components/CoachChat";
import { useUserRole, AppRole } from "@/hooks/useUserRole";

interface LayoutProps {
  children: ReactNode;
}

const adminNav = [
  { path: "/dashboard", icon: LayoutDashboard, label: "Customers" },
  { path: "/operations-hub", icon: Settings2, label: "Operations" },
  { path: "/admin", icon: Shield, label: "Admin" },
  { path: "/account", icon: UserIcon, label: "Account" },
];

const staffNav = [
  { path: "/operations-hub", icon: Settings2, label: "Operations" },
  { path: "/baked-goods", icon: Cookie, label: "Products" },
  { path: "/ingredients", icon: Package, label: "Ingredients" },
  { path: "/account", icon: UserIcon, label: "Account" },
];

const clientNav = [
  { path: "/brand-portal", icon: LayoutDashboard, label: "Brand Portal" },
  { path: "/account", icon: UserIcon, label: "Account" },
];

function getNavItems(role: AppRole | null) {
  switch (role) {
    case "admin": return adminNav;
    case "staff": return staffNav;
    case "user": return clientNav;
    default: return clientNav;
  }
}

const Layout = ({ children }: LayoutProps) => {
  const navigate = useNavigate();
  const location = useLocation();
  const [user, setUser] = useState<User | null>(null);
  const { role } = useUserRole();

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null);
      if (!session) {
        navigate("/k2f-login");
      }
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, session) => {
      setUser(session?.user ?? null);
      if (!session) {
        navigate("/k2f-login");
      }
    });

    return () => subscription.unsubscribe();
  }, [navigate]);

  const handleSignOut = async () => {
    const { error } = await supabase.auth.signOut();
    if (error) {
      toast.error("Error signing out");
    } else {
      toast.success("Signed out successfully");
      navigate("/k2f-login");
    }
  };

  const navItems = getNavItems(role);

  if (!user) {
    return null;
  }

  return (
    <div className="min-h-screen">
      <header
        className="sticky top-0 z-50 w-full border-b"
        style={{
          background: "linear-gradient(135deg, rgba(245, 241, 230, 0.98) 0%, rgba(255, 253, 250, 0.98) 100%)",
          borderColor: "rgba(200, 155, 60, 0.2)",
          backdropFilter: "blur(12px)",
          boxShadow: "0 2px 12px rgba(200, 155, 60, 0.08)",
        }}
      >
        <div className="container flex h-16 items-center justify-between">
          <div className="flex items-center gap-3">
            <img src={logo} alt="Adventure Bakery Logo" className="w-10 h-10" />
            <span className="font-semibold text-lg hidden sm:inline" style={{ color: "#2C1810" }}>
              Kitchen-to-Factory Coach
            </span>
          </div>

          <nav className="flex items-center gap-1">
            {navItems.map((item) => {
              const Icon = item.icon;
              const isActive = location.pathname === item.path;
              return (
                <Button
                  key={item.path}
                  variant={isActive ? "secondary" : "ghost"}
                  size="sm"
                  asChild
                  className={isActive ? "font-semibold" : "hover:bg-[#C89B3C]/10"}
                  style={
                    isActive
                      ? {
                          background:
                            "linear-gradient(135deg, rgba(200, 155, 60, 0.15) 0%, rgba(200, 155, 60, 0.08) 100%)",
                          borderColor: "rgba(200, 155, 60, 0.3)",
                          color: "#C89B3C",
                        }
                      : {
                          color: "#8B7355",
                        }
                  }
                >
                  <Link to={item.path}>
                    <Icon className="w-4 h-4 mr-2" />
                    <span className="hidden sm:inline">{item.label}</span>
                  </Link>
                </Button>
              );
            })}
            <Button
              variant="ghost"
              size="sm"
              onClick={handleSignOut}
              className="hover:bg-destructive/10"
              style={{ color: "#8B7355" }}
            >
              <LogOut className="w-4 h-4" />
            </Button>
          </nav>
        </div>
      </header>

      <main className="container py-8">{children}</main>

      <CoachChat progress={0} currentSection="Concept" />
    </div>
  );
};

export default Layout;
