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
      const { data } = await supabase.from("prf_submissions").select("*").eq("id", prfId).maybeSingle();
      setPrf(data);

      // `prf_submissions` declares no foreign keys, so PostgREST cannot embed
      // these via `select("*, sales_leads(...)")` — that needs a real FK. Fetch
      // each separately, in parallel, and tolerate individual failures.
      if (data) {
        const [lead, owner, concept] = await Promise.all([
          data.lead_id
            ? (supabase as any).from("sales_leads")
                .select("id, company_name, contact_name, email, phone, archived_at")
                .eq("id", data.lead_id).maybeSingle()
            : Promise.resolve({ data: null }),
          data.owner_user_id
            ? (supabase as any).from("profiles")
                .select("id, full_name, email")
                .eq("id", data.owner_user_id).maybeSingle()
            : Promise.resolve({ data: null }),
          data.concept_id
            ? (supabase as any).from("concepts")
                .select("id, product_name, status")
                .eq("id", data.concept_id).maybeSingle()
            : Promise.resolve({ data: null }),
        ]);
        setRelated({ lead: lead?.data ?? null, owner: owner?.data ?? null, concept: concept?.data ?? null });
      } else {
        setRelated({});
      }

      // mark as 'reviewing' if currently 'new'
      if (data && data.status === "new") {
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
