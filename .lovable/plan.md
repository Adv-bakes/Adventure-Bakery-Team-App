
## Goal

1. **Documents Inbox lane #2** — review returned NDA + PSS, then promote the lead into a real client folder.
2. **Project workspace** in the Client Folder mirroring the Brand Portal tabs (Concept, Ingredients, Formulas, Packaging, Shelf Life, Products), staff-side, with header quick-icons for **PRF · PSS · NDA · Batch Sheet**.
3. **Batch Sheet is generated from the PSS** — internal artifact, **Adventure Bakery only**, never client-visible. Process edits feed back into it.

## Workflow

```text
PRF accepted ─► Send Documents stage
                       │
                       ▼
   Client returns NDA + PSS  ──► Inbox lane #2
                       │
              AI review (generic provider)
                       │
              Staff Approves both
                       │
                       ├── PSS approved ──► auto-create/refresh Batch Sheet (internal)
                       │                    linked: batch_sheet.pss_document_id
                       │
                       └── NDA + PSS approved ──► lead → "Follow-Up"
                                                  client_activity('documents_completed')
```

## 1. PSS — partial submissions are OK

The PSS template (digital + PDF) marks these as **mandatory** — the client cannot submit without them:
- Company name
- Product name
- Recipe (ingredients + percentages)
- Process (steps)
- Target unit size + weight
- Units per primary pack
- Units per retail unit
- Human signature (for the client's own protection)

These are **optional** — when missing, the AI flags them as **"service offered"** rather than rejecting the PSS:
- Nutritional panel  → offer nutritional analysis service
- Allergen declaration → offer allergen review service
- Packaging spec  → offer packaging design service
- Shelf life data → offer shelf-life testing service

The Document Review side panel surfaces these as a **"Services we can offer this client"** list, which the salesperson can use as upsell talking points. Approval is allowed even with optional sections missing.

## 2. AI document review — generic provider

A small `lib/ai/reviewer.ts` abstraction so we can swap providers without touching the edge function logic.

```ts
// supabase/functions/_shared/ai.ts
export async function aiJSON({ system, user }): Promise<any> {
  const provider = Deno.env.get('AI_PROVIDER') ?? 'lovable';  // 'lovable' | 'openai' | 'ollama'
  // dispatches to the right gateway, all return parsed JSON
}
```

- **Default**: Lovable AI Gateway (already wired, no extra cost configuration)
- **Swap via env var** `AI_PROVIDER` + corresponding key — no code change needed
- **Ollama path** posts to `OLLAMA_BASE_URL` for self-hosted/cheap inference
- Model name is also env-driven (`AI_MODEL`)

This way you compare costs later by flipping a secret, not by re-deploying a different function.

Edge function `review-client-document`:
- Downloads from `product-spec-sheets` bucket (signed URL via service role)
- Extracts text (PDF → pdfjs / xlsx → `npm:xlsx`)
- Calls `aiJSON()` with a strict schema:
  - **NDA**: `{ fully_executed, signer_name, company, date, signature_present, issues[] }`
  - **PSS**: `{ has_required: { company, product, recipe, process, size_weight, units_per_primary, units_per_retail, signature }, missing_optional[], summary }`
- Writes to `client_documents.review_status` + `review_notes` (jsonb)

## 3. PSS approval — generate / overwrite the internal Batch Sheet

When a PSS row flips to `approved`, edge function `generate-batch-sheet-from-pss` runs:
- Reads PSS structured data + reuses `parse-batch-sheet` extraction
- **Upserts** `batch_sheets` keyed on `pss_document_id` — new drafts overwrite the previous one (per your rule)
- Stores `data_json` (recipe, process steps, equipment)
- Logs `client_activity('batch_sheet_drafted')`

Batch sheet is **internal-only** — RLS restricts it to `is_staff_or_admin(auth.uid())` and it has no client-portal route. The client never sees it.

## 4. Process edits feed the Batch Sheet

When staff edit the **Process** tab of a project (existing process editor) for a project that has a batch sheet, those edits write through to `batch_sheets.data_json.process_steps`. A small `useSyncProcessToBatchSheet(projectId)` hook in the project workspace handles the sync.

Client-portal Process view stays read-only for the client (no change there).

## 5. Client Folder — projects list

In `SalesClientFolder.tsx`:
- Rename **PRFs** tab → **Projects**
- Each row + Overview "Latest project" card → `/team/sales/clients/:leadId/projects/:prfId`

## 6. Project Workspace (NEW) — mirrors Brand Portal

```text
┌─ Header ─────────────────────────────────────────────────┐
│ ← Back · Product name · stage chip                       │
│ Quick docs:  [PRF] [PSS] [NDA] [Batch Sheet*]            │
│              *internal-only icon, gold tint              │
└──────────────────────────────────────────────────────────┘
┌─ Tabs ───────────────────────────────────────────────────┐
│ Concept · Ingredients · Formulas · Packaging ·           │
│ Shelf Life · Products · Costing · Notes                  │
└──────────────────────────────────────────────────────────┘
```

- Tabs are scoped read-views of existing data with "Open in editor" deep-link to the existing team pages — we don't rebuild editors.
- **PRF** → `PrfReviewPanel`
- **PSS** → signed URL (latest approved)
- **NDA** → signed URL (latest approved)
- **Batch Sheet** → side panel reading `batch_sheets`, staff-only

## 7. Database migration

```sql
ALTER TABLE public.client_documents
  ADD COLUMN review_status text DEFAULT 'pending',
  ADD COLUMN review_notes jsonb,
  ADD COLUMN reviewed_at timestamptz,
  ADD COLUMN reviewed_by uuid;
CREATE INDEX idx_client_docs_review
  ON public.client_documents (review_status, document_type);
UPDATE public.client_documents SET review_status = 'approved'
  WHERE review_status IS NULL OR review_status = 'pending';

ALTER TABLE public.prf_submissions ADD COLUMN concept_id bigint;
CREATE INDEX idx_prf_concept ON public.prf_submissions (concept_id);

CREATE TABLE public.batch_sheets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  pss_document_id text UNIQUE,            -- one batch sheet per PSS, edits overwrite
  concept_id bigint,
  lead_id uuid,
  client_user_id uuid,
  status text NOT NULL DEFAULT 'draft',   -- draft | approved
  data_json jsonb,                         -- recipe, process_steps, equipment
  generated_from text DEFAULT 'pss',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.batch_sheets ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Staff/admin all batch_sheets" ON public.batch_sheets
  FOR ALL TO authenticated
  USING (is_staff_or_admin(auth.uid()))
  WITH CHECK (is_staff_or_admin(auth.uid()));
```

## 8. PSS digital form — mandatory-field gating (deferred but flagged)

You're right that if the PSS is filled online we can simply prevent submit without the mandatory fields. That belongs in the Brand Portal PSS form, which is a **separate edit** I'll do right after this lands so this PR stays focused. Tracking it as a follow-up: "PSS form: enforce required fields client-side + server-side."

## 9. Files

**New**
- `src/pages/sales/SalesProjectWorkspace.tsx`
- `src/components/sales/DocumentReviewPanel.tsx`
- `src/components/sales/project-tabs/` (Concept, Ingredients, Formula, Packaging, ShelfLife, Products, Costing, BatchSheetPanel)
- `supabase/functions/_shared/ai.ts` (generic provider abstraction)
- `supabase/functions/review-client-document/index.ts`
- `supabase/functions/generate-batch-sheet-from-pss/index.ts`

**Edited**
- `src/pages/sales/SalesDocumentsInbox.tsx` — second lane
- `src/pages/sales/SalesClientFolder.tsx` — Projects tab + workspace link
- `src/App.tsx` — new route

## Out of scope (explicit follow-ups)

- PSS digital form mandatory-field gating (next PR)
- Full edit parity with Brand Portal in the new tabs (read + deep-link for v1)
- E-sign / NDA generation
- Inline batch-sheet editor (v1 = view + auto-regenerate from PSS + auto-sync from Process edits)

## Open question

NDA "signature_present" — text-extraction heuristic (looks for "Signed by:", signature-line, or visible signed-glyph blob on the page) is fine for v1, with ambiguous cases flagged for human review. True image-signature verification is deferred. OK?
