import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";

export function useClientAccess() {
  const [accessGranted, setAccessGranted] = useState<boolean | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const check = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        setAccessGranted(false);
        setLoading(false);
        return;
      }

      const { data } = await supabase
        .from("profiles")
        .select("access_granted")
        .eq("id", user.id)
        .maybeSingle();

      setAccessGranted(data?.access_granted ?? false);
      setLoading(false);
    };

    check();
  }, []);

  return { accessGranted, loading };
}
