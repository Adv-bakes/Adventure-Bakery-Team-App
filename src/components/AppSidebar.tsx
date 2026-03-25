import { NavLink, useLocation } from "react-router-dom";
import { 
  Lightbulb, 
  Package, 
  FlaskConical, 
  TestTube, 
  DollarSign, 
  BoxIcon,
  CheckCircle2
} from "lucide-react";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from "@/components/ui/sidebar";
import { cn } from "@/lib/utils";

interface AppSidebarProps {
  projectId: string;
  onSectionChange?: (section: string) => void;
}

const workflowSteps = [
  { title: "Concept", url: "/concept", icon: Lightbulb },
  { title: "Ingredients & Specs", url: "/ingredients", icon: Package },
  { title: "Formulation", url: "/formulation", icon: FlaskConical },
  { title: "Shelf-Life & Process", url: "/shelf-life", icon: TestTube },
  { title: "Costing & MOQ", url: "/costing", icon: DollarSign },
  { title: "Packaging", url: "/packaging", icon: BoxIcon },
  { title: "Market Readiness", url: "/readiness", icon: CheckCircle2 },
];

export function AppSidebar({ projectId, onSectionChange }: AppSidebarProps) {
  const { state } = useSidebar();
  const location = useLocation();
  const collapsed = state === "collapsed";
  
  const isActive = (path: string) => location.pathname.includes(path);
  const isExpanded = workflowSteps.some((step) => isActive(step.url));

  const getNavCls = (active: boolean) =>
    cn(
      "transition-colors",
      active 
        ? "bg-accent/20 text-accent font-semibold border-l-2 border-accent" 
        : "hover:bg-muted/50"
    );

  return (
    <Sidebar
      className={cn(
        "transition-all duration-300",
        collapsed ? "w-14" : "w-64"
      )}
      collapsible="icon"
    >
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel className={collapsed ? "sr-only" : ""}>
            Project Workflow
          </SidebarGroupLabel>

          <SidebarGroupContent>
            <SidebarMenu>
              {workflowSteps.map((step) => {
                const active = isActive(step.url);
                return (
                  <SidebarMenuItem key={step.title}>
                    <SidebarMenuButton asChild>
                      <NavLink 
                        to={`/project/${projectId}${step.url}`}
                        className={getNavCls(active)}
                        onClick={() => onSectionChange?.(step.title)}
                      >
                        <step.icon className={cn("h-4 w-4", !collapsed && "mr-2")} />
                        {!collapsed && <span>{step.title}</span>}
                      </NavLink>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                );
              })}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
    </Sidebar>
  );
}
