import { useEffect, useMemo, useState, type Dispatch, type SetStateAction } from "react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { RefreshCw, AlertTriangle, Clock, CheckCircle2, UserPlus, Trash2, Download } from "lucide-react";
import { toast } from "sonner";
import { format, addDays } from "date-fns";
import { useUserRole } from "@/hooks/useUserRole";
import {
  TRAINING_CATEGORIES, TRAINING_CATEGORY_LABELS, DEPARTMENTS,
  TrainingModule, TrainingAssignment, Employee, ModuleVariant,
  AssignmentStatus, getAssignmentStatus, isExpiringSoon, isOverdue,
  fetchTrainingModules, fetchTrainingAssignments, fetchEmployees, fetchTrainingVariants,
  assignModulesToEmployees, deleteAssignment,
} from "@/lib/training";
import {
  assignableModules, buildGoverningMap, requirementMatrix, exceptions,
  exceptionLabel, statusLabel,
} from "@/lib/trainingMatrix";
import { downloadRequirementsPdf, downloadCompletionPdf } from "@/lib/trainingPdf";

const cardStyle = { background: "#FFFFFF", borderColor: "rgba(200,155,60,0.25)" };

const STATUS_DOT: Record<AssignmentStatus, string> = {
  not_started: "bg-[#2A1F0E]/15",
  in_progress: "bg-[#C89B3C]",
  completed: "bg-green-500",
  expired: "bg-red-500",
};

export default function TrainingCompliance() {
  const { hasRole } = useUserRole();
  const isAdmin = hasRole("admin") || hasRole("owner");
  const [modules, setModules] = useState<TrainingModule[]>([]);
  const [assignments, setAssignments] = useState<TrainingAssignment[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [variants, setVariants] = useState<ModuleVariant[]>([]);
  const [loading, setLoading] = useState(true);

  // Manual assignment dialog (in addition to the automatic department sync).
  const [assignOpen, setAssignOpen] = useState(false);
  const [assigning, setAssigning] = useState(false);
  const [selEmployees, setSelEmployees] = useState<Set<string>>(new Set());
  const [selModules, setSelModules] = useState<Set<string>>(new Set());
  const [dueDate, setDueDate] = useState(format(addDays(new Date(), 30), "yyyy-MM-dd"));

  const load = async () => {
    setLoading(true);
    try {
      const [mods, assigns, emps, vars] = await Promise.all([
        fetchTrainingModules(),
        fetchTrainingAssignments(),
        fetchEmployees(),
        fetchTrainingVariants(),
      ]);
      setModules(mods);
      setAssignments(assigns);
      setEmployees(emps);
      setVariants(vars);
    } catch (e: any) {
      toast.error(e.message ?? "Failed to load compliance data");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const toggle = (set: Dispatch<SetStateAction<Set<string>>>, id: string) =>
    set((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });

  const handleAssign = async () => {
    const emps = employees.filter((e) => selEmployees.has(e.id));
    const mods = modules.filter((m) => selModules.has(m.id));
    if (emps.length === 0 || mods.length === 0) {
      toast.error("Pick at least one employee and one module.");
      return;
    }
    setAssigning(true);
    try {
      const created = await assignModulesToEmployees(emps, mods, dueDate || null);
      const skipped = emps.length * mods.length - created;
      toast.success(
        `Assigned ${created} new module${created === 1 ? "" : "s"}` +
        (skipped > 0 ? ` (${skipped} already assigned, left as-is).` : "."),
      );
      setAssignOpen(false);
      setSelEmployees(new Set());
      setSelModules(new Set());
      await load();
    } catch (e: any) {
      toast.error(e.message ?? "Failed to assign training");
    } finally {
      setAssigning(false);
    }
  };

  const [removingId, setRemovingId] = useState<string | null>(null);

  const handleUnassign = async (assignment: TrainingAssignment) => {
    setRemovingId(assignment.id);
    try {
      await deleteAssignment(assignment.id);
      toast.success("Assignment removed.");
      await load();
    } catch (e: any) {
      toast.error(e.message ?? "Failed to remove assignment");
    } finally {
      setRemovingId(null);
    }
  };

  // Spanish variant id -> the English module that governs it. Without this an ES
  // assignment keys on a sop_id that is in no module list (fetchTrainingModules filters
  // training_category IS NOT NULL, and ES rows carry null) and reads as "not assigned".
  const governing = useMemo(
    () => buildGoverningMap(modules, variants), [modules, variants]);

  const assignmentMap = useMemo(() => {
    const map = new Map<string, TrainingAssignment>();
    for (const a of assignments) {
      const moduleId = governing.get(a.sop_id) ?? a.sop_id;
      const key = `${a.employee_id}:${moduleId}`;
      const prev = map.get(key);
      // If somebody holds both languages, the completed record is the evidence.
      if (!prev || (!prev.completed_at && a.completed_at)) map.set(key, a);
    }
    return map;
  }, [assignments, governing]);

  const reqRows = useMemo(
    () => requirementMatrix(modules, variants), [modules, variants]);

  const exceptionRows = useMemo(
    () => exceptions(employees, modules, assignments, governing),
    [employees, modules, assignments, governing]);

  const categoryGroups = useMemo(() => {
    return TRAINING_CATEGORIES.map(cat => ({
      category: cat,
      label: TRAINING_CATEGORY_LABELS[cat],
      items: assignableModules(modules).filter(m => m.training_category === cat),
    })).filter(g => g.items.length > 0);
  }, [modules]);

  const employeeName = (e: Employee) => e.full_name || e.id;

  const exportPdf = (which: "requirements" | "completion") => {
    const run = which === "requirements"
      ? downloadRequirementsPdf(reqRows)
      : downloadCompletionPdf(employees, modules, assignments, governing);
    run.catch((e: any) => toast.error(e.message ?? "Failed to generate PDF"));
  };

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
            Generated from the live system &mdash; not a maintained document. Who is required to
            take what, who has done it, and where the two disagree.
          </p>
        </div>
        <div className="flex items-center gap-2">
          {isAdmin && (
            <Dialog open={assignOpen} onOpenChange={setAssignOpen}>
              <DialogTrigger asChild>
                <Button className="bg-[#C89B3C] hover:bg-[#B8892C] text-black">
                  <UserPlus className="w-4 h-4 mr-1" />Assign Training
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-2xl">
                <DialogHeader>
                  <DialogTitle>Assign Training</DialogTitle>
                  <DialogDescription>
                    Hand-pick modules for specific people. This is in addition to automatic
                    department-based assignment; already-assigned modules are left untouched.
                  </DialogDescription>
                </DialogHeader>

                <div className="grid gap-4 sm:grid-cols-2">
                  <div>
                    <Label className="mb-2 block">Employees ({selEmployees.size})</Label>
                    <ScrollArea className="h-56 rounded-md border p-2">
                      {employees.length === 0 ? (
                        <p className="text-sm text-muted-foreground p-2">No employees.</p>
                      ) : employees.map((e) => (
                        <label key={e.id} className="flex items-center gap-2 rounded px-1.5 py-1 hover:bg-muted/50 cursor-pointer">
                          <Checkbox checked={selEmployees.has(e.id)} onCheckedChange={() => toggle(setSelEmployees, e.id)} />
                          <span className="text-sm">{e.full_name || e.id}{e.department ? ` · ${e.department}` : ""}</span>
                        </label>
                      ))}
                    </ScrollArea>
                  </div>
                  <div>
                    <Label className="mb-2 block">Modules ({selModules.size})</Label>
                    <ScrollArea className="h-56 rounded-md border p-2">
                      {modules.length === 0 ? (
                        <p className="text-sm text-muted-foreground p-2">No active modules.</p>
                      ) : modules.map((m) => (
                        <label key={m.id} className="flex items-center gap-2 rounded px-1.5 py-1 hover:bg-muted/50 cursor-pointer">
                          <Checkbox checked={selModules.has(m.id)} onCheckedChange={() => toggle(setSelModules, m.id)} />
                          <span className="text-sm">
                            <span className="font-mono text-xs mr-1">{m.module_number}</span>{m.title}
                          </span>
                        </label>
                      ))}
                    </ScrollArea>
                  </div>
                </div>

                <div className="flex items-end gap-3">
                  <div>
                    <Label htmlFor="assign-due" className="mb-1 block">Due date</Label>
                    <Input id="assign-due" type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} className="w-44" />
                  </div>
                  <p className="text-xs text-muted-foreground pb-2.5">
                    Annual-refresher modules recur every 12 months automatically.
                  </p>
                </div>

                <DialogFooter>
                  <Button variant="outline" onClick={() => setAssignOpen(false)} disabled={assigning}>Cancel</Button>
                  <Button
                    onClick={handleAssign}
                    disabled={assigning || selEmployees.size === 0 || selModules.size === 0}
                    className="bg-[#C89B3C] hover:bg-[#B8892C] text-black"
                  >
                    {assigning ? "Assigning…" : `Assign ${selEmployees.size * selModules.size || ""}`.trim()}
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          )}
          <Button variant="outline" onClick={load} disabled={loading}>
            <RefreshCw className={`w-4 h-4 mr-1 ${loading ? "animate-spin" : ""}`} />Refresh
          </Button>
        </div>
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

      <Tabs defaultValue="requirements" className="w-full">
        <TabsList>
          <TabsTrigger value="requirements">Requirements</TabsTrigger>
          <TabsTrigger value="completion">Completion</TabsTrigger>
          <TabsTrigger value="exceptions">
            Exceptions{exceptionRows.length > 0 ? ` (${exceptionRows.length})` : ""}
          </TabsTrigger>
        </TabsList>

        {/* ---- Requirements: the standing requirement, by department (SQF 2.9.2.1) ---- */}
        <TabsContent value="requirements" className="space-y-3 mt-4">
          <div className="flex justify-between items-center gap-3">
            <p className="text-xs text-[#F5F1E6]/60">
              What each department must complete. An X means the module is required of everyone in
              that department; a module marked in every column is required of all staff.
            </p>
            <Button variant="outline" size="sm" onClick={() => exportPdf("requirements")}>
              <Download className="w-4 h-4 mr-1" />Download PDF
            </Button>
          </div>
          <Card className="border overflow-x-auto" style={cardStyle}>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="text-[#2A1F0E]/60">Module</TableHead>
                  <TableHead className="text-[#2A1F0E]/60">Title</TableHead>
                  <TableHead className="text-[#2A1F0E]/60 text-center">Cat</TableHead>
                  {DEPARTMENTS.map(d => (
                    <TableHead key={d} className="text-[#2A1F0E]/60 text-center whitespace-nowrap">{d}</TableHead>
                  ))}
                  <TableHead className="text-[#2A1F0E]/60 text-center" title="A Spanish version exists (SQF 2.9.2.2)">ES</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {reqRows.map(({ module, marks, hasSpanish }) => (
                  <TableRow key={module.id}>
                    <TableCell className="font-mono text-xs text-[#2A1F0E] whitespace-nowrap">
                      {module.module_number ?? module.sop_number ?? "-"}
                    </TableCell>
                    <TableCell className="text-[#2A1F0E]">{module.title}</TableCell>
                    <TableCell className="text-center text-[#2A1F0E]/60">{module.training_category}</TableCell>
                    {marks.map((on, i) => (
                      <TableCell key={DEPARTMENTS[i]} className="text-center text-[#2A1F0E] font-semibold">
                        {on ? "X" : ""}
                      </TableCell>
                    ))}
                    <TableCell className="text-center text-[#2A1F0E]/70 text-xs">
                      {hasSpanish ? "Yes" : ""}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            {reqRows.length === 0 && (
              <p className="p-8 text-center text-[#2A1F0E]/50 text-sm">No active training modules.</p>
            )}
          </Card>
          {/* The limitation is stated rather than hidden: department is the finest grain the
              data holds, and 2.9.2.1 ii asks by duty. Closing it is deliverable D-01. */}
          <p className="text-xs text-[#F5F1E6]/50 leading-relaxed">
            Training is assigned by <strong>department</strong>. SQF 2.9.2.1 ii asks for competencies
            by <strong>duty</strong> &mdash; &ldquo;staff engaged in monitoring critical control
            points&rdquo; and their named backups &mdash; and a duty is narrower than a department.
            Recording that needs the job descriptions and named CCP monitors from deliverable D-01.
          </p>
        </TabsContent>

        {/* ---- Completion: the existing employee x module grid ---- */}
        <TabsContent value="completion" className="space-y-3 mt-4">
          <div className="flex justify-end">
            <Button variant="outline" size="sm" onClick={() => exportPdf("completion")}>
              <Download className="w-4 h-4 mr-1" />Download PDF
            </Button>
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

        {isAdmin && (
          <p className="text-xs text-[#F5F1E6]/60 -mb-2">
            Tip: click any filled status dot to remove that assignment.
          </p>
        )}

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
                    const cellTitle = `${TRAINING_CATEGORY_LABELS[m.training_category]} — ${m.title}: ${status.replace("_", " ")}`;
                    const dot = <span className={`inline-block w-3 h-3 rounded-full ${STATUS_DOT[status]}`} />;
                    return (
                      <TableCell
                        key={m.id}
                        className="text-center"
                        style={isFirstInGroup ? { borderLeft: "1px solid rgba(200,155,60,0.25)" } : undefined}
                        title={cellTitle}
                      >
                        {isAdmin && assignment ? (
                          <Popover>
                            <PopoverTrigger asChild>
                              <button className="p-1 rounded hover:bg-[#2A1F0E]/5" aria-label="Assignment actions">
                                {dot}
                              </button>
                            </PopoverTrigger>
                            <PopoverContent className="w-64 text-sm" align="center">
                              <p className="font-medium text-[#2A1F0E]">{employeeName(emp)}</p>
                              <p className="text-xs text-muted-foreground mb-1">
                                <span className="font-mono">{m.module_number}</span> {m.title}
                              </p>
                              <p className="text-xs mb-3">
                                Status: <span className="capitalize">{status.replace("_", " ")}</span>
                                {assignment.due_at ? ` · due ${assignment.due_at}` : ""}
                              </p>
                              <Button
                                variant="outline"
                                size="sm"
                                className="w-full text-red-600 border-red-300 hover:bg-red-50 hover:text-red-700"
                                disabled={removingId === assignment.id}
                                onClick={() => handleUnassign(assignment)}
                              >
                                <Trash2 className="w-3.5 h-3.5 mr-1" />
                                {removingId === assignment.id ? "Removing…" : "Remove assignment"}
                              </Button>
                              <p className="text-[11px] text-muted-foreground mt-2">
                                Automatic sync may re-add this if the employee's department still
                                requires the module.
                              </p>
                            </PopoverContent>
                          </Popover>
                        ) : (
                          dot
                        )}
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
        </TabsContent>

        {/* ---- Exceptions: where requirement and assignment disagree ---- */}
        <TabsContent value="exceptions" className="space-y-3 mt-4">
          <p className="text-xs text-[#F5F1E6]/60">
            Where the standing requirement and the actual assignments disagree. An empty list is the
            healthy state.
          </p>
          <Card className="border overflow-x-auto" style={cardStyle}>
            {exceptionRows.length === 0 ? (
              <p className="p-8 text-center text-[#2A1F0E]/50 text-sm">
                No exceptions &mdash; every required module is assigned, and nothing is assigned out of scope.
              </p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="text-[#2A1F0E]/60">Employee</TableHead>
                    <TableHead className="text-[#2A1F0E]/60">Department</TableHead>
                    <TableHead className="text-[#2A1F0E]/60">Module</TableHead>
                    <TableHead className="text-[#2A1F0E]/60">Title</TableHead>
                    <TableHead className="text-[#2A1F0E]/60">Finding</TableHead>
                    <TableHead className="text-[#2A1F0E]/60">Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {exceptionRows.map(({ employee, row }) => (
                    <TableRow key={`${employee.id}:${row.module.id}`}>
                      <TableCell className="text-[#2A1F0E] whitespace-nowrap">
                        {employee.full_name || employee.id}
                      </TableCell>
                      <TableCell className="text-[#2A1F0E]/70">{employee.department ?? "Not set"}</TableCell>
                      <TableCell className="font-mono text-xs text-[#2A1F0E] whitespace-nowrap">
                        {row.module.module_number ?? row.module.sop_number ?? "-"}
                      </TableCell>
                      <TableCell className="text-[#2A1F0E]">{row.module.title}</TableCell>
                      <TableCell>
                        <Badge
                          className={row.exception === "gap"
                            ? "bg-red-500/20 text-red-700 border-red-500/30"
                            : "bg-[#C89B3C]/20 text-[#9A6F1E] border-[#C89B3C]/40"}
                        >
                          {exceptionLabel(row)}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-[#2A1F0E]/70 capitalize">{statusLabel(row)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
