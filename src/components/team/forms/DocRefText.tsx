import { createContext, useContext } from "react";
import { splitDocRefs } from "@/lib/docRefs";

/**
 * Document number -> document id, for the numbers written in the form being shown. Provided by
 * the entry page, which owns the lookup; empty anywhere else (the builder's preview), where the
 * text renders exactly as before.
 */
export const DocLinksContext = createContext<Record<string, string>>({});

/**
 * Form text with each known document number as a link into the SOPs Library, in a new tab so the
 * entry being filled stays open. A number with no document behind it stays plain text.
 */
export function DocRefText({ text }: { text: string }) {
  const links = useContext(DocLinksContext);
  if (!text || Object.keys(links).length === 0) return <>{text}</>;
  return (
    <>
      {splitDocRefs(text).map((part, i) => {
        if (typeof part === "string") return part;
        const id = links[part.ref];
        if (!id) return part.ref;
        return (
          <a
            key={i}
            href={`/team/compliance/sops?doc=${id}`}
            target="_blank"
            rel="noopener noreferrer"
            title={`Open ${part.ref} in a new tab`}
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
