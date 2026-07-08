import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ShieldCheck, BookOpen } from "lucide-react";
import { toast } from "sonner";
import { SqfReference } from "@/components/team/SqfReference";
import { DOC_STAGES, parseDocNumber, stageForNumber, isValidDocNumber, parseClauseNumber, compareClauseIds } from "@/lib/docNumber";

type RegisterDoc = {
  id: string;
  sop_number: string | null;
  title: string;
  type: "sop" | "form" | "policy" | "training" | "fsqm";
  revision: string | null;
  effective_date: string | null;
  sqf_reference: string | null;
  status: "draft" | "active" | "archived";
};

const TYPE_LABELS: Record<string, string> = { sop: "SOP", form: "Form", policy: "Policy", training: "Training", fsqm: "FSQM" };

const statusColors: Record<string, string> = {
  draft: "bg-[#C89B3C]/20 text-[#9A6F1E] border-[#C89B3C]/40",
  active: "bg-green-500/20 text-green-700",
  archived: "bg-amber-500/20 text-amber-700",
};

const UNASSIGNED_KEY = "__unassigned__";
const CLAUSE_KEY = "__sqf_clause__";

export default function DocumentRegister() {
  const navigate = useNavigate();
  const [docs, setDocs] = useState<RegisterDoc[]>([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      // Controlled QMS documents only. Training modules (type 'training') have their own
      // TR-NN scheme and management surface (/team/hr/trainings), so they're excluded here.
      const { data, error } = await (supabase as any)
        .from("sop_documents")
        .select("id, sop_number, title, type, revision, effective_date, sqf_reference, status")
        .neq("type", "training")
        .order("sop_number", { ascending: true });
      if (error) toast.error(error.message);
      setDocs((data ?? []) as RegisterDoc[]);
      setLoading(false);
    })();
  }, []);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return docs;
    return docs.filter((d) => `${d.sop_number ?? ""} ${d.title}`.toLowerCase().includes(q));
  }, [docs, search]);

  // Group by stage block. SQF-clause-numbered SOPs (a deliberate second scheme) get their own
  // section; unparseable / legacy / messy numbers land in "Unassigned" (the renumbering worklist).
  const groups = useMemo(() => {
    const map = new Map<string, RegisterDoc[]>();
    for (const d of filtered) {
      const parsed = parseDocNumber(d.sop_number);
      const stage = parsed && isValidDocNumber(d.sop_number) ? stageForNumber(parsed.number) : null;
      const key = stage?.key ?? (parseClauseNumber(d.sop_number) ? CLAUSE_KEY : UNASSIGNED_KEY);
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(d);
    }
    // Order: DOC_STAGES sequence, then clause-numbered SOPs, then Unassigned last.
    const ordered: { key: string; label: string; rows: RegisterDoc[] }[] = [];
    for (const stage of DOC_STAGES) {
      const rows = map.get(stage.key);
      if (rows) ordered.push({ key: stage.key, label: stage.label, rows: sortRows(rows) });
    }
    const clause = map.get(CLAUSE_KEY);
    if (clause) ordered.push({ key: CLAUSE_KEY, label: "SOPs (numbered by SQF clause)", rows: sortRows(clause) });
    const unassigned = map.get(UNASSIGNED_KEY);
    if (unassigned) ordered.push({ key: UNASSIGNED_KEY, label: "Unassigned", rows: sortRows(unassigned) });
    return ordered;
  }, [filtered]);

  return (
    <div className="p-6 space-y-6 max-w-6xl mx-auto">
      <div>
        <h1 className="text-3xl font-bold flex items-center gap-2" style={{ color: "#F5F1E6" }}>
          <BookOpen className="w-7 h-7 text-[#C89B3C]" />
          Document Register
        </h1>
        <p className="text-sm mt-1" style={{ color: "rgba(245,241,230,0.75)" }}>
          Every controlled SOP, form, and manual, grouped by process stage. Numbers follow the
          <span className="font-semibold" style={{ color: "#F5F1E6" }}> TYPE-NNN </span> convention (block = stage). Click a row to open it in the SOPs Library.
        </p>
      </div>

      <Input
        placeholder="Search by number or title…"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        className="max-w-sm"
      />

      {loading ? (
        <p className="text-sm text-muted-foreground">Loading…</p>
      ) : groups.length === 0 ? (
        <p className="text-sm text-muted-foreground">No documents found.</p>
      ) : (
        groups.map((group) => (
          <Card key={group.key} className="overflow-hidden" style={{ borderColor: "rgba(200,155,60,0.25)" }}>
            <div className="flex items-center justify-between px-4 py-2.5 bg-[#F5F1E6] border-b" style={{ borderColor: "rgba(200,155,60,0.25)" }}>
              <h2 className="text-sm font-semibold text-[#2A1F0E]">{group.label}</h2>
              <Badge variant="outline">{group.rows.length}</Badge>
            </div>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[120px]">Number</TableHead>
                  <TableHead>Title</TableHead>
                  <TableHead className="w-[90px]">Type</TableHead>
                  <TableHead className="w-[80px]">Rev</TableHead>
                  <TableHead className="w-[120px]">Effective</TableHead>
                  <TableHead className="w-[160px]">SQF Ref</TableHead>
                  <TableHead className="w-[90px]">Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {group.rows.map((d) => (
                  <TableRow
                    key={d.id}
                    className="cursor-pointer"
                    onClick={() => navigate(`/team/compliance/sops?doc=${d.id}`)}
                  >
                    <TableCell className="font-mono text-xs">{d.sop_number ?? "—"}</TableCell>
                    <TableCell className="font-medium">{d.title}</TableCell>
                    <TableCell><Badge variant="outline">{TYPE_LABELS[d.type] ?? d.type}</Badge></TableCell>
                    <TableCell>{d.revision ?? "—"}</TableCell>
                    <TableCell>{d.effective_date ?? "—"}</TableCell>
                    <TableCell onClick={(e) => e.stopPropagation()}>
                      {d.sqf_reference ? <SqfReference value={d.sqf_reference} /> : "—"}
                    </TableCell>
                    <TableCell><Badge className={statusColors[d.status]}>{d.status}</Badge></TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </Card>
        ))
      )}
    </div>
  );
}

// Sort by stage-block number, then by SQF clause, falling back to raw string.
function sortRows(rows: RegisterDoc[]): RegisterDoc[] {
  return [...rows].sort((a, b) => {
    const na = parseDocNumber(a.sop_number)?.number;
    const nb = parseDocNumber(b.sop_number)?.number;
    if (na != null && nb != null) return na - nb;
    const ca = parseClauseNumber(a.sop_number)?.clause;
    const cb = parseClauseNumber(b.sop_number)?.clause;
    if (ca && cb) return compareClauseIds(ca, cb);
    return (a.sop_number ?? "").localeCompare(b.sop_number ?? "");
  });
}
