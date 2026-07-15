import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Camera, Download, FileText, Loader2, Trash2, Upload } from "lucide-react";
import { toast } from "sonner";
import {
  getResponseAttachmentUrl, removeResponseAttachment, uploadResponseAttachment,
  type ResponseAttachment,
} from "@/lib/formResponses";
import { DictationTextarea } from "./DictationTextarea";

const IMAGE_EXT = /\.(png|jpe?g|gif|webp|heic|heif)$/i;

// Long enough to not fire mid-sentence, short enough that a note is on the
// server before the filler moves on to the next photo.
const NOTE_SAVE_DEBOUNCE_MS = 900;

function isImage(a: ResponseAttachment): boolean {
  return a.contentType ? a.contentType.startsWith("image/") : IMAGE_EXT.test(a.name);
}

function formatSize(bytes?: number): string | null {
  if (!bytes) return null;
  const mb = bytes / 1024 / 1024;
  return mb >= 1 ? `${mb.toFixed(1)} MB` : `${Math.max(1, Math.round(bytes / 1024))} KB`;
}

// One attachment: thumbnail (images) or file icon, name, download, remove, and
// a note describing what it shows.
function AttachmentRow({ item, canEdit, onRemove, onNoteChange }: {
  item: ResponseAttachment;
  canEdit: boolean;
  onRemove?: () => void;
  onNoteChange?: (note: string) => void;
}) {
  const [url, setUrl] = useState<string | null>(null);
  const [note, setNote] = useState(item.note ?? "");
  const image = isImage(item);
  const size = formatSize(item.size);

  const saveTimerRef = useRef<number | null>(null);
  const pendingRef = useRef<string | null>(null);
  const onNoteChangeRef = useRef(onNoteChange);
  onNoteChangeRef.current = onNoteChange;

  useEffect(() => {
    let cancelled = false;
    getResponseAttachmentUrl(item.path)
      .then(u => { if (!cancelled) setUrl(u); })
      .catch((e: any) => { if (!cancelled) toast.error(e.message ?? "Could not open attachment"); });
    return () => { cancelled = true; };
  }, [item.path]);

  const flush = () => {
    if (saveTimerRef.current) {
      window.clearTimeout(saveTimerRef.current);
      saveTimerRef.current = null;
    }
    if (pendingRef.current === null) return;
    const value = pendingRef.current;
    pendingRef.current = null;
    onNoteChangeRef.current?.(value);
  };

  // A note left unsaved when the page unmounts is a note the filler believes
  // they wrote — flush the pending debounce rather than dropping it.
  useEffect(() => () => flush(), []);

  const editNote = (value: string) => {
    setNote(value);
    pendingRef.current = value;
    if (saveTimerRef.current) window.clearTimeout(saveTimerRef.current);
    saveTimerRef.current = window.setTimeout(flush, NOTE_SAVE_DEBOUNCE_MS);
  };

  return (
    <div className="rounded-md border border-[#C89B3C]/30 bg-[#C89B3C]/5 p-2.5 space-y-2">
      <div className="flex items-center gap-3">
        {image && url ? (
          <a href={url} target="_blank" rel="noreferrer" className="shrink-0">
            <img
              src={url}
              alt={item.name}
              className="w-20 h-20 rounded object-cover border border-[#C89B3C]/20 bg-white"
            />
          </a>
        ) : (
          <div className="w-20 h-20 rounded border border-[#C89B3C]/20 bg-white flex items-center justify-center shrink-0">
            <FileText className="w-7 h-7 text-[#9A6F1E]" />
          </div>
        )}
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-[#2A1F0E] truncate" title={item.name}>{item.name}</p>
          <p className="text-xs text-[#2A1F0E]/60">
            {new Date(item.uploadedAt).toLocaleString()}{size ? ` · ${size}` : ""}
          </p>
        </div>
        <div className="flex items-center gap-1.5 shrink-0">
          {url && (
            <a href={url} target="_blank" rel="noreferrer" download={item.name}>
              <Button variant="outline" size="sm" title="Download">
                <Download className="w-3.5 h-3.5" />
              </Button>
            </a>
          )}
          {canEdit && onRemove && (
            <Button
              variant="outline" size="sm" onClick={onRemove} title="Remove"
              className="text-red-600 border-red-300 hover:bg-red-50"
            >
              <Trash2 className="w-3.5 h-3.5" />
            </Button>
          )}
        </div>
      </div>

      {canEdit ? (
        <DictationTextarea
          value={note}
          onChange={editNote}
          onBlur={flush}
          rows={1}
          compact
          placeholder="Note — what does this show? (saves automatically)"
          className="bg-white text-sm min-h-[2.25rem]"
        />
      ) : item.note ? (
        <p className="text-sm text-[#2A1F0E]/80 whitespace-pre-wrap">{item.note}</p>
      ) : null}
    </div>
  );
}

interface ResponseAttachmentsProps {
  responseId: string;
  attachments: ResponseAttachment[];
  /** Undefined = read-only (view/download only, no add/remove/note controls). */
  onChange?: (next: ResponseAttachment[]) => void | Promise<void>;
}

/**
 * Photo/file attachments for a filled form entry — separate from the
 * document-level DocumentAttachment (which manages reference material on the
 * form template itself, not evidence attached to one filled-out response).
 * Upload/remove mechanics live here; the parent (FormEntry) owns persistence
 * via onChange, same delegation split as DocumentAttachment.
 */
export function ResponseAttachments({ responseId, attachments, onChange }: ResponseAttachmentsProps) {
  const canEdit = !!onChange;
  const fileInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);

  const list = attachments ?? [];

  // The array as we believe it to be, including edits whose save is still in
  // flight — building the next array from the prop alone would drop one when a
  // second edit lands before the first round trip returns. Adopt the prop only
  // when it actually changes (server truth); the parent re-renders on unrelated
  // form state too, which would otherwise revert an in-flight edit.
  const latestRef = useRef(list);
  const lastPropRef = useRef(list);
  if (lastPropRef.current !== list) {
    lastPropRef.current = list;
    latestRef.current = list;
  }

  const handleFiles = async (files: FileList) => {
    setBusy(true);
    try {
      const added: ResponseAttachment[] = [];
      for (const file of Array.from(files)) {
        added.push(await uploadResponseAttachment(responseId, file));
      }
      const next = [...latestRef.current, ...added];
      latestRef.current = next;
      await onChange?.(next);
      toast.success(added.length > 1 ? `${added.length} files attached` : "Attached");
    } catch (e: any) {
      toast.error(e.message ?? "Upload failed");
    } finally {
      setBusy(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
      if (cameraInputRef.current) cameraInputRef.current.value = "";
    }
  };

  const handleRemove = async (item: ResponseAttachment) => {
    setBusy(true);
    try {
      await removeResponseAttachment(item.path).catch(() => { /* tolerate missing object */ });
      const next = latestRef.current.filter(a => a.path !== item.path);
      latestRef.current = next;
      await onChange?.(next);
      toast.success("Removed");
    } catch (e: any) {
      toast.error(e.message ?? "Remove failed");
    } finally {
      setBusy(false);
    }
  };

  const handleNote = async (item: ResponseAttachment, note: string) => {
    const trimmed = note.trim();
    const next = latestRef.current.map(a =>
      a.path === item.path ? { ...a, note: trimmed || undefined } : a);
    latestRef.current = next;
    await onChange?.(next); // silent — a toast per note would fire while typing
  };

  if (list.length === 0 && !canEdit) return null;

  return (
    <div
      className="rounded-md border p-3 space-y-3"
      style={{ background: "#FFF", borderColor: "rgba(200,155,60,0.4)" }}
    >
      <div>
        <p className="text-sm font-medium text-[#2A1F0E]">Attachments</p>
        {canEdit && (
          <p className="text-xs text-[#2A1F0E]/60">
            Photos and files kept with this entry. Add a note to each so the record says what it shows.
          </p>
        )}
      </div>

      {list.map(item => (
        <AttachmentRow
          key={item.path}
          item={item}
          canEdit={canEdit}
          onRemove={canEdit ? () => handleRemove(item) : undefined}
          onNoteChange={canEdit ? note => handleNote(item, note) : undefined}
        />
      ))}

      {list.length === 0 && (
        <p className="text-xs text-[#2A1F0E]/50">
          {canEdit ? "Nothing attached yet." : "No files or photos attached."}
        </p>
      )}

      {canEdit && (
        <div className="flex flex-wrap items-center gap-2">
          <input
            ref={fileInputRef}
            type="file"
            multiple
            accept="image/*,.pdf,.doc,.docx,.xls,.xlsx"
            className="hidden"
            onChange={e => { if (e.target.files?.length) handleFiles(e.target.files); }}
          />
          <input
            ref={cameraInputRef}
            type="file"
            accept="image/*"
            capture="environment"
            className="hidden"
            onChange={e => { if (e.target.files?.length) handleFiles(e.target.files); }}
          />
          <Button variant="outline" size="sm" onClick={() => cameraInputRef.current?.click()} disabled={busy}>
            {busy ? <Loader2 className="w-3.5 h-3.5 mr-1 animate-spin" /> : <Camera className="w-3.5 h-3.5 mr-1" />}
            Take Photo
          </Button>
          <Button variant="outline" size="sm" onClick={() => fileInputRef.current?.click()} disabled={busy}>
            {busy ? <Loader2 className="w-3.5 h-3.5 mr-1 animate-spin" /> : <Upload className="w-3.5 h-3.5 mr-1" />}
            Attach File
          </Button>
        </div>
      )}
    </div>
  );
}
