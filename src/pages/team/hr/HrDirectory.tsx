import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { toast } from "sonner";
import { UserSquare2, Search, ChevronRight, UserPlus, Copy, Check, Clock, Ban } from "lucide-react";
import { useUserRole, type AppRole } from "@/hooks/useUserRole";

const TEAM_ROLES: AppRole[] = ["owner", "admin", "staff", "auditor"];
const ROLE_LABEL: Record<string, string> = {
  owner: "Owner", admin: "Admin", staff: "Staff", auditor: "Auditor", user: "Client",
};
const DEPARTMENTS = ["Production", "Sourcing", "Quality Control", "Admin", "R&D", "Sales"];
const NO_DEPT = "__none__";

interface Member {
  id: string;
  full_name: string;
  email: string;
  employee_id: string;
  department: string;
  job_title: string;
  roles: AppRole[];
}

interface TeamInvite {
  id: string;
  email: string;
  role: string | null;
  department: string | null;
  created_at: string;
  expires_at: string;
  token: string;
}

export default function HrDirectory() {
  const navigate = useNavigate();
  const { hasRole } = useUserRole();
  const isOwner = hasRole("owner");
  const canEdit = isOwner || hasRole("admin");
  const [members, setMembers] = useState<Member[]>([]);
  const [invites, setInvites] = useState<TeamInvite[]>([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState("");

  // Invite dialog
  const [inviteOpen, setInviteOpen] = useState(false);
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState<AppRole>("staff");
  const [inviteDept, setInviteDept] = useState<string>(NO_DEPT);
  const [inviting, setInviting] = useState(false);
  const [inviteLink, setInviteLink] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  // Owner can invite any role; admin can invite staff/auditor only (matches RLS).
  const inviteRoleOptions: AppRole[] = isOwner ? ["owner", "admin", "staff", "auditor"] : ["staff", "auditor"];

  const resetInvite = () => {
    setInviteEmail(""); setInviteRole("staff"); setInviteDept(NO_DEPT);
    setInviteLink(null); setCopied(false);
  };

  const handleInvite = async () => {
    const email = inviteEmail.trim().toLowerCase();
    if (!email) { toast.error("Enter an email address."); return; }
    setInviting(true);
    try {
      const { data, error } = await supabase.rpc("create_team_invitation" as any, {
        _email: email,
        _role: inviteRole,
        _department: inviteDept === NO_DEPT ? "" : inviteDept,
      });
      if (error) throw error;

      const token = data as string | null;
      if (!token) {
        throw new Error(
          "The server didn't return an invite token. Refresh the page and try again; " +
          "if it persists, sign out and back in (your session may have expired).",
        );
      }
      const link = `${window.location.origin}/accept-invite?token=${token}`;
      setInviteLink(link);

      // Best-effort email delivery; the copyable link is the reliable fallback.
      const { data: { user } } = await supabase.auth.getUser();
      supabase.functions.invoke("send-invitation-email", {
        body: { email, inviteUrl: link, invitedByEmail: user?.email },
      }).catch(() => {/* non-fatal — admin shares the link manually */});

      try { await navigator.clipboard.writeText(link); setCopied(true); } catch { /* clipboard may be blocked */ }
      toast.success("Invitation created — link copied. Email sent if delivery is configured.");
      loadInvites();
    } catch (e: any) {
      toast.error(e.message ?? "Failed to create invitation");
    } finally {
      setInviting(false);
    }
  };

  const copyLink = async () => {
    if (!inviteLink) return;
    try { await navigator.clipboard.writeText(inviteLink); setCopied(true); toast.success("Link copied"); }
    catch { toast.error("Couldn't copy — select the link manually."); }
  };

  const loadMembers = async () => {
    setLoading(true);
    // Team members = anyone holding a team role (excludes brand-only clients).
    const { data: roleRows, error: rErr } = await supabase
      .from("user_roles")
      .select("user_id, role")
      .in("role", TEAM_ROLES);
    if (rErr) { toast.error("Failed to load roles"); setLoading(false); return; }

    const rolesByUser = new Map<string, AppRole[]>();
    (roleRows ?? []).forEach((r: { user_id: string; role: string }) => {
      const list = rolesByUser.get(r.user_id) ?? [];
      list.push(r.role as AppRole);
      rolesByUser.set(r.user_id, list);
    });
    const ids = [...rolesByUser.keys()];
    if (ids.length === 0) { setMembers([]); setLoading(false); return; }

    const { data: profs, error: pErr } = await supabase
      .from("profiles")
      .select("id, full_name, email, employee_id, department, job_title")
      .in("id", ids);
    if (pErr) { toast.error("Failed to load profiles"); setLoading(false); return; }

    const profById = new Map<string, any>((profs ?? []).map((p: any) => [p.id, p]));

    // Drive the list off the ROLE rows (the source of truth for "team member"),
    // not the profiles query — so a role-holder whose profile row is missing
    // still appears instead of silently vanishing.
    const rows: Member[] = ids.map((id) => {
      const p = profById.get(id) ?? {};
      return {
        id,
        // Fall back to the login email, then a short id, so a member with no
        // profile name is still identifiable.
        full_name: p.full_name || p.email || `User ${id.slice(0, 8)}`,
        email: p.email || "",
        employee_id: p.employee_id || "",
        department: p.department || "",
        job_title: p.job_title || "",
        roles: rolesByUser.get(id) ?? [],
      };
    }).sort((a, b) => a.full_name.localeCompare(b.full_name));

    setMembers(rows);
    setLoading(false);
  };

  // Unaccepted, still-valid team invites. Revoking (below) expires the row, so
  // it drops off this list on the next load.
  const loadInvites = async () => {
    const { data, error } = await supabase
      .from("client_invitations" as any)
      .select("id, email, role, department, created_at, expires_at, token")
      .eq("invite_kind", "team")
      .is("accepted_at", null)
      .gt("expires_at", new Date().toISOString())
      .order("created_at", { ascending: false });
    if (error) { toast.error("Failed to load invitations"); return; }
    setInvites((data ?? []) as TeamInvite[]);
  };

  const revokeInvite = async (id: string) => {
    // No DELETE policy on client_invitations by design — expire it instead
    // (validate_invitation_token then treats it as invalid).
    const { error } = await supabase
      .from("client_invitations" as any)
      .update({ expires_at: new Date().toISOString() })
      .eq("id", id);
    if (error) { toast.error("Failed to revoke: " + error.message); return; }
    toast.success("Invitation revoked");
    loadInvites();
  };

  const copyInviteLink = async (token: string) => {
    const link = `${window.location.origin}/accept-invite?token=${token}`;
    try { await navigator.clipboard.writeText(link); toast.success("Invite link copied"); }
    catch { toast.error("Couldn't copy automatically — link: " + link); }
  };

  useEffect(() => { loadMembers(); }, []);
  // canEdit depends on the async role fetch, so (re)load invites once it resolves.
  useEffect(() => { if (canEdit) loadInvites(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [canEdit]);

  const filtered = members.filter((m) => {
    if (!q.trim()) return true;
    const hay = `${m.full_name} ${m.email} ${m.employee_id} ${m.department} ${m.job_title}`.toLowerCase();
    return hay.includes(q.toLowerCase());
  });

  return (
    <div className="container mx-auto px-4 py-8 max-w-4xl">
      <div className="mb-6 flex items-start justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight flex items-center gap-2" style={{ color: "#F5F1E6" }}>
            <UserSquare2 className="h-7 w-7" style={{ color: "#C89B3C" }} />
            Team Directory
          </h1>
          <p className="mt-1" style={{ color: "rgba(245,241,230,0.7)" }}>
            Everyone with a team role. {canEdit ? "Open a member to set their roles and department." : "View-only."}
          </p>
        </div>

        {canEdit && (
          <Dialog open={inviteOpen} onOpenChange={(o) => { setInviteOpen(o); if (!o) resetInvite(); }}>
            <DialogTrigger asChild>
              <Button className="bg-[#C89B3C] hover:bg-[#B8892C] text-black shrink-0">
                <UserPlus className="w-4 h-4 mr-1" />Invite Team Member
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-md">
              <DialogHeader>
                <DialogTitle>Invite a Team Member</DialogTitle>
                <DialogDescription>
                  Send a self-serve link. They set their own password; the role and department below
                  are applied automatically when they accept.
                </DialogDescription>
              </DialogHeader>

              {inviteLink ? (
                <div className="space-y-3">
                  <p className="text-sm text-muted-foreground">
                    Invitation for <span className="font-medium text-foreground">{inviteEmail}</span> as{" "}
                    <span className="font-medium text-foreground">{ROLE_LABEL[inviteRole]}</span>. Share this link:
                  </p>
                  <div className="flex items-center gap-2">
                    <Input readOnly value={inviteLink} className="text-xs" onFocus={(e) => e.currentTarget.select()} />
                    <Button type="button" variant="outline" size="icon" onClick={copyLink}>
                      {copied ? <Check className="h-4 w-4 text-green-600" /> : <Copy className="h-4 w-4" />}
                    </Button>
                  </div>
                  <p className="text-xs text-muted-foreground">Link expires in 7 days.</p>
                </div>
              ) : (
                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="invite-email">Email</Label>
                    <Input
                      id="invite-email"
                      type="email"
                      value={inviteEmail}
                      onChange={(e) => setInviteEmail(e.target.value)}
                      placeholder="name@company.com"
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-2">
                      <Label>Role</Label>
                      <Select value={inviteRole} onValueChange={(v) => setInviteRole(v as AppRole)}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          {inviteRoleOptions.map((r) => (
                            <SelectItem key={r} value={r}>{ROLE_LABEL[r]}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label>Department</Label>
                      <Select value={inviteDept} onValueChange={setInviteDept}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value={NO_DEPT}>— None —</SelectItem>
                          {DEPARTMENTS.map((d) => (
                            <SelectItem key={d} value={d}>{d}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Department drives automatic training assignment. Auditors don't need one.
                  </p>
                </div>
              )}

              <DialogFooter>
                {inviteLink ? (
                  <Button onClick={() => { setInviteOpen(false); resetInvite(); }}>Done</Button>
                ) : (
                  <>
                    <Button variant="outline" onClick={() => setInviteOpen(false)} disabled={inviting}>Cancel</Button>
                    <Button onClick={handleInvite} disabled={inviting || !inviteEmail.trim()} className="bg-[#C89B3C] hover:bg-[#B8892C] text-black">
                      {inviting ? "Creating…" : "Create Invite"}
                    </Button>
                  </>
                )}
              </DialogFooter>
            </DialogContent>
          </Dialog>
        )}
      </div>

      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between gap-3">
            <CardTitle className="text-lg">
              {loading ? "Loading…" : `${filtered.length} member${filtered.length === 1 ? "" : "s"}`}
            </CardTitle>
            <div className="relative w-64 max-w-full">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search name, dept, title" className="pl-8" />
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {!loading && filtered.length === 0 ? (
            <p className="text-sm text-muted-foreground py-6 text-center">No team members found.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Department</TableHead>
                  <TableHead>Roles</TableHead>
                  {canEdit && <TableHead className="w-8" />}
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((m) => {
                  const cells = (
                    <>
                      <TableCell>
                        <div className="font-medium">{m.full_name}</div>
                        <div className="text-xs text-muted-foreground">
                          {/* Prefer the email as the secondary identifier; avoid
                              repeating it when it's already the primary name. */}
                          {m.email && m.email !== m.full_name
                            ? m.email
                            : m.job_title || m.employee_id || "—"}
                        </div>
                      </TableCell>
                      <TableCell>{m.department || "—"}</TableCell>
                      <TableCell>
                        <div className="flex flex-wrap gap-1">
                          {m.roles.map((r) => (
                            <Badge key={r} variant="secondary">{ROLE_LABEL[r] ?? r}</Badge>
                          ))}
                        </div>
                      </TableCell>
                      {canEdit && <TableCell><ChevronRight className="h-4 w-4 text-muted-foreground" /></TableCell>}
                    </>
                  );
                  return canEdit ? (
                    <TableRow
                      key={m.id}
                      className="cursor-pointer hover:bg-muted/50"
                      onClick={() => navigate(`/team/member/${m.id}`)}
                    >
                      {cells}
                    </TableRow>
                  ) : (
                    <TableRow key={m.id}>{cells}</TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {canEdit && invites.length > 0 && (
        <Card className="mt-6">
          <CardHeader className="pb-3">
            <CardTitle className="text-lg flex items-center gap-2">
              <Clock className="h-4 w-4 text-accent" />
              Pending Invitations ({invites.length})
            </CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Email</TableHead>
                  <TableHead>Role</TableHead>
                  <TableHead>Department</TableHead>
                  <TableHead>Sent</TableHead>
                  <TableHead>Expires</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {invites.map((inv) => (
                  <TableRow key={inv.id}>
                    <TableCell className="font-medium">{inv.email}</TableCell>
                    <TableCell>
                      <Badge variant="secondary">{ROLE_LABEL[inv.role ?? ""] ?? inv.role}</Badge>
                    </TableCell>
                    <TableCell>{inv.department || "—"}</TableCell>
                    <TableCell className="text-sm text-muted-foreground">{new Date(inv.created_at).toLocaleDateString()}</TableCell>
                    <TableCell className="text-sm text-muted-foreground">{new Date(inv.expires_at).toLocaleDateString()}</TableCell>
                    <TableCell className="text-right whitespace-nowrap space-x-1">
                      <Button variant="outline" size="sm" onClick={() => copyInviteLink(inv.token)}>
                        <Copy className="h-3.5 w-3.5 mr-1" />Copy link
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        className="text-red-600 border-red-300 hover:bg-red-50 hover:text-red-700"
                        onClick={() => revokeInvite(inv.id)}
                      >
                        <Ban className="h-3.5 w-3.5 mr-1" />Revoke
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
