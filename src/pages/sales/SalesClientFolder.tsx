import { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { MoneyOnly, useIsOwner } from "@/components/MoneyOnly";
import { toast } from "sonner";

interface Profile {
  id: string;
  full_name: string | null;
  business_name: string | null;
  email: string | null;
  phone: string | null;
  sales_stage: string | null;
  product_type: string | null;
  location: string | null;
  website: string | null;
  bio: string | null;
}

const SalesClientFolder = () => {
  const { id } = useParams();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [docs, setDocs] = useState<any[]>([]);
  const [prfs, setPrfs] = useState<any[]>([]);
  const [concepts, setConcepts] = useState<any[]>([]);
  const [costing, setCosting] = useState<any[]>([]);
  const [activity, setActivity] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const { isOwner } = useIsOwner();

  useEffect(() => {
    if (!id) return;
    (async () => {
      const [p, d, pr, c, co, ac] = await Promise.all([
        supabase.from("profiles").select("*").eq("id", id).maybeSingle(),
        supabase.from("client_documents").select("*").eq("user_id", id).order("uploaded_at", { ascending: false }),
        supabase.from("prf_submissions").select("*").or(`owner_user_id.eq.${id},email.eq.${(await supabase.from("profiles").select("email").eq("id", id).maybeSingle()).data?.email || ""}`).order("created_at", { ascending: false }),
        supabase.from("concepts").select("id, product_name, status, created_at").eq("user_id", id).order("created_at", { ascending: false }),
        supabase.from("costing").select("*").eq("user_id", id).order("created_at", { ascending: false }),
        supabase.from("client_activity").select("*").eq("client_id", id).order("created_at", { ascending: false }).limit(50),
      ]);
      if (p.error) toast.error(p.error.message);
      setProfile((p.data as any) || null);
      setDocs(d.data || []);
      setPrfs(pr.data || []);
      setConcepts(c.data || []);
      setCosting(co.data || []);
      setActivity(ac.data || []);
      setLoading(false);
    })();
  }, [id]);

  const logActivity = async (action: string, payload?: any) => {
    if (!id) return;
    const { data: { user } } = await supabase.auth.getUser();
    await supabase.from("client_activity").insert({
      client_id: id,
      actor_id: user?.id,
      action,
      payload,
    });
    const { data } = await supabase.from("client_activity").select("*").eq("client_id", id).order("created_at", { ascending: false }).limit(50);
    setActivity(data || []);
  };

  if (loading) return <p style={{ color: "rgba(245,241,230,0.5)" }}>Loading…</p>;
  if (!profile) return <p style={{ color: "rgba(245,241,230,0.5)" }}>Client not found.</p>;

  const card = "rounded-lg border p-4";
  const cardStyle = { background: "rgba(200,155,60,0.04)", borderColor: "rgba(200,155,60,0.15)" };

  return (
    <div className="max-w-6xl">
      <Link to="/team/sales/clients" className="text-xs hover:underline" style={{ color: "rgba(245,241,230,0.5)" }}>
        ← Back to clients
      </Link>
      <div className="flex items-baseline justify-between mt-2 mb-1">
        <h1 className="text-3xl font-semibold" style={{ color: "#F5F1E6" }}>
          {profile.business_name || profile.full_name || "—"}
        </h1>
        <span className="px-2 py-0.5 rounded text-xs" style={{ background: "rgba(200,155,60,0.15)", color: "#C89B3C" }}>
          {profile.sales_stage || "Lead In"}
        </span>
      </div>
      <p className="text-sm mb-6" style={{ color: "rgba(245,241,230,0.6)" }}>
        {profile.email} {profile.phone && `· ${profile.phone}`}
      </p>

      <Tabs defaultValue="overview">
        <TabsList>
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="documents">Documents</TabsTrigger>
          <TabsTrigger value="prfs">PRFs</TabsTrigger>
          <TabsTrigger value="concepts">Concepts</TabsTrigger>
          {isOwner && <TabsTrigger value="quotes">Quotes</TabsTrigger>}
          <TabsTrigger value="activity">Activity</TabsTrigger>
        </TabsList>

        <TabsContent value="overview">
          <div className={card} style={cardStyle as any}>
            <dl className="grid grid-cols-1 md:grid-cols-2 gap-y-3 gap-x-8 text-sm">
              {[
                ["Contact", profile.full_name],
                ["Company", profile.business_name],
                ["Email", profile.email],
                ["Phone", profile.phone],
                ["Product type", profile.product_type],
                ["Location", profile.location],
                ["Website", profile.website],
              ].map(([k, v]) => (
                <div key={k as string}>
                  <dt className="text-xs" style={{ color: "rgba(245,241,230,0.5)" }}>{k}</dt>
                  <dd style={{ color: "#F5F1E6" }}>{(v as string) || "—"}</dd>
                </div>
              ))}
            </dl>
            {profile.bio && (
              <div className="mt-4">
                <dt className="text-xs mb-1" style={{ color: "rgba(245,241,230,0.5)" }}>Bio</dt>
                <p className="text-sm" style={{ color: "#F5F1E6" }}>{profile.bio}</p>
              </div>
            )}
          </div>
        </TabsContent>

        <TabsContent value="documents">
          <div className={card} style={cardStyle as any}>
            {docs.length === 0 ? (
              <p className="text-sm" style={{ color: "rgba(245,241,230,0.5)" }}>No documents yet.</p>
            ) : (
              <ul className="divide-y" style={{ borderColor: "rgba(200,155,60,0.1)" }}>
                {docs.map((d) => (
                  <li key={d.id} className="py-2 flex justify-between text-sm" style={{ color: "#F5F1E6" }}>
                    <span>{d.file_name || d.document_type}</span>
                    <span style={{ color: "rgba(245,241,230,0.5)" }}>{d.document_type}</span>
                  </li>
                ))}
              </ul>
            )}
            <div className="mt-4 flex gap-2 text-xs">
              <button className="px-3 py-1.5 rounded border" style={{ borderColor: "rgba(200,155,60,0.3)", color: "#C89B3C" }} onClick={() => logActivity("Sent NDA")}>Send NDA</button>
              <button className="px-3 py-1.5 rounded border" style={{ borderColor: "rgba(200,155,60,0.3)", color: "#C89B3C" }} onClick={() => logActivity("Sent PSS")}>Send PSS</button>
              <button className="px-3 py-1.5 rounded border" style={{ borderColor: "rgba(200,155,60,0.3)", color: "#C89B3C" }} onClick={() => logActivity("Uploaded document")}>Upload doc</button>
            </div>
          </div>
        </TabsContent>

        <TabsContent value="prfs">
          <div className={card} style={cardStyle as any}>
            {prfs.length === 0 ? (
              <p className="text-sm" style={{ color: "rgba(245,241,230,0.5)" }}>No PRFs submitted yet.</p>
            ) : (
              <ul className="divide-y" style={{ borderColor: "rgba(200,155,60,0.1)" }}>
                {prfs.map((p) => (
                  <li key={p.id} className="py-2 flex justify-between text-sm" style={{ color: "#F5F1E6" }}>
                    <span>{p.product_name || p.project_type || "(untitled)"}</span>
                    <span style={{ color: "rgba(245,241,230,0.5)" }}>
                      {p.status} · {new Date(p.created_at).toLocaleDateString()}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </TabsContent>

        <TabsContent value="concepts">
          <div className={card} style={cardStyle as any}>
            {concepts.length === 0 ? (
              <p className="text-sm" style={{ color: "rgba(245,241,230,0.5)" }}>No concepts yet.</p>
            ) : (
              <ul className="divide-y" style={{ borderColor: "rgba(200,155,60,0.1)" }}>
                {concepts.map((c) => (
                  <li key={c.id} className="py-2 flex justify-between text-sm" style={{ color: "#F5F1E6" }}>
                    <span>{c.product_name || "(untitled concept)"}</span>
                    <span style={{ color: "rgba(245,241,230,0.5)" }}>{c.status || "draft"}</span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </TabsContent>

        {isOwner && (
          <TabsContent value="quotes">
            <MoneyOnly>
              <div className={card} style={cardStyle as any}>
                {costing.length === 0 ? (
                  <p className="text-sm" style={{ color: "rgba(245,241,230,0.5)" }}>No quotes yet.</p>
                ) : (
                  <ul className="divide-y" style={{ borderColor: "rgba(200,155,60,0.1)" }}>
                    {costing.map((c) => (
                      <li key={c.id} className="py-2 flex justify-between text-sm" style={{ color: "#F5F1E6" }}>
                        <span>Target ${Number(c.target_price || 0).toFixed(2)}</span>
                        <span style={{ color: "rgba(245,241,230,0.5)" }}>
                          Cost ${Number(c.total_cost || 0).toFixed(2)} · margin {c.margin_percentage ?? "—"}%
                        </span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </MoneyOnly>
          </TabsContent>
        )}

        <TabsContent value="activity">
          <div className={card} style={cardStyle as any}>
            {activity.length === 0 ? (
              <p className="text-sm" style={{ color: "rgba(245,241,230,0.5)" }}>No activity logged yet.</p>
            ) : (
              <ul className="space-y-2 text-sm">
                {activity.map((a) => (
                  <li key={a.id} style={{ color: "#F5F1E6" }}>
                    <span style={{ color: "rgba(245,241,230,0.5)" }}>
                      {new Date(a.created_at).toLocaleString()} ·
                    </span>{" "}
                    {a.action}
                  </li>
                ))}
              </ul>
            )}
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default SalesClientFolder;
