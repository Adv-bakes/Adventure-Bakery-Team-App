# Revised plan

## 1. Templates live on the Sales Dashboard — no sidebar entry

On the main Sales Dashboard (the screen you land on at `/team/sales/dashboard`), add a small "Templates" strip near the top with three download buttons side by side:

- **Download blank PRF**
- **Download NDA**
- **Download PSS workbook**

Each button fetches the currently active template from storage and downloads it directly — one click, no extra page. If no template has been uploaded yet for that kind, the button is disabled with a hover tooltip ("No template uploaded yet"). No sidebar item is added.

(The existing `/team/sales/templates` admin page stays as-is for uploading new versions, just unlinked from the sidebar — reachable only by URL when you need to swap a master file.)

## 2. Download button sits next to every Upload button

Wherever the app currently shows an Upload control, add a matching Download-template button right next to it, so if you don't have the file you can grab a blank copy in the same spot:

- **Add Deal dialog** — under the PRF upload box: "Don't have a PRF? Download blank template" link.
- **Project workspace, PRF row** — if no PRF on file: show **Upload PRF** + **Download blank PRF** side by side.
- **Project workspace, PSS row** — if no PSS on file: show **Upload PSS** + **Download PSS workbook** side by side.
- **Project workspace, NDA row** — if no signed NDA on file: show **Upload signed NDA** + **Download blank NDA** side by side.

No "send to client" button for now — the salesperson handles delivery themselves.

## 3. Inbox: keep the existing one-line layout, just include PSS

The inbox stays the same simple list it is today. Only change: the query also pulls PSS uploads (not just NDAs). Each row shows a small chip telling you which kind it is (NDA / PSS), the client, the file name, and the Review button. No new columns, no wide layout.

## 4. Client/project card lights up when something is waiting

When a PSS or NDA is uploaded for a client and not yet approved, the project card on the Sales Dashboard gets a small gold pill: **"PSS pending review"** (or NDA). Clicking the card opens the project workspace as today; from there a "Review in Inbox" button deep-links to the inbox row.

This is what makes Bahama Burger visibly "wake up" the moment you upload the PSS directly.

## 5. Batch sheet button always visible on the project workspace

Today the Generate Batch Sheet button only appears once a PSS is approved. Make it permanent in the project header, with its label reflecting state:

- No PSS yet → disabled, label: "Upload PSS to generate batch sheet"
- PSS pending review → disabled, label: "Approve PSS to generate batch sheet" (tooltip links to inbox)
- PSS approved → enabled, label: "Generate Batch Sheet"
- Batch sheet already created → label: "Open Batch Sheet"

## Out of scope

- The "background flash on page change" — fixing that separately so it can be tested in isolation.
- Any change to how the batch sheet itself is generated.
- Email-to-client flow for templates (skipped per your call — sales person fills it out themselves).

## Technical notes

- Download buttons call `supabase.storage.from('document-templates').createSignedUrl(...)` for the row in `document_templates` where `is_active = true` for that `kind`. No schema changes. New kind `prf_template` will be added to the existing `document_templates` table (it's a free-text column, no migration needed) — once you upload a PRF master via the existing `/team/sales/templates` admin page, the dashboard download button activates.
- Inbox query widens from `document_type = 'nda'` to `document_type IN ('nda','pss')`. `DocumentReviewPanel` already branches on `document_type`, so PSS reviews reuse the same side panel.
- Project-card "pending" pill driven by a single batched query of `client_documents` filtered to `review_status IN ('pending','ai_passed','ai_flagged')` keyed by lead.
