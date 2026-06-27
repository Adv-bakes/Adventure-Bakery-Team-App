import { useEffect, useState } from "react";
import { FileText } from "lucide-react";
import { SopBodyEditor } from "@/components/team/SopBodyEditor";
import { hasSopBody, resolveFileUrl, type Attachment } from "@/lib/training";

// A read-only, PDF-styled view of a reference document for employees.
// Renders the structured SOP body (when present) on a paged "document" surface,
// or embeds an uploaded PDF inline. Text selection / copy / right-click are
// disabled so the view behaves like a locked document, not editable content.

type DocRow = {
  id: string;
  title: string | null;
  sop_number: string | null;
  revision: string | null;
  effective_date: string | null;
  category: string | null;
  sqf_reference: string | null;
  type: string;
  content: any;
  file_url: string | null;
};

function MetaCell({ label, value }: { label: string; value: string | null | undefined }) {
  return (
    <div className="px-3 py-2 border border-[#2A1F0E]/15">
      <p className="text-[10px] uppercase tracking-wide text-[#2A1F0E]/50">{label}</p>
      <p className="text-sm text-[#2A1F0E]">{value || "—"}</p>
    </div>
  );
}

// Resolves a single PDF attachment's signed URL and embeds it view-only.
function PdfEmbed({ path, url, name }: { path?: string; url?: string; name: string }) {
  const [src, setSrc] = useState<string | null>(url ?? null);

  useEffect(() => {
    if (url) { setSrc(url); return; }
    let cancelled = false;
    if (path) resolveFileUrl(path).then(u => { if (!cancelled) setSrc(u); }).catch(() => {});
    return () => { cancelled = true; };
  }, [path, url]);

  if (!src) return null;
  // #toolbar=0 hides the built-in download/print chrome in most browser viewers.
  const viewerSrc = src.includes("#") ? src : `${src}#toolbar=0&navpanes=0`;
  return (
    <object data={viewerSrc} type="application/pdf" className="w-full h-[75vh] rounded border border-[#2A1F0E]/15 bg-white">
      <iframe src={viewerSrc} title={name} className="w-full h-[75vh]" />
    </object>
  );
}

export function DocumentReader({ doc }: { doc: DocRow }) {
  const body = hasSopBody(doc.content);
  const attachments: Attachment[] = Array.isArray(doc.content?.attachments) ? doc.content.attachments : [];
  const legacy = doc.file_url;

  // PDF sources to embed when there's no structured body: uploaded PDFs + legacy file_url.
  const pdfFiles = attachments.filter(a => a.path && /\.pdf$/i.test(a.name));
  const legacyIsPdf = !!legacy && /\.pdf$/i.test(legacy) && !/^https?:\/\//i.test(legacy);

  const docType = (["sop", "form", "policy", "fsqm"].includes(doc.type) ? doc.type : "sop") as
    "sop" | "form" | "policy" | "fsqm";

  // Lock the rendered surface: no selection, no copy, no context menu.
  const lockProps = {
    onContextMenu: (e: React.MouseEvent) => e.preventDefault(),
    onCopy: (e: React.ClipboardEvent) => e.preventDefault(),
    style: { userSelect: "none" as const, WebkitUserSelect: "none" as const },
  };

  if (body) {
    return (
      <div {...lockProps} className="select-none">
        {/* Paged document surface, styled to echo the PDF export */}
        <div className="mx-auto max-w-3xl rounded-md bg-white shadow-sm border border-[#2A1F0E]/10 p-6 sm:p-8 space-y-5">
          <div className="grid grid-cols-2 gap-px bg-[#2A1F0E]/10 rounded overflow-hidden">
            <MetaCell label="Document" value={doc.title} />
            <MetaCell label="SOP No." value={doc.sop_number} />
            <MetaCell label="Revision" value={doc.revision} />
            <MetaCell label="Effective Date" value={doc.effective_date} />
            <MetaCell label="Category" value={doc.category} />
            <MetaCell label="SQF Reference" value={doc.sqf_reference} />
          </div>
          <SopBodyEditor sopId={doc.id} content={doc.content} docType={docType} />
        </div>
      </div>
    );
  }

  if (pdfFiles.length > 0 || legacyIsPdf) {
    return (
      <div {...lockProps} className="space-y-4 select-none">
        {legacyIsPdf && <PdfEmbed path={legacy!} name={doc.title ?? "Document"} />}
        {pdfFiles.map((a, i) => <PdfEmbed key={(a.path ?? "") + i} path={a.path} name={a.name} />)}
      </div>
    );
  }

  // Non-PDF attachments (e.g. links, Word docs) — fall back to a simple notice.
  return (
    <div className="rounded-md border border-dashed border-[#2A1F0E]/20 bg-[#2A1F0E]/[0.02] p-6 text-center">
      <FileText className="w-6 h-6 mx-auto text-[#2A1F0E]/30 mb-2" />
      <p className="text-sm text-[#2A1F0E]/60">No readable document content has been added to this entry yet.</p>
    </div>
  );
}
