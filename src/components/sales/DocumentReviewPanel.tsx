import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { X, Check, AlertTriangle, Sparkles, Download, Copy, ExternalLink } from "lucide-react";
import { readDocumentForReview, needsClientRead, UnreadableDocumentError } from "@/lib/clientDocRead";

const mimeForExt = (name: string): string => {
  const ext = (name.split(".").pop() || "").toLowerCase();
  if (ext === "pdf") return "application/pdf";
  if (ext === "xlsx") return "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";
  if (ext === "xls") return "application/vnd.ms-excel";
  if (ext === "png") return "image/png";
  if (ext === "jpg" || ext === "jpeg") return "image/jpeg";
  return "application/octet-stream";
};

const openAsBlob = async (url: string, name: string) => {
  try {
    const res = await fetch(url);
    if (!res.ok) throw new Error(`Open failed (${res.status})`);
    const buf = await res.arrayBuffer();
    const blob = new Blob([buf], { type: mimeForExt(name) });
    const blobUrl = URL.createObjectURL(blob);
    window.open(blobUrl, "_blank", "noopener,noreferrer");
    setTimeout(() => URL.revokeObjectURL(blobUrl), 60_000);
  } catch (e: any) {
    toast.error(e?.message || "Could not open — try the direct link instead");
  }
};

interface Props {
  documentId: string | null;
  onClose: () => void;
  onDecided?: () => void;
  /**
   * Kick off the AI review as soon as the document and its signed URL have loaded, without
   * waiting for a click. Used when the panel is opened straight off an upload -- the reviewer
   * is going to press the button anyway, and the read has to wait for the signed URL either way.
   * Only ever fires for a document that has no verdict yet.
   */
  autoRunAI?: boolean;
  /**
   * Approving a PSS normally sends the reviewer to the client folder "so they land in context".
   * That is right from the Documents Inbox, but wrong when the panel was opened from inside the
   * project workspace -- the reviewer is already somewhere more specific, and navigating would
   * throw that away. Callers already in context pass false.
   */
  redirectAfterPssApproval?: boolean;
}

export const DocumentReviewPanel = ({
  documentId,
  onClose,
  onDecided,
  autoRunAI,
  redirectAfterPssApproval = true,
}: Props) => {
  const navigate = useNavigate();
  const [doc, setDoc] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [reviewing, setReviewing] = useState(false);
  const [signedUrl, setSignedUrl] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [provider, setProvider] = useState<{ provider: string; model: string } | null>(null);
  const [showRaw, setShowRaw] = useState(false);

  useEffect(() => {
    if (!documentId) { setDoc(null); setSignedUrl(null); return; }
    (async () => {
      setLoading(true);
      const { data } = await supabase
        .from("client_documents")
        .select("*")
        .eq("id", documentId)
        .maybeSingle();
      setDoc(data);
      if (data?.file_path) {
        const { data: signed } = await supabase.storage
          .from("product-spec-sheets")
          .createSignedUrl(data.file_path, 600);
        setSignedUrl(signed?.signedUrl || null);
      }
      setLoading(false);
    })();
  }, [documentId]);

  const runAI = async () => {
    if (!documentId) return;
    setReviewing(true);

    // PDFs and Word files are read here, not in the edge function: pdf.js needs a canvas to
    // rasterize a scanned page, and both parsers already ship on the client.
    let docPayload: { doc_text?: string; doc_images?: string[] } = {};
    const name = (doc?.file_name || doc?.file_path || "");
    if (needsClientRead(name)) {
      if (!signedUrl) {
        setReviewing(false);
        return toast.error("Still preparing the file — try again in a moment.");
      }
      try {
        const buf = await (await fetch(signedUrl)).arrayBuffer();
        const read = await readDocumentForReview(buf, name);
        if (read.scanned) {
          if (read.pageImages.length === 0) {
            setReviewing(false);
            return toast.error("This PDF has no readable text and no pages could be rendered.");
          }
          docPayload = { doc_images: read.pageImages };
          toast.info(
            `Scanned document — reading ${read.pageImages.length} page${read.pageImages.length === 1 ? "" : "s"} visually.` +
              (read.droppedPages > 0 ? ` First ${read.pageImages.length} of ${read.pageCount} pages only.` : ""),
          );
        } else {
          docPayload = { doc_text: read.text };
        }
      } catch (e) {
        setReviewing(false);
        const message = e instanceof Error ? e.message : "unknown error";
        return toast.error(
          e instanceof UnreadableDocumentError ? message : `Could not read the document: ${message}`,
        );
      }
    }

    const { error, data } = await supabase.functions.invoke("review-client-document", {
      body: { document_id: documentId, ...docPayload },
    });
    setReviewing(false);
    if (error) return toast.error(error.message || "AI review failed");
    if (data?.error) return toast.error(data.error);
    if (data?.provider) setProvider({ provider: data.provider, model: data.model });
    toast.success("AI review complete");
    // Refresh
    const { data: fresh } = await supabase
      .from("client_documents")
      .select("*")
      .eq("id", documentId)
      .maybeSingle();
    setDoc(fresh);
  };

  // A ref, not state, is what holds this to one call per document: StrictMode double-invokes
  // effects, and `doc` and `signedUrl` arrive in separate renders, so this effect legitimately
  // runs several times before the review is allowed to start.
  const autoRanFor = useRef<string | null>(null);
  useEffect(() => {
    if (!autoRunAI || !documentId || loading || reviewing) return;
    if (!doc || !signedUrl) return; // runAI reads the file through the signed URL
    if (autoRanFor.current === documentId) return;
    const notes = doc.review_notes;
    if (notes && Object.keys(notes).length > 0) return; // already has a verdict; leave it alone
    autoRanFor.current = documentId;
    runAI();
    // runAI is deliberately not a dependency -- it closes over state that changes on every
    // render, and the ref guard above is what makes this run once.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoRunAI, documentId, loading, reviewing, doc, signedUrl]);

  const decide = async (status: "approved" | "rejected") => {
    if (!documentId || !doc) return;
    setBusy(true);

    const { error } = await supabase
      .from("client_documents")
      .update({
        review_status: status,
        reviewed_at: new Date().toISOString(),
      })
      .eq("id", documentId);

    if (error) {
      setBusy(false);
      return toast.error(error.message);
    }

    // PSS approved → kick off batch sheet generation, and check if both NDA+PSS approved for this user → advance stage
    const docType = (doc.document_type || "").toLowerCase();
    let batchSheetId: string | null = null;
    if (status === "approved" && docType === "pss") {
      const { error: bsErr, data: bsData } = await supabase.functions.invoke("generate-batch-sheet-from-pss", {
        body: { pss_document_id: documentId },
      });
      if (bsErr) toast.warning("PSS approved but batch sheet draft failed — you can retry from the project.");
      else batchSheetId = (bsData as any)?.batch_sheet?.id || null;
    }

    if (status === "approved" && doc.lead_id) {
      // Always log per-doc approval
      await supabase.from("client_activity").insert({
        client_id: doc.user_id,
        action: `${docType}_approved`,
        payload: { document_id: documentId, file_name: doc.file_name },
      });

      // Check if this client has an approved NDA AND approved PSS
      const { data: clientDocs } = await (supabase as any)
        .from("client_documents")
        .select("document_type, review_status")
        .eq("lead_id", doc.lead_id);
      const approved = (clientDocs || []).filter((d: any) => d.review_status === "approved");
      const hasNda = approved.some((d: any) => (d.document_type || "").toLowerCase() === "nda");
      const hasPss = approved.some((d: any) => (d.document_type || "").toLowerCase() === "pss");
      // include the one we just approved (in case the read raced)
      const justNda = docType === "nda";
      const justPss = docType === "pss";
      if ((hasNda || justNda) && (hasPss || justPss)) {
        await (supabase as any)
          .from("sales_leads")
          .update({ stage: "Follow-Up", stage_updated_at: new Date().toISOString() })
          .eq("id", doc.lead_id)
          .eq("stage", "Send Documents");
        await supabase.from("client_activity").insert({
          client_id: doc.user_id,
          action: "documents_completed",
          payload: { trigger_doc_id: documentId },
        });
        toast.success("Both docs approved — moved to Follow-Up");
      } else {
        toast.success(`${docType.toUpperCase()} approved`);
      }
    } else if (status === "rejected") {
      if (doc.user_id) {
        await supabase.from("client_activity").insert({
          client_id: doc.user_id,
          action: `${docType}_rejected`,
          payload: { document_id: documentId, file_name: doc.file_name },
        });
      }
      toast.success("Document rejected — client can resubmit");
    }

    setBusy(false);
    onDecided?.();
    onClose();

    // Navigate to the client folder after PSS approval so the salesperson lands in context.
    // Skipped when the caller is already in a more specific place (see redirectAfterPssApproval).
    if (status === "approved" && docType === "pss" && !redirectAfterPssApproval) {
      if (batchSheetId) toast.success("Batch sheet v1 created.");
    } else if (status === "approved" && docType === "pss" && doc.lead_id) {
      navigate(`/team/sales/clients/${doc.lead_id}`);
      if (batchSheetId) toast.success(`Batch sheet v1 created — open it from the project workspace.`);
    } else if (status === "approved" && docType === "pss") {
      toast.info("Approved, but no client folder linked to this document yet.");
    }
  };

  if (!documentId) return null;

  const notes = doc?.review_notes || {};
  const docType = (doc?.document_type || "").toLowerCase();
  const status = doc?.review_status;

  // Portalled to <body>: TeamPage wraps pages in `.tp-fade-up`, whose animation
  // keeps a transform (fill-mode: both), and a transformed ancestor becomes the
  // containing block for `position: fixed` — which would clip this to the page
  // wrapper. `team-portal` stays for the --tp-* vars; its near-black background
  // is overridden so the translucent scrim below is what dims the page.
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
          <div className="min-w-0">
            <p className="text-[10px] uppercase tracking-[0.18em] text-[hsl(var(--tp-text-dim))]">
              Document review · {docType.toUpperCase()}
            </p>
            <h2 className="font-display text-lg text-[hsl(var(--tp-text))] truncate">
              {doc?.file_name || doc?.file_path || "Loading…"}
            </h2>
          </div>
          <div className="flex items-center gap-2">
            {signedUrl && (
              <>
                <button
                  onClick={() => openAsBlob(signedUrl, doc?.file_name || "file")}
                  className="tp-btn"
                  title="Open in a new tab with the correct file type"
                >
                  <ExternalLink className="w-3.5 h-3.5" /> View
                </button>
                <a href={signedUrl} target="_blank" rel="noreferrer" className="tp-btn" title="Direct signed link (fallback)">
                  <Download className="w-3.5 h-3.5" /> Direct
                </a>
              </>
            )}
            <button onClick={onClose} className="tp-btn" aria-label="Close"><X className="w-4 h-4" /></button>
          </div>
        </div>

        <div className="p-6 space-y-5">
          {loading && <p className="text-sm text-[hsl(var(--tp-text-dim))]">Loading…</p>}

          {/* AI review button */}
          {!notes || Object.keys(notes).length === 0 ? (
            <div className="tp-surface p-5 border border-dashed border-[hsl(var(--tp-hairline))]">
              <p className="text-sm text-[hsl(var(--tp-text-muted))] mb-3">
                No AI review yet. Run the review to extract data and check completeness.
              </p>
              <button onClick={runAI} disabled={reviewing} className="tp-btn tp-btn-primary disabled:opacity-50">
                <Sparkles className="w-3.5 h-3.5" />
                {reviewing ? "Reviewing…" : "Run AI review"}
              </button>
            </div>
          ) : (
            <>
              <div className="flex items-center justify-between gap-2 flex-wrap">
                <span className={`tp-chip text-[11px] ${
                  status === "ai_passed" ? "text-[hsl(var(--tp-gold))]" :
                  status === "ai_flagged" ? "text-[hsl(var(--tp-warning))]" :
                  status === "approved" ? "text-green-400" :
                  status === "rejected" ? "text-red-400" : ""
                }`}>
                  {status === "ai_passed" && <Check className="w-3 h-3 inline mr-1" />}
                  {status === "ai_flagged" && <AlertTriangle className="w-3 h-3 inline mr-1" />}
                  {status}
                </span>
                <div className="flex items-center gap-2">
                  {provider && (
                    <span className="text-[10px] uppercase tracking-wider text-[hsl(var(--tp-text-dim))]">
                      AI · {provider.provider} · {provider.model}
                    </span>
                  )}
                  <button
                    onClick={() => {
                      navigator.clipboard.writeText(JSON.stringify(notes, null, 2));
                      toast.success("Raw JSON copied");
                    }}
                    className="tp-btn text-[11px]"
                    title="Copy raw AI verdict JSON"
                  >
                    <Copy className="w-3 h-3" /> JSON
                  </button>
                  <button onClick={() => setShowRaw((v) => !v)} className="tp-btn text-[11px]">
                    {showRaw ? "Hide" : "Show"} raw
                  </button>
                  <button onClick={runAI} disabled={reviewing} className="tp-btn text-[11px] disabled:opacity-50">
                    <Sparkles className="w-3 h-3" /> Re-run
                  </button>
                </div>
              </div>

              {showRaw && (
                <pre className="tp-surface p-3 text-[10px] overflow-x-auto text-[hsl(var(--tp-text-dim))] whitespace-pre-wrap">
                  {JSON.stringify(notes, null, 2)}
                </pre>
              )}

              {notes.summary && (
                <div className="tp-surface p-4">
                  <p className="text-[10px] uppercase tracking-wider text-[hsl(var(--tp-text-dim))] mb-1">Summary</p>
                  <p className="text-sm text-[hsl(var(--tp-text))]">{notes.summary}</p>
                </div>
              )}

              {/* NDA-specific */}
              {docType === "nda" && (
                <div className="tp-surface p-4 space-y-2">
                  <p className="text-[10px] uppercase tracking-wider text-[hsl(var(--tp-text-dim))] mb-1">NDA fields</p>
                  <Row k="Fully executed" v={notes.fully_executed ? "Yes" : "No"} good={notes.fully_executed} />
                  <Row k="Signer" v={notes.signer_name || "—"} />
                  <Row k="Company" v={notes.company || "—"} />
                  <Row k="Date" v={notes.date || "—"} />
                  <Row k="Signature present" v={notes.signature_present ? "Yes" : "No"} good={notes.signature_present} />
                </div>
              )}

              {/* PSS-specific */}
              {docType === "pss" && notes.has_required && (
                <div className="tp-surface p-4 space-y-2">
                  <p className="text-[10px] uppercase tracking-wider text-[hsl(var(--tp-text-dim))] mb-1">Required fields</p>
                  {Object.entries(notes.has_required).map(([k, v]) => (
                    <Row key={k} k={pssLabel(k)} v={v ? "Present" : "Missing"} good={!!v} />
                  ))}
                </div>
              )}

              {docType === "pss" && (notes.services_to_offer?.length ?? 0) > 0 && (
                <div className="tp-surface p-4 border border-[hsl(var(--tp-gold))]/30">
                  <p className="text-[10px] uppercase tracking-wider text-[hsl(var(--tp-gold))] mb-2">
                    Services we can offer this client
                  </p>
                  <ul className="text-sm text-[hsl(var(--tp-text))] space-y-1 list-disc pl-5">
                    {notes.services_to_offer.map((s: string, i: number) => <li key={i}>{s}</li>)}
                  </ul>
                </div>
              )}

              {docType === "pss" && notes.extracted && (() => {
                const ex = notes.extracted;
                const ings = ex?.recipe?.ingredients || ex?.ingredients || [];
                const total = ex?.recipe?.total_batch_weight;
                let sumPct = 0;
                let computedCount = 0;
                if (total && total > 0) {
                  for (const i of ings) if (typeof i.weight === "number") { sumPct += (i.weight / total) * 100; computedCount++; }
                } else {
                  for (const i of ings) if (typeof i.percentage === "number") { sumPct += i.percentage; computedCount++; }
                }
                const pctOk = computedCount > 0 && Math.abs(sumPct - 100) <= 0.05;
                const steps = ex?.process?.pre_bake?.steps || ex?.process_steps || [];
                const method = ex?.process?.method;
                const used = new Set<string>();
                for (const s of steps) for (const n of (s?.ingredients_added || [])) used.add(String(n).toLowerCase().trim());
                const names = new Set(ings.map((i: any) => (i.name || "").toLowerCase().trim()));
                const coverageOk = names.size > 0 && [...names].every((n) => used.has(n as string));
                const packing = ex?.packaging?.primary?.vessel || ex?.packaging?.secondary?.type;
                return (
                  <div className="tp-surface p-4 border border-[hsl(var(--tp-gold))]/20 space-y-2">
                    <p className="text-[10px] uppercase tracking-wider text-[hsl(var(--tp-gold))]">
                      Will populate batch sheet
                    </p>
                    <div className="text-sm text-[hsl(var(--tp-text))] space-y-1">
                      <div>
                        Recipe: <span className="text-[hsl(var(--tp-text-dim))]">{ings.length} ingredients</span>
                        {computedCount > 0 && (
                          <span className={pctOk ? "text-green-400 ml-2" : "text-[hsl(var(--tp-warning))] ml-2"}>
                            · Σ = {sumPct.toFixed(2)}% {pctOk ? "✓" : "⚠"}
                          </span>
                        )}
                        <span className="text-[hsl(var(--tp-text-dim))] ml-2">· locked 🔒</span>
                      </div>
                      <div>
                        Process: <span className="text-[hsl(var(--tp-text-dim))]">
                          {method || "method TBD"} · {steps.length} step{steps.length === 1 ? "" : "s"}
                        </span>
                        {names.size > 0 && (
                          <span className={coverageOk ? "text-green-400 ml-2" : "text-[hsl(var(--tp-warning))] ml-2"}>
                            · coverage {coverageOk ? "✓" : "⚠"}
                          </span>
                        )}
                      </div>
                      <div>
                        Packaging: <span className="text-[hsl(var(--tp-text-dim))]">
                          {packing || "TBD → offered as service"}
                        </span>
                      </div>
                    </div>
                    <p className="text-[11px] text-[hsl(var(--tp-text-dim))] pt-2 border-t border-[hsl(var(--tp-hairline))]">
                      On approval, a confidential staff-only formula will be created. Ingredient weights are locked on the batch sheet — all other fields editable by the AB team.
                    </p>
                  </div>
                );
              })()}

              {(notes.issues?.length ?? 0) > 0 && (
                <div className="tp-surface p-4 border border-[hsl(var(--tp-warning))]/30">
                  <p className="text-[10px] uppercase tracking-wider text-[hsl(var(--tp-warning))] mb-2">Issues</p>
                  <ul className="text-sm text-[hsl(var(--tp-text))] space-y-1 list-disc pl-5">
                    {notes.issues.map((s: string, i: number) => <li key={i}>{s}</li>)}
                  </ul>
                </div>
              )}
            </>
          )}

          {/* Decision buttons */}
          {status !== "approved" && status !== "rejected" && (
            <div className="flex items-center gap-2 pt-2">
              <button onClick={() => decide("approved")} disabled={busy} className="tp-btn tp-btn-primary disabled:opacity-50">
                <Check className="w-3.5 h-3.5" /> Approve
              </button>
              <button onClick={() => decide("rejected")} disabled={busy} className="tp-btn disabled:opacity-50">
                <X className="w-3.5 h-3.5" /> Reject
              </button>
            </div>
          )}

          {/* An NDA arrives already approved, so the pair above never renders for one. Without
              this, a document the AI flagged as not fully executed could not be acted on at all. */}
          {docType === "nda" && status === "approved" && (
            <div className="flex items-center gap-3 pt-2">
              <button onClick={() => decide("rejected")} disabled={busy} className="tp-btn disabled:opacity-50">
                <X className="w-3.5 h-3.5" /> Reject NDA
              </button>
              <span className="text-[11px] text-[hsl(var(--tp-text-dim))]">
                NDAs are approved on upload — reject only if this is not a valid signed NDA.
              </span>
            </div>
          )}
        </div>
      </div>
    </div>,
    document.body
  );
};

function Row({ k, v, good }: { k: string; v: string; good?: boolean }) {
  return (
    <div className="flex items-center justify-between text-sm">
      <span className="text-[hsl(var(--tp-text-dim))]">{k}</span>
      <span className={good === true ? "text-green-400" : good === false ? "text-[hsl(var(--tp-warning))]" : "text-[hsl(var(--tp-text))]"}>
        {v}
      </span>
    </div>
  );
}

function pssLabel(k: string): string {
  return ({
    company: "Company",
    product: "Product",
    recipe: "Recipe",
    process: "Process",
    size_weight: "Size & weight",
    units_per_primary: "Units / primary pack",
    units_per_retail: "Units / retail unit",
    signature: "Signature",
  } as any)[k] || k;
}
