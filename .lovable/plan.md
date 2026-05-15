# Interlude → Phase 1: Sales

## Interlude (small, do first)

**1. Re-add `weight_conversions` to realtime publication**
- Public reference data; no privacy concern.
- One-line migration: `ALTER PUBLICATION supabase_realtime ADD TABLE public.weight_conversions;`
- Update security memory so the scanner stops flagging it.

**2. Let logged-in clients edit their own PRF**
- Add `owner_user_id uuid` column to `prf_submissions` (nullable; anonymous submissions stay anonymous).
- Backfill trigger: on first login, match `prf_submissions.email` → `auth.users.email` and set `owner_user_id`.
- Add RLS policies on `prf_submissions`:
  - SELECT: `auth.uid() = owner_user_id` (client sees own)
  - UPDATE: `auth.uid() = owner_user_id AND status IN ('new','draft','needs_revision')` (no edits after we lock it)
- Brand portal gets a "My PRFs" view (Phase 1 ships the list; full editor reuses existing wizard).

## Phase 1 — Sales

### Sales Pipeline (Kanban)
- Route: `/team/sales/pipeline`
- Columns: Lead In → Send Documents → Follow-Up → Quote → First Order
- Cards = clients (`profiles` where `role='Client'`), grouped by `profiles.sales_stage`
- Drag to move; writes `sales_stage` + `sales_stage_updated_at`
- Card shows: company name, contact, days-in-stage, doc badges (NDA/PSS/PRF), `<MoneyOnly>` quote chip
- Auto-advance hooks: NDA signed → Send Documents; PRF received → Follow-Up; quote sent → Quote; first PO → First Order (also spawns Ops card at "Order Received")

### Clients list
- Route: `/team/sales/clients` (replace placeholder)
- Searchable table: Name, Company, Stage, Last Activity, Owner, $ pipeline (owner-only)
- Bulk actions: send NDA, send PSS, advance stage

### Client folder (6 tabs)
- Route: `/team/sales/clients/:id`
- Tabs: **Overview** · **Documents** (NDAs, PSS, batch sheets via `client_documents`) · **PRFs** (list + open in wizard) · **Concepts** · **Quotes** [owner-only] · **Activity** (new `client_activity` table)
- "Send NDA" / "Send PSS" / "Upload doc" / "Invite to portal" actions
- Quote $ amounts and margin gated by `<MoneyOnly>` — staff sees "Quote sent ✓" badge only

### Documents Inbox
- Route: `/team/sales/documents-inbox`
- Unified feed: incoming PRFs (`prf_submissions` where status='new'), signed NDAs, completed PSS uploads
- Click → opens the relevant client folder

### New tables / columns
| Table | Change |
|---|---|
| `prf_submissions` | + `owner_user_id uuid` |
| `client_activity` | new (client_id, actor_id, action, payload, created_at) |
| `profiles` | already has `sales_stage` from Phase 0 |

### Out of scope for Phase 1 (already deferred)
- Vendor quotes / Scout Bot → Phase 2
- Permissions matrix UI → Phase 5
- Finance/QuickBooks → Phase 5

## Order of execution

1. Migration: `weight_conversions` realtime + `prf_submissions.owner_user_id` + backfill trigger + new RLS + `client_activity` table
2. Brand portal "My PRFs" list page (lets clients self-edit — closes the security loop you raised)
3. Sales Pipeline Kanban
4. Clients list + Client folder (6 tabs)
5. Documents Inbox
6. Wire auto-advance hooks

After Phase 1 lands and you've kicked the tires, we move to Phase 2 (Operations + Scout Bot port).
