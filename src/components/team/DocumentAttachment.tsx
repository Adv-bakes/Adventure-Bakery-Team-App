import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Download, Upload, Trash2, FileText, Presentation, Loader2, Eye, EyeOff, Link2, ExternalLink, Plus, X } from "lucide-react";
import { toast } from "sonner";
import {
  uploadSopFile, removeSopFile, resolveFileUrl, getSourceDeckUrl, type Attachment,
} from "@/lib/training";

type Props = {
  sopId: string;
  // The managed list of attachments (from content.attachments). Parent persists changes.
  attachments: Attachment[];
  // Called with the next list after add/remove. Only provided for admins (omit = view-only).
  onChange?: (next: Attachment[]) => void | Promise<void>;
  // Legacy single file_url value (storage path or external http URL); shown alongside the list.
  legacyFileUrl?: string | null;
  // Clears the legacy file_url. Admin only.
  onClearLegacy?: () => void | Promise<void>;
  // "training" → label the region as related supplementary material; "reference" (default) →
  // the files themselves are the document.
  variant?: "reference" | "training";
};

function fileNameOf(p: string): string {
  const clean = p.split("?")[0];
  return decodeURIComponent(clean.split("/").pop() || clean);
}

// Derive a readable label from a URL: last path segment (sans extension) or the host.
function titleFromUrl(raw: string): string {
  let u = raw.trim();
  if (!u) return "";
  if (!/^https?:\/\//i.test(u)) u = "https://" + u;
  try {
    const url = new URL(u);
    const titleCase = (s: string) =>
      s.replace(/\S+/g, w => w.charAt(0).toUpperCase() + w.slice(1));
    const seg = url.pathname.split("/").filter(Boolean).pop();
    if (seg) {
      const name = decodeURIComponent(seg).replace(/\.[a-z0-9]+$/i, "").replace(/[-_+]+/g, " ").trim();
      if (name) return titleCase(name);
    }
    return url.hostname.replace(/^www\./, "");
  } catch {
    return "";
  }
}

// One uploaded-file row: name, download, inline PDF preview (toggle), and remove (admin).
function FileRow({
  path, name, isAdmin, defaultOpen, onRemove,
}: {
  path: string; name: string; isAdmin: boolean; defaultOpen: boolean;
  onRemove?: () => void;
}) {
  const [url, setUrl] = useState<string | null>(null);
  const [open, setOpen] = useState(defaultOpen);
  const isPdf = name.toLowerCase().endsWith(".pdf");

  useEffect(() => {
    let cancelled = false;
    resolveFileUrl(path)
      .then(u => { if (!cancelled) setUrl(u); })
      .catch((e: any) => { if (!cancelled) toast.error(e.message ?? "Could not open file"); });
    return () => { cancelled = true; };
  }, [path]);

  return (
    <div className="rounded-md border border-[#C89B3C]/30 bg-[#C89B3C]/5 p-3 space-y-3">
      <div className="flex items-center justify-between gap-2">
        <span className="flex items-center gap-1.5 text-sm font-medium text-[#2A1F0E] truncate">
          <FileText className="w-4 h-4 shrink-0 text-[#9A6F1E]" />
          <span className="truncate">{name}</span>
        </span>
        <div className="flex items-center gap-2 shrink-0">
          {isPdf && (
            <Button variant="ghost" size="sm" onClick={() => setOpen(o => !o)} title={open ? "Hide preview" : "Show preview"}>
              {open ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
            </Button>
          )}
          {url && (
            <a href={url} target="_blank" rel="noreferrer" download>
              <Button variant="outline" size="sm"><Download className="w-3.5 h-3.5 mr-1" />Download</Button>
            </a>
          )}
          {isAdmin && onRemove && (
            <Button variant="outline" size="sm" onClick={onRemove}
              className="text-red-600 border-red-300 hover:bg-red-50">
              <Trash2 className="w-3.5 h-3.5" />
            </Button>
          )}
        </div>
      </div>
      {isPdf && open && url && (
        <object data={url} type="application/pdf" className="w-full h-[60vh] rounded border border-[#C89B3C]/20">
          <iframe src={url} title={name} className="w-full h-[60vh]" />
        </object>
      )}
    </div>
  );
}

// One external-link row: label, open-in-new-tab, remove (admin).
function LinkRow({
  url, name, isAdmin, onRemove,
}: {
  url: string; name: string; isAdmin: boolean; onRemove?: () => void;
}) {
  return (
    <div className="rounded-md border border-[#C89B3C]/30 bg-[#C89B3C]/5 p-3 flex items-center justify-between gap-2">
      <span className="flex items-center gap-1.5 text-sm font-medium text-[#2A1F0E] truncate min-w-0">
        <Link2 className="w-4 h-4 shrink-0 text-[#9A6F1E]" />
        <span className="truncate">{name}</span>
      </span>
      <div className="flex items-center gap-2 shrink-0">
        <a href={url} target="_blank" rel="noreferrer noopener">
          <Button variant="outline" size="sm"><ExternalLink className="w-3.5 h-3.5 mr-1" />Open</Button>
        </a>
        {isAdmin && onRemove && (
          <Button variant="outline" size="sm" onClick={onRemove}
            className="text-red-600 border-red-300 hover:bg-red-50">
            <Trash2 className="w-3.5 h-3.5" />
          </Button>
        )}
      </div>
    </div>
  );
}

export function DocumentAttachment({ sopId, attachments, onChange, legacyFileUrl, onClearLegacy, variant = "reference" }: Props) {
  const isAdmin = !!onChange;
  const inputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [deckUrl, setDeckUrl] = useState<string | null>(null);
  const [addingLink, setAddingLink] = useState(false);
  const [linkUrl, setLinkUrl] = useState("");
  const [linkLabel, setLinkLabel] = useState("");
  // While false, the label auto-tracks the URL; once the user edits it, stop overriding.
  const [labelTouched, setLabelTouched] = useState(false);

  const list = attachments ?? [];
  // Auto-expand the only doc; collapse previews when several are attached.
  const singleDoc = list.length + (legacyFileUrl ? 1 : 0) === 1;

  useEffect(() => {
    let cancelled = false;
    setDeckUrl(null);
    if (!sopId) return;
    getSourceDeckUrl(sopId)
      .then(url => { if (!cancelled) setDeckUrl(url); })
      .catch(() => { /* absent is normal */ });
    return () => { cancelled = true; };
  }, [sopId]);

  const handleFiles = async (files: FileList) => {
    setBusy(true);
    try {
      const added: Attachment[] = [];
      for (const file of Array.from(files)) {
        const path = await uploadSopFile(sopId, file);
        added.push({ path, name: file.name });
      }
      await onChange?.([...list, ...added]);
      toast.success(added.length > 1 ? `${added.length} files attached` : "File attached");
    } catch (e: any) {
      toast.error(e.message ?? "Upload failed");
    } finally {
      setBusy(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  };

  const handleAddLink = async () => {
    let url = linkUrl.trim();
    if (!url) return toast.error("Enter a URL");
    if (!/^https?:\/\//i.test(url)) url = "https://" + url;
    try { new URL(url); } catch { return toast.error("That doesn't look like a valid URL"); }
    const name = linkLabel.trim() || url.replace(/^https?:\/\//i, "");
    setBusy(true);
    try {
      await onChange?.([...list, { url, name }]);
      toast.success("Link added");
      setLinkUrl(""); setLinkLabel(""); setLabelTouched(false); setAddingLink(false);
    } catch (e: any) {
      toast.error(e.message ?? "Failed to add link");
    } finally {
      setBusy(false);
    }
  };

  const handleRemove = async (item: Attachment) => {
    setBusy(true);
    try {
      if (item.path) await removeSopFile(item.path).catch(() => { /* tolerate missing object */ });
      await onChange?.(list.filter(a => a !== item));
      toast.success("Removed");
    } catch (e: any) {
      toast.error(e.message ?? "Remove failed");
    } finally {
      setBusy(false);
    }
  };

  const handleRemoveLegacy = async () => {
    setBusy(true);
    try {
      if (legacyFileUrl && !/^https?:\/\//i.test(legacyFileUrl)) {
        await removeSopFile(legacyFileUrl).catch(() => {});
      }
      await onClearLegacy?.();
      toast.success("Removed");
    } catch (e: any) {
      toast.error(e.message ?? "Remove failed");
    } finally {
      setBusy(false);
    }
  };

  const heading = variant === "training" ? "Related Materials" : "Attached Documents";
  const note = variant === "training"
    ? "Documents and links related to this training — supplementary references, not part of the slides."
    : null;

  return (
    <div className="space-y-3">
      <div>
        <p className="text-sm font-medium text-[#2A1F0E]">{heading}</p>
        {note && <p className="text-xs text-[#2A1F0E]/50">{note}</p>}
      </div>

      {legacyFileUrl && (
        <FileRow
          path={legacyFileUrl}
          name={fileNameOf(legacyFileUrl)}
          isAdmin={isAdmin}
          defaultOpen={singleDoc}
          onRemove={onClearLegacy ? handleRemoveLegacy : undefined}
        />
      )}

      {list.map((a, i) => a.url
        ? <LinkRow key={a.url + i} url={a.url} name={a.name} isAdmin={isAdmin} onRemove={onChange ? () => handleRemove(a) : undefined} />
        : <FileRow key={(a.path ?? "") + i} path={a.path!} name={a.name} isAdmin={isAdmin} defaultOpen={singleDoc} onRemove={onChange ? () => handleRemove(a) : undefined} />
      )}

      {list.length === 0 && !legacyFileUrl && (
        <p className="text-xs text-[#2A1F0E]/50">
          {isAdmin ? "Nothing attached yet." : "No documents or links attached."}
        </p>
      )}

      {isAdmin && (
        <div className="space-y-1.5">
          <input
            ref={inputRef}
            type="file"
            multiple
            accept=".pdf,.doc,.docx,.xls,.xlsx,.png,.jpg,.jpeg"
            className="hidden"
            onChange={e => { if (e.target.files?.length) handleFiles(e.target.files); }}
          />
          <div className="flex flex-wrap items-center gap-2">
            {!addingLink && (
              <Button size="sm" onClick={() => setAddingLink(true)} disabled={busy} className="bg-[#C89B3C] hover:bg-[#B8892C]">
                <Link2 className="w-3.5 h-3.5 mr-1" />Add link
              </Button>
            )}
            <Button variant="outline" size="sm" onClick={() => inputRef.current?.click()} disabled={busy}>
              {busy ? <Loader2 className="w-3.5 h-3.5 mr-1 animate-spin" /> : <Upload className="w-3.5 h-3.5 mr-1" />}
              Upload file
            </Button>
          </div>
          <p className="text-xs text-[#2A1F0E]/50">
            Prefer a link when the document already lives somewhere online — it saves storage.
            Upload a file only when there's no link to point to.
          </p>
        </div>
      )}

      {isAdmin && addingLink && (
        <div className="rounded-md border border-[#C89B3C]/30 bg-[#C89B3C]/5 p-3 space-y-2">
          <Input
            placeholder="https://…"
            value={linkUrl}
            onChange={e => {
              const v = e.target.value;
              setLinkUrl(v);
              if (!labelTouched) setLinkLabel(titleFromUrl(v));
            }}
            onKeyDown={e => { if (e.key === "Enter") handleAddLink(); }}
            autoFocus
          />
          <Input
            placeholder="Label (auto-filled from the URL — edit to override)"
            value={linkLabel}
            onChange={e => { setLabelTouched(true); setLinkLabel(e.target.value); }}
          />
          <div className="flex justify-end gap-2">
            <Button variant="ghost" size="sm" onClick={() => { setAddingLink(false); setLinkUrl(""); setLinkLabel(""); setLabelTouched(false); }}>
              <X className="w-3.5 h-3.5 mr-1" />Cancel
            </Button>
            <Button size="sm" onClick={handleAddLink} disabled={busy} className="bg-[#C89B3C] hover:bg-[#B8892C]">
              <Plus className="w-3.5 h-3.5 mr-1" />Add link
            </Button>
          </div>
        </div>
      )}

      {deckUrl && (
        <a href={deckUrl} target="_blank" rel="noreferrer" download>
          <Button variant="outline" size="sm">
            <Presentation className="w-3.5 h-3.5 mr-1" />Download source PowerPoint
          </Button>
        </a>
      )}
    </div>
  );
}
