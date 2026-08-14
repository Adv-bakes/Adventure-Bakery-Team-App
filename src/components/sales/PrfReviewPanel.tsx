import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { supabase } from "@/integrations/supabase/client";
import { X, Download, FileText } from "lucide-react";
import { toast } from "sonner";
import { generatePrfPdf } from "@/lib/prfPdf";
import { buildPrfSections, prfAttachment, type PrfRelated } from "@/lib/prfFields";

interface Props {
  prfId: string | null;
  onClose: () => void;
}

const Field = ({ label, value, block, mono }: { label: string; value: string; block?: boolean; mono?: boolean }) => (
  <div className="grid grid-cols-3 gap-3 py-2 border-b border-[hsl(var(--tp-hairline))]">
    <p className="text-[11px] uppercase tracking-wider text-[hsl(var(--tp-text-dim))]">{label}</p>
    <p
      className={`col-span-2 text-sm break-words whitespace-pre-line ${
        mono ? "font-mono text-xs text-[hsl(var(--tp-text-dim))]" : "text-[hsl(var(--tp-text))]"
      } ${block ? "leading-relaxed" : ""}`}
    >
      {value}
    </p>
  </div>
);

export const PrfReviewPanel = ({ prfId, onClose }: Props) => {
  const [prf, setPrf] = useState<any>(null);
  const [related, setRelated] = useState<PrfRelated>({});
  const [loading, setLoading] = useState(false);
  // Must stay above the `if (!prfId) return null` below — declaring it after that
  // early return changes the hook count when the panel opens, which crashes React.
  const [downloading, setDownloading] = useState(false);

  useEffect(() => {
    if (!prfId) { setPrf(null); setRelated({}); return; }
    setLoading(true);
    (async () => {
      // One round trip: the related rows come back embedded. This relies on the
      // foreign keys added in migration 20260814000001 — PostgREST resolves
      // embeds from declared FKs, and without them this request fails outright
      // with PGRST200 ("could not find a relationship"), it does not silently
      // degrade. Each embed is many-to-one, so it returns an object or null.
      const { data, error } = await (supabase as any)
        .from("prf_submissions")
        .select(
          "*," +
          "sales_leads(id, company_name, contact_name, email, phone, archived_at)," +
          "profiles(id, full_name, email)," +
          "concepts(id, product_name, status)"
        )
        .eq("id", prfId)
        .maybeSingle();

      if (error || !data) {
        if (error) console.error("[PrfReviewPanel] load failed", error);
        setPrf(null);
        setRelated({});
        setLoading(false);
        return;
      }

      // Keep the embedded rows out of `prf` so the row stays a clean
      // prf_submissions record for buildPrfSections().
      const { sales_leads, profiles, concepts, ...row } = data;
      setPrf(row);
      setRelated({ lead: sales_leads ?? null, owner: profiles ?? null, concept: concepts ?? null });

      // mark as 'reviewing' if currently 'new'
      if (row.status === "new") {
        await supabase.from("prf_submissions").update({ status: "reviewing" }).eq("id", prfId);
      }
      setLoading(false);
    })();
  }, [prfId]);

  if (!prfId) return null;

  const downloadPdf = async () => {
    if (!prf || downloading) return;
    setDownloading(true);
    try {
      await generatePrfPdf(prf, related);
    } finally {
      setDownloading(false);
    }
  };

  /** The original PRF document uploaded with the deal (data_json.prf_file). */
  const attachment = prf ? prfAttachment(prf) : null;
  const openAttachment = async () => {
    if (!attachment) return;
    const { data, error } = await supabase.storage
      .from("prf-uploads")
      .createSignedUrl(attachment.path, 60);
    if (error || !data?.signedUrl) {
      toast.error("Could not open the attached file");
      return;
    }
    window.open(data.signedUrl, "_blank", "noopener,noreferrer");
  };

  const sections = prf ? buildPrfSections(prf, related) : [];

  // Portalled to <body> on purpose: TeamPage wraps every page in `.tp-fade-up`,
  // whose animation has `fill-mode: both` and so retains a transform. A
  // transformed ancestor becomes the containing block for `position: fixed`
  // descendants, which would clip this overlay to the page wrapper instead of
  // the viewport. `team-portal` stays for the --tp-* vars, but its near-black
  // background is overridden — the translucent scrim below is the backdrop.
  return createPortal(
    <div
      className="fixed inset-0 z-50 team-portal"
      style={{ background: "transparent" }}
      onClick={onClose}
    >
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />
      <div
        onClick={(e) => e.stopPropagation()}
        className="absolute right-0 top-0 h-full w-full max-w-[680px] tp-surface border-l border-[hsl(var(--tp-hairline))] overflow-y-auto"
      >
        <div className="sticky top-0 z-10 flex items-center justify-between px-6 py-4 border-b border-[hsl(var(--tp-hairline))] bg-[hsl(var(--tp-surface))]/95 backdrop-blur">
          <div>
            <p className="text-[10px] uppercase tracking-[0.18em] text-[hsl(var(--tp-text-dim))]">PRF Review</p>
            <h2 className="font-display text-lg text-[hsl(var(--tp-text))]">
              {prf?.company_name || prf?.product_name || "Loading…"}
            </h2>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={downloadPdf} disabled={downloading || !prf} className="tp-btn">
              <Download className="w-3.5 h-3.5" />
              {downloading ? "Preparing…" : "Download"}
            </button>
            <button onClick={onClose} className="tp-btn" aria-label="Close"><X className="w-4 h-4" /></button>
          </div>
        </div>
        <div className="p-6">
          {loading && <p className="text-sm text-[hsl(var(--tp-text-dim))]">Loading…</p>}

          {!loading && prf && attachment && (
            <button
              onClick={openAttachment}
              className="tp-btn w-full justify-start mb-5"
              title={attachment.name}
            >
              <FileText className="w-3.5 h-3.5 shrink-0" />
              <span className="truncate">Open attached PRF — {attachment.name}</span>
            </button>
          )}

          {!loading && prf && sections.map((sec) => (
            <section key={sec.heading} className="mb-6 last:mb-0">
              <p className="text-[10px] uppercase tracking-[0.18em] text-[hsl(var(--tp-gold))] mb-1.5">
                {sec.heading}
              </p>
              {sec.rows.map((row) => (
                <Field key={row.label} label={row.label} value={row.value} block={row.block} mono={row.mono} />
              ))}
            </section>
          ))}

          {!loading && !prf && (
            <p className="text-sm text-[hsl(var(--tp-text-dim))]">
              This PRF could not be loaded. It may have been deleted.
            </p>
          )}
        </div>
      </div>
    </div>,
    document.body
  );
};
