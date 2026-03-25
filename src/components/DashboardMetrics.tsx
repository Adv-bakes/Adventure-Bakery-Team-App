import { Card, CardContent } from "@/components/ui/card";
import { CheckCircle2, Clock, FolderOpen } from "lucide-react";
import { cn } from "@/lib/utils";

interface DashboardMetricsProps {
  total: number;
  completed: number;
  inProgress: number;
  activeFilter: "all" | "completed" | "inProgress";
  onFilterChange: (filter: "all" | "completed" | "inProgress") => void;
}

export function DashboardMetrics({ total, completed, inProgress, activeFilter, onFilterChange }: DashboardMetricsProps) {
  const metrics = [
    {
      id: "all" as const,
      icon: FolderOpen,
      label: "Total Projects",
      value: total,
      colorClass: "text-accent"
    },
    {
      id: "completed" as const,
      icon: CheckCircle2,
      label: "Completed",
      value: completed,
      colorClass: "text-success"
    },
    {
      id: "inProgress" as const,
      icon: Clock,
      label: "In Progress",
      value: inProgress,
      colorClass: "text-accent"
    }
  ];

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
      {metrics.map((metric) => {
        const Icon = metric.icon;
        const isActive = activeFilter === metric.id;
        
        return (
          <Card
            key={metric.id}
            className={cn(
              "premium-card cursor-pointer transition-all duration-300 hover:shadow-2xl hover:-translate-y-1",
              isActive && "ring-2 ring-accent shadow-2xl"
            )}
            onClick={() => onFilterChange(metric.id)}
          >
            <CardContent className="p-6">
              <div className="flex items-center gap-4">
                <div 
                  className={cn(
                    "h-14 w-14 rounded-full flex items-center justify-center transition-transform duration-300 hover:scale-110 shadow-inner",
                    metric.id === "completed" ? "bg-gradient-to-br from-success/15 to-success/5" : "bg-gradient-to-br from-accent/15 to-accent/5"
                  )}
                >
                  <Icon className={cn("h-7 w-7", metric.colorClass)} />
                </div>
                <div>
                  <p className="text-sm font-medium text-muted-foreground mb-1">{metric.label}</p>
                  <p className={cn("text-4xl font-bold", metric.colorClass)}>
                    {metric.value}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
