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
| `sop_documents` | Training modules & SOPs — `training_category`, `module_number`, `content` (JSON), `passing_score_pct`, `is_critical`, `required_departments`, `status` |
| `training_assignments` | Employee ↔ module assignments — `completed_at`, `quiz_score`, `quiz_attempts`, `expires_at`, `recurrence_months` |
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

---

## lib/ Utilities Reference

| File | Key exports |
|------|-------------|
| `utils.ts` | `cn()` — class merging |
| `training.ts` | Types, fetchers, `scoreQuiz`, `submitQuizResult`, `parseQuizCsv`, `computeExpiry`, `getAssignmentStatus` |
| `materialCalc.ts` | `runMaterialCalc()` — ingredient/packaging needs for an order batch |
| `sopDocxParser.ts` | `parseSopDocx()` — extracts structured SOP data from a .docx upload |
| `templates.ts` | `fetchActiveTemplates()`, `downloadTemplate()` |
