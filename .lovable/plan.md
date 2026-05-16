
## Mental model (locked)

- **Project = Concept = one product in presale** (Lead In → Send Documents → Follow-Up → Quote). Lives in Sales.
- Quote approval **renames** Project → Product and moves it under the Products tab. Same documents carry over (PRF · PSS · Batch Sheet · Quote · other services). The pipeline changes — that's the only real difference.
- **NDA is client-level only.** It lives on Documents & NDA at the top of the folder. It does **not** appear under any project or product.
- **QB Estimate is the gate.** Nothing downstream runs until staff marks the QB estimate accepted. Then Material Estimator (Scout Bot) unlocks.
- **Shipping address lives on the client profile**, not on the order. Default destination + option to choose an Adventure Bakery warehouse.

## Sales sidebar

```text
Sales
├─ Dashboard          → presale-only project kanban + "Add Deal"
├─ Documents Inbox 🔴
└─ Archive
```

## Staff Client Folder `/team/sales/clients/:id`

Header on every tab: company name · collapsed contact card (expand on click) · **Add Order** button top-right · NDA status strip.

```text
├─ Overview            Active Projects (presale) + Approved Products (post-quote)
├─ Documents & NDA     NDA + client-level docs the portal exposes  ← ONLY place NDA appears
├─ Projects            presale projects list → project detail sub-tabs:
│    ├─ Documents      PRF · PSS · Batch Sheet · Quote · other offered services
│    ├─ Packaging
│    ├─ Shelf Life
│    ├─ Activity       STAFF-ONLY
│    └─ Notes          STAFF-ONLY
├─ Products            approved products → product detail sub-tabs:
│    ├─ Documents      SAME set as Projects (PRF · PSS · Batch Sheet · Quote · other) — carried over
│    ├─ Packaging
│    ├─ Shelf Life
│    ├─ Orders History STAFF-ONLY
│    ├─ Activity       STAFF-ONLY
│    └─ Notes          STAFF-ONLY
├─ Tolling Inventory   STAFF-ONLY (tab shell this pass)
├─ Orders              STAFF-ONLY — QB-gated flow (see below)
└─ Notes               STAFF-ONLY client-level notes
```

## Add Order flow (QB-gated)

`Add Order` (header button) opens a dialog:
- Multi-select of the client's **approved products**, qty + units/cases per product.
- **Ship-to**: defaults to the client profile's shipping address; dropdown can switch to an Adventure Bakery warehouse. No free-text address on the order itself.
- If originating quote is >30 days old → "Pricing review required" banner.
- Submit creates `production_orders` row in status **`Awaiting QB Acceptance`** and routes to the Orders tab.

Orders tab row, gated:

```text
1. QB Estimate sent           → staff marks "Estimate sent" (qb_estimate_sent_at)
2. QB Estimate accepted ⛔    → staff marks "Accepted" (qb_estimate_accepted_at)
                                THE GATE. Nothing below visible/clickable until accepted.
3. Material Estimator         → waste % + "Calculate ingredients" (Scout Bot stub)
4. (future) Sourcing · Schedule · MPDs
```

## Sales Dashboard `/team/sales/dashboard`

KPIs + **Add Deal** + project kanban grouped by `prf_submissions.sales_stage`: Lead In → Send Documents → Follow-Up → Quote → Approved.

## Project Subfolder `/team/sales/clients/:leadId/projects/:projectId`

Stage stepper. Approving Quote graduates project → Product (same docs carry over). Sub-tabs: Documents · Packaging · Shelf Life · Activity · Notes.

## Data model

```sql
alter table prf_submissions
  add column sales_stage text default 'Lead In',
  add column sales_stage_updated_at timestamptz default now(),
  add column quote_approved_at timestamptz,
  add column lead_id uuid;

-- Shipping lives on the client, not the order
alter table profiles
  add column shipping_address_line1 text,
  add column shipping_address_line2 text,
  add column shipping_city text,
  add column shipping_state text,
  add column shipping_postal_code text,
  add column shipping_country text;

-- New: Adventure Bakery warehouses (staff-managed)
create table ab_warehouses (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  address text not null,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);
-- Staff/admin RLS on ab_warehouses.

alter table production_orders
  add column client_id uuid,
  add column items jsonb default '[]'::jsonb,         -- [{product_id, qty, unit:'units'|'cases'}]
  add column ship_to_kind text default 'client',      -- 'client' | 'ab_warehouse'
  add column ship_to_warehouse_id uuid,               -- null unless kind='ab_warehouse'
  add column notes text,
  add column qb_estimate_sent_at timestamptz,
  add column qb_estimate_accepted_at timestamptz,
  add column waste_pct numeric;
```

Backfill `prf_submissions.lead_id` from `sales_leads.email`. Tighten `production_orders` RLS from admin-only to staff/admin.

## Files

- `supabase/migrations/...` — column adds, `ab_warehouses` table, RLS, backfill.
- `src/components/TeamLayout.tsx` — Sales sidebar trim.
- `src/App.tsx` — `/team/sales/dashboard` + nested project/product routes.
- `src/pages/sales/SalesDashboard.tsx` *(new)*
- `src/pages/sales/SalesClientFolder.tsx` — retabbing + header Add Order + collapsed contact card + NDA strip.
- `src/pages/sales/SalesProjectWorkspace.tsx` — stepper + sub-tabs.
- `src/pages/sales/SalesProductWorkspace.tsx` *(new)* — product sub-tabs (no NDA).
- `src/pages/sales/ClientOrders.tsx` *(new)* — QB-gated flow.
- `src/components/sales/AddOrderDialog.tsx` *(new)* — ship-to picker (client default vs AB warehouse).
- Client profile editor: add shipping-address block (separate small follow-up if not already in scope).

## Out of scope

- Operations sidebar cleanup.
- Tolling Inventory CRUD (tab shell only).
- Real QB integration (manual mark-accepted).
- Scout Bot beyond ingredient pull-list stub; sourcing/scheduling/MPDs.
- Warehouse CRUD UI (seed manually this pass; admin screen later).
- Brand-portal write-back.
