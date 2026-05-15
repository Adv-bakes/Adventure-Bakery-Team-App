import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { TeamPage, KpiTile } from "@/components/team/TeamPage";
import { PipelineCard, PipelineCardData } from "@/components/sales/PipelineCard";
import { PipelineColumn } from "@/components/sales/PipelineColumn";
import { MoneyOnly } from "@/components/MoneyOnly";
import { Search, Plus } from "lucide-react";

const STAGES = ["Lead In", "Send Documents", "Follow-Up", "Quote", "First Order"] as const;
type Stage = (typeof STAGES)[number];

const daysSince = (iso: string | null) => {
  if (!iso) return 0;
  return Math.max(0, Math.floor((Date.now() - new Date(iso).getTime()) / 86400000));
};

const SalesPipeline = () => {
  const [clients, setClients] = useState<PipelineCardData[]>([]);
  const [loading, setLoading] = useState(true);
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [q, setQ] = useState("");

  const load = async () => {
    setLoading(true);
    const { data: profiles, error } = await supabase
      .from("profiles")
      .select("id, full_name, business_name, email, sales_stage, sales_stage_updated_at")
      .eq("role", "Client" as any)
      .order("sales_stage_updated_at", { ascending: false });
    if (error) toast.error(error.message);

    const ids = (profiles || []).map((p: any) => p.id);
    let docMap: Record<string, { nda: boolean; pss: boolean }> = {};
    let prfMap: Record<string, boolean> = {};

    if (ids.length) {
      const [docRes, prfRes] = await Promise.all([
        supabase.from("client_documents").select("user_id, document_type").in("user_id", ids),
        supabase.from("prf_submissions").select("owner_user_id").in("owner_user_id", ids),
      ]);
      (docRes.data || []).forEach((d: any) => {
        const m = (docMap[d.user_id] ||= { nda: false, pss: false });
        const t = (d.document_type || "").toLowerCase();
        if (t.includes("nda")) m.nda = true;
        if (t.includes("pss") || t.includes("spec")) m.pss = true;
      });
      (prfRes.data || []).forEach((p: any) => { if (p.owner_user_id) prfMap[p.owner_user_id] = true; });
    }

    setClients(
      ((profiles as any[]) || []).map((p) => ({
        ...p,
        has_nda: docMap[p.id]?.nda || false,
        has_pss: docMap[p.id]?.pss || false,
        has_prf: prfMap[p.id] || false,
      }))
    );
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const moveClient = async (id: string, stage: Stage) => {
    const prev = clients;
    setClients((c) =>
      c.map((x) => x.id === id ? { ...x, sales_stage: stage, sales_stage_updated_at: new Date().toISOString() } : x)
    );
    const { error } = await supabase
      .from("profiles")
      .update({ sales_stage: stage, sales_stage_updated_at: new Date().toISOString() })
      .eq("id", id);
    if (error) { toast.error(error.message); setClients(prev); }
  };

  const filtered = useMemo(() => {
    const s = q.trim().toLowerCase();
    if (!s) return clients;
    return clients.filter((c) =>
      [c.business_name, c.full_name, c.email].some((v) => v && v.toLowerCase().includes(s))
    );
  }, [clients, q]);

  const open = clients.length;
  const stuck = clients.filter((c) => daysSince(c.sales_stage_updated_at) >= 7).length;
  const inQuote = clients.filter((c) => (c.sales_stage || "Lead In") === "Quote").length;

  return (
    <TeamPage
      eyebrow="Sales"
      title="Pipeline"
      description="Drag clients between stages. Auto-advances when an NDA, PRF, or quote lands."
      actions={
        <>
          <div className="relative">
            <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-[hsl(var(--tp-text-dim))]" />
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Search clients…"
              className="tp-input pl-9 w-[240px]"
            />
          </div>
          <button className="tp-btn tp-btn-primary"><Plus className="w-4 h-4" /> New client</button>
        </>
      }
    >
      {/* Bento KPI strip */}
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-3 mb-8">
        <KpiTile label="Open deals" value={open} className="lg:col-span-1" />
        <KpiTile label="Stuck >7d" value={stuck} hint={stuck ? "Needs follow-up" : "All moving"} className="lg:col-span-1" />
        <KpiTile label="In Quote" value={inQuote} className="lg:col-span-1" />
        <MoneyOnly fallback={
          <div className="tp-kpi lg:col-span-3 flex items-center justify-center">
            <p className="text-xs text-[hsl(var(--tp-text-dim))] italic">Pipeline value hidden — owner only</p>
          </div>
        }>
          <KpiTile label="Pipeline value" value="$—" hint="Sum of open quote targets" emphasis className="lg:col-span-3" />
        </MoneyOnly>
      </div>

      {/* Kanban */}
      {loading ? (
        <p className="text-sm text-[hsl(var(--tp-text-dim))]">Loading pipeline…</p>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-5 gap-3">
          {STAGES.map((stage) => {
            const cards = filtered.filter((c) => (c.sales_stage || "Lead In") === stage);
            return (
              <PipelineColumn
                key={stage}
                title={stage}
                count={cards.length}
                onDrop={(id) => { moveClient(id, stage); setDraggingId(null); }}
              >
                {cards.map((c) => (
                  <PipelineCard
                    key={c.id}
                    client={c}
                    isDragging={draggingId === c.id}
                    onDragStart={setDraggingId}
                    onDragEnd={() => setDraggingId(null)}
                  />
                ))}
              </PipelineColumn>
            );
          })}
        </div>
      )}
    </TeamPage>
  );
};

export default SalesPipeline;
