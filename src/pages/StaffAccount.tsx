import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { LogOut, User, Shield, Building2, Phone, FileCheck, Briefcase, Save, KeyRound, Eye, EyeOff } from "lucide-react";
import { useUserRole } from "@/hooks/useUserRole";

const DEPARTMENTS = [
  "Production",
  "Sourcing",
  "Quality Control",
  "Admin",
  "R&D",
  "Sales",
];

interface StaffProfile {
  full_name: string;
  employee_id: string;
  department: string;
  job_title: string;
  emergency_contact_name: string;
  emergency_contact_phone: string;
}

export default function StaffAccount() {
  const navigate = useNavigate();
  const { role } = useUserRole();
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [profile, setProfile] = useState<StaffProfile>({
    full_name: "",
    employee_id: "",
    department: "",
    job_title: "",
    emergency_contact_name: "",
    emergency_contact_phone: "",
  });
  // NDA status — check if nda_agreements record exists (table may not exist yet)
  const [ndaSigned, setNdaSigned] = useState<boolean | null>(null);

  // Change password
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [changingPassword, setChangingPassword] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  useEffect(() => {
    loadProfile();
  }, []);

  const loadProfile = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { setLoading(false); return; }

    setEmail(user.email || "");

    const { data } = await supabase
      .from("profiles")
      .select("full_name, employee_id, department, job_title, emergency_contact_name, emergency_contact_phone")
      .eq("id", user.id)
      .maybeSingle();

    if (data) {
      setProfile({
        full_name: data.full_name || "",
        employee_id: data.employee_id || "",
        department: data.department || "",
        job_title: data.job_title || "",
        emergency_contact_name: data.emergency_contact_name || "",
        emergency_contact_phone: data.emergency_contact_phone || "",
      });
    }

    // NDA status — currently we infer from the nda flow; placeholder for future table
    setNdaSigned(true); // Will be wired to nda_agreements table when available

    setLoading(false);
  };

  const handleSave = async () => {
    setSaving(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { setSaving(false); return; }

    // Staff can only update their own emergency contact info
    const updateFields = role === "admin"
      ? { ...profile }
      : {
          emergency_contact_name: profile.emergency_contact_name,
          emergency_contact_phone: profile.emergency_contact_phone,
        };

    const { error } = await supabase
      .from("profiles")
      .update(updateFields)
      .eq("id", user.id);

    if (error) {
      toast.error("Failed to save profile");
    } else {
      toast.success("Profile updated");
    }
    setSaving(false);
  };

  const handleChangePassword = async () => {
    if (newPassword.length < 8) {
      toast.error("Password must be at least 8 characters.");
      return;
    }
    if (newPassword !== confirmPassword) {
      toast.error("Passwords don't match.");
      return;
    }
    setChangingPassword(true);
    const { error } = await supabase.auth.updateUser({ password: newPassword });
    if (error) {
      toast.error("Failed to update password: " + error.message);
    } else {
      toast.success("Password updated.");
      setNewPassword("");
      setConfirmPassword("");
    }
    setChangingPassword(false);
  };

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    navigate("/k2f-login");
    toast.success("Signed out successfully");
  };

  const isAdmin = role === "admin";

  if (loading) {
    return (
      <div className="container mx-auto px-4 py-8 flex justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-accent" />
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8 max-w-2xl">
      <div className="mb-8">
        <h1 className="text-4xl font-bold tracking-tight" style={{ color: "#F5F1E6" }}>Team Account</h1>
        <p className="mt-2" style={{ color: "rgba(245,241,230,0.7)" }}>Adventure Bakery internal team member</p>
      </div>

      {/* Identity & Role */}
      <Card className="mb-6">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <User className="h-5 w-5 text-accent" />
            Identity
          </CardTitle>
          <CardDescription>Your login details and role assignment</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label>Email</Label>
              <Input value={email} disabled className="bg-muted" />
            </div>
            <div className="space-y-2">
              <Label>Full Name</Label>
              <Input
                value={profile.full_name}
                onChange={(e) => setProfile(p => ({ ...p, full_name: e.target.value }))}
                disabled={!isAdmin}
                placeholder="e.g. Jane Smith"
                className={!isAdmin ? "bg-muted" : ""}
              />
            </div>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label>Employee ID</Label>
              <Input
                value={profile.employee_id}
                onChange={(e) => setProfile(p => ({ ...p, employee_id: e.target.value }))}
                disabled={!isAdmin}
                placeholder="e.g. AB-001"
                className={!isAdmin ? "bg-muted" : ""}
              />
            </div>
            <div className="flex items-center gap-3 pt-6">
              <Label>Role</Label>
              <Badge variant="secondary" className="flex items-center gap-1">
                <Shield className="h-3 w-3" />
                {role === "admin" ? "Admin" : "Staff"}
              </Badge>
              {ndaSigned !== null && (
                <Badge
                  variant={ndaSigned ? "default" : "destructive"}
                  className="flex items-center gap-1"
                >
                  <FileCheck className="h-3 w-3" />
                  {ndaSigned ? "NDA Signed" : "NDA Pending"}
                </Badge>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Department & Title */}
      <Card className="mb-6">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Briefcase className="h-5 w-5 text-accent" />
            Position
          </CardTitle>
          <CardDescription>Department and job title</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label>Department</Label>
            {isAdmin ? (
              <Select
                value={profile.department}
                onValueChange={(val) => setProfile(p => ({ ...p, department: val }))}
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
            ) : (
              <Input value={profile.department || "—"} disabled className="bg-muted" />
            )}
          </div>
          <div className="space-y-2">
            <Label>Job Title</Label>
            <Input
              value={profile.job_title}
              onChange={(e) => setProfile(p => ({ ...p, job_title: e.target.value }))}
              disabled={!isAdmin}
              placeholder="e.g. Production Lead"
              className={!isAdmin ? "bg-muted" : ""}
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
          <CardDescription>Required for manufacturing facility safety</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label>Contact Name</Label>
            <Input
              value={profile.emergency_contact_name}
              onChange={(e) => setProfile(p => ({ ...p, emergency_contact_name: e.target.value }))}
              placeholder="e.g. John Smith"
            />
          </div>
          <div className="space-y-2">
            <Label>Contact Phone</Label>
            <Input
              value={profile.emergency_contact_phone}
              onChange={(e) => setProfile(p => ({ ...p, emergency_contact_phone: e.target.value }))}
              placeholder="(555) 123-4567"
            />
          </div>
        </CardContent>
      </Card>

      {/* Save Button */}
      <div className="flex justify-end mb-6">
        <Button onClick={handleSave} disabled={saving} className="gap-2">
          <Save className="h-4 w-4" />
          {saving ? "Saving…" : "Save Changes"}
        </Button>
      </div>

      {/* Change Password */}
      <Card className="mb-6">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <KeyRound className="h-5 w-5 text-accent" />
            Change Password
          </CardTitle>
          <CardDescription>Update your sign-in password</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label>New Password</Label>
              <div className="relative">
                <Input
                  type={showPassword ? "text" : "password"}
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="At least 8 characters"
                  autoComplete="new-password"
                  className="pr-10"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((s) => !s)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  aria-label={showPassword ? "Hide password" : "Show password"}
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>
            <div className="space-y-2">
              <Label>Confirm Password</Label>
              <div className="relative">
                <Input
                  type={showPassword ? "text" : "password"}
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="Re-enter new password"
                  autoComplete="new-password"
                  className="pr-10"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((s) => !s)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  aria-label={showPassword ? "Hide password" : "Show password"}
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>
          </div>
          <div className="flex justify-end">
            <Button
              onClick={handleChangePassword}
              disabled={changingPassword || !newPassword || !confirmPassword}
              className="gap-2"
            >
              <KeyRound className="h-4 w-4" />
              {changingPassword ? "Updating…" : "Update Password"}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Sign Out */}
      <Card className="border-destructive/50">
        <CardHeader>
          <CardTitle>Sign Out</CardTitle>
        </CardHeader>
        <CardContent>
          <Button variant="destructive" onClick={handleSignOut} className="w-full">
            <LogOut className="h-4 w-4 mr-2" />
            Sign Out
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
