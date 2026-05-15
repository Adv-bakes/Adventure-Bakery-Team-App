import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

const editableStatuses = new Set(["new", "draft", "needs_revision"]);

const MyPrfs = () => {
  const [prfs, setPrfs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        setLoading(false);
        return;
      }
      const { data, error } = await supabase
        .from("prf_submissions")
        .select("id, product_name, project_type, status, created_at")
        .eq("owner_user_id", user.id)
        .order("created_at", { ascending: false });
      if (error) toast.error(error.message);
      setPrfs(data || []);
      setLoading(false);
    })();
  }, []);

  return (
    <div className="max-w-4xl mx-auto py-8">
      <h1 className="text-3xl font-semibold mb-2">My Product Requests</h1>
      <p className="text-sm text-muted-foreground mb-6">
        Your submitted PRFs. You can edit them while they're still in review.
      </p>

      {loading ? (
        <p className="text-sm text-muted-foreground">Loading…</p>
      ) : prfs.length === 0 ? (
        <div className="rounded-lg border p-8 text-center">
          <p className="text-sm text-muted-foreground mb-4">
            You haven't submitted any product requests yet.
          </p>
          <Link
            to="/product-request-form"
            className="inline-block px-4 py-2 rounded bg-primary text-primary-foreground text-sm"
          >
            Start a PRF
          </Link>
        </div>
      ) : (
        <ul className="divide-y border rounded-lg">
          {prfs.map((p) => {
            const editable = editableStatuses.has(p.status);
            return (
              <li key={p.id} className="p-4 flex items-center justify-between">
                <div>
                  <p className="font-medium">
                    {p.product_name || p.project_type || "(untitled PRF)"}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Submitted {new Date(p.created_at).toLocaleDateString()} · {p.status}
                  </p>
                </div>
                {editable ? (
                  <Link
                    to={`/stage2?lead_id=${p.id}`}
                    className="text-sm px-3 py-1.5 rounded border hover:bg-accent"
                  >
                    Edit
                  </Link>
                ) : (
                  <span className="text-xs text-muted-foreground">Locked</span>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
};

export default MyPrfs;
