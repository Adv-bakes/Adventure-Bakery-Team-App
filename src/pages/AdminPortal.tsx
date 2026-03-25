import { Link } from "react-router-dom";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { FlaskConical, Cookie, Settings2, LogOut, UserPlus, Users, Plus, ArrowRight } from "lucide-react";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import logo from "@/assets/logo.png";

const adminLinks = [
  {
    title: "Product Workspace",
    description: "Manage concepts, products, and full product development workflows.",
    icon: Cookie,
    href: "/team/dashboard",
  },
  {
    title: "Formula Manager",
    description: "Build and refine formulations, ingredient specs, and shelf-life data.",
    icon: FlaskConical,
    href: "/team/formulas",
  },
  {
    title: "Operations Hub",
    description: "Order intake, sourcing, production orders, and reporting.",
    icon: Settings2,
    href: "/team/operations-hub",
  },
];

interface ClientProfile {
  id: string;
  business_name: string | null;
  access_granted: boolean;
  created_at: string | null;
}

const AdminPortal = () => {
  const navigate = useNavigate();
  const [userEmail, setUserEmail] = useState<string | null>(null);
  const [inviteEmail, setInviteEmail] = useState("");
  const [isInviting, setIsInviting] = useState(false);
  const [showInviteForm, setShowInviteForm] = useState(false);
  const [clients, setClients] = useState<ClientProfile[]>([]);
  const [clientEmails, setClientEmails] = useState<Record<string, string>>({});
  const [loadingClients, setLoadingClients] = useState(false);
  const [showClients, setShowClients] = useState(false);

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      setUserEmail(user?.email ?? null);
    });
  }, []);

  const handleSignOut = async () => {
    const { error } = await supabase.auth.signOut();
    if (error) {
      toast.error("Error signing out");
    } else {
      toast.success("Signed out successfully");
      navigate("/k2f-login");
    }
  };

  const handleInvite = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inviteEmail.trim()) return;

    setIsInviting(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data, error } = await supabase
        .from("client_invitations")
        .insert({
          email: inviteEmail.trim().toLowerCase(),
          invited_by: user.id,
        })
        .select("token")
        .single();

      if (error) {
        toast.error("Failed to create invitation: " + error.message);
        return;
      }

      const inviteUrl = `${window.location.origin}/accept-invite?token=${data.token}`;

      // Send invitation email
      const { error: emailError } = await supabase.functions.invoke(
        "send-invitation-email",
        {
          body: {
            email: inviteEmail.trim().toLowerCase(),
            inviteUrl,
            invitedByEmail: user.email,
          },
        }
      );

      // Copy to clipboard as fallback
      await navigator.clipboard.writeText(inviteUrl);

      if (emailError) {
        console.error("Email send error:", emailError);
        toast.warning("Invitation created & link copied, but email failed to send.", {
          description: "Share the link manually with your client.",
          duration: 8000,
        });
      } else {
        toast.success("Invitation emailed & link copied to clipboard!", {
          description: `Sent to ${inviteEmail.trim().toLowerCase()}`,
          duration: 6000,
        });
      }

      setInviteEmail("");
      setShowInviteForm(false);
    } catch (err) {
      toast.error("An unexpected error occurred.");
    } finally {
      setIsInviting(false);
    }
  };

  const fetchClients = async () => {
    setLoadingClients(true);
    // Get all users with 'user' role
    const { data: roles } = await supabase
      .from("user_roles")
      .select("user_id")
      .eq("role", "user");

    if (!roles || roles.length === 0) {
      setClients([]);
      setLoadingClients(false);
      return;
    }

    const userIds = roles.map((r) => r.user_id);
    const { data: profiles } = await supabase
      .from("profiles")
      .select("id, business_name, access_granted, created_at")
      .in("id", userIds);

    setClients((profiles as ClientProfile[]) || []);
    setLoadingClients(false);
  };

  const toggleAccess = async (clientId: string, currentAccess: boolean) => {
    const { error } = await supabase
      .from("profiles")
      .update({ access_granted: !currentAccess })
      .eq("id", clientId);

    if (error) {
      toast.error("Failed to update access.");
    } else {
      toast.success(currentAccess ? "Access revoked." : "Access granted.");
      setClients((prev) =>
        prev.map((c) => (c.id === clientId ? { ...c, access_granted: !currentAccess } : c))
      );
    }
  };

  const handleShowClients = () => {
    if (!showClients) {
      fetchClients();
    }
    setShowClients(!showClients);
  };

  const initials = userEmail
    ? userEmail.substring(0, 2).toUpperCase()
    : "AB";

  return (
    <div
      className="min-h-screen flex flex-col relative"
      style={{
        backgroundImage: "url(/bakery-workspace-bg.jpg)",
        backgroundSize: "cover",
        backgroundPosition: "center",
      }}
    >
      <div className="absolute inset-0" style={{ backgroundColor: "rgba(44, 24, 16, 0.75)" }} />

      <header
        className="relative z-10 border-b backdrop-blur-sm"
        style={{
          backgroundColor: "rgba(44, 24, 16, 0.3)",
          borderColor: "rgba(255,255,255,0.1)",
        }}
      >
        <div className="container flex h-16 items-center justify-between">
          <div className="flex items-center gap-3">
            <img src={logo} alt="Adventure Bakery" className="w-10 h-10" />
            <span className="font-semibold text-lg" style={{ color: "#F5F1E6" }}>
              Internal Admin Portal
            </span>
          </div>
          <div className="flex items-center gap-2">
            <Link to="/team/account">
              <Avatar className="h-9 w-9 cursor-pointer border-2 border-accent/30 hover:border-accent transition-colors">
                <AvatarFallback className="bg-accent/20 text-accent text-sm font-semibold">
                  {initials}
                </AvatarFallback>
              </Avatar>
            </Link>
            <Button
              variant="ghost"
              size="sm"
              onClick={handleSignOut}
              className="hover:bg-destructive/20"
              style={{ color: "rgba(245, 241, 230, 0.7)" }}
            >
              <LogOut className="w-4 h-4" />
            </Button>
          </div>
        </div>
      </header>

      <main className="relative z-10 flex-1 container py-12">
        <h1 className="text-3xl font-bold mb-2" style={{ color: "#F5F1E6" }}>
          Welcome Back
        </h1>
        <p className="mb-10 text-base" style={{ color: "rgba(245, 241, 230, 0.7)" }}>
          Jump into a workspace below.
        </p>

        <div className="grid gap-6 md:grid-cols-3">
          {adminLinks.map((link) => {
            const Icon = link.icon;
            return (
              <Link key={link.href} to={link.href} className="group">
                <Card className="h-full transition-transform duration-200 group-hover:scale-[1.02] bg-card/90 backdrop-blur-md">
                  <CardHeader>
                    <div className="flex items-center gap-3 mb-2">
                      <div className="p-2 rounded-lg bg-accent/15">
                        <Icon className="w-6 h-6 text-accent" />
                      </div>
                      <CardTitle className="text-lg">{link.title}</CardTitle>
                    </div>
                    <CardDescription>{link.description}</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <span className="text-sm font-medium text-accent">Open →</span>
                  </CardContent>
                </Card>
              </Link>
            );
          })}
        </div>

        {/* Client Management Section */}
        <div className="mt-12 space-y-4">
          <div className="flex items-center gap-4 flex-wrap">
            <Button
              variant="outline"
              onClick={() => setShowInviteForm(!showInviteForm)}
              className="gap-2 border-accent/40 text-accent hover:bg-accent/10"
            >
              <UserPlus className="w-4 h-4" />
              Invite Client
            </Button>
            <Button
              variant="outline"
              asChild
              className="gap-2 border-accent/40 text-accent hover:bg-accent/10"
            >
              <Link to="/team/client/new">
                <Plus className="w-4 h-4" />
                Add Client
              </Link>
            </Button>
            <Button
              variant="outline"
              onClick={handleShowClients}
              className="gap-2 border-accent/40 text-accent hover:bg-accent/10"
            >
              <Users className="w-4 h-4" />
              {showClients ? "Hide Clients" : "Manage Clients"}
            </Button>
          </div>

          {/* Invite Form */}
          {showInviteForm && (
            <Card className="bg-card/90 backdrop-blur-md max-w-md">
              <CardHeader>
                <CardTitle className="text-base">Invite a Client</CardTitle>
                <CardDescription>
                  Send an invitation link. The client will create an account and get Brand Portal access.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <form onSubmit={handleInvite} className="flex gap-3">
                  <div className="flex-1">
                    <Label htmlFor="invite-email" className="sr-only">Email</Label>
                    <Input
                      id="invite-email"
                      type="email"
                      placeholder="client@company.com"
                      value={inviteEmail}
                      onChange={(e) => setInviteEmail(e.target.value)}
                      required
                    />
                  </div>
                  <Button
                    type="submit"
                    disabled={isInviting}
                    className="bg-gradient-to-r from-[#C89B3C] to-[#D4A855] text-white"
                  >
                    {isInviting ? "Sending…" : "Create Invite"}
                  </Button>
                </form>
              </CardContent>
            </Card>
          )}

          {/* Client List */}
          {showClients && (
            <Card className="bg-card/90 backdrop-blur-md">
              <CardHeader>
                <CardTitle className="text-base">Client Accounts</CardTitle>
                <CardDescription>
                  Manage client access to the Brand Portal.
                </CardDescription>
              </CardHeader>
              <CardContent>
                {loadingClients ? (
                  <div className="flex justify-center py-6">
                    <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-accent" />
                  </div>
                ) : clients.length === 0 ? (
                  <p className="text-sm text-muted-foreground py-4">No client accounts found.</p>
                ) : (
                  <div className="space-y-3">
                    {clients.map((client) => (
                      <Link
                        key={client.id}
                        to={`/team/client/${client.id}`}
                        className="flex items-center justify-between p-3 rounded-lg border border-border/50 hover:bg-accent/5 transition-colors cursor-pointer group"
                      >
                        <div>
                          <p className="text-sm font-medium">
                            {client.business_name || "No business name"}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            ID: {client.id.substring(0, 8)}…
                          </p>
                        </div>
                        <div className="flex items-center gap-3">
                          <Badge
                            variant={client.access_granted ? "default" : "secondary"}
                            className="text-xs"
                          >
                            {client.access_granted ? "Active" : "Pending"}
                          </Badge>
                          <Button
                            size="sm"
                            variant={client.access_granted ? "destructive" : "default"}
                            onClick={(e) => {
                              e.preventDefault();
                              e.stopPropagation();
                              toggleAccess(client.id, client.access_granted);
                            }}
                            className={
                              client.access_granted
                                ? ""
                                : "bg-gradient-to-r from-[#C89B3C] to-[#D4A855] text-white"
                            }
                          >
                            {client.access_granted ? "Revoke" : "Grant Access"}
                          </Button>
                          <ArrowRight className="h-4 w-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
                        </div>
                      </Link>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          )}
        </div>
      </main>
    </div>
  );
};

export default AdminPortal;
