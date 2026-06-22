# Approved To Implement

Curated queue of backlog items approved for implementation.

Workflow:

1. Candidate starts in [`nice-to-have.md`](nice-to-have.md).
2. Review manually with the user; ask for clarification when tradeoffs are
   unclear.
3. If the user is satisfied with the approach, move or copy the item here with
   enough implementation intent to start safely.
4. If not, leave it in `nice-to-have.md` or move the rationale to
   [`deferred-notes.md`](deferred-notes.md).

Items here are approved in principle, not necessarily scheduled next. Before
coding, still inspect the implementation and update the plan if the code
contradicts the assumptions.

---

## Mobile-responsive web

Approved 2026-06-22. Make the SPA usable on a phone (~375px) without changing the
desktop layout. Mobile-first tweaks, **no redesign**.

### Why

The app is deployed and reachable on mobile (behind Cloudflare Access), but the
shell is desktop-only — `Layout.tsx` renders an always-on `w-60` sidebar with no
mobile toggle, so a phone loses ~240px to nav with no way to collapse it.

### Already handled (verified in code, do not redo)

- `index.html` has the viewport meta.
- shadcn `Table` wraps in `overflow-x-auto` — tables already scroll horizontally.
- shadcn `DialogContent` is `w-full max-w-[calc(100%-2rem)]` on mobile.
- Charts use `ChartContainer` (responsive width) at `h-64`.

So the dominant gap is the **sidebar**; the rest is small responsive-class polish.

### Slice M1 — App shell (the core fix)

`web/src/components/Layout.tsx` (+ add shadcn `sheet` primitive — Radix-Dialog
based, no new dependency):

- Desktop (`md+`): keep the fixed `w-60` sidebar exactly as-is.
- Mobile (`<md`): hide it (`hidden md:flex`); add a top bar with a hamburger
  (`Menu` icon) + `勘定 Kanjo` brand + `HealthBadge`. Hamburger opens a `Sheet`
  (left off-canvas drawer) holding the same nav; close the drawer on nav-tap.
- Extract the `NAV.map(...)` render so the sidebar and the drawer share one nav
  list (no duplication).
- Trim main padding on mobile: `px-4 py-6 md:px-8 md:py-8`.

Only structural change. Every page renders inside this shell, so nav is fixed
app-wide at once.

### Slice M2 — Per-page polish (class tweaks only)

- Page headers (Ledger/Reports/Accounts/Dashboard): stack on mobile —
  `flex-col gap-3 sm:flex-row sm:items-center sm:justify-between`.
- Filter/control bars (Ledger, Reports): inputs/selects `w-full sm:w-40` so they
  stack instead of overflowing (bars are already `flex-wrap`).
- Ledger table: hide low-priority columns on mobile via `hidden lg:table-cell` on
  **Tags + Project**; keep Date / Description / Amount / Account. Keep the
  `RowMessage` `colSpan` in sync with the visible column count.
- Dialogs: add `max-h-[90vh] overflow-y-auto` to dialog content so tall forms
  (Transaction / Transfer) scroll on short screens.
- Metric-card grids stay 2-up on mobile (already fine).

### Decisions (defaults — adjust before coding if needed)

- **Drawer (Sheet + hamburger)** for mobile nav, not a bottom tab bar — standard,
  smallest build, reuses an existing Radix primitive.
- **Breakpoint `md` (768px)** to switch sidebar ↔ drawer (tablet portrait gets the
  drawer).
- **Hide Tags + Project** on the ledger at `<lg`.
- **Two slices** (M1 shell, M2 polish), each its own CodeRabbit-then-commit per the
  per-phase cadence.

### Out of scope

Redesign, PWA/install, bottom-tab navigation, charts rework (already responsive),
column card/stack layouts (overflow-scroll is enough for now).

### Risks

- M1 edits the shared shell — test **every route** at 375 / 768 / desktop.
- Adding `sheet` pulls a Radix-Dialog-based primitive only (radix already a dep).
- Column hiding: empty/loading `colSpan` must match the visible column count or the
  message cell spans wrong.

### Verification

`pnpm build` + `pnpm lint`; manual resize at 375px (phone) / 768px (tablet) /
desktop — drawer opens/closes, no page-level horizontal overflow, dialogs scroll.
Then redeploy (`git pull && docker compose up -d --build`) and purge the CF cache
if any static asset name was reused.

### Files (expected)

- `web/src/components/Layout.tsx` — sidebar → responsive shell + drawer.
- `web/src/components/ui/sheet.tsx` (new) — shadcn primitive.
- `web/src/features/transactions/LedgerPage.tsx` — header stack, filter widths,
  column hiding.
- `web/src/features/reports/ReportsPage.tsx` — header/controls stacking.
- `web/src/features/{accounts/AccountsPage,dashboard/DashboardPage}.tsx`,
  `web/src/features/shared/NameCrud.tsx` — header stacking.
- `web/src/components/ui/dialog.tsx` — `max-h`/scroll (or per-dialog).
