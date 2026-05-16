# End-to-end dry run + polish

Goal: walk one PRF through the full pipeline in the live preview, fix every gap we hit, and leave the flow demo-ready.

## The walk

```text
[PRF submitted]
   → /team/sales/inbox  (Lane 1)  → Accept
[Lead → "Send Documents"]
   → /team/sales/clients/:leadId  → upload NDA + PSS  (using existing staff upload in ClientDetail/AddClientFlow)
[Returned docs in inbox Lane 2]
   → DocumentReviewPanel  → Run AI review  → Approve NDA, Approve PSS
[Batch sheet auto-generated, stage → "Follow-Up"]
   → /team/sales/clients/:leadId/projects/:prfId
   → Quick-doc icons (PRF / PSS / NDA / Batch Sheet) all open
   → Tabs read PRF + extracted PSS data
```

## Known gaps to fix while walking

1. **Inbox case sensitivity.** Lane 2 query lists `["nda","pss","NDA","PSS"]` but new uploads aren't normalized. Normalize `document_type` to lowercase on insert in `ClientDetail.tsx` and `AddClientFlow.tsx`, and switch the inbox filter to a single canonical pair.

2. **PSS upload should land in inbox, not auto-approved.** Existing inserts don't set `review_status`, so the column default `'pending'` kicks in — good. But the migration force-approved all *existing* rows. Confirm new rows get `'pending'` and surface in Lane 2.

3. **Batch-sheet upsert type mismatch.** `batch_sheets.client_user_id` is `uuid` but `client_documents.user_id` is `text`. Cast/validate in the edge function before upsert (skip if not a valid UUID, log a warning) so a malformed user_id doesn't 500 the call.

4. **Lead lookup in batch-sheet generator.** Currently joins `sales_leads.profile_id = pss.user_id`. Confirm both sides resolve; otherwise fall back to email lookup via the document's uploader profile.

5. **Project Workspace defensive loading.** When a client has multiple PRFs, the workspace currently picks "any PSS" — scope to the most recent approved PSS, and show a small "no approved PSS yet" banner instead of a disabled button with no explanation.

6. **Stage advancement race.** `decide()` reads `client_documents` after the update but the just-approved doc may not be returned yet (RLS + timing). Already guarded with `justNda/justPss`, but also re-fetch the lead's PRFs and bump the linked PRF status to `accepted` if still `new`/`reviewing` — keeps the inbox tidy.

7. **Activity log.** Add `client_activity` rows for `nda_approved`, `pss_approved`, `documents_completed` already exists. Add `nda_rejected` / `pss_rejected` so the client folder Activity tab tells the full story.

8. **AI review UX.** Surface a tiny "AI provider: lovable/openai/ollama" hint in the panel header so we know which model produced the verdict; add a "Copy raw JSON" link for debugging.

9. **Quick-doc strip on workspace.** Add a 5th icon: "Send to client" placeholder that just toasts "Coming soon" — it's the natural next step from this screen and prevents users from looking for it.

10. **Empty / error states.** Inbox loading skeletons; workspace "Project not found" copy improvements; workspace returns to client folder via breadcrumb.

## Files touched

- `src/pages/sales/SalesDocumentsInbox.tsx` — normalize doc filter, loading skeleton.
- `src/pages/ClientDetail.tsx`, `src/pages/AddClientFlow.tsx` — lowercase `document_type` on insert; ensure `review_status` is left default (`pending`).
- `src/components/sales/DocumentReviewPanel.tsx` — provider hint, raw-JSON toggle, log rejection activity.
- `src/pages/sales/SalesProjectWorkspace.tsx` — most-recent-approved-PSS scoping, banner when missing, breadcrumb, "Send to client" placeholder.
- `supabase/functions/generate-batch-sheet-from-pss/index.ts` — UUID validation on `client_user_id`; email-fallback lead lookup.
- `supabase/functions/review-client-document/index.ts` — return `provider` in response so the panel can show it.

## Out of scope (next loop)

- Real PSS digital form with mandatory-field gating.
- Process-tab → batch_sheet sync.
- Filling out the workspace tabs with editable views (today they're read-only summaries).
- Client onboarding email automation.

## Validation

- After edits I'll open the preview, walk the seven steps above, and report any remaining issues.
