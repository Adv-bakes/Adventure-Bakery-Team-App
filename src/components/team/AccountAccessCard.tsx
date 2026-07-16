import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import { KeyRound, Eye, EyeOff, Copy, Check, Mail, Loader2 } from "lucide-react";
import { format } from "date-fns";
import type { AppRole } from "@/hooks/useUserRole";

const MIN_PASSWORD_LENGTH = 8;

interface AccountStatus {
  email: string | null;
  email_confirmed_at: string | null;
  last_sign_in_at: string | null;
  created_at: string;
  banned_until: string | null;
}

interface Props {
  userId: string;
  /** Roles held by the *target*, to mirror the server-side escalation guard in the UI. */
  targetRoles: AppRole[];
  viewerIsOwner: boolean;
}

type Action = "status" | "set_password" | "reset_link";

/**
 * Admin surface for another user's sign-in credentials. Every action routes
 * through the admin-user-account edge function — the service-role key never
 * reaches the browser, and the function re-checks permission regardless of what
 * this component renders.
 */
export default function AccountAccessCard({ userId, targetRoles, viewerIsOwner }: Props) {
  const [status, setStatus] = useState<AccountStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);

  const [pwOpen, setPwOpen] = useState(false);
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);

  const [resetLink, setResetLink] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  // Mirrors the server guard: only an owner may touch an owner/admin account.
  // The function enforces this too — this just avoids offering a button that 403s.
  const targetIsPrivileged = targetRoles.some((r) => r === "owner" || r === "admin");
  const locked = targetIsPrivileged && !viewerIsOwner;

  const call = async (action: Action, body: Record<string, unknown> = {}) => {
    const { data, error } = await supabase.functions.invoke("admin-user-account", {
      body: { action, userId, ...body },
    });
    // A non-2xx from the function surfaces as a FunctionsHttpError whose message
    // is generic; read the real reason off the response body.
    if (error) {
      let detail = error.message;
      const res = (error as { context?: Response }).context;
      if (res) {
        try { detail = (await res.clone().json())?.error ?? detail; } catch { /* keep generic */ }
      }
      throw new Error(detail);
    }
    return data;
  };

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        const data = await call("status");
        if (!cancelled) setStatus(data?.status ?? null);
      } catch (err) {
        if (!cancelled) {
          console.error("Account status load failed:", err);
          toast.error(`Couldn't load account status: ${(err as Error).message}`);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [userId]);

  const handleSetPassword = async () => {
    if (newPassword.length < MIN_PASSWORD_LENGTH) {
      toast.error(`Password must be at least ${MIN_PASSWORD_LENGTH} characters.`);
      return;
    }
    if (newPassword !== confirmPassword) {
      toast.error("Passwords don't match.");
      return;
    }
    setBusy(true);
    try {
      await call("set_password", { password: newPassword });
      toast.success("Password updated. Share it with them over a trusted channel.");
      setPwOpen(false);
      setNewPassword("");
      setConfirmPassword("");
      const data = await call("status");
      setStatus(data?.status ?? null);
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const handleResetLink = async () => {
    setBusy(true);
    setCopied(false);
    try {
      const data = await call("reset_link", {
        redirectTo: `${window.location.origin}/reset-password`,
      });
      if (!data?.action_link) throw new Error("No link was returned.");
      setResetLink(data.action_link);
      toast.success("Reset link generated — copy it to them.");
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const copyLink = async () => {
    if (!resetLink) return;
    await navigator.clipboard.writeText(resetLink);
    setCopied(true);
    toast.success("Link copied");
    setTimeout(() => setCopied(false), 2000);
  };

  const statusLine = () => {
    if (loading) return "Checking…";
    if (!status) return "Account status unavailable";
    const parts: string[] = [];
    parts.push(status.email_confirmed_at ? "Confirmed" : "Email not confirmed");
    parts.push(
      status.last_sign_in_at
        ? `Last signed in ${format(new Date(status.last_sign_in_at), "MMM d, yyyy")}`
        : "Never signed in",
    );
    if (status.banned_until) parts.push("Banned");
    return parts.join(" · ");
  };

  return (
    <Card className="mb-6">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <KeyRound className="h-5 w-5 text-accent" />
          Account Access
        </CardTitle>
        <CardDescription>Sign-in credentials for this account</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="rounded-md border p-3">
          <div className="flex items-center gap-2">
            {loading ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin text-muted-foreground" />
            ) : (
              <span
                className={`h-2 w-2 rounded-full ${
                  status?.email_confirmed_at && !status?.banned_until ? "bg-emerald-500" : "bg-amber-500"
                }`}
              />
            )}
            <span className="text-sm font-medium">{statusLine()}</span>
          </div>
          {status?.created_at && (
            <p className="mt-1 text-xs text-muted-foreground">
              Account created {format(new Date(status.created_at), "MMM d, yyyy")}
            </p>
          )}
        </div>

        {locked ? (
          <p className="text-xs text-muted-foreground">
            This account holds Owner or Admin. Only an owner can reset its password.
          </p>
        ) : (
          <>
            <div className="flex flex-wrap gap-2">
              <Button variant="outline" onClick={handleResetLink} disabled={busy || loading} className="gap-2">
                <Mail className="h-4 w-4" />
                Send Reset Link
              </Button>
              <Button variant="outline" onClick={() => setPwOpen(true)} disabled={busy || loading} className="gap-2">
                <KeyRound className="h-4 w-4" />
                Set Temporary Password
              </Button>
            </div>

            {resetLink && (
              <div className="space-y-2 rounded-md border p-3" style={{ backgroundColor: "rgba(200, 155, 60, 0.06)" }}>
                <Label className="text-xs">Password reset link — send this to them</Label>
                <div className="flex gap-2">
                  <Input value={resetLink} readOnly className="font-mono text-xs" />
                  <Button size="icon" variant="outline" onClick={copyLink} aria-label="Copy reset link">
                    {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                  </Button>
                </div>
                <p className="text-xs text-muted-foreground">
                  Single-use and time-limited. They set their own password, so you never learn it —
                  preferred over a temporary password wherever practical.
                </p>
              </div>
            )}

            <p className="text-xs text-muted-foreground">
              Password actions are recorded against your account for audit.
            </p>
          </>
        )}
      </CardContent>

      <Dialog open={pwOpen} onOpenChange={setPwOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Set Temporary Password</DialogTitle>
            <DialogDescription>
              You will know this password, so training records and form signatures made with it are
              weaker evidence of who acted. Use the reset link instead unless you need to unblock
              someone right now — and have them change it once they're in.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="space-y-2">
              <Label>New Password</Label>
              <div className="relative">
                <Input
                  type={showPassword ? "text" : "password"}
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder={`At least ${MIN_PASSWORD_LENGTH} characters`}
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
              <Input
                type={showPassword ? "text" : "password"}
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="Re-enter password"
                autoComplete="new-password"
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="ghost" onClick={() => setPwOpen(false)} disabled={busy}>Cancel</Button>
            <Button
              onClick={handleSetPassword}
              disabled={busy || !newPassword || !confirmPassword}
              className="gap-2 bg-[#C89B3C] hover:bg-[#B8892C] text-black"
            >
              {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <KeyRound className="h-4 w-4" />}
              {busy ? "Updating…" : "Update Password"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
