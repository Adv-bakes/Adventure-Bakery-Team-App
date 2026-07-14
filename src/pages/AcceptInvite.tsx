import { useState, useEffect } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "sonner";
import { Eye, EyeOff, CheckCircle, XCircle, Loader2 } from "lucide-react";
import logo from "@/assets/logo.png";

const ROLE_LABEL: Record<string, string> = {
  owner: "Owner", admin: "Admin", staff: "Staff", auditor: "Auditor (read-only)", user: "Client",
};

interface Invitation {
  id: string;
  email: string;
  accepted_at: string | null;
  expires_at: string;
  invite_kind: "client" | "team";
  role: string | null;
  department: string | null;
}

const AcceptInvite = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const token = searchParams.get("token");

  const [invitation, setInvitation] = useState<Invitation | null>(null);
  const [status, setStatus] = useState<"loading" | "valid" | "expired" | "used" | "invalid">("loading");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (!token) {
      setStatus("invalid");
      return;
    }

    const fetchInvitation = async () => {
      // Use secure RPC function instead of direct table query
      const { data, error } = await supabase
        .rpc("validate_invitation_token", { _token: token });

      if (error || !data || data.length === 0) {
        setStatus("invalid");
        return;
      }

      const result = data[0] as {
        email: string; expired: boolean; invite_kind?: string; role?: string | null; department?: string | null;
      };

      if (result.expired) {
        setStatus("expired");
        return;
      }

      // Store email + team metadata from RPC for the signup form
      setInvitation({
        id: "",
        email: result.email,
        accepted_at: null,
        expires_at: "",
        invite_kind: result.invite_kind === "team" ? "team" : "client",
        role: result.role ?? null,
        department: result.department ?? null,
      });
      setStatus("valid");
    };

    fetchInvitation();
  }, [token]);

  const isTeam = invitation?.invite_kind === "team";

  // Mark the invitation accepted (provisioning role/department for team invites,
  // brand access for client invites) and return where to send the new user.
  const acceptAndDestination = async (userId: string): Promise<string> => {
    if (invitation?.invite_kind === "team") {
      const { data } = await supabase.rpc("accept_team_invitation" as any, {
        _token: token,
        _user_id: userId,
      });
      const granted = typeof data === "string" && data ? data : invitation.role ?? "staff";
      return granted === "auditor" ? "/team/compliance/sops" : "/team/dashboard";
    }
    await supabase.rpc("accept_invitation", { _token: token!, _user_id: userId });
    return "/brand-portal";
  };

  const handleSignUp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!invitation || !token) return;

    if (password.length < 6) {
      toast.error("Password must be at least 6 characters.");
      return;
    }

    setIsSubmitting(true);

    try {
      // 1. Sign up the user
      const { data: signUpData, error: signUpError } = await supabase.auth.signUp({
        email: invitation.email,
        password,
        options: {
          emailRedirectTo: `${window.location.origin}${isTeam ? "/team" : "/brand-portal"}`,
        },
      });

      if (signUpError) {
        // If user already exists, try signing them in
        if (signUpError.message.includes("already registered") || signUpError.status === 422) {
          const { data: signInData, error: signInError } = await supabase.auth.signInWithPassword({
            email: invitation.email,
            password,
          });

          if (signInError) {
            toast.error("An account with this email already exists. Please sign in at the login page.");
            setIsSubmitting(false);
            return;
          }

          if (signInData.user) {
            const dest = await acceptAndDestination(signInData.user.id);
            toast.success("Welcome! Your access has been activated.");
            navigate(dest);
            return;
          }
        }
        toast.error(signUpError.message);
        setIsSubmitting(false);
        return;
      }

      // 2. If user was created and has a session (auto-confirm enabled)
      if (signUpData?.user?.id && signUpData?.session) {
        const dest = await acceptAndDestination(signUpData.user.id);
        toast.success("Account created! Welcome to Adventure Bakery.");
        navigate(dest);
      } else if (signUpData?.user && !signUpData?.session) {
        // Email confirmation required — mark invitation accepted now so the
        // role/department is provisioned; they finish by confirming + logging in.
        await acceptAndDestination(signUpData.user.id);
        toast.success("Account created! Please check your email to confirm, then sign in.");
        navigate(isTeam ? "/team" : "/k2f-login");
      }
    } catch (error) {
      console.error("Accept invite error:", error);
      toast.error("An unexpected error occurred. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const renderContent = () => {
    switch (status) {
      case "loading":
        return (
          <div className="flex flex-col items-center py-12">
            <Loader2 className="w-8 h-8 animate-spin mb-4" style={{ color: "#C89B3C" }} />
            <p style={{ color: "#8B7355" }}>Validating your invitation…</p>
          </div>
        );

      case "invalid":
        return (
          <div className="flex flex-col items-center py-12 text-center">
            <XCircle className="w-12 h-12 mb-4 text-destructive" />
            <h3 className="text-lg font-semibold mb-2" style={{ color: "#2C1810" }}>
              Invalid Invitation
            </h3>
            <p className="text-sm mb-6" style={{ color: "#8B7355" }}>
              This invitation link is not valid. Please contact Adventure Bakery for a new invite.
            </p>
            <Button variant="outline" onClick={() => navigate("/")}>
              Go to Homepage
            </Button>
          </div>
        );

      case "expired":
        return (
          <div className="flex flex-col items-center py-12 text-center">
            <XCircle className="w-12 h-12 mb-4 text-destructive" />
            <h3 className="text-lg font-semibold mb-2" style={{ color: "#2C1810" }}>
              Invitation Expired
            </h3>
            <p className="text-sm mb-6" style={{ color: "#8B7355" }}>
              This invitation has expired. Please ask your contact at Adventure Bakery to send a new one.
            </p>
            <Button variant="outline" onClick={() => navigate("/")}>
              Go to Homepage
            </Button>
          </div>
        );

      case "used":
        return (
          <div className="flex flex-col items-center py-12 text-center">
            <CheckCircle className="w-12 h-12 mb-4" style={{ color: "#C89B3C" }} />
            <h3 className="text-lg font-semibold mb-2" style={{ color: "#2C1810" }}>
              Already Accepted
            </h3>
            <p className="text-sm mb-6" style={{ color: "#8B7355" }}>
              This invitation has already been used. You can sign in to your account.
            </p>
            <Button
              onClick={() => navigate("/k2f-login")}
              className="bg-gradient-to-r from-[#C89B3C] to-[#D4A855] text-white"
            >
              Sign In
            </Button>
          </div>
        );

      case "valid":
        return (
          <form onSubmit={handleSignUp} className="space-y-5">
            <div className="space-y-2">
              <Label htmlFor="invite-email">Email</Label>
              <Input
                id="invite-email"
                type="email"
                value={invitation?.email || ""}
                disabled
                className="bg-muted"
              />
              <p className="text-xs" style={{ color: "#8B7355" }}>
                This email was set by your invitation and cannot be changed.
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="invite-password">Create Password</Label>
              <div className="relative">
                <Input
                  id="invite-password"
                  type={showPassword ? "text" : "password"}
                  placeholder="At least 6 characters"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  minLength={6}
                  className="pr-10"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>

            <Button
              type="submit"
              className="w-full bg-gradient-to-r from-[#C89B3C] to-[#D4A855] hover:from-[#B8892C] hover:to-[#C89B3C] text-white"
              disabled={isSubmitting}
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Creating account…
                </>
              ) : (
                "Create Account & Get Started"
              )}
            </Button>

            <p className="text-xs text-center" style={{ color: "#8B7355" }}>
              Already have an account?{" "}
              <button
                type="button"
                onClick={() => navigate(isTeam ? "/team" : "/k2f-login")}
                className="font-medium hover:underline"
                style={{ color: "#C89B3C" }}
              >
                Sign in here
              </button>
            </p>
          </form>
        );
    }
  };

  return (
    <div
      className="min-h-screen flex items-center justify-center p-6"
      style={{
        background: "linear-gradient(135deg, #F5F1E6 0%, #FFFDF8 50%, #F5F1E6 100%)",
      }}
    >
      <Card
        className="w-full max-w-md border-0"
        style={{
          background: "linear-gradient(135deg, rgba(245, 241, 230, 0.98) 0%, rgba(255, 253, 250, 0.98) 100%)",
          boxShadow: "0 8px 32px rgba(200, 155, 60, 0.15)",
        }}
      >
        <CardHeader className="text-center">
          <img src={logo} alt="Adventure Bakery" className="w-16 h-16 mx-auto mb-2" />
          <CardTitle className="text-xl" style={{ color: "#2C1810" }}>
            You're Invited
          </CardTitle>
          <CardDescription style={{ color: "#8B7355" }}>
            {isTeam
              ? `You've been invited to the Adventure Bakery Team Portal${
                  invitation?.role ? ` as ${ROLE_LABEL[invitation.role] ?? invitation.role}` : ""
                }${invitation?.department ? ` · ${invitation.department}` : ""}.`
              : "Adventure Bakery has invited you to their Brand Portal."}
          </CardDescription>
        </CardHeader>
        <CardContent>{renderContent()}</CardContent>
      </Card>
    </div>
  );
};

export default AcceptInvite;
