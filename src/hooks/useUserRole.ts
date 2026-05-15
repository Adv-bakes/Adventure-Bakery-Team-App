import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";

export type AppRole = "owner" | "admin" | "staff" | "user";

interface UseUserRoleReturn {
  role: AppRole | null;
  loading: boolean;
}

export function useUserRole(): UseUserRoleReturn {
  const [role, setRole] = useState<AppRole | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    const fetchRole = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user || cancelled) {
        setLoading(false);
        return;
      }

      const { data, error } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", user.id)
        .limit(1)
        .maybeSingle();

      if (!cancelled) {
        if (data && !error) {
          setRole(data.role as AppRole);
        } else {
          // No role assigned — default to "user" (client)
          setRole("user");
        }
        setLoading(false);
      }
    };

    fetchRole();

    const { data: { subscription } } = supabase.auth.onAuthStateChange(() => {
      fetchRole();
    });

    return () => {
      cancelled = true;
      subscription.unsubscribe();
    };
  }, []);

  return { role, loading };
}
