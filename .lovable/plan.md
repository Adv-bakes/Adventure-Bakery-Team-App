## Decisions from this round

1. **PSS = same content in two formats** (workbook + questionnaire). We mirror the PRF pattern: in-app wizard → DB → auto-PDF emailed to prospect + sales inbox. No manual upload of the PSS file.
2. **NDA still needs file upload** (signed PDF). One pre-signed master NDA lives in a templates bucket; it's emailed out, prospect countersigns and uploads back.
3. **No "Send Documents" button.** When sales accepts the PRF, the email goes out automatically and the lead advances to `Send Documents`. Saves a click and prevents drop-off.
4. **`lead_id` is correct.** A "client" in this app = `sales_leads` row. `profile_id` only exists after signup. We key on `lead_id`, also stamp `profile_id` when present.
5. **Resumable wizard with magic-link token** (same draft pattern as `stage2_prf_submissions`).
6. **Review-all screen with per-field pencil edit** that jumps to that step and shows a `Return to review` button.
7. **Multi-product**: `Submit` + `Submit and add another product` — second click clones the wizard with header pre-filled, fresh recipe/process.

## End-to-end flow

```text
Sales accepts PRF in inbox
   ↓ (automatic, no button)
   ├─ Stage → "Send Documents", stage_updated_at = now
   ├─ Create document_send_token (60-day expiry)
   ├─ Create empty pss_submissions row (status=draft, lead_id, draft_token)
   └─ Resend email to prospect (CC sales team):
       • Subject: "Next step — your NDA + product spec sheet"
       • Body lists the PSS sections so they know what to gather:
           Company & product · Target weight & dimensions · Recipe (ingredients + weights)
           · Process (mix / form / bake / freeze) · Packaging · Optional: nutritionals / allergens / shelf life
       • Two clear paths:
           ① "Fill it online (recommended, save & resume)" → /p/pss/:token
           ② "Prefer offline? Download the PSS workbook (.xlsx) and reply with it"
       • Pre-signed NDA attached as PDF → countersign and upload at /p/pss/:token

Prospect clicks magic link  → /p/pss/:token  (public, iframe-safe, no auth)
   ├─ Panel A: NDA upload (drop a signed PDF)
   └─ Panel B: PSS wizard (steps below). Auto-saves every step.
                Closing the tab is fine — same link reopens to the last step.

Wizard finishes → Review-all screen (pencil-edit per field) → Submit
   ├─ Generates PSS PDF, stores in product-spec-sheets bucket
   ├─ Inserts client_documents row (type=pss, review_status=ai_passed, data already structured)
   ├─ Resend the PDF copy to prospect + CC sales team
   ├─ Stage → "Follow-Up"
   └─ Shows: [Done] · [Submit another product] (clones header, fresh recipe/process, same token reused)
```

## PSS wizard — steps

1. Company & product header (most fields pre-filled from PRF)
2. Product specs — target raw weight, baked weight, dimensions, shape, intended use, shelf-life target
3. Recipe — repeater rows: ingredient name + weight (+ unit). Total batch weight auto-sums. % derived live (read-only preview)
4. Process — method dropdown (no-bake / melt-kettle / loose-batter / extruder+wire / round former / die-press / manual), ordered steps with ingredients-added-at-this-step, mix time/speed, dough temp, bake temp/time, post-bake freeze
5. Packaging — primary vessel + units/pack, secondary case + units/case + lot-code printing, palletizing
6. Optional sections — nutritionals / allergens / shelf-life test data (clearly marked "skip if unknown")
7. **Review-all** — every answer rendered with a pencil ✏ that jumps to that step. The destination step shows a `← Return to review` button at the top. Submit at the bottom.

## Email — content sketch

```text
Subject: Next step with Adventure Bakery — your NDA + product spec sheet

Hi {first_name},

Two short things to get your project moving:

1) NDA — sign the attached PDF and upload it at the link below.

2) Product Spec Sheet (PSS) — the easiest way is to fill it online.
   It auto-saves, so you can step away and come back any time using
   this same link.

   Sections we'll cover (so you can gather what you need):
     • Company & product info
     • Target unit weight & dimensions
     • Recipe — ingredients with their weights per batch
     • Process — mixing, forming, baking, freezing
     • Packaging — retail unit, case, pallet
     • Optional — nutritionals, allergens, shelf-life data

   → Open your secure link: https://app.../p/pss/{token}

Prefer to do it offline? Download the workbook and reply with it filled in:
   → PSS workbook (.xlsx)

— Adventure Bakery sales team
```

## Database

### New tables

- **`document_templates`** — `kind` (`'nda' | 'pss_workbook'`), `version`, `file_path`, `file_name`, `is_active`, `uploaded_by`, `uploaded_at`. Staff write, service-role read.
- **`pss_submissions`** — `id` (text PK), `lead_id` (uuid → sales_leads), `profile_id` (nullable), `prospect_email`, `draft_token`, `status` (`draft|submitted`), `data_json`, `submitted_at`, `created_at`. Public anon writes only via SECURITY DEFINER RPCs that match on `draft_token`. Staff full read.
- **`document_send_tokens`** — `token` (PK), `lead_id`, `prospect_email`, `expires_at`, `created_at`. Resolved by anon only via RPC.

### New RPCs (all SECURITY DEFINER)

- `validate_send_token(token)` → `{ valid, expired, lead_id, prospect_email, company_name, contact_name }`
- `get_pss_draft(_id, _token)` → row
- `save_pss_draft(_id, _token, _data)` → bool (autosave)
- `submit_pss_draft(_id, _token, _data)` → bool (flips to `submitted`)
- `start_additional_pss(_token)` → new draft id (for "Submit another product")

### New storage buckets

- `document-templates` (private) — pre-signed NDA + PSS workbook master files.

### Trigger / automation

- When `prf_submissions.status` flips to `accepted`, edge function `send-client-documents` is called (no manual button). It creates the token + draft + sends the email.

## Edge functions

- **`send-client-documents`** — staff-callable AND callable from the inbox accept-handler. Creates `document_send_tokens` + empty `pss_submissions` draft, downloads active NDA PDF, sends Resend email with attachments + magic link, logs to `client_activity`.
- **`finalize-pss-submission`** — called from the wizard's Submit. Renders PSS PDF, uploads to `product-spec-sheets/{lead_id}/pss_{id}.pdf`, inserts `client_documents` (type=pss, structured data already in `review_notes`), Resend's the PDF, advances `sales_leads.stage`. Returns `{ success, can_add_another: true }`.

## Frontend

### New

- `src/pages/team/Templates.tsx` (`/team/sales/templates`, staff-only) — single card to upload the active pre-signed NDA + active PSS workbook (.xlsx).
- `src/pages/public/PssIntake.tsx` (`/p/pss/:token`, public, iframe-safe) — token resolution + the two panels (NDA upload + PSS wizard).
- `src/components/pss/PssWizard.tsx` — multi-step form, autosave on every step, review-all screen with per-field ✏ jump + `← Return to review` button.
- `src/components/pss/PssWizardSubmitDialog.tsx` — post-submit choice: `Done` / `Submit another product`.

### Edited

- `src/pages/sales/SalesDocumentsInbox.tsx` — `accept(row)` no longer just stamps the stage; it invokes `send-client-documents` (success toast: "Accepted — documents emailed to {email}").
- `src/pages/sales/SalesPipeline.tsx` — remove the future "Send Documents" button idea; `Send Documents` becomes purely a status column showing the lead is waiting on the prospect.
- `src/components/sales/DocumentReviewPanel.tsx` — for PSS uploaded via wizard, skip AI extraction (data already canonical), jump straight to the batch-sheet preview.

## What the user uploads after this ships

Two files, one time, in `/team/sales/templates`:
1. Pre-signed NDA PDF (use `Signed_NDA.pdf`).
2. PSS workbook (.xlsx) for offline-preferring clients (use `PSS_Product_Spec_Sheet_1.xlsx`).

The PDF questionnaire and the batch-sheet template are internal references — they don't ship into the running app.

## Out of scope

- Embedded e-signature (still rely on client signing the NDA PDF themselves)
- Reminder cron if prospect hasn't returned in N days (easy to add later)
- Editable batch-sheet UI
