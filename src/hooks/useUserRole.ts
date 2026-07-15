import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";

export type AppRole = "owner" | "admin" | "staff" | "auditor" | "user";

// Highest-privilege wins when deriving the single back-compat `role`.
// A user may hold several roles at once (user_roles is keyed UNIQUE(user_id, role));
// permissions union additively at the DB layer via has_role()/is_staff_or_admin().
const ROLE_PRIORITY: AppRole[] = ["owner", "admin", "staff", "user", "auditor"];

function highestRole(roles: AppRole[]): AppRole | null {
  for (const r of ROLE_PRIORITY) {
    if (roles.includes(r)) return r;
  }
  return roles[0] ?? null;
}

interface UseUserRoleReturn {
  /** Every role the user holds (may be empty). */
  roles: AppRole[];
  /** Back-compat single role = highest-privilege role held (or "user" when none). */
  role: AppRole | null;
  /** True when the user holds the given role. */
  hasRole: (role: AppRole) => boolean;
  loading: boolean;
}

export function useUserRole(): UseUserRoleReturn {
  const [roles, setRoles] = useState<AppRole[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    const fetchRoles = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user || cancelled) {
        if (!cancelled) {
          setRoles([]);
          setLoading(false);
        }
        return;
      }

      const { data, error } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", user.id);

      if (!cancelled) {
        if (data && !error && data.length > 0) {
          setRoles(data.map((r) => r.role as AppRole));
        } else {
          // No role assigned — default to "user" (brand client)
          setRoles(["user"]);
        }
        setLoading(false);
      }
    };

    fetchRoles();

    const { data: { subscription } } = supabase.auth.onAuthStateChange(() => {
      fetchRoles();
    });

    return () => {
      cancelled = true;
      subscription.unsubscribe();
    };
  }, []);

  return {
    roles,
    role: highestRole(roles),
    hasRole: (r: AppRole) => roles.includes(r),
    loading,
  };
}
