import { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { toast } from "sonner";
import { ArrowLeft, Save, User, Shield, Briefcase, Phone, FileCheck } from "lucide-react";
import { useUserRole, type AppRole } from "@/hooks/useUserRole";

const DEPARTMENTS = ["Production", "Sourcing", "Quality Control", "Admin", "R&D", "Sales"];

// Assignable roles. owner/admin are privileged grants — only an owner may set
// them (mirrors the user_roles RLS escalation guard in 20260714000001).
const ROLE_OPTIONS: { value: AppRole; label: string; hint: string; ownerGrantOnly?: boolean }[] = [
  { value: "owner", label: "Owner", hint: "Full control incl. finance", ownerGrantOnly: true },
  { value: "admin", label: "Admin", hint: "Manage SOPs, forms, training, roles", ownerGrantOnly: true },
  { value: "staff", label: "Staff", hint: "Fill forms, take training" },
  { value: "auditor", label: "Auditor", hint: "Read-only compliance access (SQF contractor)" },
  { value: "user", label: "Client", hint: "Brand portal only" },
];

interface StaffProfile {
  id: string;
  full_name: string;
  employee_id: string;
  department: string;
  job_title: string;
  emergency_contact_name: string;
  emergency_contact_phone: string;
}

export default function TeamMemberDetail() {
  const { userId } = useParams<{ userId: string }>();
  const { hasRole } = useUserRole();
  const viewerIsOwner = hasRole("owner");
  const viewerIsAdmin = viewerIsOwner || hasRole("admin");
  const [email, setEmail] = useState("");
  const [roles, setRoles] = useState<AppRole[]>([]);
  const [initialRoles, setInitialRoles] = useState<AppRole[]>([]);
  const [profile, setProfile] = useState<StaffProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (userId) loadData();
  }, [userId]);

  const loadData = async () => {
    const [profileRes, roleRes] = await Promise.all([
      supabase.from("profiles").select("id, full_name, employee_id, department, job_title, emergency_contact_name, emergency_contact_phone").eq("id", userId!).single(),
      supabase.from("user_roles").select("role").eq("user_id", userId!),
    ]);

    if (profileRes.data) {
      const p = profileRes.data;
      setProfile({
        id: p.id,
        full_name: p.full_name || "",
        employee_id: p.employee_id || "",
        department: p.department || "",
        job_title: p.job_title || "",
        emergency_contact_name: p.emergency_contact_name || "",
        emergency_contact_phone: p.emergency_contact_phone || "",
      });
    }

    if (roleRes.data) {
      const list = roleRes.data.map((r: { role: string }) => r.role as AppRole);
      setRoles(list);
      setInitialRoles(list);
    }

    // Get email via admin API — for now show user ID
    setEmail(userId || "");
    setLoading(false);
  };

  const handleSave = async () => {
    if (!profile) return;
    setSaving(true);

    const { error } = await supabase
      .from("profiles")
      .update({
        full_name: profile.full_name,
        employee_id: profile.employee_id,
        department: profile.department,
        job_title: profile.job_title,
        emergency_contact_name: profile.emergency_contact_name,
        emergency_contact_phone: profile.emergency_contact_phone,
      })
      .eq("id", profile.id);

    if (error) {
      toast.error("Failed to save: " + error.message);
      setSaving(false);
      return;
    }

    // Reconcile role rows (only admins/owners can reach the editor; RLS also
    // enforces the owner-only guard on owner/admin grants).
    if (viewerIsAdmin) {
      const toAdd = roles.filter((r) => !initialRoles.includes(r));
      const toRemove = initialRoles.filter((r) => !roles.includes(r));

      if (toRemove.length > 0) {
        const { error: delErr } = await supabase
          .from("user_roles")
          .delete()
          .eq("user_id", profile.id)
          .in("role", toRemove);
        if (delErr) { toast.error("Failed to remove role: " + delErr.message); setSaving(false); return; }
      }
      if (toAdd.length > 0) {
        const { error: insErr } = await supabase
          .from("user_roles")
          .insert(toAdd.map((r) => ({ user_id: profile.id, role: r })));
        if (insErr) { toast.error("Failed to add role: " + insErr.message); setSaving(false); return; }
      }
      setInitialRoles(roles);
    }

    toast.success("Team member profile updated");
    setSaving(false);
  };

  const toggleRole = (r: AppRole, on: boolean) =>
    setRoles((prev) => (on ? [...new Set([...prev, r])] : prev.filter((x) => x !== r)));

  if (loading) {
    return (
      <div className="container mx-auto px-4 py-8 flex justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-accent" />
      </div>
    );
  }

  if (!profile) {
    return (
      <div className="container mx-auto px-4 py-8">
        <p className="text-muted-foreground">Team member not found.</p>
        <Button asChild variant="ghost" className="mt-4">
          <Link to="/team/dashboard"><ArrowLeft className="h-4 w-4 mr-2" />Back</Link>
        </Button>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8 max-w-2xl">
      <Button asChild variant="ghost" className="mb-4">
        <Link to="/team/dashboard">
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back to Dashboard
        </Link>
      </Button>

      <div className="mb-8">
        <h1 className="text-3xl font-bold tracking-tight text-foreground">Edit Team Member</h1>
        <p className="text-muted-foreground mt-1">Update profile fields for this staff member</p>
      </div>

      {/* Identity */}
      <Card className="mb-6">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <User className="h-5 w-5 text-accent" />
            Identity
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label>Full Name</Label>
              <Input
                value={profile.full_name}
                onChange={(e) => setProfile(p => p ? { ...p, full_name: e.target.value } : p)}
                placeholder="e.g. Jane Smith"
              />
            </div>
            <div className="space-y-2">
              <Label>Employee ID</Label>
              <Input
                value={profile.employee_id}
                onChange={(e) => setProfile(p => p ? { ...p, employee_id: e.target.value } : p)}
                placeholder="e.g. AB-001"
              />
            </div>
          </div>
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <Shield className="h-4 w-4 text-accent" />
              <Label className="mb-0">Roles</Label>
              <Badge variant="default" className="ml-auto flex items-center gap-1">
                <FileCheck className="h-3 w-3" />
                NDA Signed
              </Badge>
            </div>

            {viewerIsAdmin ? (
              <>
                <div className="grid gap-2 sm:grid-cols-2">
                  {ROLE_OPTIONS.map((opt) => {
                    const disabled = opt.ownerGrantOnly && !viewerIsOwner;
                    return (
                      <label
                        key={opt.value}
                        className={`flex items-start gap-2 rounded-md border p-2 ${disabled ? "opacity-50" : "cursor-pointer hover:bg-muted/50"}`}
                      >
                        <Checkbox
                          checked={roles.includes(opt.value)}
                          disabled={disabled}
                          onCheckedChange={(v) => toggleRole(opt.value, v === true)}
                          className="mt-0.5"
                        />
                        <span className="leading-tight">
                          <span className="text-sm font-medium">{opt.label}</span>
                          <span className="block text-xs text-muted-foreground">{opt.hint}</span>
                        </span>
                      </label>
                    );
                  })}
                </div>
                <p className="text-xs text-muted-foreground">
                  A person may hold several roles — permissions combine (they add up, never subtract).
                  {!viewerIsOwner && " Only an owner can grant Owner or Admin."}
                </p>
              </>
            ) : (
              <div className="flex flex-wrap gap-1.5">
                {roles.length === 0 ? (
                  <span className="text-sm text-muted-foreground">—</span>
                ) : (
                  roles.map((r) => (
                    <Badge key={r} variant="secondary" className="capitalize">{r}</Badge>
                  ))
                )}
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Position */}
      <Card className="mb-6">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Briefcase className="h-5 w-5 text-accent" />
            Position
          </CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label>Department</Label>
            <Select
              value={profile.department}
              onValueChange={(val) => setProfile(p => p ? { ...p, department: val } : p)}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select department" />
              </SelectTrigger>
              <SelectContent>
                {DEPARTMENTS.map(d => (
                  <SelectItem key={d} value={d}>{d}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Job Title</Label>
            <Input
              value={profile.job_title}
              onChange={(e) => setProfile(p => p ? { ...p, job_title: e.target.value } : p)}
              placeholder="e.g. Production Lead"
            />
          </div>
        </CardContent>
      </Card>

      {/* Emergency Contact */}
      <Card className="mb-6">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Phone className="h-5 w-5 text-accent" />
            Emergency Contact
          </CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label>Contact Name</Label>
            <Input
              value={profile.emergency_contact_name}
              onChange={(e) => setProfile(p => p ? { ...p, emergency_contact_name: e.target.value } : p)}
              placeholder="e.g. John Smith"
            />
          </div>
          <div className="space-y-2">
            <Label>Contact Phone</Label>
            <Input
              value={profile.emergency_contact_phone}
              onChange={(e) => setProfile(p => p ? { ...p, emergency_contact_phone: e.target.value } : p)}
              placeholder="(555) 123-4567"
            />
          </div>
        </CardContent>
      </Card>

      <div className="flex justify-end">
        <Button onClick={handleSave} disabled={saving} className="gap-2">
          <Save className="h-4 w-4" />
          {saving ? "Saving…" : "Save Changes"}
        </Button>
      </div>
    </div>
  );
}
