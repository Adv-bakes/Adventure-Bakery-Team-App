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
- `TeamLayout` — team portal; collapsible left sidebar (232px ↔ 64px) with 7 nav sections; polls `prf_submissions` for inbox badge count

**Route protection:** `ProtectedRoute` accepts a `roles` prop (e.g. `["admin","owner"]`); redirects unauthenticated users to `/team` or `/k2f-login`

**Roles:** `owner | admin | staff | user` — fetched from `user_roles` table via `useUserRole()`

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
| Home | `/team/dashboard` | |
| Relationships | `/team/sales/clients` | |
| Sales | `/team/sales/dashboard`, `/team/sales/templates` | Dashboard has inbox badge |
| Operations | `/team/ops/orders`, `/team/ops/inventory`, `/team/ops/floor`, `/team/ops/insights` | floor & insights are Phase 0 |
| Compliance | `/team/compliance/sops`, `/team/compliance/traceability`, `/team/compliance/temperature`, `/team/compliance/certifications` | traceability & certifications Phase 0 |
| HR | `/team/hr/directory`, `/team/hr/trainings`, `/team/hr/traceability` | directory is Phase 0 |
| Internal | `/team/internal/email`, `/team/internal/finance` (owner only), `/team/sourcing`, `/team/account`, `/team/settings` | email/finance Phase 0 |

---

## Key Supabase Tables

| Table | Purpose |
|-------|---------|
| `profiles` | User profiles — `full_name`, `department`, `job_title`, `access_granted` |
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
| `sop_document_responses` | Filled instances of a fillable `sop_documents` form — `document_id` (FK, `ON DELETE RESTRICT`), `form_number`/`form_revision` (pinned at creation), `data` (flat JSON `{fieldId: value}`), `status` (`draft`/`submitted`), `created_by`/`submitted_by`/`reopened_by`, `updated_at` (optimistic-concurrency token). **Not in generated `types.ts`** — query with `supabase.from("sop_document_responses" as any)`. See "Dynamic Fillable Forms" below. |
| `sop_document_history` | Auto-snapshot (`SECURITY DEFINER` trigger, no direct INSERT/UPDATE/DELETE policies) of a published `sop_documents` row whenever a watched field or `content.form_schema` changes — `document_id`, `revision`, `changed_fields[]`, `snapshot` (full prior row as JSON). **Not in generated `types.ts`** — query with `supabase.from("sop_document_history" as any)`. See "Dynamic Fillable Forms" below. |

---

## Training System (Active Development Area)

**Files:** `src/lib/training.ts`, `src/pages/team/hr/TrainingSops.tsx`, `TrainingModuleDetail.tsx`, `TrainingCompliance.tsx`

**Training categories:** 1 Core Onboarding · 2 Safety & Risk Management · 3 Job-Specific Operations · 4 Response Protocols

**Departments:** Production · Sourcing · Quality Control · Admin · R&D · Sales

**Assignment statuses:** `not_started | in_progress | completed | expired`

**Quiz flow:** Admin configures questions + passing score (or marks as critical → requires 100%). Employees take quiz in `TrainingModuleDetail`; `scoreQuiz()` → `submitQuizResult()` records completion and computes `expires_at` via `computeExpiry()`.

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

**SQF Ref column / drawer — `SqfReference.tsx`:** the comma-delimited `sqf_reference` value (list category view + drawer read-only display) renders each clause number as a gold hover-card chip showing the clause text, with a **"View in {code} (p.N)"** link that opens the matching code PDF at the right page (`#page=N`). **Two code PDFs are hosted**, each with its own auto-generated clause map; a token resolves against the Quality Code first, then the Food Manufacturing code (so 2.x prefers Quality, 11.x falls to Food Mfg), and the matched code decides which PDF the link opens and the link label ("SQF Code" vs "Food Mfg Code"):
- **Quality Code** — `public/sqf-quality-code.pdf` → `src/lib/sqfClauses.ts` (`lookupSqfClause`, `sqfPdfHref`, exports the shared `SqfClause` type), generated by `python scripts/generate-sqf-clauses.py`.
- **Food Safety Code: Food Manufacturing** (Module 11 GMPs + System Elements) — `public/sqf-food-manufacturing-code.pdf` → `src/lib/sqfFoodClauses.ts` (`lookupSqfFoodClause`, `sqfFoodPdfHref`, `SQF_FOOD_CLAUSES`), generated by `python scripts/generate-sqf-food-clauses.py` (reuses the base parser's `parse()`/`extract_text()` with a Food-Manufacturing-specific NOISE filter).

Unmapped numbers fall back to plain text. Both generators key physical==printed page (verified). Full runbook for refreshing either edition in `UPDATING_SQF_CODE.md`.

---

## Document Numbering Convention — `lib/docNumber.ts`

**Forms, manuals (FSQM), and policies** (`sop_documents.sop_number`) follow **`<TYPE>-<NNN>`**: a type prefix (`FRM`/`FSQM`/`POL` — same prefixes `detectType()` reads) plus a **3-digit number whose hundreds block = the process stage** (receiving 300s, production 500s, …; low number = early in the flow). The identifier is **stable for the document's life — the revision lives in the `revision` field, never baked into the number** (the old `FRM-046-1` style did the latter, the inconsistency this fixes). SQF clause numbers stay **decoupled** from these IDs (SQF renumbers between editions) — cross-reference via the existing `sqf_reference` field/chips. **SOPs are the deliberate exception:** they're numbered by the SQF clause they implement (`SOP-2.3.1`, `SOP-11.7.5`) so auditors can jump clause→SOP; `parseClauseNumber()` recognizes this so it isn't flagged, and the register groups them under "SOPs (numbered by SQF clause)".

- **`src/lib/docNumber.ts`** is the single source of truth: `DOC_STAGES` (the block→stage map), `parseDocNumber` (tolerant; strips a legacy `-N` suffix and returns it), `stageForNumber`/`stageForSopNumber`, `formatDocNumber` (canonical `FRM-301`), `docNumberIssue`/`isValidDocNumber` (advisory, non-blocking).
- **`DocNumberHint`** (`components/team/DocNumberHint.tsx`) renders the derived stage + a non-blocking warning under the `sop_number` inputs in `SopImportDialog` and the SOPs Library drawer.
- **Document Register** (`pages/team/compliance/DocumentRegister.tsx`, `/team/compliance/register`, Compliance nav): read-only, groups every doc by stage block; unparseable/legacy numbers fall into an **"Unassigned"** worklist; rows deep-link into the SOPs Library drawer via `?doc=<id>`.
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
  (verifier-role signatures admin-only), `FormSchemaBuilder` + `GridColumnsEditor` (admin authoring —
  incl. per-field **"Show in Entries list"** checkbox and per-grid-column **Width**, live Preview, saves
  via `updateModuleContent` **merge**), `FormEntriesTab` (drawer Entries list + New Entry; renders one
  extra `TableHead`/`TableCell` per `listFields(schema)` field, e.g. Complaint No./Customer on FRM-002).
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
  Submit (confirm + validation) / admin Reopen / Download PDF / admin Delete, hidden when
  `settings.deletable === false`; the "Back to FRM-###" link is duplicated into the sticky bottom action
  bar next to Save/Submit so returning to the library never requires scrolling to the header);
  **Form Records** page **`/team/compliance/records`** (`Records.tsx`, Compliance nav) = cross-form recent
  entries + per-form flattened answer table with From/To + status filters and CSV/PDF export.
- **Derived reports (log forms):** a `type='form'` doc can carry a **`content.report_schema`** that presents
  it as a live report projected from *another* form's responses (e.g. **FRM-003 Customer Complaint Log** ←
  **FRM-002** reports, **FRM-201 Approved Supplier Register** ← **FRM-202**) — a register with **no entries
  of its own**, so it does NOT duplicate `Records.tsx`. Engine `src/lib/formReport.ts` (declarative column
  kinds `field/template/map/cases/const`; user `params` + always-applied `filters[]` fixed conditions —
  e.g. `supplier_status in [Approved, Conditionally Approved]`; `loadReportBase` + pure `filterReportRows`,
  client-side; `buildReportSql` renders the read-only SQL equivalent for the **View SQL** panel). UI: **Report** tab in the drawer (`FormReportTab.tsx` viewer +
  `ReportSchemaBuilder.tsx` admin authoring, saved via `updateModuleContent` merge) + a "Report" list pill;
  shown for forms when `isAdmin || hasReportSchema`. **Full runbook + data-model + FRM-003↔FRM-002 mapping
  in `FORM_REPORTS.md`.**
- **PDF:** `src/lib/formPdf.ts` — `generateFormResponsePdf` (paper-like entry PDF; grids as real tables),
  `generateFormReportPdf` (landscape, clamps to 10 columns → "see CSV"), and `generateDerivedReportPdf`
  (landscape log/register PDF for the derived-report feature above); reuses `loadLogoDataUrl`/
  `confidentialFooter` now exported from `sopPdf.ts`.
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
- **Retention:** `sop_document_responses.document_id` is `ON DELETE RESTRICT` — hard-deleting a form with
  entries fails (code 23503 → "archive instead" toast). Response RLS: staff read all / insert own / update
  own **drafts** only; admin-or-owner (`has_role('admin') OR is_owner()`) update/delete anything.
  Dormant scaffold tables `sop_versions`/`form_templates`/`form_submissions` (20260608000001) are unused
  and deliberately not reused.

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
| `sopDocxParser.ts` | `parseSopDocx()` — extracts structured SOP/FSQM data from a .docx upload (scanned-hardcopy robust: merged-header splitting, running-header/noise filtering, list-rendered headings, trailing revision-history table, `Compass Blending`→`Adventure Bakery` rebrand); exports `SECTION_LABELS` (body section keys/labels/order, reused by `SopBodyEditor`) and `SopType` (`sop`/`form`/`policy`/`fsqm`) |
| `pptxNotes.ts` | `extractSpeakerNotes(file)` — pulls per-slide speaker notes from a .pptx (JSZip, presentation order); throw-safe (degrades to nulls → AI narration fallback) |
| `sopPdf.ts` | `generateSopPdf(row)` — client-side SOP→PDF via `pdfmake` (template header table + body sections via `SECTION_LABELS` + per-page confidentiality footer; logo from `/sop-logo.png`). On-demand, no caching. Also exports `loadLogoDataUrl`, `confidentialFooter`, `DISCLAIMER`, `PDF_GOLD` for reuse by `formPdf.ts`. See "SOP PDF Export" above |
| `docNumber.ts` | Document numbering convention: `DOC_STAGES`, `parseDocNumber`, `stageForNumber`/`stageForSopNumber`, `formatDocNumber`, `docNumberIssue`/`isValidDocNumber`; `parseClauseNumber`/`compareClauseIds` (the deliberate SQF-clause SOP scheme). See "Document Numbering Convention" above |
| `templates.ts` | `fetchActiveTemplates()`, `downloadTemplate()` |
| `formSchema.ts` | Dynamic form schema types + pure helpers: `getFormSchema`/`hasFormSchema`, `buildZodSchema` (submit-time validation), `emptyValues`, `formatFieldValue`, `flattenForReport`, `instanceTitle`, `slugifyFieldId`, `valueFields`, `listFields` (fields with `showInList: true`, for Entries-list extra columns). See "Dynamic Fillable Forms" below |
| `formResponses.ts` | Supabase access for `sop_document_responses`/`sop_document_history` — `createResponse`, `saveResponseData`/`submitResponse` (optimistic-concurrency guard, throws `StaleResponseError`), `reopenResponse`, `deleteResponse`, `resolveSchemaForResponse` (live/snapshot/fallback), `fetchProfileNames` |
| `formPdf.ts` | `generateFormResponsePdf(doc, schema, response)` (paper-like entry PDF), `generateFormReportPdf(...)` (landscape report, clamps to 10 columns), and `generateDerivedReportPdf(...)` (derived log/register PDF); reuses `sopPdf.ts`'s logo/footer exports |
| `formReport.ts` | Derived-report engine for log forms (`content.report_schema`): `getReportSchema`/`hasReportSchema`, declarative `ColumnSource` (`field/template/map/cases/const`), `resolveReportColumns`, `loadReportBase`+`filterReportRows` (client-side projection), `matchesFilter` (fixed `filters[]` conditions), `runReport`, `distinctColumnValues`, `buildReportSql` (read-only SQL equivalent). See `FORM_REPORTS.md` |
