## Top-level structure: 5 departments + Internal admin

```text
HOME
  Main Dashboard            ← cross-department snapshot, no financials for staff

SALES
  Sales Pipeline            ← Lead In → Send Documents → Follow-Up → Quote → First Order
  Clients                   ← all client folders, search
  Documents Inbox           ← incoming PRFs, signed NDAs, completed PSS

OPERATIONS
  Operations Pipeline       ← Order Received → Materials Sourced → Scheduled → Produced
  Orders
  Production Schedule
  Inventory                 ← JIT (AB-owned) + Tolling (client-owned)
  Sourcing (Scout Bot)      ← ingredient calculator, vendor quotes  ⚠ owner-only $$
  Variance Report           ← qty variance only for staff; $ variance owner-only

COMPLIANCE
  SOPs Library
  Production Traceability   ← lot code → ingredients → batch → order → client
  Certifications

HR
  Team Directory
  Training & SOPs
  Training Traceability

INTERNAL (admin/owner only)
  Vendor DB / Reference Data
  Settings & Permissions    ← role + per-section matrix (Phase 5)
  Email Inbox               ← curated, important emails only
  Finance                   ← QuickBooks links, full $$ reports (Phase 5)
  My Account
```

## Pipeline stages (your corrections)

- **Sales (5):** Lead In → Send Documents → Follow-Up → Quote → First Order
- **Operations (4):** Order Received & Confirmed → Materials Sourced → Scheduled → Produced

When a Sales card hits "First Order" it spawns an Ops card at "Order Received & Confirmed". One handoff, no double entry.

## Money is owner-only — enforced in 3 layers

You said staff should never see numbers/revenue. I will enforce this everywhere, not just hide buttons:

1. **New role: `owner`** (you). Existing `admin` and `staff` stay as-is. Only `owner` sees money.
2. **DB layer.** Financial columns live in tables/views gated by RLS to `has_role(auth.uid(),'owner')`. Even if staff opens devtools and queries Supabase directly, they get nothing.
3. **UI layer.** A `<MoneyOnly>` wrapper hides the element when `useUserRole()` ≠ owner.

### What counts as "financial" (hidden from staff)

| Item | Who sees it |
|---|---|
| Vendor prices, cost per lb, $/case, total material cost | Owner only |
| Quote amounts, target prices, margin %, downpayment $ | Owner only |
| Variance in **dollars** | Owner only |
| Variance in **lbs / %** | Staff + owner (operational signal) |
| Revenue, P&L, monthly totals | Owner only |
| QuickBooks links / Finance section | Owner only |
| Scout Bot **costing workspace** | Owner only |
| Scout Bot **ingredient pull list** (qty needed, available, shortfall in lbs) | Staff + owner — they need this to produce |
| Inventory **quantities** (cases, lbs, lot codes) | Staff + owner |
| Inventory **values** ($ on hand) | Owner only |
| Production batch lot codes, ingredients, qty actual | Staff + owner |

### Database changes

Reusing existing tables. Net new is small.

| Concept | Table.column | New? |
|---|---|---|
| Owner role | `user_roles.role = 'owner'` | new enum value |
| Sales stage per client | `profiles.sales_stage`, `sales_stage_updated_at` | new columns |
| Ops stage per order | `production_batches.status` | reuse |
| Activity log | `client_activity` (client_id, actor_id, action, payload, created_at) | new |
| Vendor quotes (Scout Bot) — **owner-gated** | `vendor_quotes` (ingredient_id, vendor, price_per_lb, quote_date, moq, shipping, is_preferred) | new, RLS = owner |
| Order quote $ — **owner-gated** | `order_financials` (order_id, quote_amount, downpayment, margin_pct) | new, RLS = owner |
| SOPs | `sops` | new |
| Compliance documents | `compliance_documents` | new |
| Trainings + assignments | `trainings`, `training_assignments` | new |
| Permission matrix | `section_permissions` (role, section_key, can_view, can_edit) | new (Phase 5) |
| Curated email inbox | `email_inbox` | new |

Existing `cost_per_lb`, `target_price`, `margin_percentage`, `total_cost`, `ingredient_cost` columns on `ingredients` / `costing` / `ingredient_specs` get an additional **owner-only** SELECT policy via a wrapping view (`*_public` view exposes non-money columns to staff; base table SELECT goes owner-only). No data is moved.

The future Client Portal continues reading the same tables — RLS handles who sees what.

## Replit Scout Bot — what I'll port

Reviewed `SourceBotScout` upload. It's Express+React; logic maps cleanly onto Supabase:

| Replit | Maps to |
|---|---|
| `clients` | `profiles` (client role) |
| `ingredients` + `vendor_quotes` | `ingredients` + new `vendor_quotes` (owner-gated) |
| `production_runs` | `production_batches` |
| `costing_lines` | new `production_run_costing` (owner-gated) |
| Stale-price (>180d), high-cost (>50% target), missing-vendor flags | computed in UI |
| Excel batch-sheet parser | already live as `parse-batch-sheet` edge function |

Port the **logic** (waste %, MOQ defaults, flags, per-case math, costing workspace UI). Skip the Express server — your project is Supabase-direct.

## Build order

- **Phase 0 — Skeleton (this PR).** New 5-section + Internal sidebar, empty section landings with correct tabs/stages, `owner` role added, `<MoneyOnly>` wrapper in place. All current routes stay alive.
- **Phase 1 — Sales.** Pipeline Kanban, Client folder (6 tabs), send-NDA / send-PSS / upload actions. Quote $ owner-only.
- **Phase 2 — Operations.** Ops Kanban, Orders, Production Schedule, Inventory, Scout Bot ported, Variance Report (qty for staff, $ for owner).
- **Phase 3 — Compliance.** SOPs, Traceability viewer, Certifications archive.
- **Phase 4 — HR.** Team directory, Training catalog, Assignments, Traceability.
- **Phase 5 — Internal.** Permissions matrix UI, curated email inbox, Finance section + QuickBooks links.

## Deferred per your direction

- **Finance / QuickBooks** — Phase 5 stub; section is owner-only from day one.
- **Permissions UI** — Phase 5. Until then: `owner` sees money, `admin`+`staff` see operations only, `user` (clients) locked out of `/team/*`.
- **Email firehose** — never. Curated inbox only.

## One open question

Should the **Main Dashboard** be a single cross-department overview (your view as owner; staff see a money-stripped version), or should login route each user straight to their primary department's dashboard? I recommend the cross-department overview — you need the bird's-eye view daily, and `<MoneyOnly>` keeps it safe for staff.