import { ReactNode, useEffect, useState } from "react";
import { useNavigate, useLocation, Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import {
  LayoutDashboard,
  Lightbulb,
  Package,
  FlaskConical,
  BoxIcon,
  TestTube,
  Cookie,
  FileText,
  Tag,
  FileSignature,
  BookOpen,
  User as UserIcon,
  LogOut,
  PanelLeftClose,
  PanelLeft,
} from "lucide-react";
import { toast } from "sonner";
import { User } from "@supabase/supabase-js";
import logo from "@/assets/logo.png";
import { CoachChat } from "@/components/CoachChat";
import { cn } from "@/lib/utils";

interface BrandLayoutProps {
  children: ReactNode;
}

interface NavSection {
  title: string;
  items: { path: string; icon: React.ElementType; label: string }[];
}

const navSections: NavSection[] = [
  {
    title: "Home",
    items: [
      { path: "/brand-portal", icon: LayoutDashboard, label: "Dashboard" },
    ],
  },
  {
    title: "My Product",
    items: [
      { path: "/concepts", icon: Lightbulb, label: "Concepts" },
      { path: "/ingredients", icon: Package, label: "Ingredients" },
      { path: "/formulas", icon: FlaskConical, label: "Formulas" },
      { path: "/packaging", icon: BoxIcon, label: "Packaging" },
      { path: "/shelf-life", icon: TestTube, label: "Shelf Life Testing" },
      { path: "/baked-goods", icon: Cookie, label: "Products" },
    ],
  },
  {
    title: "Requests",
    items: [
      { path: "/product-request-form", icon: FileText, label: "Project Request Form" },
      { path: "/private-label", icon: Tag, label: "Private Label Inquiry" },
      { path: "/nda-next", icon: FileSignature, label: "Documents & NDA" },
    ],
  },
  {
    title: "Resources",
    items: [
      { path: "/resources", icon: BookOpen, label: "Resources" },
    ],
  },
  {
    title: "Account",
    items: [
      { path: "/account", icon: UserIcon, label: "Account" },
    ],
  },
];

const BrandLayout = ({ children }: BrandLayoutProps) => {
  const navigate = useNavigate();
  const location = useLocation();
  const [user, setUser] = useState<User | null>(null);
  const [collapsed, setCollapsed] = useState(false);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null);
      if (!session) navigate("/brand");
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
      if (!session) navigate("/brand");
    });

    return () => subscription.unsubscribe();
  }, [navigate]);

  const handleSignOut = async () => {
    const { error } = await supabase.auth.signOut();
    if (error) toast.error("Error signing out");
    else { toast.success("Signed out successfully"); navigate("/brand"); }
  };

  if (!user) return null;

  return (
    <div className="min-h-screen flex" style={{ background: "linear-gradient(135deg, hsl(40 33% 93%) 0%, hsl(40 100% 99%) 50%, hsl(40 33% 93%) 100%)" }}>
      {/* Sidebar */}
      <aside
        className={cn(
          "sticky top-0 h-screen flex flex-col border-r transition-all duration-300 shrink-0",
          collapsed ? "w-16" : "w-60"
        )}
        style={{
          background: "linear-gradient(180deg, hsl(40 33% 96%) 0%, hsl(40 40% 92%) 100%)",
          borderColor: "rgba(200, 155, 60, 0.2)",
        }}
      >
        {/* Logo */}
        <div className="flex items-center gap-3 px-4 h-16 shrink-0">
          <img src={logo} alt="AB" className="w-8 h-8 shrink-0" />
          {!collapsed && (
            <span className="font-semibold text-sm" style={{ color: "#2C1810" }}>
              Brand Portal
            </span>
          )}
        </div>

        <Separator style={{ borderColor: "rgba(200, 155, 60, 0.15)" }} />

        {/* Nav */}
        <ScrollArea className="flex-1 py-2">
          {navSections.map((section) => (
            <div key={section.title} className="mb-2">
              {!collapsed && (
                <p className="px-4 py-2 text-[10px] font-bold uppercase tracking-wider" style={{ color: "rgba(44, 24, 16, 0.4)" }}>
                  {section.title}
                </p>
              )}
              {section.items.map((item) => {
                const Icon = item.icon;
                const isActive =
                  location.pathname === item.path ||
                  (item.path !== "/brand-portal" && location.pathname.startsWith(item.path));
                return (
                  <Link
                    key={item.path}
                    to={item.path}
                    className={cn(
                      "flex items-center gap-3 mx-2 px-3 py-2 rounded-md text-sm transition-colors",
                      isActive ? "bg-[#C89B3C]/15 font-semibold" : "hover:bg-[#C89B3C]/5"
                    )}
                    style={{ color: isActive ? "#C89B3C" : "#5A4A3A" }}
                    title={collapsed ? item.label : undefined}
                  >
                    <Icon className="w-4 h-4 shrink-0" />
                    {!collapsed && <span>{item.label}</span>}
                  </Link>
                );
              })}
            </div>
          ))}
        </ScrollArea>

        {/* Bottom controls */}
        <div className="p-2 space-y-1 shrink-0">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setCollapsed(!collapsed)}
            className="w-full justify-start hover:bg-[#C89B3C]/10"
            style={{ color: "#8B7355" }}
          >
            {collapsed ? <PanelLeft className="w-4 h-4" /> : <><PanelLeftClose className="w-4 h-4 mr-2" /><span>Collapse</span></>}
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={handleSignOut}
            className="w-full justify-start hover:bg-destructive/10"
            style={{ color: "#8B7355" }}
          >
            <LogOut className="w-4 h-4 shrink-0" />
            {!collapsed && <span className="ml-2">Sign Out</span>}
          </Button>
        </div>
      </aside>

      {/* Main content */}
      <div className="flex-1 flex flex-col min-w-0">
        <main className="flex-1 p-6 lg:p-8">{children}</main>
      </div>

      <CoachChat progress={0} currentSection="Concept" />
    </div>
  );
};

export default BrandLayout;
