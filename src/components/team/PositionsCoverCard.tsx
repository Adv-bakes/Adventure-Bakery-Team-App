/**
 * Positions and cover (FSQM-004): every position, who holds it, and who covers it, resolved to
 * people. Read-only; who holds what is changed on each team member's page, and the SQF
 * Practitioner designation on FRM-005.
 */
import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { AlertTriangle, Network } from "lucide-react";
import { toast } from "sonner";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import type { Person, PositionRow } from "@/lib/positions";
import { type PositionsData, loadPositions } from "@/lib/positionsLoad";

function PersonName({ p, linkable }: { p: Person; linkable: boolean }) {
  return linkable && p.id
    ? <Link to={`/team/member/${p.id}`} className="hover:underline">{p.name}</Link>
    : <span>{p.name}</span>;
}

function People({ people, linkable }: { people: Person[]; linkable: boolean }) {
  return <>{people.map((p, i) => <span key={p.id ?? p.name}>{i > 0 && ", "}<PersonName p={p} linkable={linkable} /></span>)}</>;
}

export default function PositionsCoverCard({ canEdit }: { canEdit: boolean }) {
  const [data, setData] = useState<PositionsData | null>(null);

  useEffect(() => {
    loadPositions().then(setData).catch((e) => toast.error(e.message ?? "Could not load the positions"));
  }, []);

  const holderCell = (r: PositionRow) => {
    if (r.def.fromDesignation && !data?.designation) {
      return <span className="text-amber-700">Not designated: no submitted FRM-005</span>;
    }
    if (r.holders.length === 0) return <span className="text-amber-700">Nobody</span>;
    return <People people={r.holders} linkable={canEdit} />;
  };

  const coverCell = (r: PositionRow) => {
    if (!r.cover) return <span className="text-muted-foreground">No cover named in FSQM-004</span>;
    const c = r.cover;
    if (c.via === "Vacant") return <span className="text-muted-foreground">Nobody to cover</span>;
    return (
      <div className="space-y-0.5">
        {c.contracted ? <span>{c.contracted}</span>
          : c.people.length ? <People people={c.people} linkable={canEdit} />
          : <span className="text-red-700 font-medium">No cover</span>}
        {!c.contracted && c.people.length > 0 && <p className="text-xs text-muted-foreground">{c.via}</p>}
        {c.problem && (
          <p className="text-xs text-amber-700 flex items-start gap-1">
            <AlertTriangle className="h-3 w-3 mt-0.5 shrink-0" />{c.problem}
          </p>
        )}
        {r.def.coverNote && <p className="text-xs text-muted-foreground">{r.def.coverNote}</p>}
      </div>
    );
  };

  return (
    <Card className="mt-6">
      <CardHeader className="pb-3">
        <CardTitle className="text-lg flex items-center gap-2">
          <Network className="h-4 w-4 text-accent" />
          Positions and cover
        </CardTitle>
        <CardDescription>
          The positions in{" "}
          {data?.fsqm004Id
            ? <Link to={`/team/compliance/sops?doc=${data.fsqm004Id}`} className="underline">FSQM-004</Link>
            : "FSQM-004"}
          , who holds each one and who covers it in their absence. A person never covers themselves:
          where the named cover is the same person, the cover passes up to Senior Site Management.
          {canEdit && " Change who holds a position on the team member's page."}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        {!data ? (
          <p className="text-sm text-muted-foreground">Loading…</p>
        ) : (
          <>
            {!data.tableReady && (
              <p className="text-sm text-amber-700">
                Position holders are not set up yet. They appear once the database update is installed.
              </p>
            )}
            {data.issues.length > 0 && (
              <div className="text-sm text-amber-800 bg-amber-50 border border-amber-200 rounded p-2">
                <p className="font-medium">FSQM-004 has changed since these cover rules were written:</p>
                <ul className="list-disc pl-5">{data.issues.map((i) => <li key={i}>{i}</li>)}</ul>
              </div>
            )}
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[30%]">Position</TableHead>
                  <TableHead className="w-[30%]">Held by</TableHead>
                  <TableHead>Covered by</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.rows.map((r) => (
                  <TableRow key={r.def.key}>
                    <TableCell className="font-medium align-top">
                      {r.def.name}
                      {r.def.fromDesignation && <p className="text-xs text-muted-foreground font-normal">Designated on FRM-005</p>}
                    </TableCell>
                    <TableCell className="align-top">{holderCell(r)}</TableCell>
                    <TableCell className="align-top">{coverCell(r)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </>
        )}
      </CardContent>
    </Card>
  );
}
