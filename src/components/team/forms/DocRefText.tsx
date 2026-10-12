import { createContext, useContext, useEffect, useMemo, useState } from "react";
import { buildDocIndex, docRefsIn, splitDocRefs, type DocIndex } from "@/lib/docRefs";
import { fetchDocIndexRows } from "@/lib/formResponses";

/**
 * The id of the document being shown, so its own number stays plain text. Optional: with no
 * provider every known number links.
 */
export const DocSelfContext = createContext<string | null>(null);

// One lookup of every document's number and title per page load, shared by every DocRefText on
// screen and started only when some text actually carries a number. A failed lookup is retried
// by the next mount; until it answers, text renders plain.
let cached: DocIndex | null = null;
let pending: Promise<DocIndex> | null = null;
export function loadDocIndex(): Promise<DocIndex> {
  if (cached) return Promise.resolve(cached);
  if (!pending) {
    pending = fetchDocIndexRows()
      .then(rows => (cached = buildDocIndex(rows)))
      .catch(() => { pending = null; return {}; });
  }
  return pending;
}

/**
 * Text with each document number it mentions (FRM-909, FSQM-032, SOP-2.3.4...) as a link that
 * opens the document in the SOPs Library in a new tab; hovering shows the document's title.
 * A number with no active or draft document behind it stays plain text.
 */
export function DocRefText({ text }: { text: string }) {
  const self = useContext(DocSelfContext);
  const parts = useMemo(() => splitDocRefs(text ?? ""), [text]);
  const hasRef = parts.some(p => typeof p !== "string");
  const [index, setIndex] = useState<DocIndex | null>(cached);
  useEffect(() => {
    if (!hasRef || index) return;
    let live = true;
    loadDocIndex().then(i => { if (live) setIndex(i); });
    return () => { live = false; };
  }, [hasRef, index]);

  if (!hasRef || !index) return <>{text}</>;
  return (
    <>
      {parts.map((part, i) => {
        if (typeof part === "string") return part;
        const doc = index[part.ref];
        if (!doc || doc.id === self) return part.ref;
        return (
          <a
            key={i}
            href={`/team/compliance/sops?doc=${doc.id}`}
            target="_blank"
            rel="noopener noreferrer"
            title={doc.draft ? `${doc.title} (draft)` : doc.title}
            onClick={e => e.stopPropagation()}
            className="text-[#9A6F1E] underline decoration-[#C89B3C]/50 underline-offset-2 hover:decoration-[#9A6F1E]"
          >
            {part.ref}
          </a>
        );
      })}
    </>
  );
}

/**
 * The documents a typed answer mentions, as a short column of links beside its box (owner's
 * request, 2026-10-12): a number cannot be a link inside an edit box. Each document once, in the
 * order first mentioned. A number with no active or draft document behind it, and the form on
 * screen, are left out; with nothing to link it renders nothing, so the box keeps its width.
 */
export function DocRefLinks({ text, compact }: { text: string; compact?: boolean }) {
  const self = useContext(DocSelfContext);
  const refs = useMemo(() => docRefsIn(text ?? ""), [text]);
  const [index, setIndex] = useState<DocIndex | null>(cached);
  useEffect(() => {
    if (refs.length === 0 || index) return;
    let live = true;
    loadDocIndex().then(i => { if (live) setIndex(i); });
    return () => { live = false; };
  }, [refs.length, index]);

  const docs = index ? refs.filter(r => index[r] && index[r].id !== self) : [];
  if (docs.length === 0) return null;
  return (
    <div className={`flex shrink-0 flex-col items-start gap-0.5 ${compact ? "pt-1 text-[11px]" : "pt-2 text-xs"}`}>
      {docs.map(ref => (
        <a
          key={ref}
          href={`/team/compliance/sops?doc=${index![ref].id}`}
          target="_blank"
          rel="noopener noreferrer"
          title={index![ref].draft ? `${index![ref].title} (draft)` : index![ref].title}
          onClick={e => e.stopPropagation()}
          className="whitespace-nowrap text-[#9A6F1E] underline decoration-[#C89B3C]/50 underline-offset-2 hover:decoration-[#9A6F1E]"
        >
          {ref}
        </a>
      ))}
    </div>
  );
}
