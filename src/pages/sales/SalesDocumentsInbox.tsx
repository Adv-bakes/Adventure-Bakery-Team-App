import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface Item {
  kind: "PRF" | "Document";
  id: string;
  title: string;
  subtitle: string;
  created_at: string;
  client_id?: string | null;
}

const SalesDocumentsInbox = () => {
  const [items, setItems] = useState<Item[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const [prfRes, docRes] = await Promise.all([
        supabase
          .from("prf_submissions")
          .select("id, product_name, company_name, email, status, created_at, owner_user_id")
          .eq("status", "new")
          .order("created_at", { ascending: false })
          .limit(50),
        supabase
          .from("client_documents")
          .select("id, file_name, document_type, user_id, uploaded_at")
          .order("uploaded_at", { ascending: false })
          .limit(50),
      ]);
      if (prfRes.error) toast.error(prfRes.error.message);

      const out: Item[] = [];
      (prfRes.data || []).forEach((p: any) =>
        out.push({
          kind: "PRF",
          id: p.id,
          title: p.product_name || "(unnamed PRF)",
          subtitle: `${p.company_name || p.email || "Unknown"} · ${p.status}`,
          created_at: p.created_at,
          client_id: p.owner_user_id,
        })
      );
      (docRes.data || []).forEach((d: any) =>
        out.push({
          kind: "Document",
          id: d.id,
          title: d.file_name || d.document_type,
          subtitle: d.document_type || "—",
          created_at: d.uploaded_at,
          client_id: d.user_id,
        })
      );
      out.sort((a, b) =>
        (b.created_at || "").localeCompare(a.created_at || "")
      );
      setItems(out);
      setLoading(false);
    })();
  }, []);

  return (
    <div className="max-w-5xl">
      <h1 className="text-3xl font-semibold mb-2" style={{ color: "#F5F1E6" }}>
        Documents Inbox
      </h1>
      <p className="text-sm mb-6" style={{ color: "rgba(245,241,230,0.6)" }}>
        Incoming PRFs and client documents.
      </p>

      <div
        className="rounded-lg border divide-y"
        style={{
          background: "rgba(200,155,60,0.04)",
          borderColor: "rgba(200,155,60,0.15)",
        }}
      >
        {loading && (
          <p className="p-6 text-sm" style={{ color: "rgba(245,241,230,0.4)" }}>Loading…</p>
        )}
        {!loading && items.length === 0 && (
          <p className="p-6 text-sm" style={{ color: "rgba(245,241,230,0.4)" }}>Nothing new in the inbox.</p>
        )}
        {items.map((i) => (
          <div
            key={`${i.kind}-${i.id}`}
            className="p-4 flex items-start justify-between"
            style={{ borderColor: "rgba(200,155,60,0.1)" }}
          >
            <div>
              <div className="flex items-center gap-2 mb-1">
                <span
                  className="text-[10px] uppercase tracking-wider px-2 py-0.5 rounded"
                  style={{
                    background: "rgba(200,155,60,0.15)",
                    color: "#C89B3C",
                  }}
                >
                  {i.kind}
                </span>
                <p className="text-sm font-medium" style={{ color: "#F5F1E6" }}>
                  {i.title}
                </p>
              </div>
              <p className="text-xs" style={{ color: "rgba(245,241,230,0.5)" }}>
                {i.subtitle}
              </p>
            </div>
            <div className="text-right text-xs" style={{ color: "rgba(245,241,230,0.5)" }}>
              <p>{new Date(i.created_at).toLocaleString()}</p>
              {i.client_id && (
                <Link
                  to={`/team/sales/clients/${i.client_id}`}
                  className="hover:underline"
                  style={{ color: "#C89B3C" }}
                >
                  Open client →
                </Link>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default SalesDocumentsInbox;
