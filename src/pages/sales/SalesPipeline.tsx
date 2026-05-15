import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { MoneyOnly } from "@/components/MoneyOnly";

const STAGES = [
  "Lead In",
  "Send Documents",
  "Follow-Up",
  "Quote",
  "First Order",
] as const;
type Stage = (typeof STAGES)[number];

interface ClientRow {
  id: string;
  full_name: string | null;
  business_name: string | null;
  email: string | null;
  sales_stage: string | null;
  sales_stage_updated_at: string | null;
}

const daysSince = (iso: string | null) => {
  if (!iso) return 0;
  return Math.max(
    0,
    Math.floor((Date.now() - new Date(iso).getTime()) / 86400000)
  );
};

const SalesPipeline = () => {
  const [clients, setClients] = useState<ClientRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [draggingId, setDraggingId] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("profiles")
      .select("id, full_name, business_name, email, sales_stage, sales_stage_updated_at")
      .eq("role", "Client" as any)
      .order("sales_stage_updated_at", { ascending: false });
    if (error) toast.error(error.message);
    setClients((data as any) || []);
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const moveClient = async (id: string, stage: Stage) => {
    const prev = clients;
    setClients((c) =>
      c.map((x) =>
        x.id === id
          ? { ...x, sales_stage: stage, sales_stage_updated_at: new Date().toISOString() }
          : x
      )
    );
    const { error } = await supabase
      .from("profiles")
      .update({
        sales_stage: stage,
        sales_stage_updated_at: new Date().toISOString(),
      })
      .eq("id", id);
    if (error) {
      toast.error(error.message);
      setClients(prev);
    }
  };

  return (
    <div className="max-w-[1600px]">
      <h1 className="text-3xl font-semibold mb-2" style={{ color: "#F5F1E6" }}>
        Sales Pipeline
      </h1>
      <p className="text-sm mb-6" style={{ color: "rgba(245,241,230,0.6)" }}>
        Drag a client card across columns to advance the deal.
      </p>

      {loading ? (
        <p style={{ color: "rgba(245,241,230,0.5)" }}>Loading…</p>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-5 gap-3">
          {STAGES.map((stage) => {
            const cards = clients.filter(
              (c) => (c.sales_stage || "Lead In") === stage
            );
            return (
              <div
                key={stage}
                onDragOver={(e) => e.preventDefault()}
                onDrop={(e) => {
                  e.preventDefault();
                  const id = e.dataTransfer.getData("text/plain");
                  if (id) moveClient(id, stage);
                  setDraggingId(null);
                }}
                className="rounded-lg border p-3 min-h-[400px]"
                style={{
                  background: "rgba(200,155,60,0.04)",
                  borderColor: "rgba(200,155,60,0.15)",
                }}
              >
                <div className="flex items-center justify-between mb-3">
                  <h2 className="text-sm font-semibold" style={{ color: "#F5F1E6" }}>
                    {stage}
                  </h2>
                  <span
                    className="text-[11px] px-2 py-0.5 rounded-full"
                    style={{
                      background: "rgba(200,155,60,0.15)",
                      color: "#C89B3C",
                    }}
                  >
                    {cards.length}
                  </span>
                </div>
                <div className="space-y-2">
                  {cards.map((c) => (
                    <div
                      key={c.id}
                      draggable
                      onDragStart={(e) => {
                        e.dataTransfer.setData("text/plain", c.id);
                        setDraggingId(c.id);
                      }}
                      onDragEnd={() => setDraggingId(null)}
                      className="rounded-md border p-3 cursor-grab active:cursor-grabbing transition-opacity"
                      style={{
                        background: "rgba(20,15,12,0.6)",
                        borderColor: "rgba(200,155,60,0.2)",
                        opacity: draggingId === c.id ? 0.5 : 1,
                      }}
                    >
                      <Link
                        to={`/team/sales/clients/${c.id}`}
                        className="block"
                      >
                        <p className="text-sm font-medium" style={{ color: "#F5F1E6" }}>
                          {c.business_name || c.full_name || "—"}
                        </p>
                        {c.business_name && c.full_name && (
                          <p className="text-xs" style={{ color: "rgba(245,241,230,0.5)" }}>
                            {c.full_name}
                          </p>
                        )}
                        <div className="flex items-center justify-between mt-2">
                          <span className="text-[11px]" style={{ color: "rgba(245,241,230,0.4)" }}>
                            {daysSince(c.sales_stage_updated_at)}d in stage
                          </span>
                          <MoneyOnly>
                            <span className="text-[11px]" style={{ color: "#C89B3C" }}>
                              $—
                            </span>
                          </MoneyOnly>
                        </div>
                      </Link>
                    </div>
                  ))}
                  {cards.length === 0 && (
                    <p className="text-xs italic" style={{ color: "rgba(245,241,230,0.3)" }}>
                      Drop clients here
                    </p>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default SalesPipeline;
