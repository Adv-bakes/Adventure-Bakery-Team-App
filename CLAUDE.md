# Adventure Bakery Team App — CLAUDE.md

## What This App Is
A B2B SaaS platform supporting end-to-end bakery product development. It has two portals:
- **Brand Portal** — client-facing; lets CPG brands submit PRFs, review formulas, specs, costing, shelf-life
- **Team Portal** — internal Adventure Bakery staff; covers sales, production ops, compliance/SOPs, HR training

---

## Tech Stack
| Layer | Library/Tool |
|-------|-------------|
| Framework | React 18 + TypeScript 5, Vite 5 (SWC) |
| Routing | React Router v6 |
| UI | shadcn/ui (Radix primitives) + Tailwind CSS 3 |
| Icons | Lucide React |
| Forms | React Hook Form + Zod |
| Server state | TanStack React Query v5 |
| Backend / Auth | Supabase (Postgres, Auth, Storage, Realtime) |
| Notifications | Sonner + custom `useToast` |
| Charts | Recharts |
| Date utils | date-fns |
| DOCX parsing | Mammoth + JSZip |
| XLSX parsing/export | ExcelJS (tolling inventory import/count sheets) |
| PDF generation | pdfmake (client-side SOP export) |
| Dark mode | next-themes |

---

## Project Structure
```
src/
  App.tsx               # All routes (74+)
  main.tsx              # Entry point; wraps in QueryClientProvider + BrowserRouter
  assets/               # Static images / icons
  components/
    ui/                 # shadcn/ui component set
    ops/                # Operations-domain components
    sales/              # Sales-domain components
    pss/                # PSS wizard
    team/               # Team-specific components
    AppSidebar.tsx      # Brand portal project sidebar
    BrandLayout.tsx     # Client portal layout wrapper
    TeamLayout.tsx      # Team portal layout wrapper (collapsible sidebar)
    ProtectedRoute.tsx  # Role-gated route wrapper
    CoachChat.tsx       # AI coach chat panel
  hooks/
    useUserRole.ts      # Fetches role from user_roles table
    useClientAccess.ts  # Checks profiles.access_granted flag
    use-mobile.tsx      # 768px breakpoint helper
    use-toast.ts        # Toast reducer (max 1 visible)
  integrations/supabase/
    client.ts           # Supabase client singleton
    types.ts            # Auto-generated Database TypeScript types
  lib/
    utils.ts            # cn() — clsx + tailwind-merge
    training.ts         # Training module types, fetchers, quiz helpers
    materialCalc.ts     # Batch material calculation engine
    sopDocxParser.ts    # DOCX → ParsedSop parser (mammoth + JSZip)
    templates.ts        # Document template fetch/download
  pages/
    team/hr/            # Training & SOPs pages (active development area)
    team/compliance/    # SOPs library
    team/operations/    # Batch sheets editor
    sales/              # Sales pipeline, clients, inbox
    ops/                # Orders, inventory, batch tracker, scout bot
    sections/           # Placeholder skeleton pages (Phase 0)
```

---

## Architecture

**Entry:** `main.tsx` → `App.tsx` (all routes defined here)

**Layout wrappers:**
- `BrandLayout` — client portal; sidebar nav driven by role (admin/staff/user)
- `TeamLayout` — team portal; collapsible left sidebar (232px ↔ 64px) with 7 nav sections; polls `prf_submissions` for inbox badge count. The sidebar **footer carries a persistent identity chip** (gold initials avatar + name/email + role label, linking to `/team/account`; collapses to the avatar alone with a tooltip) so who is signed in is visible at a glance without opening My Account — it reads `profiles.full_name` for the current `user.id`

**Route protection:** `ProtectedRoute` accepts a `roles` prop (e.g. `["admin","owner"]`); redirects unauthenticated users to `/team` or `/k2f-login`

**Roles:** `owner | admin | staff | auditor | user | kiosk` — fetched from `user_roles` table via `useUserRole()` (`kiosk` = the entrance tablet; see "Visitor Sign-In")

---

## Key Conventions

### Supabase
- Import client from `@/integrations/supabase/client`
- Use generated `Database` type from `@/integrations/supabase/types` for type-safe queries
- Auth state cleanup pattern: subscribe in `useEffect`, return `subscription.unsubscribe()`
- Soft deletes via `status` enum (`draft | active | archived`) — never hard-delete records

### Styling
- Tailwind CSS with CSS variables for theming
- Team portal uses custom vars: `--tp-gold`, `--tp-hairline`, `--tp-nav-section`
- Warm bakery palette: gold `#C89B3C`, dark brown `#2A1F0E`, cream `#F5F1E6`
- Mobile breakpoint: 768px (`use-mobile` hook)
- Use `cn()` from `@/lib/utils` for conditional class merging

### Error handling
- All async data fetching wrapped in try/catch; errors surfaced via `toast.error()`
- Loading states tracked with local `useState<boolean>`
- Form validation via Zod schemas

### JSON columns
- `sop_documents.content` — arbitrary JSON (slides array, etc.)
- `batch_sheets.data_json` — full batch formula data
- Versioned via `superseded_at` / `superseded_by` fields (audit trail)

---

## Environment Variables
```
VITE_SUPABASE_URL=https://zsukaixinoqmggpxxonn.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=<anon JWT>
VITE_SUPABASE_PROJECT_ID=zsukaixinoqmggpxxonn
```
All are public (anon) Supabase credentials — safe on the client.

---

## Team Portal Navigation (TeamLayout sidebar)

| Section | Path | Notes |
|---------|------|-------|
| Home | `/team/today`, `/team/dashboard`, `/team/notifications` | Today is the floor's home page and the **staff landing** (see "Today page"); Notifications carries a count badge |
| Relationships | `/team/sales/clients` | |
| Sales | `/team/sales/dashboard`, `/team/sales/templates` | Dashboard has inbox badge |

**Sidebar badges are declared, not hardcoded.** `NavItem.badge?: "inbox" | "notifications"` names
which live counter feeds an item's gold pill; `TeamLayout` owns both counts (plain `useState` +
`setInterval` at 30s keyed on `location.pathname` — the sidebar deliberately uses no TanStack
Query, and `refetchInterval` appears nowhere in `src/`). The pill still renders when the sidebar
is collapsed. Before D-18 this was `item.path === "/team/sales/dashboard"` inline in the render.
| Operations | `/team/ops/orders`, `/team/ops/inventory`, `/team/operations/batch-sheets`, `/team/ops/floor`, `/team/ops/insights` | floor & insights are Phase 0; Batch Sheets lists every current sheet, including ones with no client folder |
| Compliance | `/team/compliance/sops`, `/team/compliance/verification`, `/team/compliance/traceability`, `/team/compliance/temperature`, `/team/compliance/certifications` | certifications Phase 0 |
| HR | `/team/hr/directory`, `/team/hr/trainings`, `/team/hr/traceability` | traceability is Phase 0 |
| Internal | `/team/internal/email`, `/team/internal/finance` (owner only), `/team/sourcing`, `/team/account`, `/team/settings` | email/finance Phase 0 |

---

## Key Supabase Tables

| Table | Purpose |
|-------|---------|
| `profiles` | User profiles — `full_name`, `department`, `job_title`, `access_granted`, `preferred_language` (`'en'`/`'es'`, default `'en'` — drives language-aware training assignment; see "Preferred training language" below) |
| `user_roles` | Role assignments — `user_id`, `role` (owner/admin/staff/user) |
| `sop_documents` | Training modules & SOPs — `training_category` (int 1–4 = assignable training module; **null = reference doc**), `category` (text, SOPs Library grouping; names mirror the training category labels), `type` (`sop`/`form`/`policy`/`training`/`fsqm` — CHECK constraint `sop_documents_type_check`), `module_number`, `content` (JSON — slides/quiz/`attachments[]`/Word-SOP body), `file_url` (legacy single attachment), `passing_score_pct`, `is_critical`, `required_departments`, `status` |
| `training_assignments` | Employee ↔ module assignments — `completed_at`, `quiz_score`, `quiz_attempts`, `expires_at`, `recurrence_months`, `signed`/`signed_at` (acknowledgment), `progress` (JSON save/resume state, cleared on completion) |
| `quiz_questions` | Per-module quiz — `options` (array), `correct_option_index`, `hint`, `rationale` |
| `prf_submissions` | Product Request Forms — `concept_id`, `lead_id`, `product_name` |
| `batch_sheets` | Production batches — `data_json`, `version`, `status`, `superseded_at` |
| `document_templates` | NDA/PSS/PRF file templates — `kind`, `is_active`, `file_path` |
| `chat_history` | CoachChat messages — `user_id`, `project_id`, `section`, `role`, `content` |
| `ab_warehouses` | Inventory locations |
| `inventory_tolling` | Per-client tolling inventory — `client_id`, `ingredient_name`, `qty_on_hand`, `unit`, `lot_code`, `expiry_date`, `category` (`ingredient`/`packaging`/`finished_good`). **Not in generated `types.ts`** — query with `supabase.from("inventory_tolling" as any)`. Powers the Sales client folder's Tolling Inventory tab (see below). |
| `temperature_logs` | YoLink sensor readings (ingested by a Hostinger VPS) — `created_at`, `device_id`, `equipment_name`, `temperature_celsius`, `temperature_fahrenheit`, `humidity`, `battery_level` (1 low – 4 full), `low_battery_alarm`. **Not in generated `types.ts`** — query with `supabase.from("temperature_logs" as any)`. Powers the Temperature Monitoring report (see below). |
| `sop_document_responses` | Filled instances of a fillable `sop_documents` form — `document_id` (FK, `ON DELETE RESTRICT`), `form_number`/`form_revision` (pinned at creation), `data` (flat JSON `{fieldId: value}`), `attachments` (JSON array of `{path, name, contentType, size, uploadedAt, uploadedBy}` — files/photos attached to the entry, storage in the `form-attachments` bucket; independent of `data`/the optimistic-concurrency guard), `status` (`draft`/`submitted`), `created_by`/`submitted_by`/`reopened_by`, `updated_at` (optimistic-concurrency token). **Not in generated `types.ts`** — query with `supabase.from("sop_document_responses" as any)`. See "Dynamic Fillable Forms" below. |
| `sop_document_history` | Auto-snapshot (`SECURITY DEFINER` trigger, no direct INSERT/UPDATE/DELETE policies) of a published `sop_documents` row whenever a watched field or `content.form_schema` changes — `document_id`, `revision`, `changed_fields[]`, `snapshot` (full prior row as JSON). **Not in generated `types.ts`** — query with `supabase.from("sop_document_history" as any)`. See "Dynamic Fillable Forms" below. |

---

## Training System (Active Development Area)

**Files:** `src/lib/training.ts`, `src/pages/team/hr/TrainingSops.tsx`, `TrainingModuleDetail.tsx`, `TrainingCompliance.tsx`

**Training categories:** 1 Core Onboarding · 2 Safety & Risk Management · 3 Job-Specific Operations · 4 Response Protocols

**Departments:** Production · Sourcing · Quality Control · Admin · R&D · Sales

**Assignment statuses:** `not_started | in_progress | completed | expired`

**Quiz flow:** Admin configures questions + passing score (or marks as critical → requires 100%). Employees take quiz in `TrainingModuleDetail`; `scoreQuiz()` → `submitQuizResult()` records completion and computes `expires_at` via `computeExpiry()`.

**Preferred training language (EN/ES bilingual assignment):** `profiles.preferred_language` (`'en'`/`'es'`, default `'en'`) records which language an employee is trained in. Captured at invite acceptance (Spanish checkbox on `AcceptInvite.tsx` → `_preferred_language` arg on the `accept_team_invitation` RPC), editable later self-service (`StaffAccount.tsx` "Training Language" select) and by admins (`TeamMemberDetail.tsx`). EN and ES modules are **separate `sop_documents` rows sharing a `module_number`** (the ES row's `title` ends with `" (ES)"`); the **EN row is the single assignable unit** (carries `training_category`/`required_departments`), and the ES row is a *content variant substituted at assignment time*. ES rows are never independently auto-assigned (keep their `training_category` null). Resolution rules: an ES-preferring employee gets the active ES sibling where one exists, else EN; an EN-preferring employee only ever gets EN — never both. Implemented in two places: (1) the SQL sync triggers `sync_employee_training`/`sync_module_training` (migration `20260714000009_language_aware_training_sync.sql` — `LEFT JOIN LATERAL` on the ES sibling; the profile trigger also fires on `preferred_language` change), and (2) the manual "Assign Training" dialog via `assignModulesToEmployees()` in `training.ts`. **Changing an employee's language re-languages their not-yet-started assignments** (deletes the wrong-language row, inserts the right one) but never touches `progress`/`completed_at` rows and never creates a duplicate in the other language for a module already started/completed. **Prerequisite:** nothing assigns in Spanish until an ES module row is `status='active'` with the matching `module_number`.

**Slide upload:** Images stored in `training-content` Supabase bucket; paths saved in `sop_documents.content.slides[]`; signed URLs fetched via `getTrainingSlideUrl()`.

**CSV import:** Admins can paste NotebookLLM-exported CSV into the settings drawer; `parseQuizCsv()` in `training.ts` handles the parse.

**`sop_documents.content` JSON shape:**
```json
{
  "slides": ["moduleId/slide-01.png", ...],
  "narrations": ["narration text per slide", ...],
  "slideDurations": [17, 20, ...],
  "audio": ["moduleId/audio/slide-01.mp3", null, ...],
  "acknowledgment": { "required": true, "text": "I have read and understand..." },
  "attachments": [{ "name": "Manual.pdf", "path": "moduleId/files/Manual.pdf" }, { "name": "Vendor portal", "url": "https://…" }]
}
```
The first four are parallel arrays indexed by slide position (`audio` holds a storage path to the pre-generated voice MP3, or `null` for slides without one). `acknowledgment` is optional; when `required`, the employee must check an "agree to comply" box before the module can be completed (recorded on the assignment as `signed`/`signed_at`). **`attachments`** is the reference docs/links list (each item has a storage `path` OR an external `url`). A **Word-imported** SOP/FSQM also stores a structured body on `content` — sop/form/**fsqm**: `purpose, scope, definitions, responsibility, procedure[], form_references, records, governing_reference, revision_history`; policy: `statement` — surfaced in the drawer's **Document** tab. (**FSQM** = Food Safety Quality Manual; parses with the same structured sections as an SOP — see Word Import below.)

**Save/resume:** `training_assignments.progress` JSON (`{ slideIndex, maxVisitedIndex, highestUnlocked, updatedAt }`) is auto-saved by the viewer on every slide transition (`saveAssignmentProgress()` in `training.ts`), restored on load (clamped to current slide count), and set to null on completion. In-progress rows in `TrainingSops.tsx` show "Slide N of M · X%".

---

## Training Viewer (Employee-facing) — `TrainingModuleDetail.tsx`

- **One slide at a time** with Back / Next navigation
- **Progress bar** (gold), percentage counter, and dot strip showing current position
- **Dwell time gating:** Next button disabled with countdown on first visit to each slide. Duration = `computeSlideDuration(narration)` — ceil(words/3) seconds, min 8s, default 20s when no narration. Revisiting an already-unlocked slide skips the gate.
- **Audio narration (company voice + TTS fallback):** the "Listen" button plays the pre-generated **ElevenLabs voice** (cached MP3 per slide, `content.audio[]`) via an `HTMLAudioElement`. If a slide has no cached audio or the MP3 fails to load, it **falls back to browser `speechSynthesis`** so Listen always works. Once started, auto-advances to each subsequent slide until "Stop" is clicked. (See "ElevenLabs voice narration" below.)
- **Begin Quiz / Mark Complete** shown in the footer of the last slide (not a separate card).
- **Acknowledgment gating:** when `content.acknowledgment.required`, the "agree to comply" checkbox gates both Mark Complete and the post-quiz-pass completion (quiz result is saved score-only via `submitQuizResult(..., complete=false)` until the box is checked).
- **Resume:** restores `assignment.progress` on load with a "Resumed at slide N of M" toast; previously unlocked slides skip the dwell gate.
- **Preview mode** (no `training_assignments` row — e.g. an admin previewing a module): the dwell gate and quiz still run so the experience can be tested, but the quiz is scored locally and nothing is written to the DB. A "Preview mode" banner is shown. Gating keys on `status !== "completed"` rather than requiring an assignment; the dwell-gate effect also depends on `loading` so the first slide re-arms after `load()` settles (it resets `remaining` and runs twice under StrictMode).
- **Layout:** content column is `max-w-6xl` so slides scale up on large screens; quiz/result cards stay `max-w-3xl` for readability.

---

## Training Admin — `SlideContentEditor.tsx`

Component in `src/components/team/` embedded inside the SOPs Library drawer for admin users.

- Single-slide view with thumbnail, narration textarea, and duration (seconds) override
- **Replace Image** — upserts a new PNG for the current slide position
- **Delete Slide** — removes the PNG from storage, splices all three content arrays
- **Mic dictation** — `SpeechRecognition` API, appends to narration field
- **AI Cleanup** (Sparkles icon) — invokes `cleanup-narration` edge function on narration text
- **AI from Image** (Wand icon) — invokes `generate-narration` edge function with a signed URL of the current slide; populates narration
- **Generate All** — iterates slides with empty narrations, bulk-generates via `generate-narration`, saves in one write
- **Generate Voice Audio** — renders every narrated slide in the **ElevenLabs company voice** and caches the MP3s (`generateModuleAudio()` in `training.ts`); re-runnable to refresh after narration edits
- **Listen / Stop** — preview of the current slide's narration: plays the cached ElevenLabs MP3 when the draft matches what was voiced, else browser TTS (so edited-but-not-yet-revoiced text is still previewable)
- **Import from PowerPoint** — opens `PptxImportDialog` in replace mode (visible both in full-slide state and empty-state "no slides yet")

---

## Quiz Editor — `QuizEditor.tsx`

Component in `src/components/team/`, rendered below the Content section in the SOPs Library detail drawer (admin only). Per-question cards with text, options (correct-answer radio, min 2), labeled Hint and Rationale inputs, and up/down reorder buttons (display honors `question_number` order). "Regenerate with AI" invokes `generate-quiz` (confirm dialog if questions exist; hidden when no narrations). Bottom row: gold "Save Quiz" + "Add Question". Also hosts the module's acknowledgment config (require checkbox + custom text, default `DEFAULT_ACKNOWLEDGMENT_TEXT`), saved into `content.acknowledgment` alongside the quiz.

---

## SOPs Library — `SopsLibrary.tsx`

`/team/compliance/sops`. Groups documents by `category` (text) or by SQF section. Admin features:
- **Per-category "Add Module"** button on each category accordion header (category view only) — opens `PptxImportDialog` targeted at that category. Button is a *sibling* of `AccordionTrigger` (Radix renders the trigger as a `<button>`; nesting would break it).
- **Header "+ Add" dropdown** — splits creation into **Import Training Deck** (`PptxImportDialog`) and **Add Reference Document** (a title-only dialog that inserts a draft reference doc — `training_category` null — then opens its drawer so files/links can be attached). Plus **Import from Word** (`SopImportDialog`).
- **Kind filter** (segmented All / Training Modules / Reference Material) — content-based: Training = `training_category != null`; Reference = `training_category == null || hasReferenceDocs(d)`. A record with both passes both.
- **Editable detail drawer:** metadata form (title, SOP #, revision, effective date, SQF reference, approved by, category, type, status, SQF-required — "Save Details") sits above a **tabbed region**.
- **`CategorySelect`** (defined in this file): dropdown of existing categories + "Uncategorized" + "Add New Category…" (swaps to a text input). Used in the detail drawer and the Add SOP dialog — category is never free text.

**Drawer tabs (coexisting regions — toggling is pure view, never writes/deletes):**
- **Training** — when `training_category != null`: a **Training Link** (deeplink to `/team/hr/trainings/<id>` + copy, for reminder emails), admin **Required For** department checkboxes (`updateModuleRequirements`; unchecking "All Staff" sets `[]` to reveal the grid, clearing all depts reverts to `null`/All Staff), `SlideContentEditor`, admin **Quiz Settings** (passing score % + Critical/100% flag via `updateModuleQuizConfig`, with its own Save), and `QuizEditor`. Otherwise an empty-state with a non-destructive **"Make this a training module"** button (sets `training_category` via `trainingCategoryForLabel(category)`; the DB trigger auto-assigns when active). This drawer is the **single** module-management surface — the Training & SOPs page (`TrainingSops.tsx`) is now view/launch-only (row click opens the employee viewer; no admin gear).
- **Document** — shown only when `hasSopBody(content)`; renders/edits the structured SOP body via `SopBodyEditor` (Word-imported or manual).
- **Reference Documents** — `DocumentAttachment` (multi-file upload + URL links + inline PDF viewer + source-deck download).
- **Default active tab:** `training_category != null ? "training" : hasSopBody ? "document" : "reference"`.
- A record can hold training material, a document body, AND reference attachments simultaneously; nothing is removed except by an explicit per-item Delete.

**SQF Ref column / drawer — `SqfReference.tsx`:** the comma-delimited `sqf_reference` value (list category view + drawer read-only display) renders each clause number as a gold hover-card chip showing the clause text, with a **"View in {code} (p.N)"** link that opens the matching code PDF at the right page (`#page=N`). **Two code PDFs are hosted**, each with its own auto-generated clause map; a token resolves against the **Food Manufacturing code first** (the code the site is certifying to, and the one every controlled document cites), then the Quality Code as a fallback — the two number Part 2 differently (2.6.3.1 is recall in Food Mfg and a crisis-supply clause in Quality, which has no 2.6.3.4), so Quality-first showed the wrong clause. The matched code decides which PDF the link opens and the link label ("Food Mfg Code" vs "SQF Quality Code"):
- **Quality Code** — `public/sqf-quality-code.pdf` → `src/lib/sqfClauses.ts` (`lookupSqfClause`, `sqfPdfHref`, exports the shared `SqfClause` type), generated by `python scripts/generate-sqf-clauses.py`.
- **Food Safety Code: Food Manufacturing** (Module 11 GMPs + System Elements) — `public/sqf-food-manufacturing-code.pdf` → `src/lib/sqfFoodClauses.ts` (`lookupSqfFoodClause`, `sqfFoodPdfHref`, `SQF_FOOD_CLAUSES`), generated by `python scripts/generate-sqf-food-clauses.py` (reuses the base parser's `parse()`/`extract_text()` with a Food-Manufacturing-specific NOISE filter).

Unmapped numbers fall back to plain text. Both generators key physical==printed page (verified). Full runbook for refreshing either edition in `UPDATING_SQF_CODE.md`.

---

## Document Numbering Convention — `lib/docNumber.ts`

**Forms, manuals (FSQM), and policies** (`sop_documents.sop_number`) follow **`<TYPE>-<NNN>`**: a type prefix (`FRM`/`FSQM`/`POL` — same prefixes `detectType()` reads — plus `TRN` for training modules and `REP` for generated reports, which the Word parser never produces so they live only in `docNumber.ts`'s `DocNumberType`) plus a **3-digit number whose hundreds block = the process stage** (receiving 300s, production 500s, …; low number = early in the flow). The identifier is **stable for the document's life — the revision lives in the `revision` field, never baked into the number** (the old `FRM-046-1` style did the latter, the inconsistency this fixes). SQF clause numbers stay **decoupled** from these IDs (SQF renumbers between editions) — cross-reference via the existing `sqf_reference` field/chips. **SOPs are the deliberate exception:** they're numbered by the SQF clause they implement (`SOP-2.3.1`, `SOP-11.7.5`) so auditors can jump clause→SOP; `parseClauseNumber()` recognizes this so it isn't flagged, and the register groups them under "SOPs (numbered by SQF clause)".

- **`src/lib/docNumber.ts`** is the single source of truth: `DOC_STAGES` (the block→stage map), `parseDocNumber` (tolerant; strips a legacy `-N` suffix and returns it), `stageForNumber`/`stageForSopNumber`, `formatDocNumber` (canonical `FRM-301`), `docNumberIssue`/`isValidDocNumber` (advisory, non-blocking).
- **`DocNumberHint`** (`components/team/DocNumberHint.tsx`) renders the derived stage + a non-blocking warning under the `sop_number` inputs in `SopImportDialog` and the SOPs Library drawer.
- **Document Register** (`pages/team/compliance/DocumentRegister.tsx`, `/team/compliance/register`, Compliance nav): read-only, groups every doc by stage block; unparseable/legacy numbers fall into an **"Unassigned"** worklist; rows deep-link into the SOPs Library drawer via `?doc=<id>`.
- **FSMS Index** (`pages/team/compliance/FsmsIndex.tsx`, `/team/compliance/fsms-index`, Compliance nav,
  auditor can open it; D-08, FSQM-010): every four-level clause of the Food Manufacturing Code against
  the documents whose `sqf_reference` cites it - the clause-to-document matrix SQF 2.2.1.1 implies,
  **read live and never typed**, because a typed matrix is stale after the next issue. Pure half
  `src/lib/fsmsIndex.ts` (`buildFsmsIndex`, tested by `scripts/test-fsms-index.mjs`). A reference covers
  the clause itself and everything under it ("11.3" covers 11.3.1.1), never upwards. Each clause gets a
  state: **Issued** (an active program/procedure/policy cites it), **Draft only**, **No program** (only
  forms, reports or training cite it), **Nothing cites it**. `parseSqfReferences` expands the shorthand
  `2.4.8.1, .2, .3`; anything else that is not a clause of the Code is listed under "References that
  match no clause" rather than dropped. It shows what a document CLAIMS to cover - the internal audit
  tests the claim. Filter chips, search, CSV download.
- **Legacy IDs:** `sop_documents.legacy_sop_number` (migration `20260708000001…`) preserves the pre-convention number when a row is renumbered. Renumbering existing live rows is a reviewed data migration (crosswalk → id-keyed UPDATEs). Full runbook + stage table in **`DOCUMENT_REGISTER.md`**.

---

## Dynamic Fillable Forms — `lib/formSchema.ts` + `components/team/forms/`

FRM documents (`sop_documents.type='form'`) can carry a **fillable form schema** at `content.form_schema`
(sections → typed fields incl. `grid` for paper log tables, `signature` for typed acknowledgment stamps,
`pass_fail` QC checks); filled instances live in **`sop_document_responses`** (draft → submitted lifecycle),
and **`sop_document_history`** auto-snapshots the prior `sop_documents` row (DB trigger, migration
`20260709000001…`) whenever a *published* (active) doc's watched fields change — `revision, sop_number,
title, effective_date, approved_by, status`, and `content->'form_schema'` only (slide/quiz/attachment
churn does NOT snapshot). The trigger's `changed := changed || 'literal'` lines were rewritten to
`array_append(changed, 'literal')` in migration `20260710000001_fix_snapshot_trigger_array_append.sql` —
the bare `||` is ambiguous between `array_append`/`array_cat` and Postgres was parsing the literal as
`{...}` array syntax, throwing "malformed array literal" on every publish-time save.

- **`src/lib/formSchema.ts`** — schema types + pure helpers: `getFormSchema`/`hasFormSchema`,
  `buildZodSchema` (submit-time validation only; drafts save anything; per-field/per-grid-column
  `required`), `emptyValues`, `formatFieldValue`, `flattenForReport` (grid → one report column per grid
  column, rows `" | "`-joined), `instanceTitle` (`settings.instanceTitleTemplate` tokens `{date}`,
  `{user}`, `{<fieldId>}`), `slugifyFieldId`, `listFields` (fields flagged `showInList: true` — surfaced
  as extra columns in the drawer's Entries table, see below). Field ids are stable snake_case, **locked
  after first save** (answers key on them); response `data` is flat `{ [fieldId]: value }` — sections
  are presentation-only. `GridColumn.width` is a relative weight (default 1) authored per-column in
  `GridColumnsEditor`; `GridFieldInput` sums the row's column weights and gives the read-only fixed-row
  label column `1.4×` the average column's share so it doesn't collapse to near-zero under
  `table-fixed` (labels can be full review-item sentences).
- **`src/lib/formResponses.ts`** — all supabase access (tables not in generated types → `as any` confined
  here): create (pins `form_number`/`form_revision`; honors `settings.allowMultipleDrafts=false` by
  resuming the user's draft), save/submit with **optimistic concurrency** (`.eq("updated_at", loaded)` →
  `StaleResponseError`), admin reopen/delete, `resolveSchemaForResponse` (live → revision-matched history
  snapshot → live-with-fallback-banner; renderer tolerates unmatched ids and shows an "Unmapped answers"
  block).
- **Components** (`src/components/team/forms/`): `FormRenderer` (schema + external RHF instance; shadcn
  form primitives; width hints on a 6-col grid), `FormFieldInput`/`GridFieldInput`/`SignatureFieldInput`
  (verifier-role signatures admin-only), `DictationTextarea` (mic + AI-cleanup wrapper shared by both),
  `FormSchemaBuilder` + `GridColumnsEditor` + `ReferenceTableEditor` (admin authoring — incl. per-field
  **"Show in Entries list"** checkbox, per-grid-column **Width**, register `deletable`/`defaultValues`/
  `labelHeader`, live Preview, saves via `updateModuleContent` **merge**), `FormEntriesTab` (drawer Entries
  list + New Entry; renders one extra `TableHead`/`TableCell` per `listFields(schema)` field, e.g. Complaint
  No./Customer on FRM-002), `ResponseAttachments` (entry-level file/photo attachments, see below).
  - `date`/`datetime` scalar fields (`FormFieldInput.tsx`) and `date` grid columns (`GridFieldInput.tsx`)
    render a **"Today"/"Now" shortcut link** beside the native picker (`format(new Date(), "yyyy-MM-dd")`
    / `"yyyy-MM-dd'T'HH:mm"`) so common dates don't require opening the calendar.
  - Grid text cells use a wrapping `Textarea` (not `Input`) under `table-fixed` layout so long entries
    are readable without horizontal scroll; a fixed-row label can carry a `\n`-joined title +
    description + `Target: …` line (the AI extractor's convention for a paper review-item cell) —
    `FixedRowLabel` in `GridFieldInput.tsx` splits on `\n` and renders title (bold) / description
    (italic) / target (gold) instead of one flat run-on line.
- **Surfaces:** SOPs Library drawer gains **Form** + **Entries** tabs for `type='form'` docs (default tab:
  entries if fillable, else form) and a gold "Fillable" pill in the list; entry editor is a dedicated route
  **`/team/compliance/forms/:docId/entries/:responseId`** (`FormEntry.tsx`, `max-w-7xl` — Save Draft /
  Submit (confirm + validation) / **Request signature** (only while a verifier line is unsigned — see
  "Signature requests") / admin Reopen / Download PDF / admin Delete, hidden when
  `settings.deletable === false`; the "Back to FRM-###" link is duplicated into the sticky bottom action
  bar next to Save/Submit so returning to the library never requires scrolling to the header);
  **Form Records** page **`/team/compliance/records`** (`Records.tsx`, Compliance nav) = cross-form recent
  entries + per-form flattened answer table with From/To + status filters and CSV/PDF export.
- **Derived reports (log forms):** a `type='form'` doc can carry a **`content.report_schema`** that presents
  it as a live report projected from *another* form's responses (e.g. **REP-003 Customer Complaint Log** ←
  **FRM-002** reports, **REP-201 Approved Supplier Register** ← **FRM-202**) — a register with **no entries
  of its own**, so it does NOT duplicate `Records.tsx`. Engine `src/lib/formReport.ts` (declarative column
  kinds `field/template/map/cases/const`; user `params` + always-applied `filters[]` fixed conditions
  (`in`/`equals`/`notEquals`/`notEmpty`/`empty`/`anyNotEmpty` — e.g. `supplier_status in [Approved, …]`, or
  REP-603 Label Change Control Log's `anyNotEmpty` over FRM-601 Section-2 change fields); `loadReportBase` + pure `filterReportRows`,
  client-side; `buildReportSql` renders the read-only SQL equivalent for the **View SQL** panel). UI: **Report** tab in the drawer (`FormReportTab.tsx` viewer +
  `ReportSchemaBuilder.tsx` admin authoring, saved via `updateModuleContent` merge). There is no extra
  list pill: these carry the **Report** type pill like any other report document, which is the whole
  point of typing them correctly;
  shown only for `type='report'` documents. A projected report is its own REP-numbered document
  sourcing another form's entries, never a mode of the form it reads — gating the tab on
  `type='form'` hid it the moment those documents were typed correctly. **Full runbook + data-model + REP-003↔FRM-002 mapping
  in `FORM_REPORTS.md`.**
- **PDF:** `src/lib/formPdf.ts` — `generateFormResponsePdf` (paper-like entry PDF; grids as real tables),
  `generateFormReportPdf` (landscape, clamps to 10 columns → "see CSV"), and `generateDerivedReportPdf`
  (landscape log/register PDF for the derived-report feature above); reuses `loadLogoDataUrl`/
  `confidentialFooter` now exported from `sopPdf.ts`.
- **Printable BLANK forms** (the paper copy an auditor asks for — distinct from the filled-entry PDF
  above): `python scripts/generate-form-blank.py` renders a form's `form_schema` to both `.pdf`
  (reportlab) and `.docx` (python-docx) in `sop-drafts/` (gitignored — regenerate rather than commit).
  One hardcoded block per form in `__main__` supplies the metadata + `landscape_page` flag. Two layout
  rules exist because both were real bugs: **Arial is registered and used throughout** (core Helvetica
  has no em-dash or arrow glyph, so those rendered as missing-glyph boxes — the corruption was in the
  font, not the source text), and section headers / grid titles carry `CondPageBreak` +
  `keep_with_next` so a heading never orphans onto the page above its table. Every `grid` renders its
  field label + help text — an untitled table on paper is unusable.
- **Package-label scan (fill ONE grid row from a photo of an ingredient pack):** a grid opted in via
  `GridField.scanLabel` gets a **camera button on every row**; the filler photographs the bag/case and
  `extract-package-label` reads the printed identity into that row. Distinct from the whole-form photo
  scan above — that reads a completed *paper form* and fills the *whole entry*; this reads a *product
  package* and fills *one row*. Facts are a closed set (`LABEL_FACTS` in `formSchema.ts`:
  `product_name, brand, lot_code, best_by, item_code, net_weight, pack_size, plant_code, barcode`) —
  **no allergen key by design**, since an allergen declaration must come off the spec sheet, not off
  whatever fraction of an ingredient panel is in frame. Column mapping is `resolveScanFact` =
  admin-pinned `GridColumn.scanFact` (incl. `"none"` to opt a column out) → else `inferScanFact`
  keyword match on the column label, so an existing grid scans with zero setup
  (Supplier→brand, Lot / Batch #→lot_code, Ingredient→product_name, Notes→overflow). Facts no column
  claims are **appended** (never replacing) to the notes column — `scanNotesColumnId`, else the
  notes-looking text column; dropped when the grid has neither. `scanWantedFacts` narrows the ask to
  what the grid can actually hold. **Lot codes are the point and the risk:** the prompt teaches the
  model that a lot is *variable-applied* (ink-jet/laser/stamped) and that pre-printed item numbers and
  barcode digits are **never** the lot — those come back in `alternates.lot_code` and render as
  click-to-apply chips in the Undo strip. `applyLabelScan` (pure, in `formSchema.ts`) overwrites
  non-empty cells deliberately and the caller snapshots the whole prior row, so one **Undo** restores
  it exactly; a half-applied scan would be worse than either. The model needs a fetchable URL so the
  photo is always uploaded, but it only **stays** as an entry attachment (auto-noted
  `"Label photo — <grid> row N"`) when the grid sets `scanKeepPhoto` — **off by default**, since the
  scanned values land in reviewed cells and a 20-ingredient entry would otherwise accumulate 20
  redundant images; otherwise the upload is transient and removed in a `finally` (best-effort, like
  `deleteResponse` — an orphaned object is harmless, a failed scan is not). Wiring: `GridFieldInput` (button/apply/Undo, still imports no supabase) ← `FormRenderer`
  `onScanLabel` ← `FormEntry.tsx` (upload → attach → signed URL → invoke); admin toggle + per-column
  mapping live in `GridColumnsEditor`.
- **Specification scan (FRM-207): one photo fills the whole entry, declarations included.** A third
  `ScanMode`, `"specification"`, reads the identity facts **plus** `DECLARATION_FACTS` (`ingredients`,
  `contains_statement`, `allergens`, `may_contain`, `storage`). The receiving modes keep their rule and
  still never read declarations — for a *delivery* the allergen declaration comes off the spec sheet;
  for a material's *specification* the printed label is the manufacturer's regulated declaration and the
  photo stays on the entry. **`allergens` and `storage` are never the model's answer**: it transcribes the
  Contains line and storage instruction verbatim, and `supabase/functions/_shared/allergenStatement.ts`
  derives the ticked boxes by word matching (tested by `scripts/test-allergen-statement.mjs`). No Contains
  statement → no allergen answer plus a warning; a scan never ticks "None". Declarations fill only fields
  that **pin** them, and a pinned field always receives its fact (keyword-inferred ones stay
  first-wins). `FormSection.scanScope: "form"` lets one section's camera fill pinned fields in other
  sections (`scanTargetFields`). A multi-select takes a comma list and keeps only values that are options.
- **A pack scanned in several shots (section scan).** A round bottle cannot be read in one photo, so
  each "Scan pack" ADDS to the entry (owner's request at the plant, 2026-10-06). Two halves:
  `FormEntry.scanLabelIntoRow` sends the new photo **together with the section's earlier label
  photos** (matched by their attachment note, newest four - the function's limit), so a statement
  that wraps round the pack is read whole; and `applyLabelScanToFields(fields, values, result,
  scanned)` fills an empty field, updates a field still holding exactly what an earlier scan wrote
  (`scanned`, a ref in `SectionLabelScan`), and **keeps any other answer**, returning the different
  reading in `differing` (a "Use this" chip) and the still-empty fields in `missing` ("Still blank:
  ... scan another side"). A fact absent from a later read never empties its field; notes leftovers
  are de-duplicated. `scanned` lives for the page visit only, so after a reload every answer counts
  as the person's and is kept. **Warnings are filtered by `relevantScanWarnings`**: a "could not read X"
  warning is shown only while X's field is still empty (every shot of the front says there is no
  Contains statement); a "check this" warning always stays. Before this every scan overwrote every field it could read. Grid-row
  scans are unchanged. Tested by `scripts/test-label-scan-merge.mjs`.
- **AI extraction:** drawer Form tab "Generate with AI" (shown when a source `.docx` is attached) runs
  mammoth client-side (keeps the tables `sopDocxParser` drops), sends HTML to edge function
  **`generate-form-schema`** (Gemini via Lovable gateway; server-side whitelist/sanitize; also accepts
  `pdf_images` for a future scanned-PDF path) — result loads into the builder as an **unsaved proposal**.
  Select options go through a `toOptionString()` coercion (label/value/name/text → string, not a blind
  `String(o)`) since the model sometimes proposes `{label,value}`-shaped objects instead of plain strings
  — without it, dropdowns render the literal text `"[object Object]"`. Fixed-row `rows.labels[]` are
  capped at 1000 chars (not 120 — column headers are short but review-item title+description+target
  blocks are not). **Known unresolved issue:** regenerating an already-large schema (seen on FRM-001) can
  hit a `SyntaxError: Expected ',' or ']'...` — the model occasionally emits a raw unescaped newline
  inside a JSON string; not yet fixed.
- **"Fill from a photo" also takes a PDF** (owner's request, 2026-10-09). The file picker of "Choose
  Photo(s)" accepts `.pdf`; **the wording on screen is unchanged on purpose and still says photo**. The
  reader (`extract-form-answers`) only takes pictures, so `renderPdfPages` (`clientDocRead.ts`, pdfjs,
  at most 10 pages) turns each page into a JPEG **data URL that is sent to the function directly**; the
  PDF itself is what stays on the entry as the attachment. The edge function is untouched. ⚠️ The first
  cut uploaded each page picture and sent its signed link, as photos do: on the owner's first real PDF
  that stalled for over a minute and filled nothing (cause not found - the function logs could not be
  read), while the same pictures sent directly were read in three seconds. Do not go back to links.
  **Document mode** (same day, after the first real PDF put a wrong status on one machine): a read made
  only of PDF pages sends `source: "pdf"` and each page's text layer (`PdfPage.text`). The function then
  appends `DOCUMENT_ADDENDUM` to its prompt, runs at temperature 0, and has the model return every
  fixed-table row WITH ITS LABEL (`_row`); `placeRowsByLabel` (`_shared/gridRows.ts`, tested by
  `scripts/test-grid-rows.mjs`) puts each row on the form row of that label. A row of the document that
  is no longer on the form (FRM-903's Chopper) is skipped with a warning instead of shifting every row
  below it. A label the form prints on several rows (FRM-903's glass check: three rows all "Processing
  Room") takes the document's rows in order, each to the next free row of that label. **Where the PDF has a text layer, the text decides**: `readRowFromText` reads the pass/fail
  and pick-list choices printed straight after each row's label ("Depositors Pass Pass") for the row's
  LEADING columns of those kinds, and they replace whatever the model read for those cells. Added the
  same day, after label placement was live and one cell still came back wrong on the owner's screen
  while five direct reads of the same PDF were right - a model's reading varies, the text does not. It
  stops at the first free-text column, gives nothing for a label printed twice with different choices,
  and does nothing for a scan. Tested on that record's real text layer.
  **A request without `source` is read exactly as before** - photographs are untouched, which
  is why this could ship without being tried on a photo. The owner deploys the function
  (`npx supabase functions deploy extract-form-answers`); the client is safe before and after.
  **A PDF never fills FRM-903's "Day / Shift" section** (`PDF_FILL_SKIPS` / `pdfFillSkippedFields` in
  `formSchema.ts`): those fields are left out of the manifest and dropped from the answers, so the date,
  area, shift and product run stay as they are on the entry. A photograph still fills them. If photos and
  a PDF are chosen together, the rule applies to the whole read.
- **Retention:** `sop_document_responses.document_id` is `ON DELETE RESTRICT` — hard-deleting a form with
  entries fails (code 23503 → "archive instead" toast). Response RLS: staff read all / insert own / update
  own **drafts** only; admin-or-owner (`has_role('admin') OR is_owner()`) update/delete anything.
  Dormant scaffold tables `sop_versions`/`form_templates`/`form_submissions` (20260608000001) are unused
  and deliberately not reused.
- **Static reference tables & register grids:** a `reference_table` field type (columns + rows of plain
  strings, no value/no `required`/no width control) renders a fixed printed table the filler only reads —
  for a paper form's static legend/key (e.g. a "Risk Rating Key"), as opposed to `grid` which is for
  filler-written tables. Authored via `ReferenceTableEditor.tsx`; AI extraction (`generate-form-schema`)
  distinguishes the two by whether the paper table's cells are fixed/printed vs. blank-for-filler. Separately,
  a fixed-mode `grid` can be a **register** — `GridRows` (fixed) gains `deletable` (every row gets an
  editable label + delete button, for registers where items can be renamed/removed over time),
  `defaultValues` (per-row known column values, parallel to `labels`, so e.g. Location/Item/Material/Risk
  pre-populate but stay editable), and `labelHeader` (header text for the leading label column, e.g.
  "Location"). "Add Item" lets the filler append rows past the schema-defined list (label editable, delete
  enabled) regardless of `deletable`. **Click-to-sort** on grid columns is safety-gated —
  `sortable = !fixed || fixedDeletable` — because a classic non-deletable fixed checklist derives its label
  from schema *position* (`fixedLabels[rowIdx]`); reordering would desync the label/data pairing, so sorting
  only activates when the label lives in the row's own data (`_label`, i.e. `deletable: true`) or the grid
  is fully dynamic.
- **Dropdowns fed by another form's register (`SelectField.optionsFrom`):** `{ form, field, filters?, emptyText? }`
  offers the distinct `field` values of every **submitted** entry of `form` that passes `filters` (same
  shape and meaning as a derived report's `filters[]`, evaluated by `matchesFilter`), after any typed
  `options`. First use: FRM-207's **Bought from** = every FRM-202 supplier that is Approved or
  Conditionally Approved, with REP-201's filters copied verbatim so the two registers cannot disagree —
  approving a supplier there is what makes it choosable here. Pure half `selectOptionsFromResponses`
  (case-insensitive dedupe, drafts never count) + `loadSelectOptions` in `formReport.ts`; fetched on
  mount by `useLinkedOptions` in `FormFieldInput` (no cache, so a new approval shows on next open). A
  value saved earlier that later drops off the list is **kept and flagged amber**, never removed.
  The builder allows saving such a select with no typed options and says where the list comes from.
  ⚠️ **`allowOther` is not rendered anywhere** — a select with it is still a closed list. Offer "Other".
- **Copy from a previous entry (`settings.copyFrom`):** `{ fields, clear? }` puts a "Copy from a previous
  entry" card on `FormEntry` (editable entries only). `CopyFromEntryDialog` lists every other entry of the
  form, searchable by instance title — a **list, not "the last one"**, because a product variant (a Coconut
  Rum Cake with its own flavoring) must start from ITS sheet. Pure half `copyFromEntry` in `formSchema.ts`
  copies the named fields, blanks the `clear` grid columns in every copied row, and **never copies a
  signature**. Like the voice fill, the result is unsaved and dirty (`keepDefaultValues`) with one Undo.
  First use: **FRM-520 Production Lot Record** copies product + the ingredient grid with `supplier_lot` and
  `notes` blanked — a lot is never inherited from another day.
- **Names from the team directory (`GridColumn.teamPick`):** `{ titleColumn? }` on a text grid column offers
  everyone with a staff, admin or owner role and a profile name (`loadTeamDirectoryNames` in
  `formResponses.ts`; auditor and kiosk accounts are left out, portal access is not required). It is an
  offer, never a closed list - a contractor is typed in. `TeamNameInput` uses the browser's own
  `<datalist>` on purpose: the grid scrolls sideways and would clip a drawn list. Entering a listed name
  fills `titleColumn` with the person's job title, else department, **only if that cell is empty**. Names
  load once per page load; if they cannot be read the cell is a plain text box. Builder: "Offer team
  names" on a text column (`titleColumn` is set by migration). First use: FRM-953's Employee Name.
  A top-level text field takes the same option as `TextField.teamPick` (`{ titleField? }`, set by
  migration): FRM-952's Employee Name, which fills Job Title / Dept.
- **Topics from the document list (`TextField.docPick`):** `{ prefixes }` on a text field offers each
  ISSUED document whose number starts with one of the prefixes, as "TRN-003 Allergens Part 1"
  (`docPickOptions` in `docRefs.ts`, tested in `scripts/test-doc-refs.mjs`). Drafts are not offered; a
  module and its "(ES)" variant are one line. It reuses the list `DocRefText` loads (`loadDocIndex`) and
  renders with `SuggestInput`, so anything else can still be typed. Set by migration - the builder has
  no control for it. First use: FRM-953's Training Title / Topic, prefixes TRN and SOP.
- **A type-ahead fed by another form (`TextField.suggestFrom`):** `{ form, field, drafts? }` on a top-level
  text field lists the distinct `field` values of that form's entries in a `SuggestInput` (focus lists
  all, typing narrows, anything can be typed). Nothing is looked up from the choice, so **more text can
  follow it** - FRM-903's Product / batch run offers the FRM-501 product names and the operator types
  the batch number after one. `drafts: true` because FRM-501's entries are kept as drafts. Loader
  `loadSuggestValues` (`formReport.ts`), pure half `suggestValuesFromRows` (`pickFrom.ts`). Set by
  migration (`20261009000005`). ⚠️ Not the same thing as the grid's `suggestFrom` below (a grey
  suggested NUMBER in a cell) - same word, different types, different jobs.
- **Suggested cell values (`GridColumn.suggestFrom`):** `{ column, times? }` on a number column shows, while
  the cell is EMPTY, a grey placeholder (another column of the row, optionally × a top-level number field)
  and a check button that enters it. **It is never a default value** — the owner's rule: a prefilled weight
  gets accepted without being checked, so it has to be taken on purpose. `suggestedCellValue` returns null
  rather than guess when the multiplier is blank. FRM-520: Batch 1/2/3 weighed ← Expected qty per batch, no
  multiplier — each batch is weighed separately, as the paper prep sheet records (an "all batches" total was
  built first and dropped).
- **A share column with a Recalculate link (`GridColumn.shareOf`):** `{ column, nameColumn? }` marks a column as
  each row's percentage of the total of another column. Its header gets a **Recalculate** link
  (`GridFieldInput`), which runs `recalculateShares` (`batchSheetFill.ts`, tested in
  `scripts/test-batch-sheet-fill.mjs`): quantities are read by `parseQty`, the result is to two places
  and adds up to exactly 100.00 (the rounding difference goes to the largest line), and a row with no
  quantity gets a blank. **All or nothing**: an unreadable quantity or mixed units changes no cell and
  says which row. It runs only when tapped - the cells stay typeable - and the result is unsaved with
  one Undo. Set by migration; the builder has no control for it. First use: FRM-501's % of Formula
  from Production Qty (owner's request, 2026-10-08, migration `20261008000005`).
- **A cell picked from another form's register (`GridColumn.pickFrom`):** `{ form, field, filters?, fill?,
  hintField? }` on a text grid column offers the `field` values of that form's SUBMITTED entries (newest
  wins a repeated name) as the browser's own `<datalist>` (`LinkedPickInput`, the `TeamNameInput` pattern),
  and a pick fills other cells of the row: `fill` maps this grid's column ids to the source form's field
  ids. **An offer, never a closed list** - anything can be typed, and then nothing is filled. `pickFills`
  (`src/lib/pickFrom.ts`, no imports, tested by `scripts/test-pick-from.mjs`) writes a cell only if it is
  empty or still holds what this cell's previous pick wrote in this page visit, so a typed answer is never
  replaced, and changing the pick carries its fills along. The neighbouring cells are written through
  their own controllers (`FillTarget`), not `useFieldArray.update`, so the row does not remount. A cell whose
  value is ALREADY a listed choice while a target cell is empty shows a **Fill from FRM-207** link
  (`FillOffer`) - the owner opened an existing sheet, where nothing changes so nothing fired, and took the
  feature for broken (2026-10-09). Checked on a temporary harness route with `supabase.from` stubbed. Loader
  `loadPickOptions` in `formReport.ts`, cached per page load. Set by migration; the builder has no control
  for it. First use: FRM-501's Ingredient from FRM-207 (not Discontinued; ingredient, additive / flavouring
  or processing aid), filling Supplier from Manufacturer / brand and Allergen(s) from the ticked allergens
  (owner's request, 2026-10-09, migration `20261009000001`). Renaming those FRM-207 fields means a new
  migration for this setting.
- **Text derived from a date (`TextField.derive`):** `{ fromField, as: "julian_lot" }` FILLS a text field
  from a date field and keeps it in step until someone types over it (`nextDerivedFill`, the rule derived
  dates use); while the date is blank it offers today's value as a link. `julianLotCode` = year digit +
  three-digit day of year (2026-09-30 → `6273`), UTC arithmetic so DST never shifts it. Filled rather than
  suggested because it is notation, not a measurement — contrast `suggestFrom` for weights. FRM-520 lot code.
- **A section that starts collapsed (`FormSection.collapsed`):** for a part of a form only filled in an
  exceptional case. `CollapsedSection` in `FormRenderer` shows it as one line to tap. It is open whenever
  it holds an answer (`sectionHasAnswers` - defaults, fill-time column defaults and a fixed row's printed
  values do not count) or one of its fields failed validation, so a recorded exception is never hidden;
  a tap opens or closes it by hand. The fields stay mounted while closed (CSS `hidden`), so values and
  field arrays are untouched. PDFs and the printable blank ignore it. Builder: "Start collapsed" under
  the section description. First use: FRM-401's "Manual readings and changes of state" (owner's request,
  2026-10-08, migration `20261008000002`). Also FRM-507's "3. If a limit was not met" (2026-10-09, migration `20261009000007`); its required "Deviations on this day" answer is inside the section, so the section opens at Submit until that is answered. FRM-606's section 3 the same (migration `20261009000010`).
- **Helper text can be put away (`InfoBlock` in `FormRenderer`, 2026-10-09):** every `info` field is shown
  by default with a **Hide** link (an information icon before it, so it reads apart from other links); hidden, it is one line ("Show: Before you start", from the field's
  label). The choice is remembered **per person**, per form and per block: `useUserPref` with key
  `form.helpHidden:<docId>` (the doc id from `DocSelfContext`), value = the ids of the hidden blocks. It
  holds across every entry of that form and follows the person to any device. Nothing is stored on the
  record, PDFs always print the text, and no schema setting is involved. Applies to every form.
- **A person's own settings (`public.user_preferences`, `src/lib/userPrefs.ts`, migration `20261009000009`).**
  One row per `(user_id, key)` with a JSON `value` - deliberately generic (owner, 2026-10-09: it must
  serve later per-person settings), so **a new setting is a new key and needs no migration**. Namespace
  the key by its owner (`form.helpHidden:<docId>`). RLS: a person reads and writes only their own rows,
  admins included; the kiosk account is kept out. Not in generated types (`as any` confined to the lib).
  `useUserPref(key, fallback)` returns `[value, set]`; `fallback` must be a constant. All of a person's
  settings load once per page load and again when the account changes; a copy tagged with the user id is
  kept in `localStorage` (`userPrefs.cache`) so a page opens in the person's arrangement without a
  flash. **Conveniences, never records**: nothing in the lib throws, and with the table missing or the
  network down a setting is simply kept on the device. Do not put anything here that a record relies on.
- **Link to another form under a field (`FieldBase.linkTo`):** `{ form, latestEntry? }` renders a link
  under the field (`FormLink` in `FormFieldInput.tsx`, target from `fetchFormLinkTarget`): with
  `latestEntry`, the form's newest submitted entry - else its newest draft, flagged - otherwise the form in
  the library. New tab, so the entry being filled stays open; renders nothing if the form is missing.
  Not rendered for `checkbox`/`signature` fields (they return early). First use: FRM-012's
  "Contact list (FRM-011)" check links to the current contact list.
- **Document numbers in text are links (`DocRefText`):** any FRM-, FSQM-, SOP-, REP- or TRN- number written
  in text ("Chemicals locked away (FSQM-032)") opens that document in the SOPs Library in a new tab, and
  hovering shows the document's title. Nothing is authored. `DocRefText` (`components/team/forms/`) is
  self-contained: the first one on screen whose text carries a number loads every active or draft
  document's number and title once per page load (`fetchDocIndexRows` + `buildDocIndex`), shared through a
  module cache - so it works with no provider, including the form builder's Preview. Where it is used:
  every label, help line, info block, section title and description, fixed row label, column header and
  signature statement of a form; and the read-only document body in `SopBodyEditor`. An admin sees the
  body as edit boxes, where a number cannot be a link, so the documents mentioned are listed as links
  above the boxes (`docRefsIn`). `DocSelfContext` (optional) carries the id of the document on screen so
  its own number stays plain text; a number with no active or draft document also stays plain. One number,
  one document: issued beats draft, and an English training module beats its "(ES)" variant. Pure half in
  `src/lib/docRefs.ts`, tested by `scripts/test-doc-refs.mjs`. Not linked: a sortable column header (it
  is a button), select options, and PDFs.
- **Internal-audit guide (`SelectField.auditGuide`):** `{ findingsGrid, clauseColumn }` on a multi-select
  whose options are SQF sections ("11.5 Water, ice and air"). Each ticked section gets a collapsible panel
  (`SqfSectionGuide.tsx`, rendered by `FormRenderer` under the field): the Code's sub-sections from
  **`sqfFoodClauses.ts`** (Food Manufacturing — not the Quality Code map, which also has 2.x), the site
  documents whose `sqf_reference` falls in the section, **looked up live** (`loadAuditGuideData` in
  `formResponses.ts`, so a newly issued program appears with no form edit), grouped programs / records /
  training, and each form's submitted entries in the last 12 months (an active form with none is amber).
  "Add to findings" appends one line per sub-section not already in the grid (`appendFindingRows`, reuses
  the seeded blank row). Pure half in `src/lib/auditGuide.ts`. First use: **FRM-010 Internal Audit Record**
  (FSQM-038, D-19).
- **AI evidence draft (`GridColumn.aiDraft: "audit_evidence"`):** a "Draft from records" button under that
  column in the row pop-up (`AiDraftAssist` in `GridRowDialog.tsx`), wired like `onScanLabel`
  (`FormEntry.draftCellFromRecords` → `FormRenderer`/`GridFieldInput` `onDraftCell`). Edge fn
  `draft-audit-evidence` reads the row's Clause, relates documents by `sqf_reference` **in both directions**
  (cites the clause or finer, or a broader section containing it), and **computes the facts in code**
  (`_shared/auditEvidence.ts`, tested by `scripts/test-audit-evidence.mjs`): submitted entries in the twelve
  months up to the Audit date, first/last, longest gap (window edges included), entries with a failed answer,
  draft count, CAPAs naming the clause or its forms. The model only writes them up. **Evidence only - it never
  proposes the Result - and the draft is previewed** with source chips built from the query, not the model;
  Use / Replace / Add below is an ordinary cell edit, Discard leaves the cell untouched. The audit record
  itself (FRM-010) is never a source. Requirement text comes from the client (`clauseRequirements` in
  `auditGuide.ts`, four-level clauses from `sqfFoodClauses.ts`) because an edge function cannot import `src/`.
- **Dictation & AI cleanup on every filler-facing textarea:** `DictationTextarea.tsx` wraps both the scalar
  `textarea` field type (`FormFieldInput.tsx`) and free-text grid cells (`GridFieldInput.tsx`'s default
  column type) with a mic button (Web Speech API `SpeechRecognition`, continuous, appends onto the
  existing value) and a gold Sparkles **AI cleanup** button (edge function
  `cleanup-form-text` — fixes grammar/punctuation/capitalization/filler words into one clear statement,
  preserving every fact/name/quantity exactly). The mic button only renders when the browser exposes
  `SpeechRecognition` (checked once at module load); the AI button always renders since it's a server call,
  disabled when the field is empty and while the request is in flight (Sparkles → spinning `Loader2`). On a
  successful cleanup a small "AI cleanup applied — **Undo**" chip floats over the textarea's bottom-right
  corner for 8s (or until further edits, which clear it) — clicking Undo restores the pre-cleanup text
  exactly, via a `valueRef` snapshot taken before the AI call.
  - **Auto-grow (tablet legibility):** the textarea fits its own content instead of clipping — these are
    filled walking the floor on a tablet, where a value wrapping to a second line is unreadable in a
    one-row grid cell and the resize grip isn't a usable affordance (so `resize-none`, and `resize-y` is
    gone from the grid cell's class). `fitToContent()` collapses to `auto` then sets `scrollHeight` +
    border (border-box counts it, `scrollHeight` excludes it), in a `useLayoutEffect` on value/interim
    change. Two extra triggers exist because both are invisible to the obvious one: a **`ResizeObserver`
    gated on width only** (rotation/column resize rewrap the text; reacting to height would loop, since it
    observes the element whose height it sets), and a **`document.fonts.ready` re-fit** (a web font
    swapping in after first paint rewraps the text *without* changing the observed box, so nothing else
    fires — this was a real clipped-cell bug, not a hypothetical). `min-h-*` still floors the height, so
    empty cells stay compact.
  - **Interim dictation results:** `interimResults = true`; provisional words render composited into the
    box (`value` + interim) so the text is confirmable *while speaking* rather than after — the previous
    final-results-only mode showed nothing until you stopped, into a 32px box you couldn't read. The
    interim is display-only and never enters the form value: the textarea is `readOnly` while `listening`
    (a keystroke would otherwise commit the provisional transcript as typed), and interim is cleared on
    stop/end/error, so stopping mid-phrase discards it and keeps only what finalized.
- **Entry attachments (files/photos):** every fillable entry gets a built-in **Attachments** section at the
  bottom (`ResponseAttachments.tsx`, wired into `FormEntry.tsx` — not a schema-authored field, nothing to
  drag in via "Add Field"), present by default and admin-toggleable per form via
  `schema.settings.attachmentsEnabled` (default enabled/`undefined`; `false` disables new uploads but never
  hides files already attached). Two upload controls: **"Take Photo"** (`<input type="file" accept="image/*"
  capture="environment">` — opens the device camera on mobile, degrades to the normal file picker on
  desktop/no-camera with no feature-detection needed) and **"Attach File"** (plain multi-select picker,
  `image/*,.pdf,.doc,.docx,.xls,.xlsx`). Stored in the dedicated **`form-attachments`** Supabase Storage
  bucket (private; `is_staff_or_admin`-gated policies, same pattern as `training-content`) — a *separate*
  bucket from `training-content` because response attachments are keyed per-response
  (`${responseId}/${uuid}-${name}`, many photos × many responses) rather than per-document, and need bulk
  cleanup on entry deletion rather than individual management. Persisted on a dedicated
  `sop_document_responses.attachments` column (not folded into `data`, so it's never mistaken for a stray
  field in the "Unmapped answers" block) via `saveResponseAttachments()` in `formResponses.ts` — deliberately
  **no optimistic-concurrency guard** (unlike `saveResponseData`/`submitResponse`) since attachments are
  additive/orthogonal to the RHF-managed field answers; the row's `updated_at` still bumps via the
  `sop_document_responses_touch` trigger, so `FormEntry.tsx` applies the returned row via `setResponse`
  immediately to avoid a stale-`updated_at` false positive on the next draft save. `deleteResponse(id,
  attachmentPaths)` deletes the DB row first, then best-effort removes the storage objects (an orphaned file
  is harmless; a live record with broken links is not).

---

## Account Access & Invitations (auth provisioning)

**Account Access card** — `components/team/AccountAccessCard.tsx`, rendered in `TeamMemberDetail.tsx`
(`/team/member/:userId`, already `["admin","owner"]`-gated) between Identity and Position. Shows the
account's real sign-in state (confirmed / last signed in / never signed in) and offers **Send Reset Link**
(copyable — `generateLink` mints but does **not** send mail) and **Set Temporary Password** (break-glass;
the admin then knows the password, which weakens non-repudiation for training/form signatures, so the
dialog says so). Both route through the `admin-user-account` edge fn — the service-role key never reaches
the browser. Actions fire immediately and are **not** covered by the page's shared Save Changes button.
The card keys its owner/admin lock on **`initialRoles`** (persisted) not the in-flight checkbox state, so
the UI lock matches what the function enforces. Every mutating action writes `admin_account_actions`
(migration `20260715000003`) — RLS-readable by admin/owner, **no INSERT/UPDATE/DELETE policies at all**, so
the service-role function can write but no client can tamper: an append-only audit log. Passwords are never
logged.

**Self-service password change** — `StaffAccount.tsx` (`/team/account`) carries a **Change Password**
card: `supabase.auth.updateUser({ password })` behind a min-8-chars + confirm-match check, with a single
Eye/EyeOff toggle driving `type` on both fields. This is a signed-in user changing *their own* password
and is the answer to "where does a user reset their password?" — distinct from `AccountAccessCard`'s
admin-driven reset link / temporary password, which exist for accounts that cannot sign in at all.

**Team invitees are auto-confirmed on accept.** `accept_team_invitation` stamps
`auth.users.email_confirmed_at = COALESCE(email_confirmed_at, now())` (migration
`20260714000006_confirm_team_invitees.sql`, which also backfilled already-accepted invitees). Without it
an invitee who set a password still hit **"Email not confirmed"** at sign-in, because internal
`@adventurebakes.com` addresses do not receive the confirmation mail. The invite link, delivered to that
mailbox, is already the proof of ownership — the same reasoning `accept-invitation` uses for
`email_confirm: true`.

**Invitations must be provisioned server-side.** `AcceptInvite.tsx` calls the `accept-invitation` edge fn —
it must **never** go back to client-side `supabase.auth.signUp`. When an auth user already exists for the
email, GoTrue's anti-enumeration behavior returns a **fake user object with a random UUID and no error**,
so `signUpError` never fires: the invitee is told "Account created!" while the password was never stored
and the accept RPC receives a phantom user id. That was a real bug. The function validates the token first
(unused + unexpired), reads the email **from the token's row and never from the request body**, then
creates-or-updates the auth user with `email_confirm: true` (the invite, delivered to that mailbox, is the
proof of ownership), and **checks the accept RPC's error** rather than swallowing it.

**Login role gates are a separate allowlist.** Adding a role to `AppRole` + `ProtectedRoute` is not enough —
`TeamAuth.tsx`'s `redirectByRole` has its own post-signin allowlist (`TEAM_PORTAL_ROLES`) and will sign a
valid user straight back out if the role is missing from it. It ranks **only team-portal roles** when
choosing a landing page, because `ROLE_PRIORITY` in `useUserRole.ts` puts `user` above `auditor` — an
auditor who is also a brand `user` would otherwise be sent to the staff page they cannot open.

⚠️ **`bootstrap-admin` was deleted** (2026-07-15) — it was deployed with `verify_jwt=false` and **no caller
authentication**, letting any anonymous request set the password on a hardcoded account and grant it admin.
Do not model new admin functions on it; copy `create-client-account`'s skeleton and tighten the role check.

---

## Document Attachments — `DocumentAttachment.tsx`

Component in `src/components/team/`, rendered in the SOPs Library drawer's **Reference Documents** tab and the HR Training & SOPs Reference Library drawer. Manages a list of reference items stored in `content.attachments[]` (`Attachment = { name; path?; url? }`):
- **Files** — multi-select upload to `training-content/<sopId>/files/<name>` via `uploadSopFile()`; inline PDF preview (`<object>`, toggleable) + Download (signed URL via `resolveFileUrl()`). Remove deletes the storage object.
- **Links** — external URL (opens in a new tab); the Label auto-fills from the URL in Title Case until edited. Links are encouraged over uploads to save storage.
- **Source deck** — when `getSourceDeckUrl(sopId)` finds `<sopId>/source.pptx`, shows a "Download source PowerPoint" button (auditor reference).
- `variant` (`training` | `reference`) only changes the heading ("Related Materials" vs "Attached Documents"). Legacy single `file_url` still renders alongside the list. View-only when no `onChange` (non-admin).

---

## SOP Body — `SopBodyEditor.tsx`

Component in `src/components/team/`, rendered in the drawer's **Document** tab. Edits/renders the structured SOP body in `content` (sop/form/**fsqm**: `purpose, scope, definitions, responsibility, procedure[], form_references, records, governing_reference, revision_history`; policy: `statement`). Section order/labels reuse `SECTION_LABELS` (exported from `sopDocxParser.ts`) — adding a key there propagates to both the parser and this editor. `isPolicy` (the single free-form statement view) keys on `docType === "policy"` only; `fsqm` renders the structured sections. Admin: editable fields + "Save Document" (`updateModuleContent`, merges so `attachments` are preserved). Non-admin: read-only formatted sections (procedure as a numbered list), empty sections hidden.

**`procedure[]` has three line forms**, all decided by `groupProcedureSteps()` in `sopDocxParser.ts` — the single function this editor *and* `generateSopPdf()` both route through, so screen and paper cannot disagree:

| Line | Renders as |
|---|---|
| plain text | a **numbered step** (in FSQM programs, a Part heading) |
| `• text` (`•◦‣·-*` + space) | a **list item** under the step above it |
| `> text` (`>` + space) | a **paragraph of prose** under the step above it |
| `◦ text` (`◦` + space) | a **sub-item**, indented one level under the bullet above it (a plain bullet if there is none) |

`procBlockRuns()` collapses consecutive bullets into one `<ul>`, so prose between two lists splits them correctly. **The `>` form exists because without it there were only two:** every explanatory sentence had to be written as a bullet, and a long program rendered as an undifferentiated wall of them — FSQM-009 was 69 bullets over 10 Parts with nothing to distinguish "here are the ten triggers" from "here is why the rule reads this way". A bullet is for a short, parallel, enumerable item; anything explanatory or narrative is prose. The marker **requires whitespace after `>`** deliberately: of all 606 stored procedure lines exactly one starts with `>`, a scanned SOP's `>10ppm shall not be reworked`, and it has no space so it is untouched.

---

## SOP PDF Export — `lib/sopPdf.ts`

`generateSopPdf(row)` renders an SOP `sop_documents` row to a downloadable PDF **client-side** via `pdfmake` (no server/storage — generated on demand, no caching). Output mirrors the paper SOP template:
- **Logo** — the Adventure Bakery wordmark, fetched at runtime from `/sop-logo.png` (in `public/`, extracted from the original SOP PDF; the seal-only `logo.png` is the wrong asset for this) and cached in a module var as a data URL.
- **3-row metadata header table** (black gridlines): company / `Revision Num.` · `SOP Title` / `Approval` · `SOP No.` / `Eff. Date:` — sourced from the row's `title, sop_number, revision, effective_date, approved_by`.
- `Clause Reference` (← `sqf_reference` + "(SQF Code, Edition 9)") and `Linked Form` (← `content.form_references`) near the top.
- **Body sections** in `SECTION_LABELS` order, empty ones omitted; `procedure` as a numbered list (a leading `N.`/`N)` in stored steps is stripped so `ol` doesn't double-number). Closing `Revision · Status · Approved By` line.
- **Per-page footer** via pdfmake's `footer` callback: `Adventure Bakery, LLC · Confidential · <page #>` + the verbatim trade-secret/FOIA disclaimer.

`SopPdfRow` is a minimal subset of the row; the function is pure (no DB call — callers already hold the row).

**Download entry points** (all reuse `generateSopPdf` + `hasSopBody`, gated to `type === 'sop'` rows with a structured body):
- **SOPs Library** (`SopsLibrary.tsx`) — a "Download PDF" button in the drawer's **Document** tab, and an inline `Download` icon beside the **Type** pill in the list (`e.stopPropagation()` so it doesn't open the drawer).
- **Training & SOPs** (`TrainingSops.tsx`) — the Reference Library table has a **Type** column with the same inline download icon.

---

## Temperature Monitoring Report — `pages/team/compliance/TemperatureReport.tsx`

`/team/compliance/temperature` (Compliance nav, `Thermometer` icon). Read-only reporting over
`temperature_logs` (YoLink sensor data). **All aggregation is client-side** — one ranged query,
no DB view/RPC yet (a later phase will roll up summaries + purge old rows). Displays **°F**.

- **Daily / Weekly / Monthly** tabs (shadcn `Tabs`) set the default window (last 24h / 7d / 30d);
  editable **From/To** date inputs override it. The two date inputs live in separate parent divs,
  so a `:last-of-type` selector won't target the second one.
- **Summary by Equipment** table: Readings · Min/Max/Avg °F · Avg Humidity %. Rows are clickable →
  a **drilldown `Sheet`** listing every individual reading (timezone-aware timestamps via
  `tzAbbr()`, DST-correct).
- **Battery Status** card: a per-sensor semicircular **SVG gauge** (`BatteryGauge`) of the latest
  reported `battery_level` (1 low → 4 full), color-coded Low/Fair/Good/Full. A red **low-battery
  banner** lists sensors with `low_battery_alarm` or level ≤ 1.
- **Recharts** `LineChart`: avg °F per time bucket, one line per equipment.
- **Exports** (both summary and drilldown): **PDF** via `pdfmake` (same vfs-font wiring + warm
  palette + confidential footer as `lib/sopPdf.ts`) and **CSV** (raw readings incl. battery
  columns). Built inline in the page, not a shared lib.
- **Contextual guide link:** on mount it locates the `yolink_operations_guide.pdf` **reference
  doc** by attachment-filename match (`fetchReferenceDocuments()` → `content.attachments[]`), and
  surfaces a gold link to it (opens a fresh signed URL via `resolveFileUrl()`) **only when data
  looks wrong** — empty range (missing) or latest reading > 6h old (stale). Renders as plain text
  if the doc isn't found (graceful).
- **Start FRM-401 Review** (staff/admin/owner): a popover with a month `<input type="month">` picker
  creates an **FRM-401 Temperature Monitoring Review** entry pre-filled from that month's data and
  navigates straight to it. The range is a **calendar month** — month-to-date for the current month,
  the full month for a past one (`monthRange()`) — deliberately *not* the page's rolling Daily/Weekly/
  Monthly window, which reads as "September 2026" while actually holding the last 30 days.
  `deriveFrm401Prefill()` fills the review month/date, a per-unit min/max/avg `unit_summary` row, and
  one `alert_log` row per `temperature_alerts` row in the month (unit, kind, opened, worst value,
  `acknowledged`, and the log's `action_taken` as the product-affected note), or a single "No alerts
  raised" row when the month is clean. **Held limits are left blank on purpose** — the limit in force
  is the reviewer's assertion, not something to be pre-answered for them. Seeded via
  `createResponse(doc, prefill)`; an existing draft is resumed untouched rather than overwritten.
- **The same fill from inside an FRM-401 entry** (owner's request, 2026-10-08): an entry started from the
  SOPs Library opened empty. `TemperatureReviewFill` (`components/team/forms/`, shown by `FormEntry` on an
  editable FRM-401 entry when `temperatureReviewReady(schema)`) says the review is best started from this
  page and offers a month picker + **Populate from temperature logs**. Both ways in share
  `src/lib/temperatureReview.ts` (`loadFrm401Prefill`, `deriveFrm401Prefill`, `mergeFrm401Prefill`,
  `monthRange`, `summarize`). In the entry it fills blanks only, never replaces an answer, refuses a
  month different from the entry's Month reviewed, and is unsaved and dirty with one Undo. The launcher
  on this page still saves straight away. A default month on the field was built first and dropped.
- **Last calibration check, on the FRM-401 entry** (2026-10-08): since calibration moved to FRM-705 (FRM-401
  v3 only confirms it), `CalibrationSummary` shows one line per unit inside the "Device accuracy" section, under its opening note (`afterSection` with `inside` and `afterField`), of
  an editable FRM-401 entry: outcome, date, probe and sensor reading, and a link to that FRM-705 entry.
  `lastSensorChecks` (`src/lib/calibrationSummary.ts`, no imports, tested by
  `scripts/test-calibration-summary.mjs`) takes, per unit, the newest FRM-705 entry whose row is Pass or
  Fail - a row marked not checked is passed over for an older entry, and drafts count and are flagged.
  Rows are matched by label (`SENSOR_UNITS`: "refrigerator ... sensor", "freezer ... sensor"), so renaming
  those FRM-705 rows means updating it. It is a reading of the records, never the answer to the
  confirmation, and is not shown on a submitted review (it would show today's check, not that month's).

---

## Tolling Inventory — `pages/sales/SalesClientFolder.tsx` + `components/sales/TollingInventoryTools.tsx`

A **Tolling Inventory** tab (staff-only) on the Sales client folder tracks each client's
customer-owned (tolling) stock in `inventory_tolling`. The tab (`TollingInventoryTab` in
`SalesClientFolder.tsx`) groups rows into collapsible **Ingredients / Packaging / Finished Goods**
sections (`category` enum), with inline add/edit/delete and an available = `qty_on_hand − reserved`
display. On load it **merges** ingredient names pulled from the client's batch sheets with existing
`inventory_tolling` rows; batch-sheet provenance (`batchSheetIds`) is kept so a merge can rename the
ingredient inside the source recipe (otherwise a merged-away row reappears on next load).

`TollingInventoryTools.tsx` holds the supporting dialogs/helpers:
- **`TollingExcelImportDialog`** — imports a client's spreadsheet via **ExcelJS**; `matchHeaderKey()`
  does keyword-based (not exact-string) header matching so messy real-world sheets still parse
  (`normalizeHeader`, `normalizeCategory`).
- **`downloadCountSheet`** — exports an ExcelJS count sheet for a physical recount.
- **`TollingRecountDialog`** — applies a physical recount back to inventory.
- **`AdjustmentHistoryPopover`** — per-row adjustment history.
- **`findDuplicateCandidates` + `TollingDuplicateReviewDialog` + `TollingManualMergeDialog`** —
  detect and merge duplicate ingredient names (auto-suggested + manual).

`inventory_tolling` is **not in generated `types.ts`** — query via `supabase.from("inventory_tolling" as any)`.

---

## PowerPoint Import — `PptxImportDialog.tsx`

Component in `src/components/team/`. Two modes:
- **New module** (SOPs Library header button, or the per-category "Add Module" button on each category accordion group): creates a draft `sop_documents` row first. Optional `defaults` prop (`{ training_category?, category? }`) sets where the module lands — the per-category buttons pass the group's category string plus the matching training category number; without defaults it falls back to training_category 1 / category null.
- **Replace** (from SlideContentEditor): deletes old slide images, then rebuilds

There's also an **optional quiz CSV** file input. When chosen, the CSV is parsed up front with `parseQuizCsv` and imported verbatim, replacing AI quiz generation.

Pipeline steps shown in a live progress list:
1. Read quiz CSV (if provided) + extract speaker notes via `extractSpeakerNotes()` (`src/lib/pptxNotes.ts`) — both done before any writes so a bad file aborts cleanly
2. Create module / remove existing slides
3. Upload `.pptx` to `training-content/{moduleId}/source.pptx`
4. Invoke `convert-pptx` edge function → CloudConvert (pptx → PNGs)
5. Narration: a slide's speaker notes win; `generate-narration` only fills slides whose notes are empty
6. Compute `slideDurations` via `computeSlideDuration()`
7. Persist content via `updateModuleContent()`
8. Quiz: authored CSV via `saveQuizQuestions()`, else (when no CSV) AI `generate-quiz`

AI quiz count (no CSV): `clamp(ceil(slides.length / 2), 5, 15)`.

**Hand-authored content wins over AI**, so SQF decks are produced by the generator in `training-decks/` (below) and import deterministically. Authoring rules, quiz CSV format, content policy (no customer/product names), and the visual-layout catalog live in `DECK_FORMAT_CONTRACT.md`.

---

## Word Import — `SopImportDialog.tsx`

Component in `src/components/ops/`. Drag/drop `.docx` files; `parseSopDocx()` (`src/lib/sopDocxParser.ts`, mammoth + JSZip) extracts metadata + a structured body into `ParsedSop`. Each file is reviewed/edited in the dialog, then **Confirm & Save** inserts a draft `sop_documents` row (reference doc — no `training_category`) with the body on `content`. On save it also **uploads the original `.docx`** to `training-content/<id>/files/<name>` and records it in `content.attachments` (downloadable in the drawer's Reference Documents tab; non-fatal if the upload fails). The saved body renders/edits in the **Document** tab (`SopBodyEditor`). ("Generate SOP from source document" is a coming-soon placeholder.)

**Type detection** (`detectType` / `detectTypeLocal`): doc-number prefix → `FSQM` = **`fsqm`** (Food Safety Quality Manual), `FRM` = `form`, else `sop`. Only `policy` is free-form (`parsePolicyBody` → `statement`); `fsqm`/sop/form all parse into structured sections via `parseBody`.

**Scanned-hardcopy robustness** (these documents are often scans of paper originals — the parser is built to survive the resulting mess):
- **Merged header cells** — `inlineHeaderValue` splits `"Label: value"` out of a single cell (e.g. `"Effective Date: 11/15/2019"`) when the label/value weren't in separate cells. The captured value is the LAST regex group (several `HEADER_FIELDS` patterns carry their own label sub-groups).
- **Body-leaked metadata** — `scanInlineMetadata` + `guessTitle` recover number/title/date/revision from the first body paragraphs when there's no clean header table.
- **Mid-body running-header tables** — a scan repeats the page header as a `<table>` partway down the body; `headerAtTop` only applies the "skip blocks before the header table" filter when that table actually precedes the first section heading (otherwise it would drop every section above it).
- **List-rendered headings** — mammoth renders a numbered Word heading (`1. PURPOSE`) as a single-item `<ol>`; `listSectionHeading` recognizes these as headings instead of swallowing them as list content.
- **Noise filtering** — `isNoiseLine`/`stripRunningHeader` drop page numbers, confidentiality boilerplate, leaked doc-number/date/revision lines, the repeated title, and stray OCR tokens.
- **Revision history table** — `extractRevisionHistoryTable` finds the trailing `Rev #/…/Approved by` table, renders rows into `content.revision_history`, and fills `approved_by` from its column when the header didn't supply one.
- **Rebrand** — `rebrandParsed` runs a final pass replacing `Compass Blending` → `Adventure Bakery` (case-insensitive) across every parsed string. **Always applied** (the source hardcopies were authored under the prior company name).

---

## PRF PDF Import — `lib/prfPdfImport.ts` + `sales/PrfImportPanel.tsx`

Attaching a filled **Manufacturing Project Request Form** (Form 009-1) in the Add Deal dialog reads it
and proposes column values for `prf_submissions`. Before this, attaching a PRF filed a document and
nothing else — 17 of 59 columns were populated, all from the dialog's own four inputs.

Customers fill the printed template in a PDF editor, which leaves **three separable layers**:

| layer | how it is identified | carries |
|-------|----------------------|---------|
| template | Calibri (+ MS-Mincho/MS-PGothic for `☐` glyphs) | the labels, used as anchors |
| typed answers | **always Arial**, and the template never is | ~13 fields |
| ticks | vector marks drawn **over** the `☐` glyph | more columns than the typed layer |

**A ticked box still extracts as an empty `☐`** — the tick is a separate vector path, so it is
invisible to text extraction and is found by rendering the page and measuring ink *inside* the box
(inset 28% to skip the outline). Measured ticked 0.024–0.167, unticked exactly 0; `TICK_THRESHOLD`
is 0.015. Validated against a rendered page: 12 detected / 12 visible on page 1, 7 on page 2.

Two pdf.js constraints shape the implementation, both verified rather than assumed:
- `textContent.styles[].fontFamily` returns only a generic CSS fallback (`"sans-serif"`), so real
  font names must come from `page.commonObjs` — which is **populated only after the page renders**.
  Hence render-then-read. Names carry a subset prefix (`SOXHWI+Arial`) that must be stripped.
- Answers are located **by label, never by coordinate**: an answer's owning label is the nearest
  template item to its left on the same row, and answers sit 2–5 units above the label baseline. A
  template revision moves coordinates but preserves that relationship.

**Paper wording ≠ database wording.** Each checkbox maps `box` (printed) → `as` (stored), because the
Stage 2 wizard writes `Bag-in-box`, `Manufacturer Provided`, `Export Requirements`, `Natural +
Artificial` where the paper says `Bag in box`, `CoPack provided`, `Export`, `Natural/Artificial`.
Emitting paper wording would render imported PRFs inconsistently beside wizard-sourced ones. `as:
null` means the box is understood but contributes nothing (the form's "Warehousing needs: yes" is
implied by the storage type ticked beside it). Where the paper asks a question the schema cannot hold
(`finished_form`'s bake/freeze/extrude options), the paper wording is kept and flagged rather than
force-fitted.

**The tick layer disambiguates the typed layer.** The form repeats "Units per primary vessel" once per
vessel type and more than one row can carry a number; the *ticked* vessel decides which is real.

Nothing writes silently: `PrfImportPanel` shows every value as a ticked proposal, and only accepted
rows merge into the insert. `company_name`/`product_name` are excluded from the proposal
(`DIALOG_OWNED`) because they pre-fill the visible inputs instead. When the PDF's email matches an
existing folder, **that folder's spelling of the company wins** over the form's (these PDFs are typed
in caps — a variant spelling is how duplicate client folders start).

Degrades honestly rather than importing nothing: non-PDF, no text layer (a scan), not a PRF, and
unopenable each report a distinct reason and never block filing the document. `pdfjs-dist` is loaded
via dynamic `import()` — it lands in its own chunk (~479 kB + a 2.2 MB worker) and adds ~15 kB to the
main bundle.

---

## Training Deck Generator — `training-decks/`

Node tooling (not part of the Vite app) that produces the SQF training decks the importer consumes. Outputs go to `training-decks/dist/` and external/design exports to `training-decks/incoming/` — both gitignored; only sources are tracked. DevDeps: `pptxgenjs`, `@resvg/resvg-js`, `jszip`.

- **`generate.mjs`** — `node training-decks/generate.mjs <content.json>` builds `<name>.pptx` + `<name>.quiz.csv` from a structured content JSON. 16:9, warm-bakery palette/fonts; diagrams as native shapes; flat illustrations drawn as SVG in **`assets.mjs`** and rasterized to PNG by resvg. Enforces the content policy (fails on customer/retailer/product brand names), warns on missing quiz hints, and round-trip-verifies that speaker notes survive.
- **`inject-notes.mjs`** — `node training-decks/inject-notes.mjs <deck.pptx> <content.json>` stamps the JSON's narration into a deck's speaker notes (creating the notes parts/master if absent; `--strip` removes them). Makes **externally designed decks** (e.g. Claude Design exports) importer-compatible; maps narration to slides by position and round-trip-verifies.
- **`translate-deck.mjs`** — `node training-decks/translate-deck.mjs <en-deck.pptx> <strings.json> -o <es-deck.pptx>` swaps visible slide text in place from an EN→target map (`--extract` dumps a skeleton). Produces the **Spanish deck from the approved EN design** (no second design session); fails on any unmatched paragraph.
- **`content/module-NN.{en,es}.json`** — per-module structured content (slides: title/lead/visual/notes; quiz: question/options/correct/hint/rationale). **`CLAUDE_DESIGN_BRIEF.md`** is the brief pasted into a Claude Design session.

Module 1 (EN + ES) is imported as draft `sop_documents` rows under Core Onboarding. See `DECK_FORMAT_CONTRACT.md` for the full authoring + external-deck + ES workflow.

---

## Supabase Edge Functions

| Function | Purpose |
|----------|---------|
| `convert-pptx` | Accepts `{sopId, sourcePath}`; uses CloudConvert API to convert .pptx → per-slide PNGs; uploads to `training-content`; returns `{slides[]}` |
| `generate-narration` | Accepts `{imageUrl}`; sends signed PNG URL to Gemini 2.5 Flash vision; returns `{text}` — 2–4 sentence trainer narration |
| `generate-quiz` | Accepts `{title, narrations[], count}`; returns `{questions[]}` — MCQ with 4 options, hint, rationale |
| `cleanup-narration` | Accepts `{text}`; returns `{text}` — grammar/style cleanup via Gemini |
| `extract-form-answers` | Accepts `{manifest, imageUrls[], source?, pageTexts?}`; reads a photographed (or, with `source: "pdf"`, a PDF) completed form and returns `{answers, warnings[]}` for the entry's "Fill from a photo". Whitelists and coerces every answer against the manifest. Document mode places fixed-table rows by label (`_shared/gridRows.ts`). See "Fill from a photo also takes a PDF" |
| `extract-package-label` | Accepts `{imageUrls[], wanted[], mode?}` (`ingredient` / `finished_goods` / `specification` — the last also transcribes declarations, see "Specification scan"); reads a photographed **ingredient package** and returns `{facts, alternates:{lot_code[]}, extras[], warnings[]}` for filling one grid row. Closed fact whitelist server-side (no allergen key); prompted to distinguish a variable-applied lot code from pre-printed item/barcode numbers. See "Package-label scan" above |
| `verification-notifications` | Invoked by pg_cron twice daily (`0 11,19 * * *` UTC). Reads `verification_schedule`, derives each activity's last-completed from the evidence records, and raises one `internal_notifications` row per activity due or overdue — plus, for the retention review, a deep link per FRM-703 sample past its discard date. Dedupes on a unique index over `dedupe_key`; treats `23505` as "already raised" and refreshes instead. Closes what is no longer due with `resolved_at` (never `dismissed_at`). Decision half is `_shared/verificationSchedule.ts`, tested by `scripts/test-verification-schedule.mjs`. See "Verification Schedule & Notifications" below. |
| `cleanup-form-text` | Accepts `{text}`; returns `{text}` — same shape as `cleanup-narration` but prompted for compliance-form free-text answers (incident reports, root-cause notes): fixes grammar/punctuation/capitalization/filler words into one clear statement, preserves every fact/name/quantity exactly. Powers the AI-cleanup Sparkles button in `DictationTextarea.tsx`. |
| `admin-user-account` | Accepts `{action, userId, password?, redirectTo?}` — `status` / `set_password` / `reset_link`. Admin-only account management; see "Account Access" below. Caller gate is `has_role('admin') OR is_owner()` — deliberately **not** `is_staff_or_admin` (that helper includes staff). |
| `accept-invitation` | Accepts `{token, password, preferSpanish}`; provisions the invited auth user server-side via `auth.admin.createUser({email_confirm:true})`, then calls the accept RPC. `verify_jwt=false` — the caller has no account yet; the invite token is the credential. See "Invitations" below. |
| `team-coach` | Accepts `{messages:[{role,content}]}`; returns `{reply, sources:[{id,number,title}]}`. The Team Portal Coach chat (see "Team Coach chat" below). Caller must pass `is_staff_or_admin`; reads active `sop_documents` with the caller's JWT (RLS). Two passes: Gemini picks up to 8 documents from a one-line catalog, merged with any document number typed and the top 3 keyword hits (a failed selection degrades to keywords), then answers from those bodies with `[FRM-509]`-style citations. |
| `draft-audit-evidence` | Accepts `{clause, requirements[], asOf}`; returns `{evidence, window, sources[]}`. FRM-010's "Draft from records" (see "AI evidence draft"). Caller must pass `is_staff_or_admin`; reads with the caller's JWT. Facts computed in `_shared/auditEvidence.ts`, prose by `aiJSON`. `verify_jwt = true`. |
| `translate-notice` | Accepts `{title, body}` written in English or Spanish; returns `{source: "en"\|"es", title, body}` in the OTHER language. For the Post a notice dialog (see "Staff notices"). Caller must pass `is_staff_or_admin`; writes nothing. `verify_jwt = true`. |
| `tts-elevenlabs` | Accepts `{text, voiceId?, lang?}`; calls ElevenLabs (`eleven_multilingual_v2`) and returns the MP3 bytes. **Returns `Content-Type: application/octet-stream`** (not `audio/mpeg`) so `supabase.functions.invoke` hands back a real `Blob` — any other type makes invoke run `response.text()` and corrupt the binary. Multilingual model auto-detects language, so one voice covers EN + ES. |

**Required secrets (set via Supabase dashboard → Settings → Edge Functions):**
- `LOVABLE_API_KEY` — Lovable AI gateway key (pre-provisioned)
- `CLOUDCONVERT_API_KEY` — CloudConvert API key for pptx→png conversion
- `ELEVENLABS_API_KEY` — ElevenLabs key (Text-to-Speech permission only); `ELEVENLABS_VOICE_ID` — the company's cloned voice ID (default when a request omits `voiceId`)

### ElevenLabs voice narration

The training "Listen" feature plays narration in the company's cloned ElevenLabs voice instead of the browser's robotic TTS.

- **Generate once, cache forever.** Admin clicks **Generate Voice Audio** in the slide editor → `generateModuleAudio()` (`training.ts`) loops narrated slides, invokes `tts-elevenlabs`, uploads each MP3 to `training-content/<sopId>/audio/slide-NN.mp3`, and writes the paths into `content.audio[]`. Billed per character at generation; playback is a static file (no per-play cost/latency). Re-run after editing narration to refresh.
- **Playback** (viewer `TrainingModuleDetail.tsx` + editor preview): resolve the slide's `content.audio[]` path to a signed URL (`getTrainingAudioUrl()`), play via `HTMLAudioElement`. **Always falls back to `speechSynthesis`** when there's no cached audio or the MP3 errors. The fallback is guarded by a one-shot `fellBack` flag because `audio.onerror` and the `play()` rejection can both fire for one failure — without the guard you get two TTS utterances and a desynced `speaking` state (Stop stops responding).
- The key stays server-side in the edge function; the browser only ever sees MP3 bytes / signed URLs.

---

## lib/ Utilities Reference

| File | Key exports |
|------|-------------|
| `utils.ts` | `cn()` — class merging |
| `training.ts` | Types, fetchers, `scoreQuiz`, `submitQuizResult` (4th arg `complete=false` saves score only, deferring completion to acknowledgment), `saveAssignmentProgress`, `markAssignmentComplete`, `parseQuizCsv`, `computeExpiry`, `getAssignmentStatus`, `getTrainingSlideUrl`, `uploadTrainingSlide`, `replaceTrainingSlide`, `deleteTrainingSlide`, `updateModuleContent`, `saveQuizQuestions`, `computeSlideDuration`, `generateModuleAudio` (renders+caches ElevenLabs voice MP3s into `content.audio[]`), `getTrainingAudioUrl`, `audioPathFor`, **reference/attachment helpers** (`Attachment` type, `uploadSopFile`, `removeSopFile`, `resolveFileUrl`, `getSourceDeckUrl`, `fetchReferenceDocuments`, `hasReferenceDocs`, `hasSopBody`) |
| `materialCalc.ts` | `runMaterialCalc()` — ingredient/packaging needs for an order batch |
| `sopDocxParser.ts` | `parseSopDocx()` — extracts structured SOP/FSQM data from a .docx upload (scanned-hardcopy robust: merged-header splitting, running-header/noise filtering, list-rendered headings, trailing revision-history table, `Compass Blending`→`Adventure Bakery` rebrand); exports `SECTION_LABELS` (body section keys/labels/order, reused by `SopBodyEditor`), `SopType` (`sop`/`form`/`policy`/`fsqm`), and the procedure line-form helpers `groupProcedureSteps`/`procBlockRuns`/`isBulletStep`/`isParagraphStep` (numbered step vs `•` list item vs `>` prose paragraph — see "SOP Body" above) |
| `pptxNotes.ts` | `extractSpeakerNotes(file)` — pulls per-slide speaker notes from a .pptx (JSZip, presentation order); throw-safe (degrades to nulls → AI narration fallback) |
| `prfPdfImport.ts` | `extractPrfFromPdf(file)` — reads a filled Form 009-1 PRF PDF into proposed `prf_submissions` values (Arial answer layer + pixel-measured checkbox ticks, located by label not coordinate); also exports `splitMeasure`/`splitDimensions`. Dynamic-imports `pdfjs-dist`. See "PRF PDF Import" above |
| `sopPdf.ts` | `generateSopPdf(row)` — client-side SOP→PDF via `pdfmake` (template header table + body sections via `SECTION_LABELS` + per-page confidentiality footer; logo from `/sop-logo.png`). On-demand, no caching. Also exports `loadLogoDataUrl`, `confidentialFooter`, `DISCLAIMER`, `PDF_GOLD` for reuse by `formPdf.ts`. See "SOP PDF Export" above |
| `docNumber.ts` | Document numbering convention: `DOC_STAGES`, `parseDocNumber`, `stageForNumber`/`stageForSopNumber`, `formatDocNumber`, `docNumberIssue`/`isValidDocNumber`; `parseClauseNumber`/`compareClauseIds` (the deliberate SQF-clause SOP scheme). See "Document Numbering Convention" above |
| `templates.ts` | `fetchActiveTemplates()`, `downloadTemplate()` |
| `notifications.ts` | The in-app feed: `FEED_TYPES` allowlist, `fetchOpenNotifications`/`countOpenNotifications` (team-wide rows plus the ones addressed to the reader), `fetchClearedNotifications`, `dismissNotification`, `isDismissable`, `isInternalHref`; signature requests — `fetchSignatories`, `requestSignature`, `resolveSignatureRequest`, `openSignatureRequest`. Every query goes through `(supabase as any)` because the added columns are not in the generated types. See "Verification Schedule & Notifications" |
| `verificationSchedule.ts` | Due-date maths for the schedule — `nextDue`, `rowState`, `assessDue`, `addFrequency`, `frequencyLabel`, `dedupeKeyFor`, `formLink`/`documentLink`, `retentionLinks`, `FROM_NOTIFICATIONS`. **Byte-identical twin** of `supabase/functions/_shared/verificationSchedule.ts` below the header; edit both and run `scripts/test-verification-schedule.mjs` |
| `formSchema.ts` | Dynamic form schema types + pure helpers: `getFormSchema`/`hasFormSchema`, `buildZodSchema` (submit-time validation), `emptyValues`, `formatFieldValue`, `flattenForReport`, `instanceTitle`, `slugifyFieldId`, `valueFields`, `listFields` (fields with `showInList: true`, for Entries-list extra columns), `verifierSignatureFields`/`unsignedVerifierFields` (which verifier lines an entry is still missing — drives the Request-signature action and closes the request); package-label scan helpers `LABEL_FACTS`/`LABEL_FACT_LABELS`, `inferScanFact`/`resolveScanFact`, `scanWantedFacts`, `applyLabelScan`. See "Dynamic Fillable Forms" below |
| `formResponses.ts` | Supabase access for `sop_document_responses`/`sop_document_history` — `createResponse` (optional 2nd arg `prefill` seeds the new entry's `data` over `emptyValues(schema)`; a resumed existing draft is never clobbered — powers the FRM-401 temperature-review launcher), `saveResponseData`/`submitResponse` (optimistic-concurrency guard, throws `StaleResponseError`), `reopenResponse`, `deleteResponse(id, attachmentPaths?)` (also best-effort cleans up storage), `resolveSchemaForResponse` (live/snapshot/fallback), `fetchProfileNames`, `extractPackageLabel` (photographed ingredient pack → facts for one grid row), and entry-attachment helpers `uploadResponseAttachment`/`removeResponseAttachment`/`getResponseAttachmentUrl`/`saveResponseAttachments` (`form-attachments` bucket, no concurrency guard — see "Dynamic Fillable Forms") |
| `visitors.ts` | Visitor sign-in, pure half: `findVisitorMatches` (phone / last 4 / name), `ackState` (twelve months + current revision), `addMonthsIso`, `buildAckData`/`buildSignInData` (the FRM-906 / FRM-905 entries), `isRefused`, `isVisitorForm`/`isVisitorKioskSchema`. No imports; tested by `scripts/test-visitors.mjs`. See "Visitor Sign-In" |
| `lotTrace.ts` | Lot trace + recall workspace, pure half: `TRACE_FORMS`, `runTrace`, `startOptions`, `toRecordFill`, `checkTraceMapping`, `deriveRecallSteps`, `clockState`, `normLot`/`sumQty`. No imports; tested by `scripts/test-lot-trace.mjs`. See "Lot Trace & Recall Workspace" |
| `formPdf.ts` | `generateFormResponsePdf(doc, schema, response)` (paper-like entry PDF), `generateFormReportPdf(...)` (landscape report, clamps to 10 columns), and `generateDerivedReportPdf(...)` (derived log/register PDF); reuses `sopPdf.ts`'s logo/footer exports |
| `formReport.ts` | Derived-report engine for log forms (`content.report_schema`): `getReportSchema`/`hasReportSchema`, declarative `ColumnSource` (`field/template/map/cases/const`), `resolveReportColumns`, `loadReportBase`+`filterReportRows` (client-side projection), `matchesFilter` (fixed `filters[]` conditions), `selectOptionsFromResponses`/`loadSelectOptions` (options for a select linked to another form — see `optionsFrom`), `runReport`, `distinctColumnValues`, `buildReportSql` (read-only SQL equivalent). See `FORM_REPORTS.md` |

---

## Verification Schedule & Notifications (D-18)

**Operating it: `VERIFICATION_NOTIFICATIONS.md`** — cheat sheet, how to run the job by hand,
and a troubleshooting guide. Read it before debugging anything scheduled: the first entry is that
`cron.job_run_details.status = 'succeeded'` means the SQL ran, NOT that the HTTP call landed.

**`public.verification_schedule`** is the master verification schedule SQF 2.5.2.2 requires — one row
per activity with its frequency, the **position** responsible, and where its evidence lives. It is a
table rather than a grid inside a form entry because **a grid row has no stable identity**: it is
addressed by array position (or `_label` when `deletable`), so renaming an activity would orphan its
open notification and deleting a row would silently stop the alerting while the printed schedule
still showed it as scheduled. `activity_key` survives the wording changing. Staff can INSERT/UPDATE
(it is meant to be edited in the app); DELETE is admin/owner only — an activity that stops applying
is **retired**, never removed. SELECT is `is_compliance_viewer`, so the auditor can read it.

- **There is no `last_completed` column.** It is derived at read time — from `max(submitted_at)` of
  the evidence form's SUBMITTED responses (`evidence_kind='form_entry'`), or from the latest
  `sop_document_history` snapshot (`evidence_kind='document_revision'`, used where an activity is
  evidenced by the document itself being revised, which is how every FSQM programme evidences its
  own annual review). Drafts never count: a draft FRM-913 is an inspection somebody started. So it
  cannot go stale and the date shown IS the record. This
  also keeps the job read-only against `sop_document_responses` — any UPDATE there fires the
  `sop_document_responses_touch` trigger and would hand a `StaleResponseError` to whoever has that
  form open.
- **Frequency is unit + count, never days.** 365-day arithmetic drifts a day per leap year until
  "reviewed annually" quietly is not. Month-end addition clamps (31 Jan + 1 month = 28 Feb).
- **`covers_until_field` is the second way to date an activity**, and only one row uses it
  (`blackout_declaration`, D-05). It names a field on the evidence form holding **the last date that
  record covers**; the activity is then due **the day after** — the first day no record covers — and
  the frequency is not consulted at all. It exists because some records declare their own period of
  validity: FRM-006 states the blackout dates for a stated period, so filing it early or late says
  nothing about when it expires. Anchored on `submitted_at`, a declaration signed in October for the
  following calendar year would come due the *following* October, and one signed late would push its
  own expiry out and let the site run uncovered. A CHECK confines it to `evidence_kind='form_entry'`.
  The job takes the **maximum** covers-until across submitted entries, not the newest entry's value,
  so a correction filed to an earlier period cannot walk the due date backwards and re-raise
  something already discharged.
- **`status='planned'`** means scheduled but *not being performed* — the governing program has not
  been issued. Three of the twenty-five rows are planned (critical-limit re-validation, backflow, water - as of 2026-10-07; calibration, the internal audit and the mock recall were activated when their programs were issued, and a crisis plan review row was added with FSQM-024); compressed air is **retired** (D-32 determined
  11.5.5 is not engaged). A CHECK forces each planned row to name its deliverable, and `assessDue()`
  refuses to raise one; the schedule page renders them muted with no due date. **Do not "fix" a
  planned row by activating it** — activate it when its program is issued.
- The date maths lives in **two identical copies** — `supabase/functions/_shared/verificationSchedule.ts`
  and `src/lib/verificationSchedule.ts` — because a browser bundle must not pull in server code (the
  same reasoning that duplicates `limitText` into `temperatureAlerts.ts`).
  `scripts/test-verification-schedule.mjs` bundles **both** and asserts they agree, because drift in
  date arithmetic is silent and material.

**`public.internal_notifications`** was extended rather than replaced. It had existed since
`20260129202804` with five writers and **zero readers**, is already team-wide (no `user_id`), and the
temperature alerts the feed must surface were already being written into it. Added: `dedupe_key`,
`responsible_position`, `due_on`, `severity`, `links` (`[{label, href}]`), `dismissed_by/at/note`,
`resolved_at/reason`, and later `assigned_to` (see "Signature requests" below).

- **Dismissal and resolution are different things.** A person clearing an item is stamped; the job
  closing one because the activity was done sets `resolved_at` and is **never** stamped with a name,
  or the stamp stops being evidence that a person acted.
- Both UPDATE policies were **dropped**, so the people a stamp describes cannot edit it. Dismissal
  goes through `public.dismiss_notification(uuid, text)` — `SECURITY DEFINER`, gated on
  `is_staff_or_admin`, first-dismissal-wins. The note is optional (unlike
  `acknowledge_temperature_alert`, where the sentence *is* the corrective-action record).
- **`is_read` / `read_at` are vestigial** — never written by any code, and they carry no actor.
- The dedupe index is **total**, not partial on dismissal, because a due date is an *occurrence* (the
  date is in the key) rather than a recurring *condition*. That is what stops the afternoon run
  resurrecting what somebody cleared at 09:30.
- **`FEED_TYPES` in `src/lib/notifications.ts` is an allowlist** — currently `verification_due`,
  `temperature_alert`, `signature_requested`. Four of the five pre-existing writers are
  batch-sheet/private-label chatter. Add a type there deliberately, or it will not show.
- **Temperature notifications carry no Clear button.** Clearing one would make the badge go away
  without the SOP-401 corrective-action record ever being written. They close themselves once the
  alert is acknowledged or cleared.

**There is deliberately no FRM-008 and no general verification form.** One was drafted and deleted
before issue. Its record section served two activities out of thirteen, and both dissolved on
inspection: no active FSQM programme records its annual review on a form — the revision is the
evidence, in all eight of them — and the annual re-validation of critical food safety limits belongs
with the food safety plan that establishes them, which does not exist, so that activity is carried
as `planned`. **The schedule lives in FSQM-017 Part 6**, generated from `verification_schedule`, and
2.5.2.2 asks the *programme* to have a verification schedule, so that is also the literal reading.
The general lesson is worth keeping: **a catch-all record beside a purpose-built one produces two
accounts of a single activity** and invites being filled in alongside the real form rather than
instead of it. If a future activity has no home, give it one — do not revive a generic form.

### Signature requests

The person who filled a form in asks a **named person** to review and sign it, with an optional note.
"Request signature" sits in `FormEntry`'s action bar and appears **only while a verifier-role
signature is still unsigned** — once every one is signed there is nobody to ask. It then offers to
withdraw instead. The request lands in that person's feed with the note and a deep link to the entry.

- **It is requested, never derived.** The first cut computed the queue — any draft with an unsigned
  verifier line was "awaiting signature" — and against live data that produced **12 items, the oldest
  three months old**, almost none of them anybody waiting on anything. A queue that is mostly noise
  stops being opened. `unsignedVerifierFields()` survives from that version and is what decides when
  the request has been satisfied. **Do not revive the derived queue.**
- **`assigned_to` (nullable) makes the feed addressable**, which it had never been. Everything else
  in the table is team-wide and labelled with a responsible *position* — deliberately, because
  2.5.2.2 is what that labelling is for. A signature request is addressed to a *person*, since only
  they can discharge it. The feed shows a row when `assigned_to is null or = the reader`, so every
  pre-existing notification behaves exactly as before.
- **A request cannot be dismissed, only resolved** — the same shape of reason temperature alerts
  cannot be. Clearing it would make the ask disappear without the signature ever being given; the
  ways out are signing it or the asker withdrawing it. That is also what makes the upsert honest:
  re-asking reopens the row by clearing `resolved_at`, which never carries a name, so nothing about
  anybody's act is erased. `dismissed_*` is never written for this type.
- **It closes itself.** Saving or submitting with every verifier line signed calls
  `resolve_signature_request`, checked in `FormEntry` where the schema and the saved answers are both
  in hand. Submitting closes it either way — a submitted entry cannot be signed.
- **Two `SECURITY DEFINER` RPCs** (`request_signature`, `resolve_signature_request`) because the
  table has no UPDATE policy at all, and because asking twice must upsert on the unique `dedupe_key`
  (`signature:<response_id>`) rather than fail. Same shape as `dismiss_notification`.
- **Only admin/owner can sign a verifier line** — `SignatureFieldInput` enforces it, and RLS lets
  only admin/owner update another person's draft. For staff→staff signing, add a `sign_response()`
  RPC that writes *only* the signature key; **do not widen the RLS update policy**, because RLS
  cannot see the old row and the signer could alter the answers they are attesting to.
- **A signature from a person named on the record (`SignatureField.signedBy`, 2026-10-07).** FRM-952's
  "Employee acknowledgment" belongs to the person trained, not to the assessor filling the record in -
  and before this it could only be ticked by whoever had the entry open. A field with
  `signedBy: { nameField?, dateField? }` is **never ticked on the filler's screen**. Under the form,
  `RequestedSignatures` (`components/team/forms/`) lets the filler (or an admin) choose **any team member**
  (a staff, admin or owner role; ⚠️ NOT `profiles.access_granted`, which is the client portal's switch and is
  off for an admin who signs in daily - testing it hid that admin from the list) - suggested from
  `nameField` - and send the request; the person asked opens the
  entry from their notifications and signs from their own log-in. Three `SECURITY DEFINER` functions
  (migration `20261007000006`): `request_signature_on`, `sign_response_field`,
  `withdraw_signature_request_on`. **`sign_response_field` is the `sign_response()` this section
  called for**: it writes that one answer (plus `dateField`, the day they signed) and nothing else,
  and only for the person an OPEN request is addressed to. RLS is not widened. Requests are
  `signature_requested` rows keyed `signature:<entry>:<field>`, so they never collide with the verifier
  request; submitting the entry closes them. **Whoever asked is told when it is signed**: the request
  row records `requested_by`, and `sign_response_field` writes a `signature_signed` notification
  addressed to them (in `FEED_TYPES`, shown under "Signed", and - being news - clearable, unlike the
  request). `signedBy.note` is the message the request starts with (`signatureRequestNote` fills
  `{fieldId}` from the saved entry; the person asking can change it) - FRM-952 names the training.
  After the person signs, the filler's open page is stale and
  its next save raises `StaleResponseError` - which is what stops it overwriting the signature. Set by
  migration; the builder has no control for it. Wrappers in `notifications.ts`
  (`requestFieldSignature`, `signRequestedField`, `withdrawFieldSignatureRequests`,
  `openFieldSignatureRequests`, `fetchTeamSigners`).
- ⚠️ Every `SECURITY DEFINER` function in `public` is executable by `anon` — a Supabase
  default-privileges effect, not specific to these two, and `revoke ... from public` does **not**
  undo it. Not a live hole (each gates on `is_staff_or_admin(auth.uid())`), and some genuinely need
  anon. Unresolved; do not tighten piecemeal.

---

### Staff notices (D-03)

A posting area at the top of the Notifications page (`components/team/StaffNotices.tsx`,
`lib/staffNotices.ts`): admin/owner posts a notice (English, optional Spanish), every team member sees
it until they tap **"I have read this"**, and the post keeps who read it and when. It exists because
SQF 2.1.1.2 asks for objectives to be communicated to staff, and before it that was word of mouth;
FSQM-006 names the read list as the record.

- **Tables `staff_notices` / `staff_notice_reads`** (migration `20261005000008`; not in generated
  types). **No write policies at all** - `post_staff_notice`, `acknowledge_staff_notice` and
  `withdraw_staff_notice` (`SECURITY DEFINER`) stamp person and time on the server. Reads RLS: a
  person sees only their own acknowledgements; `staff_notice_readers()` (admin/owner/auditor) returns
  notice x team member with `read_at` null where unread. "Team" = profiles with a
  staff/admin/owner role. ⚠️ It used to also require `access_granted`; that flag is the CLIENT portal's
  switch and is off for an admin who signs in daily (corrected 2026-10-07, migration `20261007000009`).
  Never use `access_granted` to mean "can use the Team Portal".
- **A notice is never edited** - people put their name to that wording. A wrong one is withdrawn and
  posted again; withdrawn notices and their read lists are kept.
- The poster is recorded as having read it. Unread notices add to the sidebar Notifications pill
  (`countUnreadNotices`, which never throws so it cannot blank the notification count).
- **Private notes (2026-10-06, migration `20261006000006`):** the dialog's "Who is it for" is **The whole
  team** (default) or **Specific people** (a tick list from `staff_notice_team()`). `staff_notices.audience`
  is `team` or `people`; `staff_notice_recipients` holds who a `people` notice is for, written by
  `post_staff_notice(..., _recipients uuid[])` in the same transaction. A private note is seen only by its
  recipients, its poster, and admin/owner - **not the auditor**, not the rest of the team (RLS on
  `staff_notices`). Only a recipient is asked to read it (`StaffNotice.for_me`; `unreadNotices` skips a
  private note an admin can see but is not named on) and the read list shows only recipients. The audience
  is a column, not "has recipient rows", and an empty recipient list is refused, so a private note can
  never become a notice to everyone. The client sends `_recipients` only for a private note and reads
  `staff_notices` with `*`, so it works before the migration is pushed (the choice is then hidden).
- **Translate (2026-10-06):** the Post a notice dialog takes the notice in English OR Spanish; the
  **Translate** button (edge fn `translate-notice`) fills the other language and sets "Written in".
  The poster often cannot read the other language, so the translation stays editable and the dialog
  says to have it checked. `noticeToPost` always stores English in `title`/`body` and Spanish in
  `title_es`/`body_es`, whichever was written first. A notice edited after it was translated cannot
  be posted until it is translated again or the translation removed (`translationIsStale`), because
  a notice is never edited afterwards.
- The section renders nothing if the tables are missing, so the page is safe to deploy before the
  migration is pushed.

## Today page — `pages/team/Today.tsx` + `lib/today.ts` (workflow layer, Phase 1)

**Design: `WORKFLOW_ARCHITECTURE.md`** (the owner's brief: make the forms invisible by following the
work, not the forms). Phase 1 is `/team/today`, the floor's home page and the **staff landing**
(`TeamAuth` `LANDING_BY_ROLE`, `ProtectedRoute`'s fallback and `Auth.tsx` all moved from the legacy
`/team/operations-hub`, which still exists). The day in order: Start the day (FRM-903), Production
(lots in progress from FRM-520 + today's CCP records), Receiving (FRM-301, open FRM-702 holds),
Finished product (awaiting release / collection; admin gets the FRM-701 button), Shipping (FRM-801),
and an admin-only Attention card over the notification feed. EN/ES from `lib/todayMessages.ts`,
starting from `profiles.preferred_language` and remembered in `localStorage` (`today.lang`).

- **Everything on it is DERIVED from the records by `lib/today.ts`** (pure, tested by
  `scripts/test-today.mjs`), through `TODAY_FORMS`, one map of form numbers to field ids with a
  `checkTodayMapping` shown on the page like the trace and release helpers. Nothing is stored for a
  stage; a lot is "awaiting release" because its FRM-520 is submitted and no submitted FRM-701
  releases it. A lot is product + code (`normLot` + `sameProduct` from `releaseAssist.ts`), so two
  products baked the same day are two lots. A hold is read from FRM-702's supplier-lot field OR its
  description, because FRM-702 has no field for one of our lots.
- **The gate (owner, 2026-10-08, no override):** `productionOpen()` is true only on a **submitted**
  FRM-903 whose `inspection_date` is today. Until then the Production card shows a red block with the
  button that resolves it, and Start a lot / Continue / the CCP buttons are disabled. Receiving,
  release and shipping are not gated. The gate lives on this page only; the SOPs Library still opens
  any form (it is the admin's surface).
- **Start a lot creates a NEW FRM-520** through `createResponse(doc)` - deliberately not the
  `/start` route, whose `resumeAnyDraft` would reopen the newest draft, i.e. another lot. The CCP
  buttons use `findDraftForDay(docId, "production_date", today)` (`formResponses.ts`): today's draft
  if there is one, else a new entry dated today - the voice panel's "today's record" rule, now shared.
- Entries opened from here carry `?from=today`; `FormEntry` turns that into "Back to Today" (same
  mechanism as `from=notifications`). `loadTodayRecords()` is the loader, same shape as
  `loadReleaseRecords` (mapped keys only, paged, `_test_batch` rows skipped) plus `created_by` /
  `submitted_by` for the "submitted at 07:42 by Diana" line.
- Not built in Phase 1 (see the document's phases): the lot page with its stage rail, prefilled
  per-lot records, the exception panel, per-product stage profiles, and `production_lots`.

## Visitor Sign-In — `pages/team/compliance/VisitorSignIn.tsx` + `lib/visitors.ts`

One short screen the visitor completes **alone**; nobody from the site takes part. It replaces
filling FRM-905 and FRM-906 as two generic entries at every arrival. Two routes, one component:

- **`/team/visitor-kiosk`** (`kiosk` prop, outside `TeamLayout`) — the entrance tablet, signed in
  once as a **`kiosk`-role account** and left that way.
- **`/team/compliance/visitors`** (Compliance nav, admin/staff/owner) — the same screen in the portal.

**The `kiosk` role has no table access at all.** It is outside `is_staff_or_admin()` and
`is_compliance_viewer()`, so every RLS policy refuses it; a tablet at the door is one a stranger can
pick up. Everything the screen does goes through four `SECURITY DEFINER` functions gated on
`is_visitor_desk()` (kiosk OR staff/admin/owner), and staff use the same ones, so there is one path:
`visitor_desk_context()` (the two schemas, the team's names, who is on site), `visitor_lookup(query)`,
`visitor_sign_in(visit, ack, rev905, rev906)`, `sign_out_visitor(id, time)`. Wrappers:
`loadVisitorDesk` / `lookupVisitors` / `visitorSignIn` / `signOutVisitor` in `formResponses.ts`.
**Do not give the kiosk a table policy** — add to the functions instead. `user_roles.role` is TEXT
with a CHECK, so the role was a constraint change. Adding a role touches a list in each of:
`AppRole` + `ROLE_PRIORITY`, `TeamAuth` (`TEAM_PORTAL_ROLES` + landing), `ProtectedRoute` fallback,
`HrDirectory` (`TEAM_ROLES`, labels, invite options), `TeamMemberDetail` `ROLE_OPTIONS`,
`create_team_invitation`'s whitelist. A kiosk account is created by inviting it with the role
**Visitor kiosk** and opening the copied invitation link on the tablet.

- **FRM-906 (GMP acknowledgement) is signed on the FIRST visit** and stays valid **twelve months,
  and only at FRM-906's current revision** (`ackState`; `visitor_sign_in` re-checks both).
  **FRM-905 is written at every visit** and records the acknowledgement it relied on
  (`ack_response_id`, `ack_date` — set by the server, never taken from the tablet). The health
  declaration (illness, cuts) lives on FRM-905 because it is a fact about today. FSQM-012 Part 6
  (v3) says the same.
- **Returning visitors look themselves up** by phone, its last four digits, or name. The server
  narrows and **refuses fewer than four digits or two letters**, so the visitor list cannot be paged
  through; `findVisitorMatches` then matches exactly (either number ends with the other, so `4471`
  finds a full number and vice versa; every typed word must begin a word of name or company).
  `visitor_fold` in SQL mirrors `normalizeName` — change one, change both.
- **Steps:** "Have you signed in on this screen before?" — worded about the screen, not about visiting, because someone who had been to the site before the kiosk existed answered yes to "visited before" (two buttons, asked BEFORE the search box is shown — with the box leading the screen, first-time visitors typed their phone number into it) → lookup → details (name, company, optional phone, **who are you here to see** as buttons
  of the team's names plus **"I don't know"** for a walk-in, stored as `HOST_UNKNOWN` rather than a name picked at random, purpose) → health → rules (only without a valid acknowledgement, never for a
  refused visitor) → sign. The wording comes from the two forms' own schemas.
- **The Full name field capitalises as it is typed** (`capitalizeName`: the first letter and the
  letter after each space or hyphen; nothing is ever lowered, so "McDonald" survives). It is skipped
  while an on-screen keyboard is composing a word and applied on `compositionend` and blur instead,
  because rewriting a value mid-composition makes some Android keyboards double letters.
- **The kiosk sizes itself to the tablet.** Everything on the page is in rem, so on the kiosk route
  the root font size is set to `clamp(16px, 1.7vw, 24px)` (about 22px on the 1280x800 entrance tablet;
  restored on unmount), the column widens to `max-w-[54rem]`, the welcome header shrinks to one line
  during a sign-in, and the Back/Next bar is `sticky bottom-0` because the larger type makes some
  steps taller than the screen. The portal version keeps its `max-w-2xl` column and normal root size.
  The preview cannot sign in; to check the layout, render `<VisitorSignIn kiosk />` on a temporary
  route with `supabase.rpc` stubbed from the two schemas in `sop-drafts/`, and do not commit it.
- **The kiosk keeps the screen on** (`useScreenAwake`, kiosk route only): a screen wake lock, asked for
  again whenever the page comes back into view (the browser drops it when the page is hidden) and on a
  touch in case a request was refused. A line under the tablet sign-out link appears ONLY when it is not held (owner, 2026-10-08),
  because it cannot be checked from the preview; a browser without the feature is told to use the
  tablet's own Stay awake setting. It does not stop the power button or a screen saver.
- **The kiosk home screen shows the time and date** (`KioskClock`) beside the welcome heading, in the
  device's own format. It is in the header and not at the foot of the screen because the on-site
  list grows downwards: at the bottom it was below the fold with two visitors signed in. The date uses
  short names ("Mon, Oct 5, 2026") because a long one pushes the welcome onto two lines. Records keep
  their own 24-hour `HH:mm` (`localTime`); the clock is display only.
- **There is no host confirmation and no host signature** (v4; owner decision 2026-10-01 after
  trying v3 at the door). What the host used to attest — jewellery removed (11.3.4.2), protective
  clothing, staff entrance and handwashing (11.3.4.4) — is in the statement the **visitor** signs.
  `isVisitorKioskSchema` (the drawn visitor signature is the form's only signature) decides whether
  the page is switched on and whether New Entry on FRM-905/906 hands over to it.
- **Nothing is written until the visitor signs**; then `visitor_sign_in` writes both entries in one
  transaction, already submitted, pinning number and revision from the live documents, rejecting
  answer keys the form does not have, and stamping `witnessed_by` with the account holding the
  device. `sign_out_visitor` later writes only `data.time_out`, once.
- **A declared symptom is a refusal** (11.3.4.3): the visit is still recorded, with route
  `Entry refused`, a note, and time out = time in. An uncovered cut is not a refusal — the page holds
  the visitor at that question until it is dressed.
- **Signing the TABLET out** (not a visitor): the kiosk home screen has a small "Staff: sign this tablet
  out" link (`KioskExit`). It asks for the account's password first — verified by signing in again
  as the same account — because a one-tap sign-out would let any visitor leave the tablet on the
  login page. The kiosk has no portal and no account menu, so this is the only way out.
- **Sign-out** is from the on-site list on the home screen (owner's choice: the list is shown on the
  kiosk). The button arms on the first tap and signs out on the second, since it cannot be undone. An armed button shows a small cancel (X) beside it and stands down by itself after ten seconds, so a wrong tap is never left waiting for the next person.
- **Drawn signatures (`SignatureField.capture: "drawn"`)** are a generic form feature built for this:
  typed name + `SignaturePad` (pointer events on a canvas — finger, stylus or mouse, no tablet
  detection). Value is `{ user_id: null, name, signed_at, image (PNG data URL), witnessed_by }`; the
  logged-in account is the **witness, never the signer**. `scalarZod` names `image`/`witnessed_by`
  because a plain `z.object` strips unknown keys at submit, and requires the image on a required
  drawn field. `formatFieldValue` stays name + date, so lists and CSV never carry the image; the
  entry PDF prints it. `entryHasFail` (audit evidence) skips `data:` strings.
- Migrations `20261001000002` (forms v3), `…03` (sign-out RPC), `…04` (FSQM-012 v3), `…05` (kiosk
  role + functions), `…06` (forms v4, host signatures removed). `scripts/test-visitors.mjs`
  validates what the page builds against the real schemas in `sop-drafts/`.

## Lot Trace & Recall Workspace — `lib/lotTrace.ts` + `components/team/trace/`

A recall (FSQM-023) or the annual mock recall touches eight forms. Every one already carries the lot
codes; nothing joined them. The trace pulls the records so nobody hunts for them under stress.

- **Two surfaces, one engine.** `/team/compliance/traceability` (`LotTrace.tsx`, replaced the Phase-0
  placeholder) answers the everyday question — a supplier notice arrives, who got that lot? — and can
  start an FRM-012 pre-filled from the result (`createResponse(doc, prefill)`). Every FRM-012 entry
  carries `RecallWorkspace` above the form when `settings.recallWorkspace` is set (keyed on the entry's
  resolved schema, because it is tied to field ids).
- **`runTrace(records, start)`** starts from a supplier lot (matches FRM-520 `ingredients.supplier_lot`
  and `film_lot`) or from one of our lot codes. One card per finished lot — **a lot is product + code**,
  since two products baked the same day share a code. Per lot: inputs with their FRM-301 receipts,
  FRM-801 dispatches, FRM-703 retention, FRM-701 release; plus FRM-702 holds and the FRM-011 contacts.
- **It must never come back quietly empty.** Lots compare normalised (`normLot`: case, spaces, dashes
  ignored). A record with the same code under a product name that does not match is listed under
  "check these", never dropped. **Drafts are included and flagged** (owner's decision: a missed lot is
  worse than an unfinished record). `checkTraceMapping` compares `TRACE_FORMS` — the single map of form
  numbers to field ids — with the live schemas, and the panel shows "FRM-801 no longer has…" instead of
  a trace. Renaming a field on any of the eight forms means updating `TRACE_FORMS`.
- **`gaps[]` is computed, not written by a model**: missing receipts (one line per lot, not per
  ingredient), no dispatch, no retention sample, drafts, a customer with no contact, quantities that
  cannot be added. Quantities are free text (`"3 cases"`), so `sumQty` adds only same-unit values.
- **`toRecordFill`** writes the trace into FRM-012's grids with a readable `source` column and a hidden
  `_src` (`"docId/responseId"`) per row. "Still on site", "disposed" and "unaccounted" are **left blank
  on purpose** — they are physical counts no record holds (the weights rule again). Applied like "Copy
  from a previous entry": unsaved, dirty, one Undo.
- **Steps are derived, never stored** (`deriveRecallSteps`): Hold, Trace, Decide, Notify, Recover,
  Reconcile, CAPA, Close, each ticked from the record's own fields, so a tick cannot disagree with the
  record. Decide and Recover do not apply to a mock recall.
- **Clocks** (`clockState`): 4-hour trace target from `started`, stopped by `completed`; the 24-hour
  written notice (SQFI, certification body, FDA) from `decided_at` else `started`, real events only.
  `started` is a datetime-local string and is parsed as LOCAL time.
- **Mock recalls show a "do not notify" banner** and no email links. Elsewhere a contact with an address
  gets an envelope (`mailtoHref`): a plain `mailto:`, which opens whatever mail app the DEVICE has set as
  default - nothing is stored per user. Inside a recall record the link carries `recallEmailDraft` (the
  record's **Reason** as the body, read at click time), which the person can change before sending.
  Deliberately not built (owner, 2026-10-01): a one-tap notification log, pre-written notices,
  launch-prefilled Hold/CAPA.
- **Download PDF** (`lib/tracePdf.ts`, `buildTraceDoc` + `generateTracePdf`): the trace as run, every
  record a live link, gaps and contacts included. A snapshot, and says so.
- **Steps vs sections are two numberings** (step 7 is written in section 4), so each step's link reads
  "Go to section N", N taken from the section title.
- **Performance:** `FormEntry` re-renders on every keystroke, so `RecallWorkspace` is `memo` with stable
  props and each changing value is read in a leaf with a narrow `useWatch`. The records load once
  (`useTraceData`); the loader selects only mapped JSON paths (entry data can hold signature images) and
  pages each form.
- Tested by `scripts/test-lot-trace.mjs`. `lotTrace.ts` has no imports so the script can bundle it.
- **Practising it: `MOCK_RECALL_PRACTICE.md`** - a walk-through for technical and non-technical staff using
  made-up records (`scripts/recall-test-data/insert.sql` / `delete.sql`, run by hand in the SQL editor,
  **not migrations**; every row tagged `data._test_batch = 'RECALL-TEST'`). The guide lists the exact
  expected trace, so it doubles as an on-screen acceptance test after a change. It is practice only - the
  annual mock recall (SQF 2.6.3.2) must be on real lots.

## Lot record from the formula (FRM-520 <- FRM-501) — `lib/batchSheetFill.ts`

The formula is the master; the Production Lot Record (FRM-520) is what went in on one bake day.
Until 2026-10-06 nothing joined them, and the formula lived in whichever earlier lot record was
copied. With `settings.batchSheet` set, `FormEntry` shows a **"Start from the formula sheet"** card:
`BatchSheetPickDialog` lists the formulas and `batchSheetFill` fills the entry.

- **The formula has two possible homes; `settings.batchSheet.source` says which.**
  `"FRM-501"` = the entries of **FRM-501 Formula Sheet & Batch Data** - the owner's choice "for right
  now" (2026-10-06), and what FRM-520 is set to. Absent = the sales-side `batch_sheets` table, built
  first the same day and kept because the owner wants to look at the sales side later. Both are
  turned into one `FormulaSource` (`formulaEntrySource` / `batchSheetSource`), so the fill does not
  know which it came from. **The owner had assumed batch sheets used FRM-501; they never did** -
  `batch_sheets` comes from the PSS flow and has no form number.
- **Only the standard comes across**: product, one line per ingredient, brand, expected quantity
  per batch and unit. **The lot on the container and the weighed quantities are never filled** - the
  weights rule again (`suggestFrom` still offers the expected figure in grey). The formula's own
  notes and allergens are not copied into the lot record.
- **FRM-501 quantity = Production Qty as written** (`"17.49 lb"`, read by `parseQty`), else the
  line's % of Formula x "Scaled / Production Batch Size". `parseQty` returns null for a range, two
  quantities or a unit it does not know - **a quantity is never guessed out of text**; the line then
  comes across without one and the banner says which. `FORMULA_FORM` is the single map of FRM-501
  field ids; `checkFormulaMapping` reports a renamed field in the dialog instead of an empty list.
- **Batch sheet quantity = stored percentage x `data_json.product.batch_size`** (the "Standard batch
  size" card in `BatchSheetEditor`), the same percentages `runMaterialCalc` reads, never the gram
  column.
- **Drafts are listed and labelled**; an entry with no product name (one somebody opened and left)
  is not listed, and practice rows (`_test_batch`) are skipped. Every FRM-501 entry of a product is
  listed, not just the newest - the version is in the label.
- **The grid is replaced, not merged**, and the result is unsaved and dirty (`keepDefaultValues`)
  with one Undo, like "Copy from a previous entry" - which stays as the fallback for a product with
  no formula sheet.
- `sourceField` (FRM-520's `formula_source`, "Formula") records what the entry started from
  ("FRM-501 v1 (draft)"), so a formula change shows in the lot history. It is text, not a foreign
  key: the entry must stay readable after the formula is revised.
- The same product name must be used on FRM-501, FRM-520 and the release record: the lot trace and
  the release helper match by product name ("Rum Cake - Original").
- **FRM-501 carries the product's bar code number** (`barcode_number`, Section 1, optional; owner's
  request 2026-10-10, migration `20261010000004`). The revision was deliberately left at "New": every
  formula sheet is an open draft pinned to that revision, and a new revision would show them the old
  layout without the field.
- **First-pack check from a photo (FRM-520, 2026-10-10, `src/lib/firstPackCheck.ts` +
  `components/team/forms/FirstPackCheck.tsx`).** Under "Code on the pack" on an editable entry
  (`firstPackReady(schema)`), **Photograph the first pack** keeps the photo on the record, reads it with
  `extract-package-label` in `finished_goods` mode (the function is unchanged), and shows one line per
  point (`checkFirstPack`): flavor against the record's Product (a flavor word on the pack the record
  lacks is a mismatch; one only the record has "needs a look"), lot code (`normLot`), best-by **month**
  = bake date + 12 months (`expectedBestBy`, owner's rule: made 10 Oct 2026 says October 2027;
  `parseBestBy` reads only a plain date), and the bar code against the formula sheet's number
  (`loadProductBarcode` in `formReport.ts`; skipped when the sheet has none). The bar code is decoded
  from the picture (`barcodeDecode.ts`): the browser's `BarcodeDetector` where there is one (Android
  Chrome), else the ZXing library (`@zxing/library`, loaded only then) - Chrome on Windows has no
  detector, and the owner's first try on a laptop came back "not scanned" (2026-10-10). A decode is a
  real scan; printed digits alone that agree are "needs a look", not a match. **Evidence,
  never the answer**: unread is never a match; when every point agrees a button offers the answer as one
  tap; a mismatch says to stop packing, and warns if the answer says Matches. The result is written into
  the photo's attachment note (`packNote`, prefix "First pack photo"), which is how it survives a reload
  and how later photos (new film roll, change of product) are listed. Nothing blocks Submit.
  **"First pack checked by"** is filled with the signed-in person's name at the moment the answer is
  given in this page visit (never on opening, never over a name), and offers team names (`teamPick`,
  migration `20261010000005`, no revision change). `FIRST_PACK` is the single map of field ids. Tested
  by `scripts/test-first-pack.mjs`; the on-screen flow was checked on a harness with a stubbed reader.
  **The best-by date must be in English** (`bestByNotEnglish`, owner 2026-10-10: a lot was once packed
  with "Augusto 2027" and it was found only after packing): any word of the date that is not an English
  month is a mismatch, worded with what it should say. The `finished_goods` prompt tells the reader never
  to translate or correct the date or the product name - without that a model may quietly return
  "August" (the owner deploys the function: `npx supabase functions deploy extract-package-label`).
  **Untested from here: the camera, the real read of an ink-jet coded box, and BarcodeDetector.**
- **The three packing counts are added up (FRM-520, 2026-10-10, `src/lib/packCounts.ts` +
  `PackCountLine.tsx`).** A line under the counts' row says "Adds up", "3 unaccounted for" or "4 more
  than were racked" (rack count = units packed + not packed, FSQM-021). **All three stay counted and
  typed by a person - none is derived or suggested**, or there would be nothing to reconcile. A
  difference with no Notes blocks Submit (`needsNote`); with a reason in Notes it is amber and allowed.
  `units_packed` is still TEXT on purpose (the lot trace adds its units): `readCount` reads "480" or
  "480 units" and says so when it cannot ("40 cases"), never guessing. It rides on the first-pack slot
  through `afterSection.more` (further full-width lines inside the same section), so it shows on an
  editable entry only. Tested by `scripts/test-pack-counts.mjs`.
- Not built: picking the formula from the Product field itself, scaling for a part batch, and
  creating a batch sheet from an FRM-501 entry.
- The batch sheet list page (`/team/operations/batch-sheets`) had a route but no sidebar link until
  2026-10-06; a sheet with no client folder could not be reached.
- Tested by `scripts/test-batch-sheet-fill.mjs`, which reads the rum cake FRM-501 entry out of its
  migration. `batchSheetFill.ts` has no imports.

## Release helper (FRM-701) — `lib/releaseAssist.ts` + `components/team/release/`

A release record repeats what the site's records already hold. With `settings.releaseAssist` set,
the entry starts from the **lot code** (what is printed on the pack) and looks the rest up.

- **Lot, then Product, are pick-lists** (`SuggestInput`, fed through `FormRenderer`'s `suggest` prop
  from `useReleaseAssist`): focusing lists everything, typing narrows, anything can still be typed.
  The Lot list is `unreleasedLots` - every FRM-520 lot with no release record yet, one line per
  product + code, and a line also sets the Product (`SuggestOption.set`). A typed code sets the
  product only when exactly one product carries it; with several, the Product list narrows to them
  (`productOptionsForLot`) and a warning asks. **A typed product is never replaced.**
- **`releaseFill(records, product, lot, selfId)`**: batch reference and date from the lot's FRM-520;
  customer, label reference and version, net weight on the label, empty packaging weight and unit
  from the product's last release, else its FRM-704 specification. So the figures are right per
  product with no fixed defaults on the form (a fixed-default version was written and dropped).
- **Evidence, never a Result.** For six of the nine checks the Note is filled with what the records
  show - FRM-520 submitted or draft, FRM-507 / FRM-606 rows for the lot, FRM-903 for the bake and
  pack dates, FRM-702 holds on the lot or any supplier / film lot in it, FRM-601 approval, units
  packed. Gaps are stated ("FRM-903: none found for 2026-10-01"), never left blank. **It never answers
  a check and never fills a pack weight**: FSQM-020 has the SQF Practitioner confirm each check, and
  the owner chose evidence-plus-tap over auto-Pass (2026-10-06). The same reasoning as `aiDraft`.
- **`applyReleaseFill` writes a cell only if it is empty or still holds what the helper last wrote**,
  so changing the lot updates looked-up cells, clears ones with nothing behind them, and leaves
  typing alone. On a reopened entry `autoFromFill` recognises the helper's earlier cells by value.
  The result is unsaved and dirty (`keepDefaultValues`) with one Undo, like "Copy from a previous entry".
- A lot is **product + code** throughout (two products baked the same day share a code), including
  the CCP rows counted. Drafts are read and flagged. `RELEASE_SOURCES` is the single map of form
  numbers to field ids; `checkReleaseMapping` reports a renamed field on the page instead of a
  quietly missing lookup. Loader `loadReleaseRecords` (mapped keys only, paged, skips
  `_test_batch` practice rows). Tested by `scripts/test-release-assist.mjs`.

## Team Coach chat — `components/team/coach/`

The Manufacturing Coach orb in `TeamLayout` opens `TeamCoachPanel` for staff/admin/owner. It has two tabs: **Ask the Coach** (`TeamCoachChat` → edge fn `team-coach`) and **Record CCP** (the unchanged `VoiceCommandPanel`). The last tab used is remembered in `localStorage`. Before this change the orb had **never** been a working chat: `CoachChat` only ever showed placeholder cards, and the brand-oriented `manufacturing-coach` function (OpenAI, concept context) has no caller. The brand portal still gets the placeholder cards.

- **It answers from our documents, not from the model.** The prompt forbids quoting any limit, concentration, temperature or frequency that is not in a supplied document. General knowledge must be labelled "General guidance, not from our SOPs:". "What do I do / fill out" questions are answered as *Procedures to follow* + *Records to fill out*. Replies carry gold source chips that deep-link to `/team/compliance/sops?doc=<id>`.
- **Retrieval is two-pass on purpose.** The owner's real case — "the Hobart mixer's bowl lift broke, what do I fill out?" — never says "maintenance", so keyword matching alone misses FSQM-029/FRM-509. See the `team-coach` row in the Edge Functions table.
- **Session-only history, in a module store (`coachConversation.ts`), not React state.** Two separate things would wipe React state: the Coach's Sheet unmounts its content on close, and **every route in `App.tsx` wraps its own `<TeamLayout>`**, so layout state is rebuilt on each page change (the first cut kept the conversation there and lost it on navigation). The store survives both, resets on reload, and is cleared on sign-out for shared tablets. Nothing is written to `chat_history`, whose `project_id` is brand-only.
- An EN training module and its ES variant share one number, so `team-coach` keeps one source chip per number, in the reply's language.
- When `CoachChat` gets `renderPanel`, the panel fills the sheet and scrolls itself instead of sitting in a `ScrollArea`, so the chat can pin its input to the bottom.

## Voice Commands (CCP records) — `lib/voiceCommands.ts`

The Team Portal's **Manufacturing Coach** orb (`CoachChat`, mounted in `TeamLayout`) opens
`VoiceCommandPanel` for staff/admin/owner: the operator taps the mic and reads a line off a printed
card — *"Create a CCP Baking Record for Product X, Lot Y, Temperature 350 for 27 minutes. Passed."* —
and FRM-507 (or FRM-606 for *"Create a CCP Sealing Record…"*) opens with the row filled in. It exists
because operators push back on the number of forms, and an unrecorded CCP check is to an auditor a
check that did not happen.

- **One registry drives the parser and the wall card.** `VOICE_COMMANDS` holds each command's
  `script` (the card text and the parser's anchors), `extract` and `build`. The card is
  `/team/compliance/voice-commands/print` (`VoiceCommandScripts.tsx`, rendered outside TeamLayout so
  it prints clean). `scripts/test-voice-commands.mjs` feeds every card example back through the
  parser — **add a command by adding a registry entry and a test, never by editing the card alone.**
- **Deterministic, not AI.** The wording is fixed by the card; the parser handles what Chrome does to
  it (`3:50` for "three fifty", `past` for "passed", lot codes spelled letter by letter, "for" heard as
  "4"). `parseAlternatives` tries every recognition alternative.
- **Never auto-saves.** The panel previews, then (on tap) finds or creates the entry and navigates with
  `state.voiceCommand` (`voiceCommandTarget.ts`); `FormEntry` applies it once per nonce with
  `form.reset(values, { keepDefaultValues: true })` so the row is **unsaved and dirty**, shows a banner
  with Undo, and the operator taps Save Draft. Nothing is written before the tap because FRM-507/606
  entries are not deletable.
- **"Today's record" is looked up, never resumed.** `createResponse`'s `resumeAnyDraft` has no date
  filter and CCP drafts wait up to a week for review, so `findTodaysDrafts` matches
  `created_by`, `status='draft'` and `data->>production_date`. A draft for a different product is an
  explicit choice in the panel.
- **The app judges CCP 1 pass/fail** from `CCP1_LIMITS` (350°F, 27 min): a spoken Pass can be
  downgraded to Fail, a spoken Fail is never upgraded. `limitsStillMatch` blanks the verdict if
  FRM-507's printed limits ever change. CCP 2's vacuum reading is recorded, not judged (limit
  unconfirmed). The internal-temperature column is never filled by voice (not probed on site).
- `applyVoiceFill` fills the new entry's seeded blank row rather than appending beside it, and
  overwrites that row's creation-time `time_out` with the time the line was spoken.
- The orb sits above FormEntry's sticky Save bar via `useBottomBarClearance` (`--tp-bottom-bar-h`) and
  `CoachChat`'s `avoidBottomBar`; brand-portal layouts pass no props and are unchanged.
- **Spanish (optional, per operator).** The panel has an **English | Español** switch that starts at
  `profiles.preferred_language` (read in `TeamLayout`). It sets the recogniser (`RECOGNIZER_LANG`, es-US)
  and the language of the panel, preview, warnings and FormEntry banner (`state.voiceCommand.uiLang`).
  **The record never changes language** — "pass"/"fail", FRM-606's English check options, numbers as
  strings — and a test asserts the Spanish and English card examples produce the identical row.
  - Word lists live in **`lib/voiceLexicon.ts`, one lexicon per language, never merged**: `es`/`el`/`en`
    are letters in an English lot code and words in Spanish, `once` is 11, `de` is both D and "of", and
    English "for" is heard as "4". A line is parsed wholly in one language; `parseAnyLanguage` retries the
    other language only on `no_command` (someone reading the other card).
  - Every sentence a person sees is in **`lib/voiceMessages.ts`** (`VOICE_MSG[lang]`); English entries are
    the exact shipped strings. Each command's card text, triggers, anchors and check phrases are under
    `text.en` / `text.es` (`checkPhrases` is typed `Record<CheckOption, …>` so a new FRM-606 option cannot
    be left without Spanish). Top-level `title`/`script`/`tips` mirror `text.en`.
  - Pitfalls that were real: JavaScript `\b` is ASCII-only, so Spanish rewrites use Unicode lookarounds
    (`/\bpasó\b/` never matches); "sellado al vacío" must collapse to "sellado" or "vacío" hijacks the
    vacuum anchor and swallows product and lot; **negation flips a pass word to fail** in both languages
    ("no pasó", "pull test not passed") — a dropped "no" is why the Spanish card prints *Rechazado*, not
    *No aprobado*. Accents are folded for matching (ñ kept) but product names keep what was said.
  - The print page takes `?lang=en|es|both` (default both), one language per card. The Spanish card wording
    is a draft for a Spanish-speaking team member to check before it goes on the wall.
- **FRM-507 from v2 (2026-10-09): the product is on each oven load, one record per day.** Two flavors baked
  on one day share the day's lot code and used to need two records. `product` left the top of the form and
  is a required column of `oven_loads`, offering FRM-501's product names (`pickFrom` with `drafts: true`,
  since formula sheets are kept as drafts). `applyVoiceFill` writes the spoken product on the row when the
  table has that column, `createVoiceEntry` prefills a top field only where the form has it, and
  `releaseAssist.ccpLine` reads the product from the row, else from the entry (records filled at revision
  New). The owner wants the baking voice command started from a button per lot + product on the Today
  page - NOT yet built (2026-10-09).
- **Record bake, on a lot's row of the Today page (2026-10-09, `components/team/today/BakeLoadButton.tsx`).**
  Each lot + product in progress has a **Record bake** button before Continue, for one oven load on the
  day's FRM-507. The row supplies the product and the lot; a menu offers two ways in. **Speak the reading**:
  "Temperature 350, bake time 27", optionally "probe 180" (`parseBakeReading` / `parseBakeAlternatives`,
  `BAKE_READING_TEXT` holds the words per language and the wall card's lines; a typed box under it, which is filled with what was heard when a line is not understood so it can be corrected, is the
  fallback). Within the limits, the row is shown and **Accept saves it without leaving the page** - the one
  path that saves with the form closed, an explicit tap on a row the operator has read. A limit missed, or
  a spoken "failed", saves nothing and opens the record with the row unsaved and Section 3 flagged.
  **Open the record** hands over a row with only the time, product, lot and initials (`startedBakeFill`,
  `VoiceFill.started`, its own banner wording). Both hand-overs reuse `state.voiceCommand`.
  Nothing is created by listening: the day's record (`findDraftForDay`, the signed-in person's draft dated
  today) is looked up or created only on Accept, a failed reading, or Open the record. Accept opens the
  record instead of saving when the draft is on an earlier revision or applying the row raises a warning
  (`NEEDS_RECORD`). **The probe is optional**: said, it is recorded and judged against 180°F
  (`CCP1_LIMITS.internalMinF`, `probeLimitStillMatches`); the day-level "Internal temperature on this day"
  answer is left to the person signing. `PROBE_RANGE` starts at 100 so "one eighty" is not read as 81.
  The dialog is opened a tick after the menu item is chosen, or the two fight over focus. Checked on a
  temporary harness route with the database stubbed; the microphone itself is untested from here.
- **Baking done: the last load of the batch, and of the lot (FRM-507 v3, 2026-10-10, migration `20261010000001`).**
  The owner's words: a **batch** is one row of the Today page (a product within the day's lot code), the
  **lot** is the day's lot code, which is also what one FRM-507 covers. Oven loads gained a **Last load**
  pick-list (`LAST_LOAD_VALUES`: "Last load of this batch" / "Last load of this lot"), filled only on a
  final load. **"Done" is read back from those marks and stored nowhere else**: `bakeState` (`today.ts`)
  gives each row `open | batch | lot` from every FRM-507 dated today, and `bakingAwaitingReview` the
  "finished and signed, waiting for review" line. A finished row's Record bake button is a small green
  flame (label on hover); its menu still opens. Four ways to mark, all in `BakeLoadButton`: said with the
  reading ("... last load of this batch" - `parseBakeReading` cuts the phrase out BEFORE reading numbers),
  said on its own (`markOnly`: marks the load recorded last, `markLastLoad`, never creates a record),
  chosen in the **Enter the reading** pop-up (three numbers typed, saved from the pop-up with no second
  summary), or **Baking done...** in the menu. **Last load of this lot** also signs the operator's
  "Monitored by" line and sends the record to a named reviewer with the existing `requestSignature`
  (pick-list of admins and owners; the last choice is the person's `bake.reviewer` setting). If the
  request fails the load is still saved and the toast says to use Request signature. **Baking not
  finished** (`clearLastLoad`) takes this batch's marks off, turns another product's "of this lot" into
  "of this batch", and withdraws the review request; the signature is left for the operator to clear.
  Section 3's "Deviations on this day" is never answered by the app. On a revision without the column
  (`hasLastLoadColumn`) none of the marks are offered. Seal checks have no equivalent yet.
- **Checks done: the last check of the batch, and of the lot (FRM-606 v3, 2026-10-10, migration `20261010000002`).**
  The seal-check button's twin of the baking marks above, with the same menu (Speak the check / **Enter the
  check** pop-up / **Checks done...** / **Checks not finished** / Open the record) and the same green
  compact button. Seal checks gained a **Last check** pick-list (`SEAL_LAST_VALUES`); `sealState` and
  `sealingAwaitingReview` (`today.ts`) derive everything from it. **What differs from baking is the record:**
  FRM-606 is one record per BATCH, so "last check of this lot" signs and sends for review EVERY record
  of that lot code the operator has open today (one `requestSignature` each), and Checks not finished
  works across those records (`clearLastCheck(values, mine)`: the batch's own marks come off; another
  batch's "of this lot" becomes "of this batch"). The phrase is cut out of the sentence before the
  hands-free parser sees it (`splitLastPhrase`, `parseSealLine`), so it can follow any check - the wording
  is "last CHECK", not "last seal", because the final check of a batch is usually the boxing check or the
  pull test, done after sealing. `markLastCheck` marks the last row that holds a check. The Enter the
  check pop-up takes the check type, air check and pull test (pass / fail / not done) and the gauge; a
  fail opens the record as always. The reviewer choice is shared with baking (`bake.reviewer`).
- **Section 3 of the CCP records is derived (2026-10-10, `src/lib/ccpDeviations.ts`, Gabriela approved).** On
  FRM-507 and FRM-606, "Deviations on this day" and the deviations table are worked out from the record's
  own oven loads / seal checks (`CCP_DEVIATION_FORMS`, `deriveDeviations`): **None** once every judged row
  passed, **Yes** plus one line per failed row saying what was out of limit. **What was done about it is
  never derived** - Action and the FRM-702 / FRM-007 reference stay blank and required, so a record with a
  failed load cannot be submitted until a person says. A line the app wrote carries hidden `_src` (which
  row) and `_auto` (what it wrote): while its wording is untouched it follows its source, and it goes if
  the load turns out to have passed; once reworded or acted on it is the person's and is left alone, as
  are lines typed by hand and a Yes a person chose. Pure and idempotent. It runs in three places: the
  entry page (an effect on the checks grid - `setValue` on the answer and the table, so the row being
  typed in the checks grid keeps its focus; the first look at a record does not mark it unsaved), the
  Today buttons' Accept / Save, and the hands-free auto-save. `deviationProblems` blocks Submit when the
  section and the checks disagree. `deviationFormFor` returns null on a revision whose fields or options
  do not match, and nothing is derived. `SelectField.restingValue` (migration `20261010000003`, no
  revision change) names the "None" option so a derived None does not open the collapsed section
  (`sectionHasAnswers`). Tested by `scripts/test-ccp-deviations.mjs` against the real schemas.
- **Suggested bake figures in the Enter the reading pop-up (2026-10-10, `src/lib/bakeTargets.ts`).** The oven
  temperature and bake time boxes show, in grey, what the product's formula sheet states - FRM-501's
  Process Parameters table, rows "Process / Bake temperature" and "Process / Bake time", column
  Target / Spec - with a **Use 350** link under the box. **Never a default**: the box stays empty until the
  link is tapped or a figure is typed (the weights rule). `readTarget` reads only a plain figure ("350",
  "350°F", "27 min"), never a range or a figure buried in text; `bakeTargets` finds the rows BY LABEL and
  takes each figure from the newest sheet of the product that states it (drafts count). Loader
  `loadBakeTargets` in `formReport.ts`, which never throws. The probe box has no suggestion: the formula
  sheet has no internal-temperature row, and 180°F is the HACCP limit, not a target to copy in. Renaming
  those FRM-501 rows or columns means updating `BAKE_TARGET_SOURCE` and the label match. Tested by
  `scripts/test-bake-targets.mjs`.
- **Record seal check, on a lot's row of the Today page (2026-10-09, `components/team/today/SealCheckButton.tsx`).**
  The sibling of Record bake, with the same rules (menu Speak the check / Open the record; a passed check
  is shown and **Accept** saves it; a failed check saves nothing and opens the record with the row unsaved
  and Section 3 flagged; nothing is created by listening). The tap stands for the trigger, as a headset
  button does on the open form, so the sentence is a hands-free line without "Form 606": `parseSealButton`
  = `parseHandsFree` after `HANDS_FREE_IMPLIED`; `sealButtonFill` builds the row and its summary. **The
  record is the lot's own**: the signed-in person's FRM-606 draft dated today whose product and lot code
  match the row (`findTodaysDrafts` + `sameProduct` + `normLot`), else a new one with date, product and lot
  filled in. Open the record just opens it - there is no started row to hand over. `SEAL_BUTTON_CARD` (the
  wall card) is DERIVED from `HANDS_FREE_CARD` by dropping the trigger and the undo line, so the two cards
  cannot disagree. The dialog's common wording is `TODAY_MSG.bake`'s; the seal-specific wording is
  `TODAY_MSG.seal`. When checking either button in the preview, a screenshot taken straight after a tap can
  miss a menu that is still fading in - read the DOM before deciding a tap was ignored.
- **FRM-606 from v2 (2026-10-07): the lot is entered once, and a row carries one check.** `lot_code` is a
  field at the top; `fill.entryFields.lot` carries it and `applyVoiceFill` fills it when empty (or writes
  the row's `lot_code` on an entry filled under the earlier revision). Check types are `Set-up`,
  `In process`, `After a change or adjustment`, `End of run`, `At boxing`; the gauge reading, the visual and
  the pull test are each optional on a row, and a line needs the visual OR the pull test. **The pull test
  is done at boxing on a cooled pouch, never on a warm seal** (it can open a good one), so a line with
  only a pull test is an `At boxing` row. `releaseAssist` reads the lot from the entry or from the row.

### Hands-free rows on an open FRM-606 entry - `lib/voiceHandsFree.ts`

With the day's FRM-606 open, a **Hands-free recording** bar sits under the production header
(`HandsFreeBar`, placed through `FormRenderer`'s `afterSection` slot; shown only when
`handsFreeReady(schema)`, i.e. the entry's revision has the `In process` option).

- **Listening mode** is a switch, **off every time the entry is opened**, and unavailable until the date,
  product and lot code are filled. With it on: "Form 606, air check passed" / "... pull test passed" /
  "... boxing check passed" / "... set up, air check passed, vacuum 27" / "Form 606, undo". Spanish:
  "Formulario 606, revisión de aire aprobada". `parseHandsFree` acts **only when the trigger is in the
  same sentence**, never guesses a result it did not hear (`unclear`), and gives the same row in both
  languages. `HANDS_FREE_CARD` is the wall card, and the test parses every printed line.
- **A sentence cut in two is put back together** (found on the tablet, 2026-10-07): Android Chrome ends
  a sentence at the first short pause, so "Form 606, air check passed" arrives as "form 606" and then
  "air check passed". An `unclear` result therefore says nothing and waits `HANDS_FREE_WAIT_MS` (6 s);
  the next sentence is parsed joined onto it (`withPending`), and only if nothing usable arrives does the
  tablet say it did not hear the check. The same row from the same words within 4 seconds is recorded once.
- **The recogniser's spellings are put back to the card's before parsing** (`SPELLINGS`): on the tablet
  Chrome wrote "air check" as one word, "aircheck", so the trigger was heard and the check was not. Add a
  spelling there, with a test, when the tablet shows a new one in the "Heard:" line.
- **These rows ARE saved automatically** - the one exception to "never auto-saves" above, because the
  operator's hands are on the sealer. It is safe because the record already exists and is open (nothing
  is created) and the last row can be taken back. `FormEntry.recordHandsFree` applies the row and saves
  through a one-at-a-time queue that reads the record from a ref; on `StaleResponseError` it re-applies
  the row to the fresh copy once. The tablet says back what it recorded (`sayAloud`), with recognition
  paused so it does not hear itself.
- **Six one-tap buttons** (air check, pull test, boxing check; passed / FAILED) do the same without the
  microphone. They are the fallback, not a convenience: see the next point.
- **How it listens is chosen on the bar** (`ListenMode`, `frm606.listenMode` in `localStorage`, read when
  listening is switched on): **All the time** (default; restarts through silence, Android's tone repeats),
  **When I press a button**, or **When it hears a voice (trial)**.
- **Button mode** (owner's idea, 2026-10-07: the operator wears a Bluetooth headset). A press starts ONE
  spell of listening (`listenOnce`); between presses the state is `ready` and the microphone is closed, so
  there is no tone and no false start. **The press stands for the trigger**: the bar parses the sentence as
  if it followed `HANDS_FREE_IMPLIED` ("form 606"), so "air check passed" is enough. Three sources, one
  path: (1) the headset's button, which reaches a page only as a Media Session action and only while the
  page is "now playing" - so a 10-second silent WAV is looped (Chrome ignores media under five seconds; a
  muted element does not count) and every media action means "listen"; (2) a key from a Bluetooth pedal or
  clicker (`isListenKey`: never while typing in a field, never Enter/space on a focused button; volume keys
  never reach a page); (3) **Press to speak** on the bar. The bar counts presses received, so a headset
  whose button does not arrive shows it. **Whether a given headset's button arrives is untested.**
- **Quiet mode is a TRIAL, one of the three choices** (`frm606.quietMode` in `localStorage`). Made the only way at first, it broke listening on the tablet the same day (PR #306): with no words heard the detector treated the operator's voice as noise and raised its threshold to it. The default is restarting recognition through silence, which is known to work and plays Android's tone every few seconds. The bar shows a trace line in quiet mode (way of sharing, starts, starts that heard words) so a trial can be reported exactly.
- **`useHandsFreeSpeech`, in quiet mode, waits quietly between sentences** (2026-10-07, after the first day on the
  tablet). Android plays its own tone whenever speech recognition starts or stops and a page cannot
  silence it; restarted through silence, that was a tone every five seconds in the operator's headset.
  So between sentences recognition is OFF and the microphone LEVEL is watched (`getUserMedia` + an
  analyser, silent); `createVoiceGate` (pure, tested) decides a voice has started - its floor follows the
  room, so a running sealer raises it - and only then is recognition started. The first word can be
  clipped, which is why a sentence may open with a bare "606". **Sharing the microphone is tried three
  ways, moving on when voice-started recognitions hear no words (one for `hold`, two for `release`), and the
  detector is told "that was noise" only once the current way has heard words at least once:** `hold` (monitor keeps
  the microphone; kindest to a Bluetooth headset), `release` (monitor lets go before each start), then
  `restart` (the original behaviour, tones and all). The first `start()` still runs synchronously in the
  tap on the switch. It needs the network, sends audio to Google's speech service while recognising,
  pauses while the page is hidden, and holds a screen wake lock.
- **Remind me** (tick box, remembered in `localStorage`, never in the record): a tone (`playTone`, Web
  Audio) and a spoken prompt 30 minutes after the last row - spoken, tapped or typed (`reminderDue`).
  A prompt only: the documents state no 30-minute check, so a missed reminder is not a missed control.
- The controlled documents do not mention hands-free; it is only a way of entering rows.
- Tested by `scripts/test-voice-handsfree.mjs`. `voiceHandsFree.ts` has relative imports only.

