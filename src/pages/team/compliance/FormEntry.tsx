import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useLocation, useNavigate, useParams } from "react-router-dom";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { supabase } from "@/integrations/supabase/client";
import { useUserRole } from "@/hooks/useUserRole";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { ArrowLeft, Camera, Download, ImagePlus, Loader2, LockOpen, ScanLine, Save, Send, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";
import {
  answerManifest, buildZodSchema, emptyValues, instanceTitle, mergeScanAnswers, valueFields,
  type FormSchema,
} from "@/lib/formSchema";
import {
  StaleResponseError, deleteResponse, extractFormAnswers, fetchProfileNames, fetchResponse,
  getResponseAttachmentUrl, reopenResponse, resolveSchemaForResponse, saveResponseAttachments,
  saveResponseData, shortUserId, submitResponse, uploadResponseAttachment,
  type FormResponse, type ResolvedSchema, type ResponseAttachment,
} from "@/lib/formResponses";
import { FormRenderer } from "@/components/team/forms/FormRenderer";
import { ResponseAttachments } from "@/components/team/forms/ResponseAttachments";
import type { Signer } from "@/components/team/forms/SignatureFieldInput";
import { generateFormResponsePdf } from "@/lib/formPdf";

const statusBadge: Record<string, string> = {
  draft: "bg-[#C89B3C]/20 text-[#9A6F1E] border-[#C89B3C]/40",
  submitted: "bg-green-500/20 text-green-700",
};

type DocRow = {
  id: string;
  title: string;
  sop_number: string | null;
  revision: string | null;
  effective_date: string | null;
  approved_by: string | null;
  type: string;
  content: any;
};

export default function FormEntry() {
  const { docId, responseId } = useParams<{ docId: string; responseId: string }>();
  const navigate = useNavigate();
  const location = useLocation();
  const { role } = useUserRole();
  const isAdmin = role === "admin" || role === "owner";

  const [doc, setDoc] = useState<DocRow | null>(null);
  const [response, setResponse] = useState<FormResponse | null>(null);
  const [resolved, setResolved] = useState<ResolvedSchema | null>(null);
  const [signer, setSigner] = useState<Signer | undefined>();
  const [fillerName, setFillerName] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [confirmSubmit, setConfirmSubmit] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [scanning, setScanning] = useState(false);
  const [scanResult, setScanResult] = useState<{ count: number; warnings: string[] } | null>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const scanInputRef = useRef<HTMLInputElement>(null);
  const scanConsumed = useRef(false);

  const schema: FormSchema | null = resolved?.schema ?? null;

  const form = useForm<Record<string, any>>({
    resolver: schema ? zodResolver(buildZodSchema(schema)) : undefined,
    mode: "onSubmit",
    defaultValues: {},
  });

  const load = async () => {
    if (!docId || !responseId) return;
    setLoading(true);
    try {
      const [{ data: docRow, error: docErr }, entry, { data: auth }] = await Promise.all([
        (supabase as any).from("sop_documents").select("*").eq("id", docId).maybeSingle(),
        fetchResponse(responseId),
        supabase.auth.getUser(),
      ]);
      if (docErr) throw docErr;
      if (!docRow) throw new Error("Form not found");
      if (!entry) throw new Error("Entry not found");
      setDoc(docRow as DocRow);
      setResponse(entry);

      const res = await resolveSchemaForResponse(docRow, entry);
      if (!res) throw new Error("This form has no fields defined");
      setResolved(res);

      const userId = auth?.user?.id;
      const names = await fetchProfileNames([entry.created_by, userId].filter(Boolean) as string[]);
      setFillerName(names.get(entry.created_by) || shortUserId(entry.created_by));
      if (userId) setSigner({ userId, name: names.get(userId) || auth?.user?.email || "Unknown" });

      form.reset({ ...emptyValues(res.schema), ...(entry.data ?? {}) });
    } catch (e: any) {
      toast.error(e.message ?? "Failed to load entry");
    } finally {
      setLoading(false);
    }
  };
  useEffect(() => { load(); }, [docId, responseId]);

  // Warn about unsaved edits when leaving the page. isDirty must be read during
  // render — RHF's formState is a subscription proxy, so reading it only inside
  // the event handler would never activate dirty tracking.
  const { isDirty } = form.formState;
  useEffect(() => {
    const handler = (e: BeforeUnloadEvent) => {
      if (isDirty) { e.preventDefault(); e.returnValue = ""; }
    };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [isDirty]);

  const isSubmitted = response?.status === "submitted";
  const isMine = !!signer && response?.created_by === signer.userId;
  const canEdit = !isSubmitted && (isMine || isAdmin);
  const readOnly = !canEdit;
  const deletable = schema?.settings?.deletable !== false;
  const attachmentsEnabled = schema?.settings?.attachmentsEnabled !== false;

  // Answers whose field ids no longer exist in the resolved schema — shown, never dropped.
  const unmapped = useMemo(() => {
    if (!schema || !response) return [];
    const known = new Set(valueFields(schema).map(f => f.id));
    return Object.entries(response.data ?? {}).filter(([k, v]) =>
      !known.has(k) && v != null && v !== "" && !(Array.isArray(v) && v.length === 0));
  }, [schema, response]);

  const applyResult = (updated: FormResponse) => {
    setResponse(updated);
    form.reset({ ...emptyValues(schema!), ...(updated.data ?? {}) });
  };

  const saveDraft = async () => {
    if (!response) return;
    setSaving(true);
    try {
      const updated = await saveResponseData(response.id, form.getValues(), response.updated_at);
      applyResult(updated);
      toast.success("Draft saved");
    } catch (e: any) {
      if (e instanceof StaleResponseError) toast.error(e.message);
      else toast.error(e.message ?? "Failed to save draft");
    } finally {
      setSaving(false);
    }
  };

  const doSubmit = form.handleSubmit(
    async values => {
      if (!response) return;
      setConfirmSubmit(false);
      setSubmitting(true);
      try {
        const updated = await submitResponse(response.id, values, response.updated_at);
        applyResult(updated);
        toast.success("Entry submitted");
      } catch (e: any) {
        if (e instanceof StaleResponseError) toast.error(e.message);
        else toast.error(e.message ?? "Failed to submit");
      } finally {
        setSubmitting(false);
      }
    },
    () => {
      setConfirmSubmit(false);
      toast.error("Fix the highlighted fields before submitting");
    },
  );

  // Photograph the completed paper copy → AI reads it → pre-fill the fields for
  // review. Photos are kept as entry attachments (the audit source of the
  // digitized record); nothing is written to the field data until the user
  // saves. form.reset (not save) mirrors applyResult and re-syncs grid arrays.
  const scanAndFill = async (files: FileList | File[]) => {
    if (!response || !schema) return;
    setScanning(true);
    setScanResult(null);
    try {
      const added: ResponseAttachment[] = [];
      for (const file of Array.from(files)) {
        added.push(await uploadResponseAttachment(response.id, file));
      }
      const updated = await saveResponseAttachments(response.id, [...(response.attachments ?? []), ...added]);
      setResponse(updated); // adopt fresh updated_at; keep photos on record

      const imageUrls = await Promise.all(added.map(a => getResponseAttachmentUrl(a.path)));
      const { answers, warnings } = await extractFormAnswers(answerManifest(schema), imageUrls);
      const count = Object.keys(answers).length;
      // Per-row grid merge (not a blind spread): keeps schema-seeded per-row
      // keys the extractor never returns — e.g. a register's _label/Location.
      const base = { ...emptyValues(schema), ...form.getValues() };
      form.reset(mergeScanAnswers(schema, base, answers));
      setScanResult({ count, warnings });
      if (count === 0) toast.warning("No readable field values were found in the photo.");
      else toast.success(`Pre-filled ${count} field${count === 1 ? "" : "s"} — review before saving`);
      if (warnings.length) toast.warning(warnings.slice(0, 3).join(" · "));
    } catch (e: any) {
      toast.error(e.message ?? "Failed to read the form photo");
    } finally {
      setScanning(false);
      if (cameraInputRef.current) cameraInputRef.current.value = "";
      if (scanInputRef.current) scanInputRef.current.value = "";
    }
  };

  // "New from Photo" (Entries tab) navigates here carrying the selected page
  // image(s) in router state; run the scan once the entry has loaded and is
  // editable, then clear the state so a back/refresh doesn't re-trigger it.
  useEffect(() => {
    const files = (location.state as any)?.scanFiles as File[] | undefined;
    if (!files?.length || scanConsumed.current) return;
    if (loading || !response || !schema || !canEdit) return;
    scanConsumed.current = true;
    navigate(location.pathname, { replace: true, state: {} });
    scanAndFill(files);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loading, response, schema, canEdit, location.state]);

  const handleAttachmentsChange = async (next: ResponseAttachment[]) => {
    if (!response) return;
    try {
      const updated = await saveResponseAttachments(response.id, next);
      setResponse(updated); // not applyResult — no need to form.reset() for an attachments-only change
    } catch (e: any) {
      toast.error(e.message ?? "Failed to save attachment");
    }
  };

  const reopen = async () => {
    if (!response) return;
    try {
      const updated = await reopenResponse(response.id);
      applyResult(updated);
      toast.success("Entry reopened for editing");
    } catch (e: any) {
      toast.error(e.message ?? "Failed to reopen");
    }
  };

  const doDelete = async () => {
    if (!response) return;
    setDeleting(true);
    try {
      await deleteResponse(response.id, (response.attachments ?? []).map(a => a.path));
      toast.success("Entry deleted");
      navigate(`/team/compliance/sops?doc=${docId}`);
    } catch (e: any) {
      toast.error(e.message ?? "Failed to delete entry");
    } finally {
      setDeleting(false);
      setConfirmDelete(false);
    }
  };

  const downloadPdf = async () => {
    if (!doc || !response || !schema) return;
    try {
      await generateFormResponsePdf(doc, schema, response, fillerName);
    } catch (e: any) {
      toast.error(e.message ?? "Failed to generate PDF");
    }
  };

  if (loading) {
    return <p className="text-sm" style={{ color: "rgba(245,241,230,0.6)" }}>Loading entry…</p>;
  }
  if (!doc || !response || !schema) {
    return (
      <div className="space-y-3">
        <p className="text-sm" style={{ color: "rgba(245,241,230,0.6)" }}>Entry not found.</p>
        <Link to="/team/compliance/sops" className="text-[#C89B3C] text-sm hover:underline">← Back to SOPs Library</Link>
      </div>
    );
  }

  return (
    <div className="space-y-4 max-w-7xl">
      {/* Header */}
      <div>
        <Link
          to={`/team/compliance/sops?doc=${doc.id}`}
          className="inline-flex items-center gap-1 text-xs text-[#C89B3C] hover:underline"
        >
          <ArrowLeft className="w-3.5 h-3.5" />Back to {doc.sop_number ?? "form"}
        </Link>
        <div className="flex flex-wrap items-center gap-2 mt-1.5">
          <h1 className="text-2xl font-bold" style={{ color: "#F5F1E6" }}>{doc.title}</h1>
          {doc.sop_number && <Badge variant="outline" className="font-mono text-[#F5F1E6]/80 border-[#C89B3C]/40">{doc.sop_number}</Badge>}
          <Badge variant="outline" className="text-[#F5F1E6]/80 border-[#C89B3C]/40">Rev {response.form_revision ?? doc.revision ?? "—"}</Badge>
          <Badge className={statusBadge[response.status]}>{response.status}</Badge>
        </div>
        <p className="text-xs mt-1" style={{ color: "rgba(245,241,230,0.55)" }}>
          {instanceTitle(schema, response, fillerName)} · filled by {fillerName || "—"}
          {response.submitted_at && ` · submitted ${format(new Date(response.submitted_at), "M/d/yyyy h:mm a")}`}
        </p>
      </div>

      {/* Schema-drift notices */}
      {resolved?.source === "snapshot" && (
        <Card className="p-3 text-xs border" style={{ background: "#FFF", borderColor: "rgba(200,155,60,0.4)" }}>
          This entry was filled against <strong>Rev {resolved.pinnedRevision}</strong> of the form and is shown exactly as it
          was recorded. The form has since been revised{doc.revision ? ` (current: Rev ${doc.revision})` : ""}.
        </Card>
      )}
      {resolved?.source === "fallback" && (
        <Card className="p-3 text-xs border border-amber-400 bg-amber-50 text-amber-800">
          This form has been revised since this entry was created (Rev {resolved.pinnedRevision} → Rev {doc.revision ?? "—"}),
          and the original layout is unavailable — some answers may not line up with the fields shown.
        </Card>
      )}

      {/* Fill from a photo of the completed paper copy */}
      {canEdit && (
        <Card className="p-3 space-y-2 border" style={{ background: "#FFF", borderColor: "rgba(200,155,60,0.4)" }}>
          <div className="flex flex-wrap items-center gap-2">
            <ScanLine className="w-4 h-4 text-[#9A6F1E]" />
            <p className="text-sm font-medium text-[#2A1F0E]">Fill from a photo</p>
            <p className="text-xs text-[#2A1F0E]/60">
              Photograph the completed paper copy — AI reads the handwriting/checkboxes and pre-fills the fields
              below for you to review. Add every page of a multi-page form.
            </p>
          </div>
          <input
            ref={cameraInputRef}
            type="file"
            accept="image/*"
            capture="environment"
            className="hidden"
            onChange={e => { if (e.target.files?.length) scanAndFill(e.target.files); }}
          />
          <input
            ref={scanInputRef}
            type="file"
            accept="image/*"
            multiple
            className="hidden"
            onChange={e => { if (e.target.files?.length) scanAndFill(e.target.files); }}
          />
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" size="sm" onClick={() => cameraInputRef.current?.click()} disabled={scanning}>
              {scanning ? <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" /> : <Camera className="w-3.5 h-3.5 mr-1.5" />}
              Take Photo
            </Button>
            <Button variant="outline" size="sm" onClick={() => scanInputRef.current?.click()} disabled={scanning}>
              {scanning ? <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" /> : <ImagePlus className="w-3.5 h-3.5 mr-1.5" />}
              Choose Photo(s)
            </Button>
            {scanning && <span className="text-xs text-[#2A1F0E]/60 self-center">Reading the form…</span>}
          </div>
          {scanResult && (
            <div className="text-xs rounded border p-2" style={{ borderColor: "rgba(200,155,60,0.4)", background: "rgba(200,155,60,0.08)" }}>
              <p className="text-[#2A1F0E]">
                {scanResult.count > 0
                  ? `AI pre-filled ${scanResult.count} field${scanResult.count === 1 ? "" : "s"} from your photo — review the values below, then Save Draft or Submit.`
                  : "No readable values were found. Check the photo is clear and in focus, or fill the fields in manually."}
              </p>
              {scanResult.warnings.length > 0 && (
                <ul className="mt-1 list-disc pl-4 text-[#9A6F1E]">
                  {scanResult.warnings.map((w, i) => <li key={i}>{w}</li>)}
                </ul>
              )}
            </div>
          )}
        </Card>
      )}

      {/* The form itself */}
      <FormRenderer schema={schema} form={form} readOnly={readOnly} isAdmin={isAdmin} signer={signer} />

      {/* File/photo attachments — always shown if any exist, even if the admin
          has since disabled the feature; add-controls only when editable and
          enabled, so uploaded evidence never silently disappears. */}
      {(attachmentsEnabled || (response.attachments?.length ?? 0) > 0) && (
        <ResponseAttachments
          responseId={response.id}
          attachments={response.attachments ?? []}
          onChange={canEdit && attachmentsEnabled ? handleAttachmentsChange : undefined}
        />
      )}

      {/* Answers that no longer map to a field — preserved, never dropped */}
      {unmapped.length > 0 && (
        <details className="rounded-md border p-3 text-xs" style={{ background: "#FFF", borderColor: "rgba(200,155,60,0.3)" }}>
          <summary className="cursor-pointer font-medium text-[#9A6F1E]">
            Unmapped answers ({unmapped.length}) — recorded against fields that no longer exist
          </summary>
          <div className="mt-2 space-y-1">
            {unmapped.map(([key, value]) => (
              <div key={key} className="flex gap-2">
                <span className="font-mono text-[#2A1F0E]/50">{key}:</span>
                <span className="text-[#2A1F0E]/80">{typeof value === "object" ? JSON.stringify(value) : String(value)}</span>
              </div>
            ))}
          </div>
        </details>
      )}

      {/* Action bar */}
      <div
        className="sticky bottom-0 -mx-1 px-1 py-3 flex flex-wrap items-center gap-2 border-t backdrop-blur"
        style={{ borderColor: "rgba(200,155,60,0.3)", background: "rgba(42,31,14,0.85)" }}
      >
        <Link
          to={`/team/compliance/sops?doc=${doc.id}`}
          className="inline-flex items-center gap-1 text-xs text-[#C89B3C] hover:underline"
        >
          <ArrowLeft className="w-3.5 h-3.5" />Back to {doc.sop_number ?? "form"}
        </Link>
        {canEdit && (
          <>
            <Button type="button" onClick={saveDraft} disabled={saving || submitting} variant="outline">
              <Save className="w-4 h-4 mr-1.5" />{saving ? "Saving…" : "Save Draft"}
            </Button>
            <Button
              type="button"
              onClick={() => setConfirmSubmit(true)}
              disabled={saving || submitting}
              className="bg-[#C89B3C] hover:bg-[#B8892C]"
            >
              <Send className="w-4 h-4 mr-1.5" />{submitting ? "Submitting…" : "Submit"}
            </Button>
          </>
        )}
        {isSubmitted && isAdmin && (
          <Button type="button" variant="outline" onClick={reopen}>
            <LockOpen className="w-4 h-4 mr-1.5" />Reopen
          </Button>
        )}
        {isSubmitted && !isAdmin && (
          <p className="text-xs" style={{ color: "rgba(245,241,230,0.55)" }}>
            Submitted entries are locked. Ask an admin to reopen it if a correction is needed.
          </p>
        )}
        <Button type="button" variant="outline" onClick={downloadPdf}>
          <Download className="w-4 h-4 mr-1.5" />Download PDF
        </Button>
        {isAdmin && deletable && (
          <Button
            type="button"
            variant="outline"
            className="ml-auto border-red-500/40 text-red-500 hover:bg-red-50 hover:text-red-600"
            onClick={() => setConfirmDelete(true)}
          >
            <Trash2 className="w-4 h-4 mr-1.5" />Delete Entry
          </Button>
        )}
      </div>

      {/* Submit confirmation */}
      <AlertDialog open={confirmSubmit} onOpenChange={setConfirmSubmit}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Submit this entry?</AlertDialogTitle>
            <AlertDialogDescription>
              Submitting locks the entry for editing{isAdmin ? " (admins can reopen it)" : " — only an admin can reopen it"}.
              Required fields are checked before it is recorded.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={() => doSubmit()} className="bg-[#C89B3C] hover:bg-[#B8892C]">
              Submit
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Delete confirmation */}
      <AlertDialog open={confirmDelete} onOpenChange={(o) => { if (!deleting) setConfirmDelete(o); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this entry?</AlertDialogTitle>
            <AlertDialogDescription>
              This permanently removes the filled-out record. It cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              disabled={deleting}
              onClick={(e) => { e.preventDefault(); doDelete(); }}
              className="bg-red-600 hover:bg-red-700 focus:ring-red-600"
            >
              {deleting ? "Deleting…" : "Delete Entry"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
