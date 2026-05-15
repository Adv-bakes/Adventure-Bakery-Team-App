import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { TeamPage } from "@/components/team/TeamPage";

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
        supabase.from("prf_submissions")
          .select("id, product_name, company_name, email, status, created_at, owner_user_id")
          .eq("status", "new").order("created_at", { ascending: false }).limit(50),
        supabase.from("client_documents")
          .select("id, file_name, document_type, user_id, uploaded_at")
          .order("uploaded_at", { ascending: false }).limit(50),
      ]);
      if (prfRes.error) toast.error(prfRes.error.message);
      const out: Item[] = [];
      (prfRes.data || []).forEach((p: any) => out.push({
        kind: "PRF", id: p.id,
        title: p.product_name || "(unnamed PRF)",
        subtitle: `${p.company_name || p.email || "Unknown"} · ${p.status}`,
        created_at: p.created_at, client_id: p.owner_user_id,
      }));
      (docRes.data || []).forEach((d: any) => out.push({
        kind: "Document", id: d.id,
        title: d.file_name || d.document_type,
        subtitle: d.document_type || "—",
        created_at: d.uploaded_at, client_id: d.user_id,
      }));
      out.sort((a, b) => (b.created_at || "").localeCompare(a.created_at || ""));
      setItems(out);
      setLoading(false);
    })();
  }, []);

  return (
    <TeamPage
      eyebrow="Sales"
      title="Documents Inbox"
      description="Every new PRF and client upload, in one stream."
    >
      <div className="tp-surface divide-y divide-[hsl(var(--tp-hairline))]">
        {loading && <p className="p-8 text-sm text-[hsl(var(--tp-text-dim))]">Loading…</p>}
        {!loading && items.length === 0 && (
          <p className="p-8 text-sm text-[hsl(var(--tp-text-dim))] italic">Nothing new in the inbox.</p>
        )}
        {items.map((i) => (
          <div key={`${i.kind}-${i.id}`} className="p-5 flex items-start justify-between gap-4 hover:bg-white/[0.02] transition">
            <div className="min-w-0">
              <div className="flex items-center gap-2 mb-1">
                <span className="tp-chip text-[10px] uppercase tracking-wider">{i.kind}</span>
                <p className="font-display text-sm font-semibold text-[hsl(var(--tp-text))] truncate">{i.title}</p>
              </div>
              <p className="text-xs text-[hsl(var(--tp-text-muted))]">{i.subtitle}</p>
            </div>
            <div className="text-right text-xs text-[hsl(var(--tp-text-dim))] shrink-0">
              <p>{new Date(i.created_at).toLocaleString()}</p>
              {i.client_id && (
                <Link to={`/team/sales/clients/${i.client_id}`} className="text-[hsl(var(--tp-gold-soft))] hover:underline">
                  Open client →
                </Link>
              )}
            </div>
          </div>
        ))}
      </div>
    </TeamPage>
  );
};

export default SalesDocumentsInbox;
