import { useEffect, useMemo, useRef, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Upload, FileText, Download } from "lucide-react";
import { fetchActiveTemplates, downloadTemplate, type ActiveTemplate } from "@/lib/templates";
import { cn } from "@/lib/utils";
import { extractPrfFromPdf, type PrfImportResult } from "@/lib/prfPdfImport";
import { PrfImportPanel } from "./PrfImportPanel";

interface AddDealDialogProps {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onCreated?: (prfId: string) => void;
}

type LeadOption = {
  id: string;
  company_name: string;
  contact_name: string | null;
  email: string | null;
  archived: boolean;
};

const MAX_SUGGESTIONS = 8;

// Read from the PDF but owned by the visible inputs above the panel: they pre-fill those boxes
// instead of being saved from the proposal, so listing them with a checkbox would offer a toggle
// that does nothing.
const DIALOG_OWNED = new Set(["company_name", "product_name"]);

// Prefix hits rank above mid-string ones, so typing "Guilt" offers "Guilt Free"
// before "No Guilt Baking Co".
const matchCompanies = (leads: LeadOption[], query: string): LeadOption[] => {
  const q = query.trim().toLowerCase();
  if (!q) return [];
  const rank = (name: string) => (name.toLowerCase().startsWith(q) ? 0 : 1);
  return leads
    .filter((l) => l.company_name.toLowerCase().includes(q))
    .sort((a, b) => rank(a.company_name) - rank(b.company_name) || a.company_name.localeCompare(b.company_name))
    .slice(0, MAX_SUGGESTIONS);
};

export const AddDealDialog = ({ open, onOpenChange, onCreated }: AddDealDialogProps) => {
  const [company, setCompany] = useState("");
  const [contact, setContact] = useState("");
  const [email, setEmail] = useState("");
  const [product, setProduct] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const [prfTpl, setPrfTpl] = useState<ActiveTemplate | null>(null);
  const [existingLead, setExistingLead] = useState<{ id: string; company_name: string | null; contact_name: string | null } | null>(null);
  const [checkingEmail, setCheckingEmail] = useState(false);
  const [leads, setLeads] = useState<LeadOption[]>([]);
  const [suggestOpen, setSuggestOpen] = useState(false);
  const [highlight, setHighlight] = useState(0);
  const [pickedLead, setPickedLead] = useState<LeadOption | null>(null);
  const [importBusy, setImportBusy] = useState(false);
  const [importResult, setImportResult] = useState<PrfImportResult | null>(null);
  const [accepted, setAccepted] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (!open) return;
    fetchActiveTemplates().then(t => setPrfTpl(t.prf_template));

    // The client list is small enough to hold in memory, so the company field
    // filters locally — no round trip per keystroke and no out-of-order
    // responses to guard against. Archived clients are included on purpose:
    // checkExistingClient() below matches by email with no stage filter, so
    // hiding them here would let staff re-key a company that the email check
    // then reports as already on file.
    (async () => {
      const { data } = await (supabase as any)
        .from("sales_leads")
        .select("id, company_name, contact_name, email, stage")
        .not("company_name", "is", null)
        .order("company_name")
        .limit(1000);

      const seen = new Set<string>();
      const opts: LeadOption[] = [];
      for (const l of (data ?? []) as any[]) {
        const name = (l.company_name ?? "").trim();
        if (!name) continue;
        const key = `${name.toLowerCase()}|${(l.email ?? "").toLowerCase()}`;
        if (seen.has(key)) continue;
        seen.add(key);
        opts.push({
          id: l.id,
          company_name: name,
          contact_name: l.contact_name,
          email: l.email,
          archived: l.stage === "Archived",
        });
      }
      setLeads(opts);
    })();
  }, [open]);

  const matches = useMemo(() => matchCompanies(leads, company), [leads, company]);

  const showSuggestions =
    suggestOpen &&
    matches.length > 0 &&
    // Once the typed name is itself the only hit there is nothing left to offer.
    !(matches.length === 1 && matches[0].company_name.toLowerCase() === company.trim().toLowerCase());

  const reset = () => {
    setCompany(""); setContact(""); setEmail(""); setProduct(""); setFile(null); setExistingLead(null);
    setSuggestOpen(false); setHighlight(0); setPickedLead(null);
    setImportBusy(false); setImportResult(null); setAccepted(new Set());
  };

  // Picking a company only fills what is still blank. The email is what
  // actually routes the deal to a folder (the PRF trigger matches on it), so it
  // is never silently rewritten out from under whatever staff already typed.
  const pickLead = (lead: LeadOption) => {
    setCompany(lead.company_name);
    setPickedLead(lead);
    setSuggestOpen(false);
    if (!contact.trim() && lead.contact_name) setContact(lead.contact_name);
    if (!email.trim() && lead.email) {
      setEmail(lead.email);
      setExistingLead({ id: lead.id, company_name: lead.company_name, contact_name: lead.contact_name });
    }
  };

  const companyKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (!showSuggestions) return;
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setHighlight(h => (h + 1) % matches.length);
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setHighlight(h => (h - 1 + matches.length) % matches.length);
    } else if (e.key === "Enter") {
      e.preventDefault();
      pickLead(matches[highlight] ?? matches[0]);
    } else if (e.key === "Tab") {
      setSuggestOpen(false);
    }
  };

  // Typed a partial name and moved on without picking a row. Saving it verbatim
  // would open a second client folder under a half-typed name — the duplicate
  // this field exists to prevent — so offer the one company it can only mean.
  // Only fires when the match is unambiguous; two candidates is a guess, not a
  // correction.
  const didYouMean = useMemo(() => {
    const typed = company.trim().toLowerCase();
    if (!typed || suggestOpen) return null;
    if (leads.some(l => l.company_name.toLowerCase() === typed)) return null;
    const hits = matchCompanies(leads, company);
    return hits.length === 1 ? hits[0] : null;
  }, [company, leads, suggestOpen]);

  // The picked company is on file under a different address than the one typed,
  // so this deal will open a second folder for the same company. Suppressed when
  // the email already matched a folder — that banner covers where it lands.
  const pickedEmailMismatch =
    !existingLead &&
    !!pickedLead?.email &&
    !!email.trim() &&
    email.trim().toLowerCase() !== pickedLead.email.toLowerCase();

  // Same client-matching the PRF trigger uses (by email) — surfaced here so
  // staff see right away that this deal will land on an existing folder
  // instead of creating a duplicate, and so we don't blank out good data
  // already on file.
  const checkExistingClient = async (override?: string) => {
    const trimmed = (override ?? email).trim().toLowerCase();
    if (!trimmed) { setExistingLead(null); return; }
    setCheckingEmail(true);
    const { data } = await (supabase as any)
      .from("sales_leads")
      .select("id, company_name, contact_name")
      .ilike("email", trimmed)
      .maybeSingle();
    setCheckingEmail(false);
    setExistingLead(data || null);
    if (data) {
      if (!company.trim() && data.company_name) setCompany(data.company_name);
      if (!contact.trim() && data.contact_name) setContact(data.contact_name);
    }
    return data ?? null;
  };

  // Reads the attached PRF and offers what it found. Everything is a proposal: the values only
  // reach the database for rows still ticked when the deal is created. The blank dialog inputs are
  // pre-filled directly so staff can see the company and contact without opening the panel — and
  // so the email lands in the existing-client check, which is what routes the deal to a folder.
  const runImport = async (f: File) => {
    setImportBusy(true);
    setImportResult(null);
    setAccepted(new Set());
    try {
      const result = await extractPrfFromPdf(f);
      setImportResult(result);
      if (!result.ok) return;
      setAccepted(new Set(result.fields.filter((x) => !DIALOG_OWNED.has(x.column)).map((x) => x.column)));

      const read = (column: string) => {
        const v = result.fields.find((x) => x.column === column)?.value;
        return typeof v === "string" ? v.trim() : "";
      };
      if (!product.trim() && read("product_name")) setProduct(read("product_name"));
      if (!contact.trim() && read("technical_contact_name")) setContact(read("technical_contact_name"));

      const pdfEmail = read("technical_contact_email");
      let matched: { company_name?: string | null } | null = null;
      if (!email.trim() && pdfEmail) {
        setEmail(pdfEmail);
        matched = await checkExistingClient(pdfEmail);
      }

      // When the address is already on file, the folder's own spelling wins over the form's. These
      // PDFs are typed in caps ("GUILT FREE BITES LLC"), and a variant spelling of a company that
      // already exists is exactly how the duplicate-folder problem starts.
      if (!company.trim()) {
        const name = matched?.company_name || read("company_name");
        if (name) setCompany(name);
      }
    } catch (e: any) {
      // A failed read must never block filing the document.
      setImportResult({ ok: false, reason: e?.message || "The PRF could not be read." });
    } finally {
      setImportBusy(false);
    }
  };

  const onFilePicked = (f: File | null) => {
    setFile(f);
    setImportResult(null);
    setAccepted(new Set());
    if (f) runImport(f);
  };

  /** What the review panel shows — the proposal minus the fields the inputs above already own. */
  const reviewable = useMemo(
    () =>
      importResult?.ok
        ? { ...importResult, fields: importResult.fields.filter((f) => !DIALOG_OWNED.has(f.column)) }
        : importResult,
    [importResult],
  );

  /** Accepted values, keyed by column, ready to merge into the insert. */
  const importedPayload = () => {
    if (!reviewable?.ok) return {};
    const payload: Record<string, unknown> = {};
    for (const f of reviewable.fields) {
      if (accepted.has(f.column)) payload[f.column] = f.value;
    }
    return payload;
  };

  const submit = async () => {
    if (!email.trim()) { toast.error("Email is required"); return; }
    if (!file) { toast.error("Please attach the PRF file"); return; }

    setBusy(true);
    try {
      // Insert PRF submission first to get id
      // owner_user_id intentionally left null here — this is a staff member
      // manually logging a deal, not a real client portal account. Stamping
      // the staff member's own id would make sales_leads.profile_id collide
      // with every other deal that staffer manually adds.
      const { data: prf, error: prfErr } = await (supabase as any)
        .from("prf_submissions")
        .insert({
          // Values read from the PDF go first so the explicit fields below always win.
          ...importedPayload(),
          email: email.trim().toLowerCase(),
          company_name: company.trim() || null,
          customer_name: contact.trim() || null,
          product_name: product.trim() || null,
          company_stage: "Established",
          status: "new",
          sales_stage: "Lead In",
          sales_stage_updated_at: new Date().toISOString(),
          submitted_at: new Date().toISOString(),
          owner_user_id: null,
        })
        .select("id")
        .single();
      if (prfErr) throw prfErr;

      // Upload file
      const ext = file.name.split(".").pop() || "bin";
      const path = `${prf.id}/${Date.now()}-${file.name.replace(/[^a-zA-Z0-9._-]/g, "_")}`;
      const { error: upErr } = await supabase.storage.from("prf-uploads").upload(path, file, {
        contentType: file.type || undefined,
        upsert: false,
      });
      if (upErr) throw upErr;

      // Save attachment reference on the PRF
      await (supabase as any)
        .from("prf_submissions")
        .update({
          data_json: { prf_file: { path, name: file.name, size: file.size, type: file.type, uploaded_at: new Date().toISOString() } },
        })
        .eq("id", prf.id);

      toast.success("Deal created");
      reset();
      onOpenChange(false);
      onCreated?.(prf.id);
    } catch (e: any) {
      toast.error(e.message || "Failed to create deal");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!busy) { onOpenChange(v); if (!v) reset(); } }}>
      <DialogContent
        className="max-w-lg"
        // Escape should dismiss the company suggestions first, not the whole
        // dialog. Radix listens on document in the capture phase, so stopping
        // the event from the input's own handler is too late — this prop is the
        // only point that runs before it decides to close.
        onEscapeKeyDown={(e) => {
          if (showSuggestions) { e.preventDefault(); setSuggestOpen(false); }
        }}
      >
        <DialogHeader>
          <DialogTitle>Add deal</DialogTitle>
          <DialogDescription>
            Upload the client's PRF and capture basic contact info. The deal will land in <strong>Lead In</strong>.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-3">
          <div className="grid grid-cols-2 gap-3">
            <div className="relative">
              <Label htmlFor="ad-company">Company</Label>
              <Input
                id="ad-company"
                value={company}
                onChange={(e) => { setCompany(e.target.value); setSuggestOpen(true); setHighlight(0); setPickedLead(null); }}
                onFocus={() => setSuggestOpen(true)}
                onBlur={() => setSuggestOpen(false)}
                onKeyDown={companyKeyDown}
                placeholder="Acme Foods"
                autoComplete="off"
                role="combobox"
                aria-expanded={showSuggestions}
                aria-autocomplete="list"
                aria-controls="ad-company-suggestions"
                aria-activedescendant={showSuggestions ? `ad-company-opt-${highlight}` : undefined}
              />
              {showSuggestions && (
                <ul
                  id="ad-company-suggestions"
                  role="listbox"
                  className="absolute z-50 mt-1 w-full max-h-56 overflow-auto rounded-md border bg-popover py-1 shadow-md"
                >
                  {matches.map((lead, i) => (
                    <li
                      key={lead.id}
                      id={`ad-company-opt-${i}`}
                      role="option"
                      aria-selected={i === highlight}
                      // Keep focus on the input so onBlur cannot close the list
                      // out from under the click that is selecting a row.
                      onMouseDown={(e) => e.preventDefault()}
                      onMouseEnter={() => setHighlight(i)}
                      onClick={() => pickLead(lead)}
                      className={cn("cursor-pointer px-3 py-1.5", i === highlight && "bg-accent text-accent-foreground")}
                    >
                      <div className="flex items-center gap-2 text-sm font-medium">
                        <span className="truncate">{lead.company_name}</span>
                        {lead.archived && (
                          <span
                            className={cn(
                              "shrink-0 rounded border px-1 text-[10px] uppercase tracking-wide",
                              i === highlight ? "text-accent-foreground/90" : "text-muted-foreground",
                            )}
                          >
                            Archived
                          </span>
                        )}
                      </div>
                      {(lead.contact_name || lead.email) && (
                        // muted-foreground is paired with the popover background, not with
                        // bg-accent — on the highlighted row it drops to ~1.8:1. Fall back to
                        // the accent's own foreground so the row stays legible when selected.
                        <div
                          className={cn(
                            "truncate text-xs",
                            i === highlight ? "text-accent-foreground/90" : "text-muted-foreground",
                          )}
                        >
                          {[lead.contact_name, lead.email].filter(Boolean).join(" · ")}
                        </div>
                      )}
                    </li>
                  ))}
                </ul>
              )}
            </div>
            <div>
              <Label htmlFor="ad-contact">Contact name</Label>
              <Input id="ad-contact" value={contact} onChange={(e) => setContact(e.target.value)} placeholder="Jane Doe" />
            </div>
          </div>
          {checkingEmail && (
            <p className="text-xs text-muted-foreground">Checking for an existing client…</p>
          )}
          {existingLead && (
            <p className="text-xs rounded-md border border-primary/30 bg-primary/5 px-3 py-2">
              Existing client found{existingLead.company_name ? ` — ${existingLead.company_name}` : ""}
              {existingLead.contact_name ? ` (${existingLead.contact_name})` : ""}. This deal will be added to their folder, not a new one.
            </p>
          )}
          {didYouMean && (
            <p className="text-xs rounded-md border border-primary/30 bg-primary/5 px-3 py-2">
              Did you mean{" "}
              <button
                type="button"
                onClick={() => pickLead(didYouMean)}
                className="font-medium text-primary underline underline-offset-2"
              >
                {didYouMean.company_name}
              </button>
              ? Saving “{company.trim()}” as typed starts a new client folder.
            </p>
          )}
          {pickedEmailMismatch && (
            <p className="text-xs rounded-md border border-amber-500/40 bg-amber-500/5 px-3 py-2">
              <strong>{pickedLead!.company_name}</strong> is on file under {pickedLead!.email}. Saving with a
              different email opens a second folder for the same company.
            </p>
          )}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label htmlFor="ad-email">Email *</Label>
              <Input
                id="ad-email"
                type="email"
                value={email}
                onChange={(e) => { setEmail(e.target.value); setExistingLead(null); }}
                // Wrapped, not passed directly — the handler takes an optional email override and
                // would otherwise receive the FocusEvent as that argument.
                onBlur={() => checkExistingClient()}
                placeholder="jane@acme.com"
              />
            </div>
            <div>
              <Label htmlFor="ad-product">Product name</Label>
              <Input id="ad-product" value={product} onChange={(e) => setProduct(e.target.value)} placeholder="Sourdough crackers" />
            </div>
          </div>

          <div>
            <div className="flex items-center justify-between">
              <Label>PRF file *</Label>
              <button
                type="button"
                onClick={() => downloadTemplate(prfTpl, "prf_template")}
                disabled={!prfTpl}
                className="text-xs text-primary underline-offset-2 hover:underline disabled:opacity-40 disabled:no-underline inline-flex items-center gap-1"
                title={prfTpl ? "Download a blank PRF to fill out" : "No PRF template uploaded yet (admin must add one in Templates)"}
              >
                <Download className="w-3 h-3" /> Don't have one? Download blank PRF
              </button>
            </div>
            <input
              ref={fileRef}
              type="file"
              accept=".pdf,.doc,.docx,.xls,.xlsx,.csv,.txt,.png,.jpg,.jpeg"
              className="hidden"
              onChange={(e) => onFilePicked(e.target.files?.[0] ?? null)}
            />
            <button
              type="button"
              onClick={() => fileRef.current?.click()}
              className="mt-1 w-full border border-dashed rounded-md p-4 flex items-center gap-3 hover:bg-muted/40 text-left"
            >
              {file ? <FileText className="w-5 h-5" /> : <Upload className="w-5 h-5" />}
              <div className="text-sm">
                {file ? (
                  <>
                    <div className="font-medium">{file.name}</div>
                    <div className="text-xs text-muted-foreground">{(file.size / 1024).toFixed(1)} KB · click to replace</div>
                  </>
                ) : (
                  <>
                    <div className="font-medium">Click to upload PRF</div>
                    <div className="text-xs text-muted-foreground">PDF, Word, Excel, image — max 20 MB</div>
                  </>
                )}
              </div>
            </button>

            {(importBusy || importResult) && (
              <div className="mt-2">
                <PrfImportPanel
                  busy={importBusy}
                  result={reviewable}
                  accepted={accepted}
                  onToggle={(column) =>
                    setAccepted((prev) => {
                      const next = new Set(prev);
                      if (next.has(column)) next.delete(column);
                      else next.add(column);
                      return next;
                    })
                  }
                  onToggleAll={(on) =>
                    setAccepted(
                      on && reviewable?.ok ? new Set(reviewable.fields.map((f) => f.column)) : new Set(),
                    )
                  }
                />
              </div>
            )}
          </div>
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)} disabled={busy}>Cancel</Button>
          <Button onClick={submit} disabled={busy}>{busy ? "Creating…" : "Create deal"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default AddDealDialog;
