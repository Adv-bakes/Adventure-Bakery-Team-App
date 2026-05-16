# PSS → Batch Sheet plan

## What will change

### 1. Make the PSS process flexible for baked and non-baked products
Update the PSS flow so the client can choose a process method that includes **No bake** and other non-bake flows like mixing, depositing, shaping, freezing, and packaging.

Rules:
- `method` is required.
- If method is **No bake**, bake temperature/time are not required.
- If method involves baking, bake temperature and bake time are required.
- Freeze/packaging steps can exist whether or not the product is baked.
- Equipment is **not** collected in this part of the flow.

### 2. Allow TBD for raw weight and incomplete packaging
The PSS should allow missing values when they are legitimately not known yet.

Rules:
- `target_unit_weight_raw` may be blank or explicitly marked `TBD`.
- Packaging can still use the existing placeholder/service path when the client needs Adventure Bakery to complete it.
- Validation should still require everything that belongs on the batch sheet unless it is one of the approved exceptions:
  - raw fill/target raw weight can be TBD
  - packaging can be incomplete if the client indicates Adventure Bakery will complete it
  - bake fields are not required for no-bake products

### 3. Capture mixing/process order more precisely in the PSS
Expand the process section so the client can describe the order of operations clearly.

For each process step, capture:
- step order
- action
- ingredient(s) added at that step
- mix time
- mix speed

Behavior:
- The client-entered process is the client-visible submitted version.
- The batch-sheet generator uses this order when seeding the internal draft.
- Coverage logic should tolerate grouped ingredient additions (multiple ingredients in one step).

### 4. Separate client-submitted process from Adventure Bakery proprietary process edits
Keep the client’s submitted process visible to the client, but store Adventure Bakery’s internal process changes separately and never expose them.

Rules:
- The client can see exactly what they submitted in the PSS.
- Staff can later replace or refine the internal process for production purposes.
- Internal process edits are proprietary and do not sync back into the client-facing PSS/concept copy.
- Equipment stays out of this process table for now and will be added later in pricing/quote logic.

### 5. Keep formula versioning
Client formula edits should create a new version rather than overwrite the current one.

Rules:
- Latest visible formula is the active one.
- Previous versions remain in history.
- Batch-sheet generation uses the current active formula version.

### 6. Remove sales review from PSS submission
PSS submissions should not wait for sales approval.

Rules:
- Client submit goes straight through once validation passes.
- Submission auto-creates/updates the downstream records and batch sheet draft.
- Staff are notified and authorized users can edit afterward.
- The Sales Documents Inbox should stop treating PSS as a manual review item.

### 7. Fix NDA viewing where it is actually broken
The remaining NDA issue appears to be in the **document review panel**, which currently opens the raw signed URL from `client_documents` storage. That can fail for PDFs served with the wrong content type.

Plan:
- Update the document review panel’s file-open behavior to use the same blob-with-corrected-MIME approach as the templates page.
- Keep a direct-link fallback action for stubborn browser/ad-blocker cases.
- Ensure NDA/PDF opens inline, while non-previewable files still download.

## Technical implementation

### Frontend
- `src/components/pss/PssWizard.tsx`
  - add no-bake aware validation
  - allow raw weight to be blank/TBD
  - refine process-step inputs for ordered ingredient additions, mix time, and mix speed
  - keep equipment out of this section
  - enforce conditional validation for bake vs no-bake flows
- `src/pages/sales/SalesDocumentsInbox.tsx`
  - remove PSS rows from the returned-documents review lane
- `src/components/sales/DocumentReviewPanel.tsx`
  - replace raw signed-link open with blob-based PDF viewing
  - add direct-link fallback action

### Edge functions
- `supabase/functions/finalize-pss-submission/index.ts`
  - validate submitted PSS using the new conditional rules
  - auto-finalize without sales review
  - create/update downstream records and notifications
- `supabase/functions/generate-batch-sheet-from-pss/index.ts`
  - respect no-bake flows
  - allow raw weight TBD
  - seed internal process draft from client-submitted ordered steps
  - keep client-submitted process data distinct from future proprietary process edits

### Database changes
Create a migration for:
- `formulas`
  - add versioning fields for active/superseded formula rows
- new `processes` table
  - staff-only proprietary internal process records
  - includes ordered steps, action, ingredients_added, mix_time, mix_speed, optional temp/time fields, notes, versioning markers
  - excludes equipment for now
- update server-side PSS submission validation logic to support conditional required fields
- update formula read access so clients only see the current active version where appropriate

## Data visibility rules
- Client sees:
  - everything they submitted in the PSS
  - current formula version
  - service outcomes / contracted deliverables
- Client does not see:
  - internal batch sheet
  - proprietary process edits made by Adventure Bakery
  - future internal-only additions unless they are part of a contracted service result

## Out of scope
- Process equipment modeling
- Pricing/quote logic equipment capture
- Rich formula diff UI
- Replacing the downstream Replit costing engine in this pass