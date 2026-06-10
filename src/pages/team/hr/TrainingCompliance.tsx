import { useEffect, useMemo, useState } from "react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { RefreshCw, AlertTriangle, Clock, CheckCircle2 } from "lucide-react";
import { toast } from "sonner";
import {
  TRAINING_CATEGORIES, TRAINING_CATEGORY_LABELS,
  TrainingModule, TrainingAssignment, Employee,
  AssignmentStatus, getAssignmentStatus, isExpiringSoon, isOverdue,
  fetchTrainingModules, fetchTrainingAssignments, fetchEmployees,
} from "@/lib/training";

const cardStyle = { background: "#FFFFFF", borderColor: "rgba(200,155,60,0.25)" };

const STATUS_DOT: Record<AssignmentStatus, string> = {
  not_started: "bg-[#2A1F0E]/15",
  in_progress: "bg-[#C89B3C]",
  completed: "bg-green-500",
  expired: "bg-red-500",
};

export default function TrainingCompliance() {
  const [modules, setModules] = useState<TrainingModule[]>([]);
  const [assignments, setAssignments] = useState<TrainingAssignment[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    setLoading(true);
    try {
      const [mods, assigns, emps] = await Promise.all([
        fetchTrainingModules(),
        fetchTrainingAssignments(),
        fetchEmployees(),
      ]);
      setModules(mods);
      setAssignments(assigns);
      setEmployees(emps);
    } catch (e: any) {
      toast.error(e.message ?? "Failed to load compliance data");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const assignmentMap = useMemo(() => {
    const map = new Map<string, TrainingAssignment>();
    for (const a of assignments) map.set(`${a.employee_id}:${a.sop_id}`, a);
    return map;
  }, [assignments]);

  const categoryGroups = useMemo(() => {
    return TRAINING_CATEGORIES.map(cat => ({
      category: cat,
      label: TRAINING_CATEGORY_LABELS[cat],
      items: modules.filter(m => m.training_category === cat),
    })).filter(g => g.items.length > 0);
  }, [modules]);

  const employeeName = (e: Employee) => e.full_name || e.id;

  const alerts = useMemo(() => {
    const expiringSoon: { employee: Employee; module: TrainingModule; assignment: TrainingAssignment }[] = [];
    const overdue: { employee: Employee; module: TrainingModule; assignment: TrainingAssignment }[] = [];

    for (const a of assignments) {
      const employee = employees.find(e => e.id === a.employee_id);
      const module = modules.find(m => m.id === a.sop_id);
      if (!employee || !module) continue;

      if (isOverdue(a)) {
        overdue.push({ employee, module, assignment: a });
      } else if (isExpiringSoon(a.expires_at, 60)) {
        expiringSoon.push({ employee, module, assignment: a });
      }
    }
    return { expiringSoon, overdue };
  }, [assignments, employees, modules]);

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-start">
        <div>
          <h1 className="text-3xl font-bold" style={{ color: "#F5F1E6" }}>Training Compliance</h1>
          <p className="text-sm mt-1" style={{ color: "rgba(245,241,230,0.6)" }}>
            Who was trained on what, when, and what's coming due.
          </p>
        </div>
        <Button variant="outline" onClick={load} disabled={loading}>
          <RefreshCw className={`w-4 h-4 mr-1 ${loading ? "animate-spin" : ""}`} />Refresh
        </Button>
      </div>

      {/* Alerts */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card className="p-4 border" style={cardStyle}>
          <div className="flex items-center gap-2 mb-3 text-[#2A1F0E]">
            <AlertTriangle className="w-4 h-4 text-red-600" />
            <h3 className="font-semibold">Overdue ({alerts.overdue.length})</h3>
          </div>
          {alerts.overdue.length === 0 ? (
            <p className="text-sm text-[#2A1F0E]/50">Nothing overdue.</p>
          ) : (
            <ul className="space-y-1.5 text-sm text-[#2A1F0E]">
              {alerts.overdue.map(({ employee, module, assignment }) => (
                <li key={assignment.id} className="flex justify-between gap-2">
                  <span>{employeeName(employee)} — {module.module_number} {module.title}</span>
                  <Badge className="bg-red-500/20 text-red-700 border-red-500/30">
                    {assignment.expires_at ? `expired ${assignment.expires_at}` : `due ${assignment.due_at}`}
                  </Badge>
                </li>
              ))}
            </ul>
          )}
        </Card>

        <Card className="p-4 border" style={cardStyle}>
          <div className="flex items-center gap-2 mb-3 text-[#2A1F0E]">
            <Clock className="w-4 h-4 text-[#C89B3C]" />
            <h3 className="font-semibold">Expiring Soon — within 60 days ({alerts.expiringSoon.length})</h3>
          </div>
          {alerts.expiringSoon.length === 0 ? (
            <p className="text-sm text-[#2A1F0E]/50">Nothing expiring soon.</p>
          ) : (
            <ul className="space-y-1.5 text-sm text-[#2A1F0E]">
              {alerts.expiringSoon.map(({ employee, module, assignment }) => (
                <li key={assignment.id} className="flex justify-between gap-2">
                  <span>{employeeName(employee)} — {module.module_number} {module.title}</span>
                  <Badge className="bg-[#C89B3C]/20 text-[#9A6F1E] border-[#C89B3C]/40">
                    expires {assignment.expires_at}
                  </Badge>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>

      {/* Legend */}
      <div className="flex justify-end">
        <div className="flex items-center gap-3 text-xs text-[#F5F1E6]/70">
          <span className="flex items-center gap-1"><span className={`w-2.5 h-2.5 rounded-full ${STATUS_DOT.completed}`} />Completed</span>
          <span className="flex items-center gap-1"><span className={`w-2.5 h-2.5 rounded-full ${STATUS_DOT.in_progress}`} />In Progress</span>
          <span className="flex items-center gap-1"><span className={`w-2.5 h-2.5 rounded-full ${STATUS_DOT.expired}`} />Expired</span>
          <span className="flex items-center gap-1"><span className={`w-2.5 h-2.5 rounded-full ${STATUS_DOT.not_started}`} />Not Assigned</span>
        </div>
      </div>

      {/* Compliance matrix */}
      <Card className="border overflow-x-auto" style={cardStyle}>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="text-[#2A1F0E]/60 sticky left-0 bg-white z-10 row-span-2 align-bottom" rowSpan={2}>Employee</TableHead>
              {categoryGroups.map(group => (
                <TableHead
                  key={group.category}
                  colSpan={group.items.length}
                  className="text-center text-[#2A1F0E] border-l"
                  style={{ borderColor: "rgba(200,155,60,0.25)" }}
                >
                  Category {group.category}: {group.label}
                </TableHead>
              ))}
            </TableRow>
            <TableRow>
              {categoryGroups.flatMap(group => group.items).map((m, idx, arr) => {
                const isFirstInGroup = idx === 0 || arr[idx - 1].training_category !== m.training_category;
                return (
                  <TableHead
                    key={m.id}
                    className="text-[#2A1F0E]/60 text-center min-w-[70px]"
                    style={isFirstInGroup ? { borderLeft: "1px solid rgba(200,155,60,0.25)" } : undefined}
                  >
                    <div className="flex flex-col items-center">
                      <span className="font-mono text-xs">{m.module_number}</span>
                      {m.is_annual_refresher && <CheckCircle2 className="w-3 h-3 text-[#C89B3C] mt-0.5" />}
                    </div>
                  </TableHead>
                );
              })}
            </TableRow>
          </TableHeader>
          <TableBody>
            {employees.map(emp => (
              <TableRow key={emp.id}>
                <TableCell className="font-medium text-[#2A1F0E] sticky left-0 bg-white z-10 whitespace-nowrap">
                  {employeeName(emp)}
                </TableCell>
                {categoryGroups.flatMap(group => group.items).map((m, idx, arr) => {
                  const assignment = assignmentMap.get(`${emp.id}:${m.id}`);
                  const status = getAssignmentStatus(assignment);
                  const isFirstInGroup = idx === 0 || arr[idx - 1].training_category !== m.training_category;
                  return (
                    <TableCell
                      key={m.id}
                      className="text-center"
                      style={isFirstInGroup ? { borderLeft: "1px solid rgba(200,155,60,0.25)" } : undefined}
                      title={`${TRAINING_CATEGORY_LABELS[m.training_category]} — ${m.title}: ${status.replace("_", " ")}`}
                    >
                      <span className={`inline-block w-3 h-3 rounded-full ${STATUS_DOT[status]}`} />
                    </TableCell>
                  );
                })}
              </TableRow>
            ))}
          </TableBody>
        </Table>
        {employees.length === 0 && (
          <p className="p-8 text-center text-[#2A1F0E]/50 text-sm">No employees found.</p>
        )}
      </Card>
    </div>
  );
}
