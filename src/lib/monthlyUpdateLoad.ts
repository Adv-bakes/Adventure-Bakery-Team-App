// The records the Monthly SQF Update's fill reads (monthlyUpdate.ts): the entries of the eight
// forms it summarises, the schedule's open reminders, and the issued documents with their
// effective dates. One load per tap of the button. Practice rows (_test_batch) are left out.

import { supabase } from "@/integrations/supabase/client";
import { getFormSchema, valueFields } from "@/lib/formSchema";
import { fetchOpenNotifications } from "@/lib/notifications";
import { UPDATE_SOURCES, checkUpdateMapping, emptyUpdateRecords, type UpdateKind, type UpdateRecords } from "@/lib/monthlyUpdate";

export async function loadMonthlyUpdateRecords(): Promise<{ records: UpdateRecords; problems: string[] }> {
  const forms = [...new Set(Object.values(UPDATE_SOURCES).map(s => s.form))];
  const [{ data: formRows, error: formErr }, { data: docRows, error: docErr }, reminders] = await Promise.all([
    (supabase as any).from("sop_documents").select("id, sop_number, status, content").in("sop_number", forms).eq("type", "form").in("status", ["active", "draft"]),
    (supabase as any).from("sop_documents").select("sop_number, revision, effective_date").eq("status", "active").not("effective_date", "is", null),
    fetchOpenNotifications().catch(() => []),
  ]);
  if (formErr) throw formErr;
  if (docErr) throw docErr;

  const docs: Record<string, { id: string; status: string; content: any }> = {};
  for (const d of (formRows ?? []) as any[]) {
    if (!docs[d.sop_number] || d.status === "active") docs[d.sop_number] = d;
  }
  const problems = checkUpdateMapping(Object.fromEntries(Object.entries(docs).map(([n, d]) => {
    const schema = getFormSchema(d.content);
    return [n, schema ? valueFields(schema).map(f => f.id) : undefined];
  })));

  const records = emptyUpdateRecords();
  await Promise.all((Object.keys(UPDATE_SOURCES) as UpdateKind[]).map(async kind => {
    const doc = docs[UPDATE_SOURCES[kind].form];
    if (!doc) return;
    const { data, error } = await (supabase as any).from("sop_document_responses")
      .select("id, status, created_at, data").eq("document_id", doc.id).order("created_at", { ascending: false }).limit(1000);
    if (error) throw error;
    records.entries[kind] = ((data ?? []) as any[])
      .filter(r => !(r.data && "_test_batch" in r.data))
      .map(r => ({ id: r.id, status: r.status, createdAt: r.created_at, data: r.data ?? {} }));
  }));

  records.reminders = reminders
    .filter(n => n.notification_type === "verification_due")
    .map(n => ({ title: n.title, severity: n.severity ?? "due", dueOn: n.due_on ?? null }));
  records.documents = ((docRows ?? []) as any[])
    .filter(d => d.sop_number)
    .map(d => ({ number: String(d.sop_number), revision: String(d.revision ?? ""), effective: String(d.effective_date ?? "") }));
  return { records, problems };
}
