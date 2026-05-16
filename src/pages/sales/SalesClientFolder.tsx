import { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { TeamPage } from "@/components/team/TeamPage";
import { toast } from "sonner";
import { ArrowLeft, Mail, Phone, ChevronDown, ChevronUp, ShieldCheck, ShieldAlert, Plus } from "lucide-react";
import { AddOrderDialog } from "@/components/sales/AddOrderDialog";
import { ClientOrders } from "./ClientOrders";

interface Lead {
  id: string;
  email: string;
  contact_name: string | null;
  company_name: string | null;
  phone: string | null;
  profile_id: string | null;
  notes: string | null;
}

type TabId = "overview" | "documents_nda" | "projects" | "products" | "tolling" | "orders" | "notes";

const SalesClientFolder = () => {
  const { id } = useParams();
  const [lead, setLead] = useState<Lead | null>(null);
  const [projects, setProjects] = useState<any[]>([]);   // presale (not Approved)
  const [products, setProducts] = useState<any[]>([]);   // Approved + quote_approved_at
  const [docs, setDocs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<TabId>("overview");
  const [contactExpanded, setContactExpanded] = useState(false);
  const [addOpen, setAddOpen] = useState(false);
  const [notesDraft, setNotesDraft] = useState("");
  const [savingNotes, setSavingNotes] = useState(false);

  const load = async () => {
    if (!id) return;
    setLoading(true);
    const { data: l } = await (supabase as any).from("sales_leads").select("*").eq("id", id).maybeSingle();
    setLead(l);
    setNotesDraft(l?.notes || "");

    const { data: prfs } = await supabase
      .from("prf_submissions")
      .select("id, product_name, project_type, status, sales_stage, quote_approved_at, created_at, lead_id, email")
      .or(`lead_id.eq.${id}${l?.email ? `,email.eq.${l.email}` : ""}`)
      .order("created_at", { ascending: false });

    const all = prfs ?? [];
    setProjects(all.filter(p => (p.sales_stage || "Lead In") !== "Approved"));
    setProducts(all.filter(p => p.sales_stage === "Approved" && p.quote_approved_at));

    if (l?.profile_id) {
      const { data: d } = await supabase
        .from("client_documents")
        .select("*")
        .eq("user_id", l.profile_id)
        .order("uploaded_at", { ascending: false });
      setDocs(d ?? []);
    } else {
      setDocs([]);
    }
    setLoading(false);
  };

  useEffect(() => { load(); }, [id]);

  const saveNotes = async () => {
    if (!lead) return;
    setSavingNotes(true);
    const { error } = await (supabase as any).from("sales_leads").update({ notes: notesDraft }).eq("id", lead.id);
    setSavingNotes(false);
    if (error) return toast.error(error.message);
    toast.success("Notes saved");
  };

  if (loading) return <TeamPage title="Loading…">…</TeamPage>;
  if (!lead) return (
    <TeamPage title="Not found">
      <Link to="/team/sales/dashboard" className="tp-btn"><ArrowLeft className="w-4 h-4" /> Back</Link>
    </TeamPage>
  );

  const ndaSigned = docs.some(d => (d.document_type || "").toLowerCase().includes("nda"));

  const tabs: Array<{ id: TabId; label: string; staffOnly?: boolean }> = [
    { id: "overview", label: "Overview" },
    { id: "documents_nda", label: "Documents & NDA" },
    { id: "projects", label: `Projects (${projects.length})` },
    { id: "products", label: `Products (${products.length})` },
    { id: "tolling", label: "Tolling Inventory", staffOnly: true },
    { id: "orders", label: "Orders", staffOnly: true },
    { id: "notes", label: "Notes", staffOnly: true },
  ];

  return (
    <TeamPage
      eyebrow="Client folder"
      title={lead.company_name || lead.contact_name || lead.email}
      actions={
        <div className="flex items-center gap-2">
          <button onClick={() => setAddOpen(true)} className="tp-btn tp-btn-primary">
            <Plus className="w-4 h-4" /> Add Order
          </button>
          <Link to="/team/sales/dashboard" className="tp-btn"><ArrowLeft className="w-4 h-4" /> Back</Link>
        </div>
      }
    >
      {/* Collapsed contact card */}
      <div className="tp-surface p-4 mb-3">
        <button
          onClick={() => setContactExpanded(v => !v)}
          className="w-full flex items-center justify-between"
        >
          <div className="flex items-center gap-3 text-sm">
            <span className="font-display text-[hsl(var(--tp-text))]">{lead.contact_name || lead.email}</span>
            {!contactExpanded && (
              <span className="text-[hsl(var(--tp-text-dim))]">{lead.email}{lead.phone ? ` · ${lead.phone}` : ""}</span>
            )}
          </div>
          {contactExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
        </button>
        {contactExpanded && (
          <div className="mt-3 grid grid-cols-1 md:grid-cols-3 gap-3 text-sm">
            <p className="flex items-center gap-2 text-[hsl(var(--tp-text-muted))]"><Mail className="w-3.5 h-3.5" /> {lead.email}</p>
            {lead.phone && <p className="flex items-center gap-2 text-[hsl(var(--tp-text-muted))]"><Phone className="w-3.5 h-3.5" /> {lead.phone}</p>}
            {lead.company_name && <p className="text-[hsl(var(--tp-text-muted))]">Company: {lead.company_name}</p>}
          </div>
        )}
      </div>

      {/* NDA strip */}
      <div className={`tp-surface px-4 py-2 mb-4 flex items-center gap-2 text-xs ${ndaSigned ? "text-green-500" : "text-amber-500"}`}>
        {ndaSigned ? <ShieldCheck className="w-4 h-4" /> : <ShieldAlert className="w-4 h-4" />}
        {ndaSigned ? "NDA on file (client-level)" : "No NDA on file — send one from Documents & NDA"}
      </div>

      {/* Tabs */}
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

      {tab === "overview" && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="tp-surface p-5">
            <p className="text-[10px] uppercase tracking-[0.18em] text-[hsl(var(--tp-text-dim))] mb-3">Active projects ({projects.length})</p>
            {projects.length === 0 ? (
              <p className="text-sm italic text-[hsl(var(--tp-text-dim))]">None in presale.</p>
            ) : (
              <ul className="space-y-2">
                {projects.slice(0, 5).map(p => (
                  <li key={p.id}>
                    <Link to={`/team/sales/clients/${lead.id}/projects/${p.id}`} className="block hover:opacity-80">
                      <p className="text-sm text-[hsl(var(--tp-text))] truncate">{p.product_name || "(unnamed)"}</p>
                      <p className="text-[11px] text-[hsl(var(--tp-text-dim))]">{p.sales_stage || "Lead In"}</p>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </div>
          <div className="tp-surface p-5">
            <p className="text-[10px] uppercase tracking-[0.18em] text-[hsl(var(--tp-text-dim))] mb-3">Approved products ({products.length})</p>
            {products.length === 0 ? (
              <p className="text-sm italic text-[hsl(var(--tp-text-dim))]">No approved products yet.</p>
            ) : (
              <ul className="space-y-2">
                {products.slice(0, 5).map(p => (
                  <li key={p.id}>
                    <Link to={`/team/sales/clients/${lead.id}/products/${p.id}`} className="block hover:opacity-80">
                      <p className="text-sm text-[hsl(var(--tp-text))] truncate">{p.product_name || "(unnamed)"}</p>
                      <p className="text-[11px] text-[hsl(var(--tp-text-dim))]">Approved {p.quote_approved_at ? new Date(p.quote_approved_at).toLocaleDateString() : "—"}</p>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      )}

      {tab === "documents_nda" && (
        <div className="tp-surface divide-y divide-[hsl(var(--tp-hairline))]">
          {docs.length === 0 && <p className="p-8 text-sm italic text-[hsl(var(--tp-text-dim))]">No documents on file.</p>}
          {docs.map(d => (
            <div key={d.id} className="p-4">
              <p className="text-sm text-[hsl(var(--tp-text))]">{d.file_name || d.document_type}</p>
              <p className="text-[11px] text-[hsl(var(--tp-text-dim))]">
                {d.document_type} · {d.uploaded_at ? new Date(d.uploaded_at).toLocaleDateString() : ""}
              </p>
            </div>
          ))}
        </div>
      )}

      {tab === "projects" && (
        <div className="tp-surface divide-y divide-[hsl(var(--tp-hairline))]">
          {projects.length === 0 && <p className="p-8 text-sm italic text-[hsl(var(--tp-text-dim))]">No presale projects.</p>}
          {projects.map(p => (
            <Link key={p.id} to={`/team/sales/clients/${lead.id}/projects/${p.id}`} className="p-4 flex items-center justify-between hover:opacity-90">
              <div>
                <p className="text-sm text-[hsl(var(--tp-text))]">{p.product_name || "(unnamed)"}</p>
                <p className="text-[11px] text-[hsl(var(--tp-text-dim))]">{p.sales_stage || "Lead In"} · {new Date(p.created_at).toLocaleDateString()}</p>
              </div>
              <span className="text-[11px] text-[hsl(var(--tp-gold))]">Open →</span>
            </Link>
          ))}
        </div>
      )}

      {tab === "products" && (
        <div className="tp-surface divide-y divide-[hsl(var(--tp-hairline))]">
          {products.length === 0 && <p className="p-8 text-sm italic text-[hsl(var(--tp-text-dim))]">No approved products.</p>}
          {products.map(p => (
            <Link key={p.id} to={`/team/sales/clients/${lead.id}/products/${p.id}`} className="p-4 flex items-center justify-between hover:opacity-90">
              <div>
                <p className="text-sm text-[hsl(var(--tp-text))]">{p.product_name || "(unnamed)"}</p>
                <p className="text-[11px] text-[hsl(var(--tp-text-dim))]">Approved {p.quote_approved_at ? new Date(p.quote_approved_at).toLocaleDateString() : "—"}</p>
              </div>
              <span className="text-[11px] text-[hsl(var(--tp-gold))]">Open →</span>
            </Link>
          ))}
        </div>
      )}

      {tab === "tolling" && (
        <p className="tp-surface p-8 text-sm italic text-[hsl(var(--tp-text-dim))]">Tolling Inventory (staff-only) — tab shell. CRUD coming next pass.</p>
      )}

      {tab === "orders" && (
        <ClientOrders clientId={lead.id} profileId={lead.profile_id} />
      )}

      {tab === "notes" && (
        <div className="tp-surface p-5">
          <textarea
            value={notesDraft}
            onChange={e => setNotesDraft(e.target.value)}
            rows={10}
            placeholder="Internal client-level notes…"
            className="tp-input w-full resize-none"
          />
          <button onClick={saveNotes} disabled={savingNotes} className="tp-btn tp-btn-primary mt-3 disabled:opacity-50">
            {savingNotes ? "Saving…" : "Save notes"}
          </button>
        </div>
      )}

      <AddOrderDialog
        open={addOpen}
        onOpenChange={setAddOpen}
        clientId={lead.id}
        profileId={lead.profile_id}
        onCreated={() => { setTab("orders"); load(); }}
      />
    </TeamPage>
  );
};

export default SalesClientFolder;
