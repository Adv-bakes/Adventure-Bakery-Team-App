// Server-side invitation acceptance.
//
// Replaces a client-side supabase.auth.signUp() call that had a silent failure
// mode: when an auth user already exists for the email, GoTrue's anti-enumeration
// behaviour returns a FAKE user object with a random UUID and NO error. The old
// code therefore reported "Account created!" while the password was never stored
// and the accept RPC was handed a phantom user id.
//
// verify_jwt = false is required and correct here — the caller has no account
// yet, by definition. The invitation token IS the credential: it is single-use,
// expiring, and 64 hex chars. The email is read from the token's row and never
// taken from the request body, so a caller cannot aim this at another address.

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient, type SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";

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

/**
 * Find an auth user by email, paging through the admin list.
 * listUsers() defaults to 50 per page, so the unpaginated `.find()` used in
 * create-client-account silently stops seeing users past the first page.
 */
async function findUserByEmail(admin: SupabaseClient, email: string) {
  const target = email.toLowerCase();
  for (let page = 1; page <= 40; page++) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage: 200 });
    if (error) throw error;
    const users = data?.users ?? [];
    const hit = users.find((u) => u.email?.toLowerCase() === target);
    if (hit) return hit;
    if (users.length < 200) return null; // last page
  }
  return null;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    const { token, password, preferSpanish } = await req.json();

    if (typeof token !== "string" || !token) return json({ error: "Missing invitation token." }, 400);
    if (typeof password !== "string" || password.length < MIN_PASSWORD_LENGTH) {
      return json({ error: `Password must be at least ${MIN_PASSWORD_LENGTH} characters.` }, 400);
    }

    const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    // 1. Validate the token first — nothing else happens until it checks out.
    const { data: invite, error: inviteError } = await admin
      .from("client_invitations")
      .select("id, email, invite_kind, role, accepted_at, expires_at")
      .eq("token", token)
      .maybeSingle();

    if (inviteError) {
      console.error("invite lookup failed:", inviteError.message);
      return json({ error: "Could not validate the invitation." }, 500);
    }
    if (!invite) return json({ error: "This invitation link is not valid.", code: "invalid" }, 400);

    // accepted_at is a text column (schema drift), so test for presence, not date.
    if (invite.accepted_at) {
      return json(
        { error: "This invitation has already been used. Please sign in instead.", code: "used" },
        409,
      );
    }
    if (new Date(invite.expires_at).getTime() <= Date.now()) {
      return json({ error: "This invitation has expired.", code: "expired" }, 410);
    }

    const email: string = invite.email;
    const isTeam = invite.invite_kind === "team";

    // 2. Provision the auth user. email_confirm: true because the invitation —
    // delivered to this mailbox — is itself the proof of address ownership.
    const existing = await findUserByEmail(admin, email);
    let userId: string;

    if (existing) {
      // Legitimate: the token proves control of the mailbox and the invite is
      // unused, so setting the password here is the intended recovery path for
      // an account that was pre-created or left half-provisioned.
      userId = existing.id;
      const { error } = await admin.auth.admin.updateUserById(userId, {
        password,
        email_confirm: true,
      });
      if (error) return json({ error: error.message }, 400);
    } else {
      const { data: created, error } = await admin.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
      });
      if (error || !created?.user) {
        return json({ error: error?.message ?? "Could not create the account." }, 400);
      }
      userId = created.user.id;
    }

    // 3. Provision role/profile. Errors are surfaced, never swallowed — the old
    // client code ignored this and reported success on a failed RPC.
    let grantedRole: string = invite.role ?? (isTeam ? "staff" : "user");

    if (isTeam) {
      const { data, error } = await admin.rpc("accept_team_invitation", {
        _token: token,
        _user_id: userId,
        _preferred_language: preferSpanish ? "es" : "en",
      });
      if (error) {
        console.error("accept_team_invitation failed:", error.message);
        return json({ error: `Could not activate your access: ${error.message}` }, 500);
      }
      // NULL means the function found no claimable invite for this token.
      if (!data) {
        return json({ error: "This invitation is no longer valid.", code: "used" }, 409);
      }
      grantedRole = data as string;
    } else {
      const { error } = await admin.rpc("accept_invitation", { _token: token, _user_id: userId });
      if (error) {
        console.error("accept_invitation failed:", error.message);
        return json({ error: `Could not activate your access: ${error.message}` }, 500);
      }
    }

    const destination = !isTeam
      ? "/brand-portal"
      : grantedRole === "auditor"
        ? "/team/compliance/sops"
        : "/team/dashboard";

    return json({ success: true, email, role: grantedRole, destination });
  } catch (err) {
    console.error("Unexpected error:", err);
    return json({ error: "Internal server error" }, 500);
  }
});
