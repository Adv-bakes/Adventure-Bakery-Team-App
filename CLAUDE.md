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
| Compliance | `/team/compliance/sops`, `/team/compliance/traceability`, `/team/compliance/certifications` | traceability & certifications Phase 0 |
| HR | `/team/hr/directory`, `/team/hr/trainings`, `/team/hr/traceability` | directory is Phase 0 |
| Internal | `/team/internal/email`, `/team/internal/finance` (owner only), `/team/sourcing`, `/team/account`, `/team/settings` | email/finance Phase 0 |

---

## Key Supabase Tables

| Table | Purpose |
|-------|---------|
| `profiles` | User profiles — `full_name`, `department`, `job_title`, `access_granted` |
| `user_roles` | Role assignments — `user_id`, `role` (owner/admin/staff/user) |
| `sop_documents` | Training modules & SOPs — `training_category` (int 1–4, HR portal), `category` (text, SOPs Library grouping; names mirror the training category labels), `module_number`, `content` (JSON), `passing_score_pct`, `is_critical`, `required_departments`, `status` |
| `training_assignments` | Employee ↔ module assignments — `completed_at`, `quiz_score`, `quiz_attempts`, `expires_at`, `recurrence_months`, `signed`/`signed_at` (acknowledgment), `progress` (JSON save/resume state, cleared on completion) |
| `quiz_questions` | Per-module quiz — `options` (array), `correct_option_index`, `hint`, `rationale` |
| `prf_submissions` | Product Request Forms — `concept_id`, `lead_id`, `product_name` |
| `batch_sheets` | Production batches — `data_json`, `version`, `status`, `superseded_at` |
| `document_templates` | NDA/PSS/PRF file templates — `kind`, `is_active`, `file_path` |
| `chat_history` | CoachChat messages — `user_id`, `project_id`, `section`, `role`, `content` |
| `ab_warehouses` | Inventory locations |

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
  "acknowledgment": { "required": true, "text": "I have read and understand..." }
}
```
The first three are parallel arrays indexed by slide position. `acknowledgment` is optional; when `required`, the employee must check an "agree to comply" box before the module can be completed (recorded on the assignment as `signed`/`signed_at`).

**Save/resume:** `training_assignments.progress` JSON (`{ slideIndex, maxVisitedIndex, highestUnlocked, updatedAt }`) is auto-saved by the viewer on every slide transition (`saveAssignmentProgress()` in `training.ts`), restored on load (clamped to current slide count), and set to null on completion. In-progress rows in `TrainingSops.tsx` show "Slide N of M · X%".

---

## Training Viewer (Employee-facing) — `TrainingModuleDetail.tsx`

- **One slide at a time** with Back / Next navigation
- **Progress bar** (gold), percentage counter, and dot strip showing current position
- **Dwell time gating:** Next button disabled with countdown on first visit to each slide. Duration = `computeSlideDuration(narration)` — ceil(words/3) seconds, min 8s, default 20s when no narration. Revisiting an already-unlocked slide skips the gate.
- **Audio narration (TTS):** "Listen" button on each slide reads narration via browser `speechSynthesis`. Once started, auto-advances narration to each subsequent slide until "Stop" is clicked.
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
- **Listen / Stop** — TTS preview of the narration for the current slide
- **Import from PowerPoint** — opens `PptxImportDialog` in replace mode (visible both in full-slide state and empty-state "no slides yet")

---

## Quiz Editor — `QuizEditor.tsx`

Component in `src/components/team/`, rendered below the Content section in the SOPs Library detail drawer (admin only). Per-question cards with text, options (correct-answer radio, min 2), labeled Hint and Rationale inputs, and up/down reorder buttons (display honors `question_number` order). "Regenerate with AI" invokes `generate-quiz` (confirm dialog if questions exist; hidden when no narrations). Bottom row: gold "Save Quiz" + "Add Question". Also hosts the module's acknowledgment config (require checkbox + custom text, default `DEFAULT_ACKNOWLEDGMENT_TEXT`), saved into `content.acknowledgment` alongside the quiz.

---

## SOPs Library — `SopsLibrary.tsx`

`/team/compliance/sops`. Groups documents by `category` (text) or by SQF section. Admin features:
- **Per-category "Add Module"** button on each category accordion header (category view only) — opens `PptxImportDialog` targeted at that category. Button is a *sibling* of `AccordionTrigger` (Radix renders the trigger as a `<button>`; nesting would break it).
- **Editable detail drawer:** title, SOP #, revision, effective date, SQF reference, approved by, category, type, status, SQF-required — saved via "Save Details" (updates `sop_documents`, re-files the doc into the right group).
- **`CategorySelect`** (defined in this file): dropdown of existing categories + "Uncategorized" + "Add New Category…" (swaps to a text input). Used in the detail drawer and the Add SOP dialog — category is never free text.
- Detail drawer also embeds `SlideContentEditor` and `QuizEditor`.

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

**Required secrets (set via Supabase dashboard → Settings → Edge Functions):**
- `LOVABLE_API_KEY` — Lovable AI gateway key (pre-provisioned)
- `CLOUDCONVERT_API_KEY` — CloudConvert API key for pptx→png conversion

---

## lib/ Utilities Reference

| File | Key exports |
|------|-------------|
| `utils.ts` | `cn()` — class merging |
| `training.ts` | Types, fetchers, `scoreQuiz`, `submitQuizResult` (4th arg `complete=false` saves score only, deferring completion to acknowledgment), `saveAssignmentProgress`, `markAssignmentComplete`, `parseQuizCsv`, `computeExpiry`, `getAssignmentStatus`, `getTrainingSlideUrl`, `uploadTrainingSlide`, `replaceTrainingSlide`, `deleteTrainingSlide`, `updateModuleContent`, `saveQuizQuestions`, `computeSlideDuration` |
| `materialCalc.ts` | `runMaterialCalc()` — ingredient/packaging needs for an order batch |
| `sopDocxParser.ts` | `parseSopDocx()` — extracts structured SOP data from a .docx upload |
| `pptxNotes.ts` | `extractSpeakerNotes(file)` — pulls per-slide speaker notes from a .pptx (JSZip, presentation order); throw-safe (degrades to nulls → AI narration fallback) |
| `templates.ts` | `fetchActiveTemplates()`, `downloadTemplate()` |
