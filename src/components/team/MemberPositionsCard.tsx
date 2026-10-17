/**
 * The FSQM-004 positions one team member holds, and the positions they cover.
 *
 * Each tick saves at once through set_position_holder (admin/owner), and is NOT covered by the
 * page's shared Save Changes button - same independence as AccountAccessCard. Giving a position up
 * ends the holding; the history is kept. The SQF Practitioner designation is shown, not edited:
 * it is made on FRM-005.
 */
import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Network } from "lucide-react";
import { toast } from "sonner";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { ASSIGNABLE_POSITIONS, type PositionKey } from "@/lib/positions";
import { type PositionsData, loadPositions, setPositionHolder } from "@/lib/positionsLoad";

export default function MemberPositionsCard({ userId, isTeamMember }: { userId: string; isTeamMember: boolean }) {
  const [data, setData] = useState<PositionsData | null>(null);
  const [busy, setBusy] = useState<PositionKey | null>(null);

  const load = useCallback(() => {
    loadPositions().then(setData).catch((e) => toast.error(e.message ?? "Could not load the positions"));
  }, []);
  useEffect(load, [load]);

  if (!data) return null;
  const me = data.team.find((p) => p.id === userId) ?? null;
  const holds = (key: PositionKey) => data.rows.some((r) => r.def.key === key && r.holders.some((h) => h.id === userId));
  const designated = data.rows.filter((r) => r.def.fromDesignation && r.holders.some((h) => h.id === userId));
  const covers = data.rows.filter((r) => r.cover?.people.some((p) => p.id === userId));

  const toggle = async (key: PositionKey, next: boolean) => {
    setBusy(key);
    try {
      await setPositionHolder(userId, key, next);
      load();
    } catch (e: any) {
      toast.error(e.message ?? "Could not save the position");
    } finally {
      setBusy(null);
    }
  };

  return (
    <Card className="mb-6">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Network className="h-5 w-5 text-accent" />
          Positions (FSQM-004)
        </CardTitle>
        <CardDescription>
          The positions this person holds. One person may hold several. Each tick saves at once.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {!data.tableReady ? (
          <p className="text-sm text-amber-700">Positions can be set once the database update is installed.</p>
        ) : !isTeamMember || !me ? (
          <p className="text-sm text-muted-foreground">Positions are held by team members (staff, admin or owner) only.</p>
        ) : (
          <div className="grid gap-2 sm:grid-cols-2">
            {ASSIGNABLE_POSITIONS.map((p) => (
              <div key={p.key} className="flex items-center gap-2">
                <Checkbox
                  id={`pos-${p.key}`}
                  checked={holds(p.key)}
                  disabled={busy !== null}
                  onCheckedChange={(v) => toggle(p.key, v === true)}
                />
                <Label htmlFor={`pos-${p.key}`} className="font-normal">{p.name}</Label>
              </div>
            ))}
          </div>
        )}

        <div className="text-sm space-y-1">
          <p>
            <span className="text-muted-foreground">SQF Practitioner: </span>
            {designated.length
              ? designated.map((r) => r.def.fromDesignation).join(" and ") + " (FRM-005)"
              : "not designated (FRM-005)"}
          </p>
          <p>
            <span className="text-muted-foreground">Covers: </span>
            {covers.length ? covers.map((r) => r.def.name).join(", ") : "nothing"}
          </p>
          <p className="text-xs text-muted-foreground">
            The full list is on the{" "}
            <Link to="/team/hr/directory" className="underline">Team Directory</Link>, under Positions and cover.
          </p>
        </div>
      </CardContent>
    </Card>
  );
}
