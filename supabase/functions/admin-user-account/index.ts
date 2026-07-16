// Admin account management: inspect an account's sign-in state, set a temporary
// password, or mint a password-reset link.
//
// Caller gate is deliberately STRICTER than the neighbouring create-client-account
// function, which uses is_staff_or_admin(). That helper includes staff, and staff
// must never be able to reset another user's password.
//
// Do not model this on bootstrap-admin — that function authenticates nobody.

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const MIN_PASSWORD_LENGTH = 8;

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const authHeader = req.headers.get("Authorization");

    if (!authHeader) return json({ error: "Unauthorized" }, 401);

    // Identify the caller from their own JWT.
    const callerClient = createClient(SUPABASE_URL, Deno.env.get("SUPABASE_ANON_KEY")!, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user: caller } } = await callerClient.auth.getUser();
    if (!caller) return json({ error: "Unauthorized" }, 401);

    const [{ data: callerIsAdmin }, { data: callerIsOwner }] = await Promise.all([
      callerClient.rpc("has_role", { _user_id: caller.id, _role: "admin" }),
      callerClient.rpc("is_owner", { _user_id: caller.id }),
    ]);
    if (!callerIsAdmin && !callerIsOwner) return json({ error: "Forbidden" }, 403);

    const { action, userId, password, redirectTo } = await req.json();
    if (!action || !userId) return json({ error: "action and userId are required" }, 400);

    const adminClient = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    const { data: target, error: targetError } = await adminClient.auth.admin.getUserById(userId);
    if (targetError || !target?.user) return json({ error: "User not found" }, 404);
    const targetUser = target.user;

    // Escalation guard: an admin must not be able to seize an owner's or a peer
    // admin's account. Mirrors the ownerGrantOnly rule on the role checkboxes and
    // the user_roles RLS guard in 20260714000001. Only an owner may target these.
    const { data: targetRoles } = await adminClient
      .from("user_roles")
      .select("role")
      .eq("user_id", userId);
    const targetIsPrivileged = (targetRoles ?? []).some(
      (r: { role: string }) => r.role === "owner" || r.role === "admin",
    );
    if (targetIsPrivileged && !callerIsOwner) {
      return json({ error: "Only an owner can manage an owner or admin account." }, 403);
    }

    // Read-only: never audited, so the admin UI can poll it freely.
    if (action === "status") {
      return json({
        success: true,
        status: {
          email: targetUser.email,
          email_confirmed_at: targetUser.email_confirmed_at ?? null,
          last_sign_in_at: targetUser.last_sign_in_at ?? null,
          created_at: targetUser.created_at,
          banned_until: (targetUser as { banned_until?: string }).banned_until ?? null,
        },
      });
    }

    // Record the action before returning. Best-effort: an audit write failure must
    // not mask a password change that already happened server-side.
    const audit = async () => {
      const { error } = await adminClient.from("admin_account_actions").insert({
        actor_id: caller.id,
        actor_email: caller.email ?? null,
        target_user_id: userId,
        target_email: targetUser.email ?? null,
        action,
      });
      if (error) console.error("audit write failed:", error.message);
    };

    if (action === "set_password") {
      if (typeof password !== "string" || password.length < MIN_PASSWORD_LENGTH) {
        return json({ error: `Password must be at least ${MIN_PASSWORD_LENGTH} characters.` }, 400);
      }

      const { error } = await adminClient.auth.admin.updateUserById(userId, {
        password,
        email_confirm: true,
      });
      if (error) return json({ error: error.message }, 400);

      await audit();
      return json({ success: true });
    }

    if (action === "reset_link") {
      if (!targetUser.email) return json({ error: "Account has no email address." }, 400);

      // generateLink mints the link but does NOT send mail — the admin copies it.
      // Same contract as the invite flow, where the copyable link is the reliable
      // channel and email is best-effort decoration.
      const { data, error } = await adminClient.auth.admin.generateLink({
        type: "recovery",
        email: targetUser.email,
        options: { redirectTo },
      });
      if (error) return json({ error: error.message }, 400);

      await audit();
      return json({ success: true, action_link: data.properties?.action_link ?? null });
    }

    return json({ error: `Unknown action: ${action}` }, 400);
  } catch (err) {
    console.error("Unexpected error:", err);
    return json({ error: "Internal server error" }, 500);
  }
});
