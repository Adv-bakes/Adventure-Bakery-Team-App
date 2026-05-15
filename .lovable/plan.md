## What we're fixing

The Team Portal works under the hood (drag-drop Kanban, RLS, routes) but looks like a 2014 admin template: 5 flat rectangles, default fonts, brown sidebar, one lonely card. We're not rebuilding — we're replacing the visual layer with a real design system and a smarter information architecture.

No database changes. No route changes. No business-logic changes.

## Design system (locked)

- **Palette:** Noir & Gold
  - `--bg` `#0a0a0a` · `--surface` `#141414` · `--surface-2` `#1c1c1c` · `--border` `rgba(201,168,76,0.12)`
  - `--text` `#f5f1e6` · `--text-muted` `rgba(245,241,230,0.55)`
  - `--gold` `#c9a84c` · `--gold-soft` `#f0d78c` · `--gold-glow` `rgba(201,168,76,0.18)`
- **Typography:** Sora (display, 600/700, tight tracking) · Manrope (body, 400/500)
- **Radius:** 14px cards, 10px inputs, 999px chips
- **Shadow:** soft inner highlight + low ambient — no harsh drop shadows
- **Motion:** Framer Motion, 180–220ms ease-out on mount; cards lift 2px on hover; column drop zones glow gold

## Sales Pipeline — bento layout

```text
┌────────────────────────────────────────────────────────────────┐
│  PIPELINE                              [search] [filter] [+ ]  │
│  Sora 32, gold underline accent                                │
├────────────────────────────────────────────────────────────────┤
│ ┌─KPI─┐ ┌─KPI─┐ ┌─KPI─┐ ┌──────── Velocity ────────┐           │
│ │ 12  │ │  3  │ │ $—  │ │  sparkline, 30d           │           │
│ │Open │ │Stuck│ │MoneyOnly│                         │           │
│ └─────┘ └─────┘ └─────┘ └───────────────────────────┘           │
├────────────────────────────────────────────────────────────────┤
│  Lead In · 1     Send Docs · 0   Follow-Up · 0   Quote · 0  …  │
│  ┌──────────┐    ┌─ empty ─┐     ┌─ empty ─┐    ┌─ empty ─┐    │
│  │ Acme Co. │    │ "drop   │     │         │    │         │    │
│  │ Jane Doe │    │  here"  │     │         │    │         │    │
│  │ ●NDA ○PSS│    └─────────┘     └─────────┘    └─────────┘    │
│  │ 3d · $—  │                                                  │
│  └──────────┘                                                   │
└────────────────────────────────────────────────────────────────┘
```

### Card upgrade
Each pipeline card shows: company (Sora 14/600), contact (Manrope 12), three doc dots (NDA/PSS/PRF — gold filled = signed/received, hollow = pending), days-in-stage chip, MoneyOnly $ chip. Hover lifts the card and reveals quick actions (Open · Send NDA · Advance →).

### Column upgrade
Column headers get a thin gold rule under them, count chip, and a "+" to add a client straight into that stage. Drop zones glow gold during drag. Empty columns show a one-line italic hint, not the current bracketed placeholder.

### KPI strip (top)
4 bento tiles: Open deals · Stuck (>7d in stage) · Pipeline value (MoneyOnly) · 30-day velocity sparkline. Tiles are different sizes — that's the bento.

## Apply the same system everywhere

Same tokens, same type, same card grammar across the rest of `/team/*`:
- **TeamLayout sidebar** — black surface, gold hairline border, Sora section labels, active item gets a 2px gold left rail (no more brown gradient).
- **Dashboard, Clients, Documents Inbox, Ops pages, Inventory, Scout Bot, etc.** — header pattern, KPI bento, table/card style all unified.
- Replace ad-hoc inline `style={{ background: "rgba(...)" }}` with semantic Tailwind tokens defined in `index.css` + `tailwind.config.ts`.

## Technical changes (where the code actually changes)

- `src/index.css` — add the Noir & Gold HSL tokens, Sora/Manrope font families, gold-glow shadow utility, gradient definitions.
- `tailwind.config.ts` — register the new semantic colors so we use `bg-surface`, `text-gold`, `border-hairline` instead of inline styles.
- `index.html` — `<link>` Sora + Manrope from Google Fonts.
- `src/components/TeamLayout.tsx` — restyle sidebar to noir surface + gold accents; move to semantic tokens.
- `src/pages/sales/SalesPipeline.tsx` — bento KPI strip + redesigned column/card components.
- New `src/components/sales/PipelineCard.tsx` and `PipelineColumn.tsx` so cards are reusable and testable.
- `src/pages/sales/SalesClients.tsx`, `SalesClientFolder.tsx`, `SalesDocumentsInbox.tsx` — restyle with the same primitives (no logic changes).
- Add `framer-motion` micro-interactions (mount fade-in, hover lift, drop-zone glow).

## Order of work

1. Tokens + fonts + Tailwind config (foundation — every page benefits)
2. TeamLayout sidebar restyle
3. Sales Pipeline bento + PipelineCard/PipelineColumn
4. Sales Clients + Client Folder + Documents Inbox restyle
5. Roll the same primitives across Ops/Compliance/HR pages

## Out of scope

- No new features, no DB changes, no route changes
- Brand portal styling stays as-is for now (different audience)
- No demo seed data — empty columns will look intentional, not broken, with the new empty-state styling
