// Opening one of the steps that stand between a lot and its release (today.ts releaseSteps): the
// record that exists, or - for the retention sample and the release only - a new one started with
// what the records can answer. Shared by the Today page's Release menu and the page that follows
// one lot, so the two cannot start a record differently.

import { createResponse, fetchResponse, saveResponseData } from "@/lib/formResponses";
import { getFormSchema } from "@/lib/formSchema";
import { blanksFilled, retentionDefaults } from "@/lib/retentionStart";
import type { LotSummary, ReleaseStep } from "@/lib/today";

type Doc = { id: string; sop_number: string; revision: string | null; content: any };

/**
 * Where a step's record is, creating it where that is allowed. Null when there is no record and
 * none may be started from here: a missing production record is not made up after the fact.
 * `back` is the query that brings "Back" on the record to where the person was.
 */
export async function releaseStepHref(
  step: ReleaseStep, lot: LotSummary, docs: { retention?: Doc; release?: Doc }, back = "from=today",
): Promise<string | null> {
  const href = (docId: string, id: string) => `/team/compliance/forms/${docId}/entries/${id}?${back}`;
  // A retention sample already started but not finished: what the records can now answer is put
  // into its BLANK answers before it opens. Nothing typed is touched.
  if (step.key === "retention" && step.state === "open" && step.entryId && step.docId) {
    try {
      const r = await fetchResponse(step.entryId);
      if (r && r.status === "draft") {
        const add = blanksFilled(r.data, await retentionDefaults(lot, getFormSchema(docs.retention?.content)));
        if (Object.keys(add).length) await saveResponseData(r.id, { ...(r.data ?? {}), ...add }, r.updated_at);
      }
    } catch (e) {
      console.error(e);   // the record still opens; it is only missing the looked-up answers
    }
    return href(step.docId, step.entryId);
  }
  if (step.entryId && step.docId) return href(step.docId, step.entryId);
  // Only the last two are started from here.
  const doc = step.key === "retention" ? docs.retention : step.key === "release" ? docs.release : undefined;
  if (!doc) return null;
  const prefill = step.key === "retention"
    ? await retentionDefaults(lot, getFormSchema(doc.content))
    : { product_name: lot.product, lot_code: lot.lotCode };
  const r = await createResponse(doc, prefill);
  return href(doc.id, r.id);
}
