// "Start this activity" — the destination of a notification's form link.
//
// A notification link has to be safe to click twice. Creating an entry is a write, so a naive
// /new route would leave two half-filled records for one task if somebody double-clicked, went
// back, or opened the notification again the next morning. This route therefore RESUMES the
// caller's newest open draft for the form when there is one and only creates when there is not
// (createResponse's resumeAnyDraft) — which is also what a person following a due reminder wants:
// the entry they are already filling in for it, not a second one beside it.
//
// It redirects with `replace`, so Back from the entry goes where the person actually came from
// rather than bouncing them through here again and re-resolving the draft.

import { useEffect, useRef } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { createResponse } from "@/lib/formResponses";

export default function FormEntryStart() {
  const { docId } = useParams<{ docId: string }>();
  const [params] = useSearchParams();
  const navigate = useNavigate();
  // StrictMode double-invokes effects in development; without this the resume would run twice.
  // It is harmless (the second call finds the draft the first made) but the guard keeps the
  // network quiet and makes the behaviour identical in dev and production.
  const started = useRef(false);

  const from = params.get("from");

  useEffect(() => {
    if (!docId || started.current) return;
    started.current = true;

    (async () => {
      const fallback = `/team/compliance/sops?doc=${docId}`;
      try {
        const { data: doc, error } = await supabase
          .from("sop_documents")
          .select("id, sop_number, revision, content")
          .eq("id", docId)
          .maybeSingle();
        if (error) throw error;
        if (!doc) throw new Error("That form no longer exists.");

        const response = await createResponse(doc as never, undefined, { resumeAnyDraft: true });
        const qs = from ? `?from=${encodeURIComponent(from)}` : "";
        navigate(`/team/compliance/forms/${docId}/entries/${response.id}${qs}`, { replace: true });
      } catch (e) {
        // Land somewhere useful rather than on a dead page: the form's own drawer, where the
        // Entries list and New Entry both are.
        toast.error(e instanceof Error ? e.message : "Could not open an entry for that form");
        navigate(fallback, { replace: true });
      }
    })();
  }, [docId, from, navigate]);

  return (
    <div className="flex items-center gap-2 p-6 tp-on-bg-dim">
      <Loader2 className="w-4 h-4 animate-spin" />
      Opening the form…
    </div>
  );
}
