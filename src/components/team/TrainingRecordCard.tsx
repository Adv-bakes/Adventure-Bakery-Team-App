/**
 * One employee's training record: every module their department requires, everything
 * they have actually been assigned, and where those two disagree.
 *
 * This is the view an auditor is shown when they pick a name, so it is the union
 * rather than either half - a module that is required and NOT assigned is the finding
 * that matters, and it is invisible on any list built from assignments alone.
 *
 * READ-ONLY, and deliberately NOT covered by the page's shared Save Changes button -
 * same independence as AccountAccessCard. Nothing here mutates; changing what someone
 * is required to hold means changing the module's scope in the SOPs Library.
 */
import { useEffect, useMemo, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { GraduationCap, Download } from "lucide-react";
import { toast } from "sonner";
import {
  type Employee, type ModuleVariant, type TrainingAssignment, type TrainingModule,
  fetchTrainingModules, fetchTrainingAssignments, fetchTrainingVariants,
} from "@/lib/training";
import { buildGoverningMap, personTraining, statusLabel, exceptionLabel } from "@/lib/trainingMatrix";
import { downloadPersonPdf } from "@/lib/trainingPdf";

interface Props {
  userId: string;
  fullName: string;
  department: string | null;
}

export default function TrainingRecordCard({ userId, fullName, department }: Props) {
  const [modules, setModules] = useState<TrainingModule[]>([]);
  const [assignments, setAssignments] = useState<TrainingAssignment[]>([]);
  const [variants, setVariants] = useState<ModuleVariant[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        const [mods, assigns, vars] = await Promise.all([
          fetchTrainingModules(),
          fetchTrainingAssignments(userId),
          fetchTrainingVariants(),
        ]);
        if (cancelled) return;
        setModules(mods);
        setAssignments(assigns);
        setVariants(vars);
      } catch (e: any) {
        if (!cancelled) toast.error(e.message ?? "Failed to load training record");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [userId]);

  // The department comes from the parent's live form state, so the record re-derives as
  // soon as the department select changes - before Save, which is the point: it shows
  // what the change would mean.
  const employee = useMemo<Employee>(() => ({
    id: userId, full_name: fullName, employee_id: null,
    department, job_title: null, preferred_language: null,
  }), [userId, fullName, department]);

  const governing = useMemo(() => buildGoverningMap(modules, variants), [modules, variants]);
  const rows = useMemo(
    () => personTraining(employee, modules, assignments, governing)
      .filter(r => r.required || r.assignment),
    [employee, modules, assignments, governing]);

  const gaps = rows.filter(r => r.exception === "gap").length;
  const extras = rows.filter(r => r.exception === "extra").length;

  return (
    <Card className="mb-6">
      <CardHeader>
        <div className="flex items-start justify-between gap-3">
          <div>
            <CardTitle className="flex items-center gap-2">
              <GraduationCap className="h-5 w-5 text-accent" />
              Training Record
            </CardTitle>
            <CardDescription>
              Required by department, plus anything assigned directly. Generated live &mdash;
              change a module&rsquo;s scope in the SOPs Library, not here.
            </CardDescription>
          </div>
          <Button
            variant="outline" size="sm" disabled={loading || rows.length === 0}
            onClick={() =>
              downloadPersonPdf(employee, modules, assignments, governing)
                .catch((e: any) => toast.error(e.message ?? "Failed to generate PDF"))}
          >
            <Download className="h-4 w-4 mr-1" />PDF
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        {loading ? (
          <p className="text-sm text-muted-foreground">Loading training record…</p>
        ) : rows.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            {department
              ? "No training is required of this department and nothing is assigned."
              : "No department set, so no training is required automatically. Set a department above and save."}
          </p>
        ) : (
          <>
            {(gaps > 0 || extras > 0) && (
              <div className="flex flex-wrap gap-2 mb-3 text-xs">
                {gaps > 0 && (
                  <Badge className="bg-red-500/15 text-red-700 border-red-500/30">
                    {gaps} required but not assigned
                  </Badge>
                )}
                {extras > 0 && (
                  <Badge className="bg-amber-500/15 text-amber-700 border-amber-500/30">
                    {extras} assigned but not required
                  </Badge>
                )}
              </div>
            )}
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Module</TableHead>
                    <TableHead>Title</TableHead>
                    <TableHead className="text-center">Required</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Completed</TableHead>
                    <TableHead>Expires</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rows.map((r) => (
                    <TableRow key={r.module.id}>
                      <TableCell className="font-mono text-xs whitespace-nowrap">
                        {r.module.module_number ?? r.module.sop_number ?? "-"}
                      </TableCell>
                      <TableCell>
                        {r.module.title}
                        {r.exception && (
                          <Badge
                            className={`ml-2 text-[10px] ${r.exception === "gap"
                              ? "bg-red-500/15 text-red-700 border-red-500/30"
                              : "bg-amber-500/15 text-amber-700 border-amber-500/30"}`}
                          >
                            {exceptionLabel(r)}
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell className="text-center">{r.required ? "Yes" : ""}</TableCell>
                      <TableCell className="capitalize">{statusLabel(r)}</TableCell>
                      <TableCell className="text-muted-foreground">
                        {r.assignment?.completed_at?.slice(0, 10) ?? ""}
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {r.assignment?.expires_at ?? ""}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}
