import { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { TeamPage } from "@/components/team/TeamPage";
import { ArrowLeft, ShieldCheck, ExternalLink, FileText } from "lucide-react";
import { toast } from "sonner";
import { useUserRole } from "@/hooks/useUserRole";

type Tab = "concept" | "formula" | "packaging" | "shelf_life" | "costing" | "production_notes" | "order_history" | "notes";

// Top 9 + common allergen keywords mapped to their label
// Each keyword is matched against the FULL ingredient name (not individual words).
// Use specific multi-word phrases or unambiguous single words only.
// "butter" alone is excluded — cocoa butter, shea butter, etc. are not dairy.
const ALLERGEN_PHRASES: [string[], string][] = [
  [["milk","whole milk","skim milk","nonfat milk","milk powder","dry milk","milk solids",
    "milk fat","cream cheese","whey","whey protein","casein","caseinate","lactose",
    "buttermilk","ghee","dairy","lactalbumin","lactoglobulin","rennet"], "Milk"],
  [["egg","eggs","whole egg","egg white","egg yolk","egg powder","dried egg",
    "albumin","egg albumin","mayonnaise","meringue","lysozyme"], "Eggs"],
  [["wheat","wheat flour","whole wheat","durum wheat","wheat starch","wheat germ",
    "wheat bran","semolina","spelt","kamut","farro","triticale","gluten","vital wheat gluten"], "Wheat"],
  [["soy","soya","soybean","soy protein","soy flour","soy lecithin","soy milk",
    "tofu","tempeh","miso","edamame","tamari","textured soy"], "Soy"],
  [["peanut","peanuts","peanut butter","peanut flour","peanut oil","groundnut","arachis"], "Peanuts"],
  [["almond","cashew","walnut","pecan","pistachio","hazelnut","macadamia",
    "brazil nut","pine nut","tree nut","nut flour","nut butter","nut oil",
    "praline","marzipan","frangipane"], "Tree Nuts"],
  [["fish sauce","fish stock","fish powder","anchovy","anchovies","cod","salmon",
    "tuna","tilapia","halibut","mahi mahi","flounder","bass fillet","worcestershire"], "Fish"],
  [["shrimp","prawn","crab","lobster","crawfish","crayfish","krill","shellfish",
    "crustacean","barnacle"], "Shellfish"],
  [["sesame seed","sesame seeds","sesame oil","tahini","til seed","gingelly oil"], "Sesame"],
];

function detectAllergens(ingredients: any[]): string {
  const names = ingredients.map((i: any) => (i.name || "").toLowerCase().trim());
  const found: string[] = [];
  for (const [phrases, label] of ALLERGEN_PHRASES) {
    // Match if the full ingredient name equals or contains the full phrase
    if (names.some(n => phrases.some(p => n === p || n.startsWith(p + " ") || n.includes(" " + p) || n.includes("(" + p) || n.includes(p + ",")))) {
      found.push(label);
    }
  }
  return found.length ? found.join(", ") : "";
}

const BASE_TABS: { id: Tab; label: string }[] = [
  { id: "concept",    label: "Concept" },
  { id: "formula",    label: "Formula" },
  { id: "packaging",  label: "Packaging" },
  { id: "shelf_life", label: "Shelf Life" },
  { id: "costing",    label: "Costing" },
  { id: "notes",      label: "Notes" },
];
const PRODUCTION_TABS: { id: Tab; label: string }[] = [
  { id: "production_notes", label: "Production Notes" },
  { id: "order_history",    label: "Order History" },
];

const LEVEL_LABELS: Record<string, string> = {
  primary:   "Primary Packaging",
  secondary: "Secondary Packaging",
  shipper:   "Shipper / Case",
};

// ─── Sub-components ───────────────────────────────────────────────────────────

const Row = ({ label, value }: { label: string; value?: any }) => (
  <div className="flex items-start gap-2 py-1.5 border-b border-[hsl(var(--tp-hairline))] last:border-0 w-fit">
    <span className="text-sm font-semibold text-[hsl(var(--tp-text))] shrink-0">{label}</span>
    <span className="text-sm text-[hsl(var(--tp-text-dim))]">·</span>
    <span className="text-sm text-[hsl(var(--tp-text))]">
      {value ?? <span className="italic font-normal text-[hsl(var(--tp-text-muted))]">—</span>}
    </span>
  </div>
);

const Field = ({
  label, value, canEdit, multiline, rows = 3, type = "text", placeholder, saving, onChange, onSave,
}: {
  label: string; value: string; canEdit: boolean; multiline?: boolean; rows?: number;
  type?: string; placeholder?: string; saving: boolean;
  onChange: (v: string) => void; onSave: () => void;
}) => (
  <div>
    <p className="text-[11px] uppercase tracking-wider font-bold text-[hsl(var(--tp-text))] mb-1.5">{label}</p>
    {canEdit ? (
      <div className="space-y-2">
        {multiline ? (
          <textarea rows={rows} value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder}
            className="w-full rounded-lg border border-[hsl(var(--tp-hairline))] bg-[hsl(var(--tp-surface-2))] px-3 py-2 text-sm text-[hsl(var(--tp-text))] resize-none focus:border-[hsl(var(--tp-gold))] outline-none" />
        ) : (
          <input type={type} value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder}
            className="w-full rounded-lg border border-[hsl(var(--tp-hairline))] bg-[hsl(var(--tp-surface-2))] px-3 py-2 text-sm text-[hsl(var(--tp-text))] focus:border-[hsl(var(--tp-gold))] outline-none" />
        )}
        <div className="flex justify-end">
          <button onClick={onSave} disabled={saving} className="tp-btn tp-btn-primary text-xs disabled:opacity-40">
            {saving ? "Saving…" : "Save"}
          </button>
        </div>
      </div>
    ) : (
      <p className="text-sm text-[hsl(var(--tp-text))]">
        {value || <span className="italic text-[hsl(var(--tp-text-dim))]">—</span>}
      </p>
    )}
  </div>
);

const UNITS_LABEL: Record<string, string> = {
  primary:   "Units / package",
  secondary: "Primary units / package",
  shipper:   "Secondary units / case",
};

const PackagingLevel = ({ level, draft, canEdit, saving, setDraft, onSave }: {
  level: string; draft: any; canEdit: boolean; saving: boolean;
  setDraft: (fn: (d: any) => any) => void; onSave: () => void;
}) => {
  const inp = "w-full rounded-lg border border-[hsl(var(--tp-hairline))] bg-[hsl(var(--tp-surface-2))] px-3 py-2 text-sm text-[hsl(var(--tp-text))] focus:border-[hsl(var(--tp-gold))] outline-none";
  const lbl = "text-[11px] uppercase tracking-wider font-bold text-[hsl(var(--tp-text))] mb-1 block";
  return (
    <div>
      <p className="text-sm font-semibold text-[hsl(var(--tp-text))] mb-3">{LEVEL_LABELS[level]}</p>
      {/* Row 1: Type | Size | Units */}
      <div className="grid gap-3 mb-4">
        {[
          { key: `${level}_type`,  label: "Type", placeholder: level === "primary" ? "e.g. Stand-up pouch" : level === "secondary" ? "e.g. Display carton" : "e.g. RSC shipper box" },
          { key: `${level}_size`,  label: "Size", placeholder: "e.g. 9 × 5 in" },
          { key: `${level}_units`, label: UNITS_LABEL[level], placeholder: "e.g. 2" },
        ].map(({ key, label, placeholder }) => (
          <div key={key}>
            <label className={lbl}>{label}</label>
            {canEdit ? (
              <input value={draft[key] ?? ""} onChange={e => setDraft(d => ({ ...d, [key]: e.target.value }))}
                placeholder={placeholder} className={inp} />
            ) : (
              <p className="text-sm text-[hsl(var(--tp-text))]">
                {draft[key] || <span className="italic text-[hsl(var(--tp-text-dim))]">—</span>}
              </p>
            )}
          </div>
        ))}
      </div>
      {/* Row 2: Specs | Additional notes */}
      <div className="grid gap-3">
        {[
          { key: `${level}_specs`, label: "Specs",            placeholder: "e.g. PPE, clear window, matte finish" },
          { key: `${level}_notes`, label: "Additional notes", placeholder: "" },
        ].map(({ key, label, placeholder }) => (
          <div key={key}>
            <label className={lbl}>{label}</label>
            {canEdit ? (
              <input value={draft[key] ?? ""} onChange={e => setDraft(d => ({ ...d, [key]: e.target.value }))}
                placeholder={placeholder} className={inp} />
            ) : (
              <p className="text-sm text-[hsl(var(--tp-text))]">
                {draft[key] || <span className="italic text-[hsl(var(--tp-text-dim))]">—</span>}
              </p>
            )}
          </div>
        ))}
      </div>
      {canEdit && (
        <div className="flex justify-end mt-3">
          <button onClick={onSave} disabled={saving} className="tp-btn tp-btn-primary text-xs disabled:opacity-40">
            {saving ? "Saving…" : `Save ${LEVEL_LABELS[level]}`}
          </button>
        </div>
      )}
    </div>
  );
};

// ─── Shelf Life Tab ───────────────────────────────────────────────────────────

const STORAGE_CONDITIONS = ["Ambient", "Refrigerated", "Frozen", "Controlled atmosphere"];

const ShelfLifeTab = ({ shelfLife, canEdit, conceptId, onSaved }: {
  shelfLife: any; canEdit: boolean; conceptId?: number; onSaved: (sl: any) => void;
}) => {
  const [draft, setDraft] = useState({
    storage_condition: shelfLife?.storage_condition ?? "",
    shelf_life_days: shelfLife?.shelf_life_days ?? "",
    shelf_life_unit: (shelfLife?.shelf_life_unit ?? "days") as "days" | "months",
    preservation_strategy: shelfLife?.preservation_strategy ?? "",
    ph_level: shelfLife?.ph_level ?? "",
    aw_test_result: shelfLife?.aw_test_result ?? "",
    notes: shelfLife?.notes ?? "",
  });
  const [saving, setSaving] = useState(false);

  const saveShelfLife = async () => {
    if (!draft.storage_condition) { toast.error("Storage condition is required"); return; }
    setSaving(true);
    const { data: { user } } = await supabase.auth.getUser();
    const payload = {
      storage_condition: draft.storage_condition,
      shelf_life_days: draft.shelf_life_days ? Number(draft.shelf_life_days) : null,
      shelf_life_unit: draft.shelf_life_unit,
      preservation_strategy: draft.preservation_strategy || null,
      ph_level: draft.ph_level ? Number(draft.ph_level) : null,
      aw_test_result: draft.aw_test_result ? Number(draft.aw_test_result) : null,
      notes: draft.notes || null,
      concept_id: conceptId ?? null,
      user_id: user!.id,
      updated_at: new Date().toISOString(),
    };
    let result: any;
    if (shelfLife?.id) {
      const { data, error } = await (supabase as any).from("shelf_life").update(payload).eq("id", shelfLife.id).select().maybeSingle();
      if (error) { setSaving(false); toast.error(error.message); return; }
      result = data;
    } else {
      const { data, error } = await (supabase as any).from("shelf_life").insert(payload).select().maybeSingle();
      if (error) { setSaving(false); toast.error(error.message); return; }
      result = data;
    }
    setSaving(false);
    onSaved(result);
    toast.success("Shelf life saved");
  };

  const inp = "w-full rounded-lg border border-[hsl(var(--tp-hairline))] bg-[hsl(var(--tp-surface-2))] px-3 py-2 text-sm text-[hsl(var(--tp-text))] focus:border-[hsl(var(--tp-gold))] outline-none";
  const lbl = "text-[11px] uppercase tracking-wider font-bold text-[hsl(var(--tp-text))] mb-1 block";

  const numInp = "rounded-lg border border-[hsl(var(--tp-hairline))] bg-[hsl(var(--tp-surface-2))] px-3 py-2 text-sm text-[hsl(var(--tp-text))] focus:border-[hsl(var(--tp-gold))] outline-none text-right w-24";

  return (
    <div className="flex gap-4 items-stretch">
      {/* Left: separate card per field */}
      <div className="space-y-3 flex-1">
        <div className="tp-surface px-4 py-3">
          <label className={lbl}>Storage condition *</label>
          {canEdit ? (
            <select value={draft.storage_condition} onChange={e => setDraft(d => ({ ...d, storage_condition: e.target.value }))} className={inp}>
              <option value="">Select…</option>
              {STORAGE_CONDITIONS.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
          ) : <p className="text-sm font-medium text-[hsl(var(--tp-text))]">{shelfLife?.storage_condition || "—"}</p>}
        </div>
        <div className="tp-surface px-4 py-3">
          <label className={lbl}>Shelf life</label>
          {canEdit ? (
            <div className="flex gap-2 items-center">
              <input type="number" min={1} value={draft.shelf_life_days} onChange={e => setDraft(d => ({ ...d, shelf_life_days: e.target.value }))} placeholder="180" className={numInp} />
              <select value={draft.shelf_life_unit} onChange={e => setDraft(d => ({ ...d, shelf_life_unit: e.target.value as "days" | "months" }))} className="rounded-lg border border-[hsl(var(--tp-hairline))] bg-[hsl(var(--tp-surface-2))] px-2 py-2 text-sm text-[hsl(var(--tp-text))] focus:border-[hsl(var(--tp-gold))] outline-none">
                <option value="days">Days</option>
                <option value="months">Months</option>
              </select>
            </div>
          ) : <p className="text-sm font-medium text-[hsl(var(--tp-text))]">{shelfLife?.shelf_life_days ? `${shelfLife.shelf_life_days} ${shelfLife.shelf_life_unit ?? "days"}` : "—"}</p>}
        </div>
        <div className="tp-surface px-4 py-3">
          <label className={lbl}>pH level</label>
          {canEdit ? (
            <input type="number" step="0.01" value={draft.ph_level} onChange={e => setDraft(d => ({ ...d, ph_level: e.target.value }))} placeholder="4.5" className={numInp} />
          ) : <p className="text-sm font-medium text-[hsl(var(--tp-text))]">{shelfLife?.ph_level ?? "—"}</p>}
        </div>
        <div className="tp-surface px-4 py-3">
          <label className={lbl}>Aw test result</label>
          {canEdit ? (
            <input type="number" step="0.01" value={draft.aw_test_result} onChange={e => setDraft(d => ({ ...d, aw_test_result: e.target.value }))} placeholder="0.87" className={numInp} />
          ) : <p className="text-sm font-medium text-[hsl(var(--tp-text))]">{shelfLife?.aw_test_result ?? "—"}</p>}
        </div>
        <div className="tp-surface px-4 py-3">
          <label className={lbl}>Preservation strategy</label>
          {canEdit ? (
            <input value={draft.preservation_strategy} onChange={e => setDraft(d => ({ ...d, preservation_strategy: e.target.value }))} placeholder="e.g. Modified atmosphere, vacuum sealed…" className={inp} />
          ) : <p className="text-sm font-medium text-[hsl(var(--tp-text))]">{shelfLife?.preservation_strategy || "—"}</p>}
        </div>
        {canEdit && (
          <div className="flex justify-end">
            <button onClick={saveShelfLife} disabled={saving} className="tp-btn tp-btn-primary text-xs disabled:opacity-40">
              {saving ? "Saving…" : shelfLife ? "Update shelf life" : "Save shelf life"}
            </button>
          </div>
        )}
      </div>

      {/* Right: Notes — same height as left */}
      <div className="tp-surface p-4 flex-1 flex flex-col">
        <label className={lbl}>Notes</label>
        {canEdit ? (
          <textarea value={draft.notes} onChange={e => setDraft(d => ({ ...d, notes: e.target.value }))} placeholder="Additional shelf life notes…" className={inp + " resize-none flex-1 min-h-[160px]"} />
        ) : <p className="text-sm font-medium text-[hsl(var(--tp-text))]">{shelfLife?.notes || "—"}</p>}
      </div>
    </div>
  );
};

// ─── Main component ───────────────────────────────────────────────────────────

const SalesProductWorkspace = () => {
  const { leadId, productId } = useParams();
  const { role } = useUserRole();
  const canEdit = role === "admin" || role === "owner" || role === "manager";

  const [prf, setPrf]         = useState<any>(null);
  const [sheet, setSheet]     = useState<any>(null);
  const [shelfLife, setShelfLife] = useState<any>(null);
  const [orders, setOrders]   = useState<any[]>([]);
  const [lead, setLead]       = useState<any>(null);
  const [tab, setTab]         = useState<Tab>("concept");
  const [additives, setAdditives] = useState<{ name: string; pct_of_batch: number }[]>([]);
  const [newAdditiveName, setNewAdditiveName] = useState("");
  const [newAdditivePct, setNewAdditivePct]   = useState("");
  const [draft, setDraft]     = useState<any>({
    allergens: "", description: "",
    primary_type: "", primary_size: "", primary_units: "", primary_specs: "", primary_notes: "",
    secondary_type: "", secondary_size: "", secondary_units: "", secondary_specs: "", secondary_notes: "",
    shipper_type: "", shipper_size: "", shipper_units: "", shipper_specs: "", shipper_notes: "",
    waste_pct: "", max_batches_per_day: "", max_batches_reason: "", aux_materials: "", equipment: "", process_notes: "", internal_notes: "",
  });
  const [saving, setSaving]   = useState(false);

  useEffect(() => { if (productId) loadAll(); }, [productId]);

  const loadAll = async () => {
    const { data: prfData } = await supabase
      .from("prf_submissions").select("*").eq("id", productId!).maybeSingle();
    setPrf(prfData);

    if (leadId) {
      const { data: leadData } = await (supabase as any)
        .from("sales_leads").select("id, profile_id, company_name, email, order_type").eq("id", leadId).maybeSingle();
      setLead(leadData ?? null);
    }

    // Find the latest active batch sheet for this lead, matching product name
    let latest: any = null;
    if (leadId) {
      const { data: byLead } = await (supabase as any)
        .from("batch_sheets").select("*")
        .eq("lead_id", leadId)
        .is("superseded_at", null)
        .order("version", { ascending: false });
      // Match by product name if multiple exist
      const name = (prfData?.product_name || "").toLowerCase().trim();
      latest = (byLead ?? []).find((s: any) =>
        (s.data_json?.product?.name || "").toLowerCase().trim() === name
      ) ?? byLead?.[0] ?? null;
    }
    // Fallbacks: concept_id, then pss_document_id
    if (!latest && prfData?.concept_id) {
      const { data: byConceptId } = await (supabase as any)
        .from("batch_sheets").select("*")
        .eq("concept_id", prfData.concept_id)
        .is("superseded_at", null)
        .order("version", { ascending: false }).limit(1);
      latest = byConceptId?.[0] ?? null;
    }
    if (!latest) {
      const { data: byPssId } = await (supabase as any)
        .from("batch_sheets").select("*")
        .eq("pss_document_id", productId)
        .order("version", { ascending: false }).limit(1);
      latest = byPssId?.[0] ?? null;
    }
    setSheet(latest);

    if (latest) {
      const d = latest.data_json || {};
      setDraft({
        allergens:      d.product?.allergens      ?? "",
        description:    d.product?.description    ?? "",
        primary_type:   d.packaging?.primary?.type   ?? "",
        primary_size:   d.packaging?.primary?.size   ?? "",
        primary_units:  d.packaging?.primary?.units  ?? "",
        primary_specs:  d.packaging?.primary?.specs  ?? "",
        primary_notes:  d.packaging?.primary?.notes  ?? "",
        secondary_type:  d.packaging?.secondary?.type  ?? "",
        secondary_size:  d.packaging?.secondary?.size  ?? "",
        secondary_units: d.packaging?.secondary?.units ?? "",
        secondary_specs: d.packaging?.secondary?.specs ?? "",
        secondary_notes: d.packaging?.secondary?.notes ?? "",
        shipper_type:   d.packaging?.shipper?.type   ?? "",
        shipper_size:   d.packaging?.shipper?.size   ?? "",
        shipper_units:  d.packaging?.shipper?.units  ?? "",
        shipper_specs:  d.packaging?.shipper?.specs  ?? "",
        shipper_notes:  d.packaging?.shipper?.notes  ?? "",
        waste_pct:           d.production_notes?.waste_pct           ?? 10,
        max_batches_per_day: d.production_notes?.max_batches_per_day ?? "",
        max_batches_reason:  d.production_notes?.max_batches_reason  ?? "",
        aux_materials:       d.production_notes?.aux_materials       ?? "",
        equipment:      d.production_notes?.equipment      ?? "",
        process_notes:  d.production_notes?.process_notes  ?? "",
        internal_notes: d.internal_notes ?? "",
      });
      setAdditives(d.production_notes?.production_additives ?? []);
    }

    if (prfData?.concept_id) {
      const { data: sl } = await (supabase as any)
        .from("shelf_life").select("*").eq("concept_id", prfData.concept_id).maybeSingle();
      setShelfLife(sl);
    }

    const { data: orderData } = await (supabase as any)
      .from("production_orders")
      .select("id, order_number, created_at, status, items")
      .order("created_at", { ascending: false });
    setOrders((orderData ?? []).filter((o: any) =>
      Array.isArray(o.items) && o.items.some((i: any) => i.product_id === productId)
    ));
  };

  const save = async (patch: Record<string, any> = {}) => {
    if (!sheet) return;
    setSaving(true);
    const merged = { ...draft, ...patch };
    const d = sheet.data_json || {};
    const { data: { user } } = await supabase.auth.getUser();

    const newJson = {
      ...d,
      product: {
        ...d.product,
        allergens:   merged.allergens,
        description: merged.description,
      },
      packaging: {
        ...d.packaging,
        primary:   { ...d.packaging?.primary,   type: merged.primary_type,   size: merged.primary_size,   units: merged.primary_units,   specs: merged.primary_specs,   notes: merged.primary_notes },
        secondary: { ...d.packaging?.secondary, type: merged.secondary_type, size: merged.secondary_size, units: merged.secondary_units, specs: merged.secondary_specs, notes: merged.secondary_notes },
        shipper:   { ...d.packaging?.shipper,   type: merged.shipper_type,   size: merged.shipper_size,   units: merged.shipper_units,   specs: merged.shipper_specs,   notes: merged.shipper_notes },
      },
      production_notes: {
        waste_pct:             merged.waste_pct,
        max_batches_per_day:   merged.max_batches_per_day !== "" ? Number(merged.max_batches_per_day) : null,
        max_batches_reason:    merged.max_batches_reason,
        aux_materials:         merged.aux_materials,
        equipment:             merged.equipment,
        process_notes:         merged.process_notes,
        production_additives:  additives,
      },
      internal_notes: merged.internal_notes,
    };

    const { error } = await (supabase as any)
      .from("batch_sheets")
      .update({ data_json: newJson, last_edited_by: user?.id ?? null, updated_at: new Date().toISOString() })
      .eq("id", sheet.id);

    setSaving(false);
    if (error) { toast.error(error.message); return; }
    setSheet((s: any) => ({ ...s, data_json: newJson, updated_at: new Date().toISOString() }));
    toast.success("Saved");
  };

  if (!prf) return <TeamPage title="Loading…" eyebrow="Product"><p className="text-sm">Loading…</p></TeamPage>;

  const d = sheet?.data_json || {};
  const ingredients: any[] = (d.recipe?.ingredients ?? []).filter((i: any) => i.name && Number(i.percentage) > 0);
  const totalPct = ingredients.reduce((s: number, i: any) => s + Number(i.percentage || 0), 0);

  return (
    <TeamPage
      eyebrow="Product"
      title={prf.product_name || "(unnamed product)"}
      description={prf.product_approved_at
        ? `Production approved ${new Date(prf.product_approved_at).toLocaleDateString()}`
        : "Not yet approved for production"}
      actions={
        <div className="flex items-center gap-2">
          {sheet && (
            <Link to={`/team/operations/batch-sheets/${sheet.id}?leadId=${leadId}&conceptId=${productId}`} className="tp-btn flex items-center gap-1.5 text-xs">
              <FileText className="w-3.5 h-3.5" /> Batch Sheet
            </Link>
          )}
          <Link to={`/team/sales/clients/${leadId}/projects/${productId}`} className="tp-btn flex items-center gap-1.5 text-xs">
            <ExternalLink className="w-3.5 h-3.5" /> PSS
          </Link>
          {!prf.product_approved_at && canEdit && (
            <button onClick={async () => {
              const now = new Date().toISOString();
              await (supabase as any).from("prf_submissions").update({ product_approved_at: now }).eq("id", productId);
              setPrf((p: any) => ({ ...p, product_approved_at: now }));

              // Seed tolling inventory if client is tolling
              const isTolling = lead?.order_type === "tolling_warehoused" || lead?.order_type === "tolling_external";
              const clientProfileId = lead?.profile_id;
              if (isTolling && clientProfileId && sheet) {
                const ingredients: any[] = (sheet.data_json?.recipe?.ingredients ?? [])
                  .filter((i: any) => i.name && Number(i.percentage) > 0);

                const { data: existing } = await (supabase as any)
                  .from("inventory_tolling").select("ingredient_name").eq("client_id", clientProfileId);
                const existingNames: string[] = (existing ?? []).map((r: any) => r.ingredient_name.toLowerCase().trim());

                const toInsert = ingredients
                  .filter(i => !existingNames.includes(i.name.toLowerCase().trim()))
                  .map(i => ({
                    client_id: clientProfileId,
                    client_name: lead?.company_name || lead?.email || "",
                    ingredient_name: i.name,
                    unit: "lbs",
                    qty_on_hand: 0,
                  }));

                if (toInsert.length > 0) {
                  await (supabase as any).from("inventory_tolling").insert(toInsert);
                  toast.success(`Approved — ${toInsert.length} ingredient${toInsert.length !== 1 ? "s" : ""} added to client inventory`);
                } else {
                  toast.success("Approved for production — ingredients already in inventory");
                }
              } else {
                toast.success("Approved for production");
              }
            }} className="tp-btn tp-btn-primary flex items-center gap-1.5">
              <ShieldCheck className="w-4 h-4" /> Approve for Production
            </button>
          )}
          <Link to={`/team/sales/clients/${leadId}`} className="tp-btn">
            <ArrowLeft className="w-4 h-4" /> Back to client
          </Link>
        </div>
      }
    >
      {/* Tab bar — base tabs always shown; production tabs appear once approved */}
      <div className="tp-surface mb-4 flex flex-wrap gap-1 p-1.5">
        {BASE_TABS.map(t => (
          <button key={t.id} onClick={() => setTab(t.id)}
            className={`px-3 py-1.5 text-xs rounded-md font-medium transition-colors
              ${tab === t.id ? "bg-[hsl(var(--tp-gold))] text-white" : "text-[hsl(var(--tp-text-dim))] hover:text-[hsl(var(--tp-text))]"}`}>
            {t.label}
          </button>
        ))}
        {prf.product_approved_at && (
          <>
            <span className="w-px bg-[hsl(var(--tp-hairline))] mx-1 self-stretch" />
            {PRODUCTION_TABS.map(t => (
              <button key={t.id} onClick={() => setTab(t.id)}
                className={`px-3 py-1.5 text-xs rounded-md font-medium transition-colors
                  ${tab === t.id ? "bg-[hsl(var(--tp-gold))] text-white" : "text-[hsl(var(--tp-text-dim))] hover:text-[hsl(var(--tp-text))]"}`}>
                {t.label}
              </button>
            ))}
          </>
        )}
      </div>

      {sheet && (
        <p className="text-xs font-medium text-white mb-3">
          Batch sheet v{sheet.version} · <span className="capitalize">{sheet.status}</span>
          {sheet.updated_at && ` · Last updated ${new Date(sheet.updated_at).toLocaleDateString()}`}
        </p>
      )}

      {/* CONCEPT — two columns */}
      {tab === "concept" && (
        <div className="grid grid-cols-[2fr_1fr] gap-4 items-start">
          {/* Left: Product name, specs, description */}
          <div className="space-y-3">
            <div className="tp-surface px-4 py-3">
              <p className="text-[10px] uppercase tracking-[0.14em] text-[hsl(var(--tp-text-dim))] mb-1">Product name</p>
              <p className="text-sm font-semibold text-[hsl(var(--tp-text))]">{prf.product_name || "—"}</p>
            </div>
            {sheet && (
              <div className="tp-surface px-4 py-3 space-y-1.5">
                <p className="text-[10px] uppercase tracking-[0.14em] text-[hsl(var(--tp-text-dim))] mb-1">Specs</p>
                {d.product?.target_unit_weight_raw && (
                  <p className="text-sm text-[hsl(var(--tp-text))]">
                    <span className="text-[hsl(var(--tp-text-dim))]">Unit weight · </span>
                    {d.product.target_unit_weight_raw} {d.product.weight_unit ?? "g"}
                  </p>
                )}
                {shelfLife?.storage_condition && (
                  <p className="text-sm text-[hsl(var(--tp-text))]">
                    <span className="text-[hsl(var(--tp-text-dim))]">Storage · </span>
                    {shelfLife.storage_condition}
                  </p>
                )}
                {shelfLife?.shelf_life_days && (
                  <p className="text-sm text-[hsl(var(--tp-text))]">
                    <span className="text-[hsl(var(--tp-text-dim))]">Shelf life · </span>
                    {shelfLife.shelf_life_days} {shelfLife.shelf_life_unit ?? "days"}
                  </p>
                )}
              </div>
            )}
            <div className="tp-surface p-4">
              <Field label="Product description" value={draft.description} canEdit={canEdit} multiline rows={4} saving={saving}
                placeholder="e.g. Vegan meat alternative, plant-based, positioned for retail…"
                onChange={v => setDraft((d: any) => ({ ...d, description: v }))}
                onSave={() => save({ description: draft.description })} />
            </div>
          </div>

          {/* Right: Formula version, Approved, Allergens */}
          <div className="space-y-3">
            <div className="tp-surface px-4 py-2.5 flex items-center gap-2">
              <span className="text-[10px] uppercase tracking-[0.14em] text-[hsl(var(--tp-text-dim))]">Formula version</span>
              <span className="text-sm font-semibold text-[hsl(var(--tp-text))]">{sheet ? `v${sheet.version}` : "—"}</span>
            </div>
            <div className="tp-surface px-4 py-2.5 flex items-center gap-2">
              <span className="text-[10px] uppercase tracking-[0.14em] text-[hsl(var(--tp-text-dim))]">Approved</span>
              <span className="text-sm font-semibold text-[hsl(var(--tp-text))]">{prf.product_approved_at ? new Date(prf.product_approved_at).toLocaleDateString() : "Not yet"}</span>
            </div>
            <div className="tp-surface p-4">
              <Field label="Allergens" value={draft.allergens} canEdit={canEdit} saving={saving}
                placeholder="e.g. Free of top 9 allergens, contains sesame…"
                onChange={v => setDraft((d: any) => ({ ...d, allergens: v }))}
                onSave={() => save({ allergens: draft.allergens })} />
              {sheet && ingredients.length > 0 && (() => {
                const detected = detectAllergens(ingredients);
                if (!detected) return null;
                return (
                  <div className="mt-2 flex items-center gap-2 flex-wrap">
                    <span className="text-xs text-[hsl(var(--tp-text-dim))]">Detected:</span>
                    <span className="text-xs font-medium text-amber-700 bg-amber-50 border border-amber-200 rounded-full px-2 py-0.5">{detected}</span>
                    {!draft.allergens && (
                      <button onClick={() => setDraft((d: any) => ({ ...d, allergens: detected }))}
                        className="text-xs text-[hsl(var(--tp-gold))] hover:underline">Use →</button>
                    )}
                  </div>
                );
              })()}
            </div>
          </div>
        </div>
      )}

      {tab !== "concept" && tab !== "packaging" && tab !== "shelf_life" && tab !== "production_notes" && tab !== "costing" && <div className={`tp-surface p-6 ${tab === "formula" ? "max-w-sm" : ""}`}>

        {/* FORMULA */}
        {tab === "formula" && (
          <div>
            {sheet && (
              <p className="text-xs font-medium text-[hsl(var(--tp-text-muted))] mb-4 pb-3 border-b border-[hsl(var(--tp-hairline))]">
                v{sheet.version} · {new Date(sheet.updated_at).toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" })}
                {" · "}To modify this formula, go to the batch sheet and create a new version.
              </p>
            )}
            {!sheet && <p className="text-sm text-[hsl(var(--tp-text))]">No batch sheet found for this product.</p>}
            {sheet && ingredients.length === 0 && <p className="text-sm text-[hsl(var(--tp-text))]">No ingredients on the batch sheet yet.</p>}
            {sheet && ingredients.length > 0 && (
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-[hsl(var(--tp-hairline))]">
                    <th className="text-left py-2 text-[11px] uppercase tracking-wider text-[hsl(var(--tp-text))] font-bold">Ingredient</th>
                    <th className="text-right py-2 text-[11px] uppercase tracking-wider text-[hsl(var(--tp-text))] font-bold">%</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[hsl(var(--tp-hairline))]">
                  {ingredients.map((ing: any, i: number) => (
                    <tr key={i}>
                      <td className="py-2.5 text-[hsl(var(--tp-text))]">{ing.name}</td>
                      <td className="py-2.5 text-right font-medium text-[hsl(var(--tp-text))]">{Number(ing.percentage).toFixed(2)}%</td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="border-t-2 border-[hsl(var(--tp-hairline))]">
                    <td className="py-2 text-xs font-bold text-[hsl(var(--tp-text))]">Total</td>
                    <td className={`py-2 text-right font-bold text-sm ${Math.abs(totalPct - 100) > 0.1 ? "text-amber-600" : "text-[hsl(var(--tp-text))]"}`}>
                      {totalPct.toFixed(2)}%
                    </td>
                  </tr>
                </tfoot>
              </table>
            )}
          </div>
        )}

        {/* PACKAGING */}



        {/* ORDER HISTORY */}
        {tab === "order_history" && (
          <div>
            {orders.length === 0
              ? <p className="text-sm italic text-[hsl(var(--tp-text-dim))]">No orders for this product yet.</p>
              : (
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-[hsl(var(--tp-hairline))]">
                      {["Date", "Order #", "Qty ordered", "Status", ""].map(h => (
                        <th key={h} className="text-left py-2 text-[11px] uppercase tracking-wider text-[hsl(var(--tp-text))] font-bold">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[hsl(var(--tp-hairline))]">
                    {orders.map((o: any) => {
                      const item = o.items?.find((i: any) => i.product_id === productId);
                      return (
                        <tr key={o.id}>
                          <td className="py-2.5 text-[hsl(var(--tp-text))]">{new Date(o.created_at).toLocaleDateString()}</td>
                          <td className="py-2.5 text-[hsl(var(--tp-text))]">{o.order_number ?? "—"}</td>
                          <td className="py-2.5 text-[hsl(var(--tp-text))]">{item ? `${item.qty} ${item.unit}` : "—"}</td>
                          <td className="py-2.5 text-[hsl(var(--tp-text))]">{o.status}</td>
                          <td className="py-2.5">
                            <Link to={`/team/ops/orders/${o.id}`} className="text-xs text-[hsl(var(--tp-gold))] hover:underline">View →</Link>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              )
            }
          </div>
        )}

        {/* NOTES */}
        {tab === "notes" && (
          <Field label="Internal notes" value={draft.internal_notes} canEdit={canEdit} multiline rows={6} saving={saving}
            placeholder="Internal notes about this product…"
            onChange={v => setDraft((d: any) => ({ ...d, internal_notes: v }))}
            onSave={() => save({ internal_notes: draft.internal_notes })} />
        )}

      </div>}

      {tab === "packaging" && (
        <div className="grid grid-cols-3 gap-4 items-start">
          {(["primary", "secondary", "shipper"] as const).map((level) => (
            <div key={level} className="tp-surface p-4">
              <PackagingLevel level={level} draft={draft} canEdit={canEdit} saving={saving}
                setDraft={setDraft} onSave={() => save(draft)} />
            </div>
          ))}
        </div>
      )}

      {tab === "shelf_life" && (
        <ShelfLifeTab
          shelfLife={shelfLife}
          canEdit={canEdit}
          conceptId={prf?.concept_id}
          onSaved={sl => setShelfLife(sl)}
        />
      )}

      {tab === "costing" && (
        <div className="tp-surface p-8 flex flex-col items-center justify-center text-center gap-3 min-h-[240px]">
          <p className="text-2xl">📊</p>
          <p className="text-sm font-semibold text-[hsl(var(--tp-text))]">Costing — Coming Soon</p>
          <p className="text-sm text-[hsl(var(--tp-text-dim))] max-w-xs">
            Ingredient costs, labor, packaging, and margin analysis will live here as pricing data becomes available.
          </p>
        </div>
      )}

      {tab === "production_notes" && (
        <div className="flex gap-4 items-stretch">
          {/* Left: Waste factor, Aux materials, Equipment, Production additives */}
          <div className="space-y-3 flex-1">
            <div className="tp-surface px-4 py-3">
              <p className="text-[11px] uppercase tracking-wider font-bold text-[hsl(var(--tp-text))] mb-1.5">Waste factor (%)</p>
              {canEdit ? (
                <div className="flex items-center gap-3">
                  <input type="number" min={0} max={100}
                    value={String(draft.waste_pct)}
                    onChange={e => setDraft((d: any) => ({ ...d, waste_pct: e.target.value }))}
                    placeholder="10"
                    className="rounded-lg border border-[hsl(var(--tp-hairline))] bg-[hsl(var(--tp-surface-2))] px-3 py-2 text-sm text-[hsl(var(--tp-text))] text-right focus:border-[hsl(var(--tp-gold))] outline-none w-24" />
                  <span className="text-sm text-[hsl(var(--tp-text-dim))]">%</span>
                  <button onClick={() => save({ waste_pct: draft.waste_pct })} disabled={saving}
                    className="tp-btn tp-btn-primary text-xs disabled:opacity-40">
                    {saving ? "Saving…" : "Save"}
                  </button>
                </div>
              ) : <p className="text-sm text-[hsl(var(--tp-text))]">{draft.waste_pct ? `${draft.waste_pct}%` : "—"}</p>}
            </div>

            <div className="tp-surface px-4 py-3">
              <p className="text-[11px] uppercase tracking-wider font-bold text-[hsl(var(--tp-text))] mb-1.5">Max batches per day</p>
              {canEdit ? (
                <div className="flex flex-col gap-2">
                  <div className="flex items-center gap-3">
                    <input type="number" min={1}
                      value={String(draft.max_batches_per_day)}
                      onChange={e => setDraft((d: any) => ({ ...d, max_batches_per_day: e.target.value }))}
                      placeholder="e.g. 2"
                      className="rounded-lg border border-[hsl(var(--tp-hairline))] bg-[hsl(var(--tp-surface-2))] px-3 py-2 text-sm text-[hsl(var(--tp-text))] text-right focus:border-[hsl(var(--tp-gold))] outline-none w-24" />
                    <span className="text-sm text-[hsl(var(--tp-text-dim))]">batches / day</span>
                  </div>
                  <input type="text"
                    value={draft.max_batches_reason}
                    onChange={e => setDraft((d: any) => ({ ...d, max_batches_reason: e.target.value }))}
                    placeholder="Reason — e.g. 140Q mixer capacity"
                    className="rounded-lg border border-[hsl(var(--tp-hairline))] bg-[hsl(var(--tp-surface-2))] px-3 py-2 text-sm text-[hsl(var(--tp-text))] focus:border-[hsl(var(--tp-gold))] outline-none w-full" />
                  <button onClick={() => save({ max_batches_per_day: draft.max_batches_per_day, max_batches_reason: draft.max_batches_reason })} disabled={saving}
                    className="tp-btn tp-btn-primary text-xs self-start disabled:opacity-40">
                    {saving ? "Saving…" : "Save"}
                  </button>
                </div>
              ) : (
                <div>
                  <p className="text-sm text-[hsl(var(--tp-text))]">{draft.max_batches_per_day ? `${draft.max_batches_per_day} batches / day` : "—"}</p>
                  {draft.max_batches_reason && <p className="text-xs text-[hsl(var(--tp-text-dim))] mt-0.5">{draft.max_batches_reason}</p>}
                </div>
              )}
            </div>

            <div className="tp-surface p-4">
              <Field label="Auxiliary materials" value={draft.aux_materials} canEdit={canEdit} multiline saving={saving}
                placeholder="e.g. Parchment paper, silicone mats, gloves…"
                onChange={v => setDraft((d: any) => ({ ...d, aux_materials: v }))}
                onSave={() => save({ aux_materials: draft.aux_materials })} />
            </div>

            <div className="tp-surface p-4">
              <Field label="Equipment — stage it is used" value={draft.equipment} canEdit={canEdit} multiline saving={saving}
                placeholder="e.g. 60 qt Hobart mixer, deck oven, proofer…"
                onChange={v => setDraft((d: any) => ({ ...d, equipment: v }))}
                onSave={() => save({ equipment: draft.equipment })} />
            </div>

            <div className="tp-surface p-4">
              <p className="text-[11px] uppercase tracking-wider font-bold text-[hsl(var(--tp-text))] mb-2">Production additives</p>
              <p className="text-xs text-[hsl(var(--tp-text-dim))] mb-3">Not in the client formula. Added on the measuring card as needed.</p>
              {additives.length > 0 && (
                <div className="mb-3 divide-y divide-[hsl(var(--tp-hairline))] border border-[hsl(var(--tp-hairline))] rounded-lg overflow-hidden">
                  {additives.map((a, i) => (
                    <div key={i} className="flex items-center justify-between px-3 py-2.5 bg-[hsl(var(--tp-surface-2))]">
                      <span className="text-sm font-medium text-[hsl(var(--tp-text))]">{a.name}</span>
                      <div className="flex items-center gap-3">
                        <span className="text-sm text-[hsl(var(--tp-text-dim))]">{a.pct_of_batch}% of batch</span>
                        {canEdit && (
                          <button onClick={() => { const u = additives.filter((_, idx) => idx !== i); setAdditives(u); save({}); }}
                            className="text-xs text-red-500 hover:text-red-700">Remove</button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
              {canEdit && (
                <div className="flex gap-2 items-end">
                  <div className="flex-1">
                    <p className="text-[10px] uppercase tracking-wider text-[hsl(var(--tp-text-dim))] mb-1">Name</p>
                    <input value={newAdditiveName} onChange={e => setNewAdditiveName(e.target.value)} placeholder="e.g. Water"
                      className="w-full rounded-lg border border-[hsl(var(--tp-hairline))] bg-[hsl(var(--tp-surface-2))] px-3 py-2 text-sm text-[hsl(var(--tp-text))] focus:border-[hsl(var(--tp-gold))] outline-none" />
                  </div>
                  <div style={{ width: "110px" }}>
                    <p className="text-[10px] uppercase tracking-wider text-[hsl(var(--tp-text-dim))] mb-1">% of batch</p>
                    <input type="number" min={0} max={100} step={0.1} value={newAdditivePct} onChange={e => setNewAdditivePct(e.target.value)} placeholder="5"
                      className="w-full rounded-lg border border-[hsl(var(--tp-hairline))] bg-[hsl(var(--tp-surface-2))] px-3 py-2 text-sm text-[hsl(var(--tp-text))] text-right focus:border-[hsl(var(--tp-gold))] outline-none" />
                  </div>
                  <button onClick={() => {
                    if (!newAdditiveName.trim() || !newAdditivePct) return;
                    const u = [...additives, { name: newAdditiveName.trim(), pct_of_batch: parseFloat(newAdditivePct) }];
                    setAdditives(u); setNewAdditiveName(""); setNewAdditivePct(""); save({});
                  }} className="tp-btn tp-btn-primary text-xs shrink-0">Add</button>
                </div>
              )}
            </div>
          </div>

          {/* Right: Process notes — full height */}
          <div className="tp-surface p-4 flex-1 flex flex-col">
            <p className="text-[11px] uppercase tracking-wider font-bold text-[hsl(var(--tp-text))] mb-1.5">Process notes</p>
            {canEdit ? (
              <>
                <textarea
                  value={draft.process_notes}
                  onChange={e => setDraft((d: any) => ({ ...d, process_notes: e.target.value }))}
                  placeholder="Step modifications, temperature adjustments, timing notes…"
                  className="flex-1 min-h-[200px] w-full rounded-lg border border-[hsl(var(--tp-hairline))] bg-[hsl(var(--tp-surface-2))] px-3 py-2 text-sm text-[hsl(var(--tp-text))] focus:border-[hsl(var(--tp-gold))] outline-none resize-none" />
                <button onClick={() => save({ process_notes: draft.process_notes })} disabled={saving}
                  className="mt-2 tp-btn tp-btn-primary text-xs self-end disabled:opacity-40">
                  {saving ? "Saving…" : "Save"}
                </button>
              </>
            ) : <p className="text-sm text-[hsl(var(--tp-text))]">{draft.process_notes || "—"}</p>}
          </div>
        </div>
      )}
    </TeamPage>
  );
};

export default SalesProductWorkspace;
