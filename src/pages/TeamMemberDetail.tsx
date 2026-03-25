import { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { ArrowLeft, Save, User, Shield, Briefcase, Phone, FileCheck } from "lucide-react";

const DEPARTMENTS = ["Production", "Sourcing", "Quality Control", "Admin", "R&D", "Sales"];

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
  const [email, setEmail] = useState("");
  const [role, setRole] = useState("");
  const [profile, setProfile] = useState<StaffProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (userId) loadData();
  }, [userId]);

  const loadData = async () => {
    const [profileRes, roleRes] = await Promise.all([
      supabase.from("profiles").select("id, full_name, employee_id, department, job_title, emergency_contact_name, emergency_contact_phone").eq("id", userId!).single(),
      supabase.from("user_roles").select("role").eq("user_id", userId!).maybeSingle(),
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
      setRole(roleRes.data.role);
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
    } else {
      toast.success("Team member profile updated");
    }
    setSaving(false);
  };

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
          <div className="flex items-center gap-3">
            <Label>Role</Label>
            <Badge variant="secondary" className="flex items-center gap-1">
              <Shield className="h-3 w-3" />
              {role === "admin" ? "Admin" : role === "staff" ? "Staff" : role || "—"}
            </Badge>
            <Badge variant="default" className="flex items-center gap-1">
              <FileCheck className="h-3 w-3" />
              NDA Signed
            </Badge>
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
