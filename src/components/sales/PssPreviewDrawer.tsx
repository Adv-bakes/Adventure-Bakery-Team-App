import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { X, Save, Download, RefreshCw, Plus, Trash2 } from "lucide-react";

/**
 * Editable in-app preview of a PSS.
 *
 * Source of truth:
 *  - We edit `client_documents.review_notes.extracted` (the structured PSS payload
 *    that `review-client-document` produces). This works for both wizard-submitted
 *    PSS (the finalize step writes the same shape) and staff-uploaded PSS.
 *  - The original uploaded file remains downloadable from the drawer header.
 */

type Extracted = {
  header?: any;
  product?: any;
  recipe?: { total_batch_weight?: any; weight_unit?: any; ingredients?: any[] };
  process?: any;
  packaging?: { primary?: any; secondary?: any; palletizing?: any };
  optional_sections?: any;
};

export function PssPreviewDrawer({
  pssDocumentId,
  onClose,
  onSaved,
}: {
  pssDocumentId: string | null;
  onClose: () => void;
  onSaved?: () => void;
}) {
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [doc, setDoc] = useState<any>(null);
  const [data, setData] = useState<Extracted>({});

  useEffect(() => {
    if (!pssDocumentId) return;
    (async () => {
      setLoading(true);
      const { data: d, error } = await (supabase as any)
        .from("client_documents")
        .select("*")
        .eq("id", pssDocumentId)
        .maybeSingle();
      if (error) toast.error(error.message);
      setDoc(d);
      const ex: Extracted = (d?.review_notes?.extracted as any) || {};
      // Make sure nested containers exist so the form is usable even if empty
      setData({
        header: ex.header || {},
        product: { ...(ex.product || {}), unit_dimensions: ex.product?.unit_dimensions || {} },
        recipe: { ...(ex.recipe || {}), ingredients: ex.recipe?.ingredients || [] },
        process: ex.process || {},
        packaging: {
          primary: ex.packaging?.primary || {},
          secondary: ex.packaging?.secondary || {},
          palletizing: ex.packaging?.palletizing || {},
        },
        optional_sections: ex.optional_sections || {},
      });
      setLoading(false);
    })();
  }, [pssDocumentId]);

  if (!pssDocumentId) return null;

  const update = (path: string[], value: any) => {
    setData((prev) => {
      const next: any = { ...prev };
      let cur = next;
      for (let i = 0; i < path.length - 1; i++) {
        cur[path[i]] = { ...(cur[path[i]] || {}) };
        cur = cur[path[i]];
      }
      cur[path[path.length - 1]] = value;
      return next;
    });
  };

  const updateIngredient = (i: number, key: string, value: any) => {
    setData((prev) => {
      const ings = [...(prev.recipe?.ingredients || [])];
      ings[i] = { ...(ings[i] || {}), [key]: value };
      return { ...prev, recipe: { ...(prev.recipe || {}), ingredients: ings } };
    });
  };
  const addIngredient = () => {
    setData((prev) => ({
      ...prev,
      recipe: { ...(prev.recipe || {}), ingredients: [...(prev.recipe?.ingredients || []), { name: "", weight: null, percentage: null }] },
    }));
  };
  const removeIngredient = (i: number) => {
    setData((prev) => {
      const ings = [...(prev.recipe?.ingredients || [])];
      ings.splice(i, 1);
      return { ...prev, recipe: { ...(prev.recipe || {}), ingredients: ings } };
    });
  };

  const downloadOriginal = async () => {
    if (!doc?.file_path) return toast.error("No file on record");
    const { data: u, error } = await supabase.storage
      .from("product-spec-sheets")
      .createSignedUrl(doc.file_path, 600);
    if (error || !u?.signedUrl) return toast.error("Could not generate link");
    window.open(u.signedUrl, "_blank");
  };

  const save = async () => {
    if (!doc) return;
    setSaving(true);
    const newNotes = { ...(doc.review_notes || {}), extracted: data };
    const { error } = await (supabase as any)
      .from("client_documents")
      .update({ review_notes: newNotes })
      .eq("id", doc.id);
    setSaving(false);
    if (error) return toast.error(error.message);
    toast.success("PSS saved");
    setDoc({ ...doc, review_notes: newNotes });
    onSaved?.();
    // Fire-and-forget reconcile so missing batch-sheet fields get filled
    syncWithBatchSheet(true);
  };

  const syncWithBatchSheet = async (silent = false) => {
    if (!doc) return;
    setSyncing(true);
    const { data: res, error } = await supabase.functions.invoke("reconcile-pss-batch", {
      body: { pss_document_id: doc.id },
    });
    setSyncing(false);
    if (error) {
      if (!silent) toast.error(error.message || "Sync failed");
      return;
    }
    const filled = (res as any)?.filled || {};
    const total = (filled.pss_filled_count || 0) + (filled.batch_filled_count || 0);
    if (total > 0) {
      toast.success(
        `Synced: filled ${filled.pss_filled_count || 0} PSS field(s), ${filled.batch_filled_count || 0} batch sheet field(s).`,
      );
      // refresh the local PSS data
      const { data: d } = await (supabase as any)
        .from("client_documents").select("*").eq("id", doc.id).maybeSingle();
      if (d) {
        setDoc(d);
        const ex: Extracted = (d?.review_notes?.extracted as any) || {};
        setData({
          header: ex.header || {},
          product: { ...(ex.product || {}), unit_dimensions: ex.product?.unit_dimensions || {} },
          recipe: { ...(ex.recipe || {}), ingredients: ex.recipe?.ingredients || [] },
          process: ex.process || {},
          packaging: {
            primary: ex.packaging?.primary || {},
            secondary: ex.packaging?.secondary || {},
            palletizing: ex.packaging?.palletizing || {},
          },
          optional_sections: ex.optional_sections || {},
        });
      }
      onSaved?.();
    } else if (!silent) {
      toast.info("Nothing to sync — both sides already aligned.");
    }
  };

  return (
    <div className="fixed inset-0 z-50 team-portal" onClick={onClose}>
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />
      <div
        onClick={(e) => e.stopPropagation()}
        className="absolute right-0 top-0 h-full w-full max-w-[760px] tp-surface border-l border-[hsl(var(--tp-hairline))] overflow-y-auto"
      >
        <div className="sticky top-0 z-10 flex items-center justify-between px-6 py-4 border-b border-[hsl(var(--tp-hairline))] bg-[hsl(var(--tp-surface))]/95 backdrop-blur">
          <div>
            <p className="text-[10px] uppercase tracking-[0.18em] text-[hsl(var(--tp-gold))]">
              Product Spec Sheet · {doc?.review_status || "—"}
            </p>
            <h2 className="font-display text-lg text-[hsl(var(--tp-text))]">
              {data.header?.product_name || doc?.file_name || "PSS"}
            </h2>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={() => syncWithBatchSheet(false)} className="tp-btn" disabled={syncing} title="Fill any blanks from the batch sheet, and vice versa">
              <RefreshCw className={`w-3.5 h-3.5 ${syncing ? "animate-spin" : ""}`} /> Sync
            </button>
            <button onClick={downloadOriginal} className="tp-btn" title="Download the original uploaded file">
              <Download className="w-3.5 h-3.5" /> Original
            </button>
            <button onClick={save} disabled={saving || loading} className="tp-btn tp-btn-primary">
              <Save className="w-3.5 h-3.5" /> {saving ? "Saving…" : "Save"}
            </button>
            <button onClick={onClose} className="tp-btn"><X className="w-3.5 h-3.5" /></button>
          </div>
        </div>

        {loading ? (
          <div className="p-8 text-sm text-[hsl(var(--tp-text-dim))]">Loading…</div>
        ) : (
          <div className="p-6 space-y-6">
            <Section title="Header">
              <TextField label="Company" v={data.header?.company_name} onChange={(v) => update(["header", "company_name"], v)} />
              <TextField label="Customer" v={data.header?.customer_name} onChange={(v) => update(["header", "customer_name"], v)} />
              <TextField label="Product name" v={data.header?.product_name} onChange={(v) => update(["header", "product_name"], v)} />
              <TextField label="Product code" v={data.header?.product_code} onChange={(v) => update(["header", "product_code"], v)} />
              <TextField label="Version" v={data.header?.version_number} onChange={(v) => update(["header", "version_number"], v)} />
              <TextField label="Date of issue" v={data.header?.date_of_issue} onChange={(v) => update(["header", "date_of_issue"], v)} />
            </Section>

            <Section title="Product">
              <TextField label="Target unit weight (raw)" v={data.product?.target_unit_weight_raw} onChange={(v) => update(["product", "target_unit_weight_raw"], num(v))} type="number" />
              <TextField label="Weight unit" v={data.product?.weight_unit} onChange={(v) => update(["product", "weight_unit"], v)} />
              <TextField label="Shape" v={data.product?.shape} onChange={(v) => update(["product", "shape"], v)} />
              <TextField label="Target shelf life" v={data.product?.target_shelf_life} onChange={(v) => update(["product", "target_shelf_life"], v)} />
              <TextField label="Intended use" v={data.product?.intended_use} onChange={(v) => update(["product", "intended_use"], v)} />
            </Section>

            <Section
              title={`Recipe (${data.recipe?.ingredients?.length || 0})`}
              action={<button onClick={addIngredient} className="tp-btn text-[11px]"><Plus className="w-3 h-3" /> Add row</button>}
            >
              <div className="col-span-2 grid grid-cols-12 gap-2 text-[10px] uppercase tracking-wider text-[hsl(var(--tp-text-dim))] pb-1 border-b border-[hsl(var(--tp-hairline))]">
                <div className="col-span-6">Ingredient</div>
                <div className="col-span-2 text-right">Weight</div>
                <div className="col-span-2 text-right">%</div>
                <div className="col-span-2"></div>
              </div>
              {(data.recipe?.ingredients || []).map((ing: any, i: number) => (
                <div key={i} className="col-span-2 grid grid-cols-12 gap-2 items-center py-1">
                  <input className="tp-input col-span-6" value={ing.name || ""} onChange={(e) => updateIngredient(i, "name", e.target.value)} placeholder="Name" />
                  <input className="tp-input col-span-2 text-right" type="number" value={ing.weight ?? ""} onChange={(e) => updateIngredient(i, "weight", num(e.target.value))} placeholder="0" />
                  <input className="tp-input col-span-2 text-right" type="number" value={ing.percentage ?? ""} onChange={(e) => updateIngredient(i, "percentage", num(e.target.value))} placeholder="0" />
                  <button className="tp-btn col-span-2 justify-self-end" onClick={() => removeIngredient(i)} title="Remove"><Trash2 className="w-3 h-3" /></button>
                </div>
              ))}
              <TextField label="Total batch weight" v={data.recipe?.total_batch_weight} onChange={(v) => update(["recipe", "total_batch_weight"], num(v))} type="number" />
              <TextField label="Recipe weight unit" v={data.recipe?.weight_unit} onChange={(v) => update(["recipe", "weight_unit"], v)} />
            </Section>

            <Section title="Packaging">
              <TextField label="Primary vessel" v={data.packaging?.primary?.vessel} onChange={(v) => update(["packaging", "primary", "vessel"], v)} />
              <TextField label="Units / primary pack" v={data.packaging?.primary?.units_per_pack} onChange={(v) => update(["packaging", "primary", "units_per_pack"], num(v))} type="number" />
              <TextField label="Net weight / pack" v={data.packaging?.primary?.net_weight_per_pack} onChange={(v) => update(["packaging", "primary", "net_weight_per_pack"], num(v))} type="number" />
              <TextField label="Pack weight unit" v={data.packaging?.primary?.weight_unit} onChange={(v) => update(["packaging", "primary", "weight_unit"], v)} />
              <TextField label="Secondary type" v={data.packaging?.secondary?.type} onChange={(v) => update(["packaging", "secondary", "type"], v)} />
              <TextField label="Units / case" v={data.packaging?.secondary?.units_per_case} onChange={(v) => update(["packaging", "secondary", "units_per_case"], num(v))} type="number" />
              <TextField label="Cases / pallet" v={data.packaging?.palletizing?.cases_per_pallet} onChange={(v) => update(["packaging", "palletizing", "cases_per_pallet"], num(v))} type="number" />
            </Section>

            <p className="text-[10px] text-[hsl(var(--tp-text-dim))] pt-2">
              Process steps are managed in the internal Batch Sheet editor and stay proprietary — they are not exposed on the PSS preview.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

const Section = ({ title, action, children }: { title: string; action?: React.ReactNode; children: React.ReactNode }) => (
  <section className="tp-surface p-4">
    <div className="flex items-center justify-between mb-3">
      <h3 className="font-display text-sm text-[hsl(var(--tp-text))]">{title}</h3>
      {action}
    </div>
    <div className="grid grid-cols-2 gap-3">{children}</div>
  </section>
);

const TextField = ({
  label, v, onChange, type = "text",
}: { label: string; v: any; onChange: (v: any) => void; type?: string }) => (
  <label className="block">
    <span className="block text-[10px] uppercase tracking-wider text-[hsl(var(--tp-text-dim))] mb-1">{label}</span>
    <input
      className="tp-input w-full"
      type={type}
      value={v ?? ""}
      onChange={(e) => onChange(e.target.value)}
    />
  </label>
);

const num = (s: any): number | null => {
  if (s === "" || s === null || s === undefined) return null;
  const n = Number(s);
  return Number.isFinite(n) ? n : null;
};
