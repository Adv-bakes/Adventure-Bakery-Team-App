// Where a spoken CCP reading goes: the form, and which of the operator's entries to put it in.
//
// The parser (voiceCommands.ts) is pure; everything that touches the database is here.
//
// "TODAY'S RECORD" HAS TO BE LOOKED UP, NOT RESUMED. createResponse's resumeAnyDraft returns the
// newest draft with no date filter, and CCP records stay drafts for up to a week waiting for the
// reviewer to sign and submit - so resuming would put Friday's loads into Monday's record. The
// lookup below matches the production date as well.
//
// NOTHING IS CREATED UNTIL THE OPERATOR TAPS OPEN. FRM-507 and FRM-606 entries cannot be deleted
// (settings.deletable: false), so a misheard command must never be able to leave a stray record.

import { supabase } from "@/integrations/supabase/client";
import { createResponse, type FormResponse } from "@/lib/formResponses";
import { getFormSchema } from "@/lib/formSchema";
import type { VoiceFill } from "@/lib/voiceCommands";
import type { VoiceLang } from "@/lib/voiceLexicon";

export interface VoiceForm {
  id: string;
  title: string;
  sop_number: string;
  revision: string | null;
  status: string;
  content: unknown;
}

/** The handoff FormEntry consumes once, from router state. */
export interface VoiceCommandState {
  v: 1;
  /** A second command on an entry that is already open is a new nonce, so it applies again. */
  nonce: string;
  responseId: string;
  fill: VoiceFill;
  transcript: string;
  /** The language the banner is shown in. Absent on a handoff from before Spanish: English. */
  uiLang?: VoiceLang;
}

export async function fetchVoiceForm(formNumber: string): Promise<VoiceForm> {
  const { data, error } = await (supabase as any)
    .from("sop_documents")
    .select("id, title, sop_number, revision, status, type, content")
    .eq("sop_number", formNumber)
    .eq("type", "form")
    .neq("status", "archived");
  if (error) throw error;
  const rows = (data ?? []) as VoiceForm[];
  if (rows.length === 0) throw new Error(`${formNumber} is not in the SOPs Library, so there is nowhere to record this.`);
  if (rows.length > 1) throw new Error(`There is more than one ${formNumber} in the SOPs Library. Ask an admin to archive the extra one.`);
  if (!getFormSchema(rows[0].content)) throw new Error(`${formNumber} has no fields set up yet.`);
  return rows[0];
}

/** The signed-in user's open drafts of this form for one production date, newest first. */
export async function findTodaysDrafts(formId: string, productionDate: string): Promise<FormResponse[]> {
  const { data: auth } = await supabase.auth.getUser();
  const userId = auth?.user?.id;
  if (!userId) throw new Error("Not signed in");
  const { data, error } = await (supabase as any)
    .from("sop_document_responses")
    .select("*")
    .eq("document_id", formId)
    .eq("created_by", userId)
    .eq("status", "draft")
    .eq("data->>production_date", productionDate)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return (data ?? []) as FormResponse[];
}

/** A new entry for the day, with the product already filled. Only ever called after the operator taps. */
export function createVoiceEntry(form: VoiceForm, fill: VoiceFill): Promise<FormResponse> {
  return createResponse(form, { production_date: fill.productionDate, product: fill.entryFields.product });
}

export function newVoiceState(responseId: string, fill: VoiceFill, transcript: string, uiLang: VoiceLang = "en"): VoiceCommandState {
  const nonce = typeof crypto !== "undefined" && typeof crypto.randomUUID === "function"
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  return { v: 1, nonce, responseId, fill, transcript, uiLang };
}
