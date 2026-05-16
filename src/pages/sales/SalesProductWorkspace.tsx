import { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { TeamPage } from "@/components/team/TeamPage";
import { ArrowLeft } from "lucide-react";

const SalesProductWorkspace = () => {
  const { leadId, productId } = useParams();
  const [prf, setPrf] = useState<any>(null);
  const [tab, setTab] = useState<"documents" | "packaging" | "shelf_life" | "orders" | "activity" | "notes">("documents");

  useEffect(() => {
    if (!productId) return;
    (async () => {
      const { data } = await supabase
        .from("prf_submissions")
        .select("*")
        .eq("id", productId)
        .maybeSingle();
      setPrf(data);
    })();
  }, [productId]);

  if (!prf) return <TeamPage title="Loading…">…</TeamPage>;

  const tabs: Array<{ id: typeof tab; label: string; staffOnly?: boolean }> = [
    { id: "documents", label: "Documents" },
    { id: "packaging", label: "Packaging" },
    { id: "shelf_life", label: "Shelf Life" },
    { id: "orders", label: "Orders History", staffOnly: true },
    { id: "activity", label: "Activity", staffOnly: true },
    { id: "notes", label: "Notes", staffOnly: true },
  ];

  return (
    <TeamPage
      eyebrow="Product"
      title={prf.product_name || "(unnamed product)"}
      description={`Approved ${prf.quote_approved_at ? new Date(prf.quote_approved_at).toLocaleDateString() : "—"}`}
      actions={
        <Link to={`/team/sales/clients/${leadId}`} className="tp-btn">
          <ArrowLeft className="w-4 h-4" /> Back to client
        </Link>
      }
    >
      <div className="tp-surface mb-4 flex flex-wrap gap-1 p-1">
        {tabs.map(t => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`px-3 py-1.5 text-xs rounded ${tab === t.id ? "bg-[hsl(var(--tp-gold))] text-black" : "text-[hsl(var(--tp-text-dim))]"}`}
          >
            {t.label}{t.staffOnly && " 🔒"}
          </button>
        ))}
      </div>

      <div className="tp-surface p-6">
        {tab === "documents" && (
          <div>
            <p className="text-[10px] uppercase tracking-[0.18em] text-[hsl(var(--tp-text-dim))] mb-3">Carried over from project</p>
            <ul className="space-y-2 text-sm text-[hsl(var(--tp-text))]">
              <li>PRF — submitted {new Date(prf.created_at).toLocaleDateString()}</li>
              <li>PSS — view in Documents Inbox</li>
              <li>Batch Sheet — see Operations · Batch Sheets</li>
              <li>Quote — approved {prf.quote_approved_at ? new Date(prf.quote_approved_at).toLocaleDateString() : "—"}</li>
              <li className="text-[hsl(var(--tp-text-dim))] italic">Other offered services — to be wired</li>
            </ul>
          </div>
        )}
        {tab === "packaging" && <p className="text-sm italic text-[hsl(var(--tp-text-dim))]">Packaging specs per product — coming soon.</p>}
        {tab === "shelf_life" && <p className="text-sm italic text-[hsl(var(--tp-text-dim))]">Shelf-life info per product — coming soon.</p>}
        {tab === "orders" && <p className="text-sm italic text-[hsl(var(--tp-text-dim))]">Orders history for this product — coming soon.</p>}
        {tab === "activity" && <p className="text-sm italic text-[hsl(var(--tp-text-dim))]">Internal activity timeline — coming soon.</p>}
        {tab === "notes" && <p className="text-sm italic text-[hsl(var(--tp-text-dim))]">Internal notes — coming soon.</p>}
      </div>
    </TeamPage>
  );
};

export default SalesProductWorkspace;
