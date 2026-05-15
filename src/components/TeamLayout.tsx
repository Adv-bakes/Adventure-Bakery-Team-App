import { ReactNode, useEffect, useState } from "react";
import { useNavigate, useLocation, Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import {
  Home,
  Users,
  FileText,
  Kanban,
  Package,
  Boxes,
  Bot,
  TrendingUp,
  ClipboardCheck,
  ShieldCheck,
  GraduationCap,
  UserSquare2,
  BookOpen,
  ListTodo,
  Inbox,
  DollarSign,
  Database,
  Settings,
  User as UserIcon,
  LogOut,
  PanelLeftClose,
  PanelLeft,
  Calendar,
  ListChecks,
} from "lucide-react";
import { toast } from "sonner";
import { User } from "@supabase/supabase-js";
import logo from "@/assets/logo.png";
import { CoachChat } from "@/components/CoachChat";
import { cn } from "@/lib/utils";
import { useUserRole } from "@/hooks/useUserRole";

interface TeamLayoutProps {
  children: ReactNode;
}

interface NavItem {
  path: string;
  icon: React.ElementType;
  label: string;
  ownerOnly?: boolean;
}
interface NavSection {
  title: string;
  items: NavItem[];
}

const navSections: NavSection[] = [
  {
    title: "Home",
    items: [{ path: "/team/dashboard", icon: Home, label: "Dashboard" }],
  },
  {
    title: "Sales",
    items: [
      { path: "/team/sales/pipeline", icon: Kanban, label: "Pipeline" },
      { path: "/team/sales/clients", icon: Users, label: "Clients" },
      { path: "/team/sales/inbox", icon: FileText, label: "Documents Inbox" },
    ],
  },
  {
    title: "Operations",
    items: [
      { path: "/team/ops/pipeline", icon: Kanban, label: "Pipeline" },
      { path: "/team/ops/orders", icon: Package, label: "Orders" },
      { path: "/team/ops/schedule", icon: Calendar, label: "Production Schedule" },
      { path: "/team/ops/batches", icon: ListChecks, label: "Batch Tracker" },
      { path: "/team/ops/inventory", icon: Boxes, label: "Inventory" },
      { path: "/team/ops/scout-bot", icon: Bot, label: "Sourcing (Scout Bot)" },
      { path: "/team/ops/variance", icon: TrendingUp, label: "Variance Report" },
    ],
  },
  {
    title: "Compliance",
    items: [
      { path: "/team/compliance/sops", icon: BookOpen, label: "SOPs Library" },
      { path: "/team/compliance/traceability", icon: ClipboardCheck, label: "Traceability" },
      { path: "/team/compliance/certifications", icon: ShieldCheck, label: "Certifications" },
    ],
  },
  {
    title: "HR",
    items: [
      { path: "/team/hr/directory", icon: UserSquare2, label: "Team Directory" },
      { path: "/team/hr/trainings", icon: GraduationCap, label: "Training & SOPs" },
      { path: "/team/hr/traceability", icon: ListTodo, label: "Training Traceability" },
    ],
  },
  {
    title: "Internal",
    items: [
      { path: "/team/internal/email", icon: Inbox, label: "Email Inbox" },
      { path: "/team/internal/finance", icon: DollarSign, label: "Finance", ownerOnly: true },
      { path: "/team/sourcing", icon: Database, label: "Vendor DB" },
      { path: "/team/account", icon: UserIcon, label: "My Account" },
      { path: "/team/settings", icon: Settings, label: "Settings" },
    ],
  },
];

const TeamLayout = ({ children }: TeamLayoutProps) => {
  const navigate = useNavigate();
  const location = useLocation();
  const [user, setUser] = useState<User | null>(null);
  const [collapsed, setCollapsed] = useState(false);
  const { role } = useUserRole();
  const isOwner = role === "owner";

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null);
      if (!session) navigate("/team");
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
      if (!session) navigate("/team");
    });

    return () => subscription.unsubscribe();
  }, [navigate]);

  const handleSignOut = async () => {
    const { error } = await supabase.auth.signOut();
    if (error) toast.error("Error signing out");
    else { toast.success("Signed out successfully"); navigate("/team"); }
  };

  if (!user) return null;

  return (
    <div className="min-h-screen flex bg-background">
      <aside
        className={cn(
          "sticky top-0 h-screen flex flex-col border-r transition-all duration-300 shrink-0",
          collapsed ? "w-16" : "w-60"
        )}
        style={{
          background: "linear-gradient(180deg, hsl(20 29% 15%) 0%, hsl(20 29% 12%) 100%)",
          borderColor: "rgba(200, 155, 60, 0.15)",
        }}
      >
        <div className="flex items-center gap-3 px-4 h-16 shrink-0">
          <img src={logo} alt="AB" className="w-8 h-8 shrink-0" />
          {!collapsed && (
            <span className="font-semibold text-sm" style={{ color: "#F5F1E6" }}>
              AB Team Portal
            </span>
          )}
        </div>

        <Separator className="opacity-20" />

        <ScrollArea className="flex-1 py-2">
          {navSections.map((section) => {
            const visibleItems = section.items.filter((i) => !i.ownerOnly || isOwner);
            if (visibleItems.length === 0) return null;
            return (
              <div key={section.title} className="mb-2">
                {!collapsed && (
                  <p className="px-4 py-2 text-[10px] font-bold uppercase tracking-wider" style={{ color: "rgba(245, 241, 230, 0.4)" }}>
                    {section.title}
                  </p>
                )}
                {visibleItems.map((item) => {
                  const Icon = item.icon;
                  const isActive =
                    location.pathname === item.path ||
                    (item.path !== "/team/dashboard" && location.pathname.startsWith(item.path));
                  return (
                    <Link
                      key={item.path}
                      to={item.path}
                      className={cn(
                        "flex items-center gap-3 mx-2 px-3 py-2 rounded-md text-sm transition-colors",
                        isActive ? "bg-[#C89B3C]/20 font-semibold" : "hover:bg-white/5"
                      )}
                      style={{ color: isActive ? "#C89B3C" : "rgba(245, 241, 230, 0.7)" }}
                      title={collapsed ? item.label : undefined}
                    >
                      <Icon className="w-4 h-4 shrink-0" />
                      {!collapsed && <span>{item.label}</span>}
                    </Link>
                  );
                })}
              </div>
            );
          })}
        </ScrollArea>

        <div className="p-2 space-y-1 shrink-0">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setCollapsed(!collapsed)}
            className="w-full justify-start hover:bg-white/10"
            style={{ color: "rgba(245, 241, 230, 0.5)" }}
          >
            {collapsed ? <PanelLeft className="w-4 h-4" /> : <><PanelLeftClose className="w-4 h-4 mr-2" /><span>Collapse</span></>}
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={handleSignOut}
            className="w-full justify-start hover:bg-destructive/20"
            style={{ color: "rgba(245, 241, 230, 0.5)" }}
          >
            <LogOut className="w-4 h-4 shrink-0" />
            {!collapsed && <span className="ml-2">Sign Out</span>}
          </Button>
        </div>
      </aside>

      <div className="flex-1 flex flex-col min-w-0">
        <main className="flex-1 p-6 lg:p-8">{children}</main>
      </div>

      <CoachChat progress={0} currentSection="Concept" />
    </div>
  );
};

export default TeamLayout;
