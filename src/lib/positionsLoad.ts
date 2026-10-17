// Loads what src/lib/positions.ts resolves: the team, the current position holders, the FRM-005
// designation in force, and FSQM-004's wording. position_holders is not in the generated types.

import { supabase } from "@/integrations/supabase/client";
import {
  type Designation, type Person, type PositionKey, type PositionRow,
  checkPositionsAgainstFsqm004, designationFrom, resolvePositions,
} from "@/lib/positions";

export interface PositionsData {
  rows: PositionRow[];
  team: Person[];
  designation: Designation | null;
  /** FSQM-004's id, for links; null when it is not found. */
  fsqm004Id: string | null;
  /** Where the cover rules no longer match FSQM-004's wording. */
  issues: string[];
  /** False before the position_holders migration is pushed. */
  tableReady: boolean;
}

export async function loadPositions(): Promise<PositionsData> {
  const db = supabase as any;
  const [{ data: roles, error: rErr }, held, frm005, fsqm004] = await Promise.all([
    db.from("user_roles").select("user_id").in("role", ["staff", "admin", "owner"]),
    db.from("position_holders").select("user_id, position").is("ended_at", null),
    db.from("sop_documents").select("id").eq("sop_number", "FRM-005").eq("status", "active").maybeSingle(),
    db.from("sop_documents").select("id, content").eq("sop_number", "FSQM-004").eq("status", "active").maybeSingle(),
  ]);
  if (rErr) throw rErr;

  const ids = [...new Set((roles ?? []).map((r: any) => r.user_id as string))];
  let team: Person[] = [];
  if (ids.length) {
    const { data: people, error } = await db.from("profiles").select("id, full_name").in("id", ids);
    if (error) throw error;
    team = (people ?? [])
      .map((p: any) => ({ id: p.id as string, name: String(p.full_name ?? "").trim() }))
      .filter((p: Person) => p.name)
      .sort((a: Person, b: Person) => a.name.localeCompare(b.name));
  }

  let designation: Designation | null = null;
  if (frm005.data?.id) {
    const { data: entries, error } = await db.from("sop_document_responses")
      .select("id, status, submitted_at, data").eq("document_id", frm005.data.id);
    if (error) throw error;
    designation = designationFrom(entries ?? []);
  }

  const procedure = fsqm004.data?.content?.procedure;
  const issues = Array.isArray(procedure)
    ? checkPositionsAgainstFsqm004(procedure.join("\n"))
    : ["FSQM-004 could not be read, so the cover rules shown are not checked against it."];

  const tableReady = !held.error;
  const current = (held.data ?? []) as { user_id: string; position: string }[];
  return {
    rows: resolvePositions(current, team, designation),
    team, designation, issues, tableReady,
    fsqm004Id: fsqm004.data?.id ?? null,
  };
}

export async function setPositionHolder(userId: string, position: PositionKey, holds: boolean): Promise<void> {
  const { error } = await (supabase as any).rpc("set_position_holder", { _user: userId, _position: position, _holds: holds });
  if (error) throw error;
}
