import { ReactNode, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useUserRole, AppRole } from "@/hooks/useUserRole";

interface ProtectedRouteProps {
  children: ReactNode;
  allowedRoles: AppRole[];
  redirectTo?: string;
  requireClientAccess?: boolean;
}

const ProtectedRoute = ({ children, allowedRoles, redirectTo, requireClientAccess = false }: ProtectedRouteProps) => {
  const { role, loading } = useUserRole();
  const [authed, setAuthed] = useState<boolean | null>(null);
  const [accessGranted, setAccessGranted] = useState<boolean | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setAuthed(!!session);
      if (session) {
        // Check access_granted for client users
        supabase
          .from("profiles")
          .select("access_granted")
          .eq("id", session.user.id)
          .maybeSingle()
          .then(({ data }) => {
            setAccessGranted(data?.access_granted ?? false);
          });
      }
    });
  }, []);

  useEffect(() => {
    if (loading || authed === null) return;
    if (accessGranted === null && authed) return; // Still loading access

    if (!authed) {
      // Determine which login page based on the current path
      const isTeamRoute = window.location.pathname.startsWith("/team");
      window.location.replace(isTeamRoute ? "/team" : "/brand");
      return;
    }

    if (!role || !allowedRoles.includes(role)) {
      const fallback = redirectTo || (
        role === "admin" ? "/team/dashboard" :
        role === "staff" ? "/team/dashboard" :
        "/brand-portal"
      );
      window.location.replace(fallback);
      return;
    }

    // For client users, check access_granted
    if (role === "user" && requireClientAccess && !accessGranted) {
      window.location.replace("/access-pending");
      return;
    }

    setReady(true);
  }, [loading, authed, role, allowedRoles, redirectTo, accessGranted, requireClientAccess]);

  if (!ready) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-accent" />
      </div>
    );
  }

  return <>{children}</>;
};

export default ProtectedRoute;
