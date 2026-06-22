# Module: reports

Read-only derived views over `transactions`. Nothing is stored — every figure
is recomputed from rows on each request (the correctness guarantee from
`known-constraints.md`: *derived, never incremented*). Same layering as the rest
(**thin handler → service → store, sqlc over pgx**), but no writes, no FK
pre-validation, no 404 (an empty ledger is a valid `0`/`[]`, not "not found").

## Layers

| File | Role |
|---|---|
| `api/internal/store/queries/reports.sql` | sqlc query source (6 aggregates) |
| `api/internal/store/db/reports.sql.go` | sqlc-generated (`DO NOT EDIT`) |
| `api/internal/report/service.go` | run queries, row→DTO, money/ratio in `big.Rat`, window resolution |
| `api/internal/report/handler.go` | parse query params, call service, map → HTTP |
| `api/internal/server/router.go` | `report…Mount(mux)` |

## Routes (`/api/v1`)

| Method | Path | Success | Query params |
|---|---|---|---|
| GET | `/reports/summary` | 200 `Summary` | `from`, `to` |
| GET | `/reports/cash-flow` | 200 `[]CashFlowPoint` | `from`, `to`, `interval` |
| GET | `/reports/categories` | 200 `[]CategoryTotal` | `from`, `to` |
| GET | `/reports/projects` | 200 `[]ProjectTotal` | `from`, `to` |
| GET | `/reports/balance-trend` | 200 `[]BalancePoint` | `to`, `interval` |

`from`/`to` are `YYYY-MM-DD`, inclusive, optional. `interval` ∈ `day | week |
month` (default `month`) — bucketed via Postgres `date_trunc` (week = Monday).
List endpoints always return a JSON array (`[]` when empty), never `null`.

### Which views map where

`summary` covers **Current Balance**, **Savings Rate**, **Monthly Burn**,
**Runway**. `cash-flow` is **Cash Flow** + the **Burn Rate** trend (the expense
series). `categories` = **Category Breakdown**, `projects` = **Project Cost**,
`balance-trend` = **Balance Trend**.

## What counts where (the sign/direction contracts)

- **Balances** (`current_balance`, `liquid_balance`, `balance-trend`) sum **all**
  rows signed by `is_inflow` (`+amount` inflow, `-amount` outflow). Transfers are
  **included** — they move money between accounts (and net to zero across them).
  `liquid_balance` restricts to `accounts.is_liquid = true` (feeds runway).
- **Flow** (`cash-flow`, `categories`, `projects`, and `income`/`expense` in
  `summary`) filters `direction IN ('income','expense')` — **transfers excluded**
  from both. The transfer **fee** is a `direction='expense'` row, so it **does**
  count in burn and Category Breakdown (this is why a fee must be categorized —
  see `findings.md` F-008).
- **Project cost** = `expense` rows with a `project_id` (inner join). Rows with no
  project are not a project cost. **Category breakdown** folds `NULL` category
  into one `Uncategorized` bucket.

## Derived figures

- **Monthly burn** = window expense ÷ month-span (calendar months in `[from,to]`,
  inclusive, floored at 1).
- **Savings rate** = `net / income` (4 dp). `null` when `income = 0` (undefined).
- **Runway months** = `liquid_balance / monthly_burn` (2 dp). `null` when burn is
  `0` ("infinite" runway).
- **Default window** (summary, when no `from`/`to`): the trailing **3 calendar
  months** ending at `to` (or today). Gives burn/runway a defined basis. Balances
  in `summary` are all-time stock, **not** windowed; only the flow figures are.
- **Balance trend** takes **no `from`**: the running total is summed from the
  earliest row (so prior periods must be present); `to` bounds the end. Slice the
  start client-side.

## Shapes

```jsonc
// Summary — money is decimal strings; savings_rate/runway_months null when undefined
{
  "from": "2026-04-01", "to": "2026-06-22",
  "current_balance": "7308500.00", "liquid_balance": "7308500.00",
  "income": "10000000.00", "expense": "2691500.00", "net": "7308500.00",
  "savings_rate": "0.7309", "monthly_burn": "897166.67", "runway_months": "8.15"
}

// CashFlowPoint
{ "period": "2026-06-01", "income": "10000000.00", "expense": "691500.00", "net": "9308500.00" }

// CategoryTotal — category_id is null for the Uncategorized bucket
{ "category_id": 1, "name": "Housing", "total": "2000000.00" }

// ProjectTotal
{ "project_id": 1, "name": "LazyScan Lite", "total": "185000.00" }

// BalancePoint — cumulative
{ "period": "2026-06-01", "balance": "7308500.00" }
```

All money is a **decimal string** at column scale (`"...00"`), consistent with
the transactions module. Derived ratios are decimal strings too (no float on the
wire): exact `big.Rat` math in the service, rounded only at the final
`FloatString`. `period` is the bucket start date (`YYYY-MM-DD`).

## sqlc note

Bare `SUM()` types as `interface{}`; every aggregate is
`COALESCE(SUM(...), 0)::numeric` so an empty set is `0` and the column is
`pgtype.Numeric`. `interval` reaches `date_trunc` as a bound parameter but is
**allowlisted in Go first** (bad → 400), so no untrusted text hits the function.

## Error mapping

| Cause | HTTP | `{"error"}` message |
|---|---|---|
| bad `from`/`to` (not `YYYY-MM-DD`) | 400 | `date must be YYYY-MM-DD` |
| bad `interval` | 400 | `interval must be day, week, or month` |
| anything else | 500 | `internal error` (logged) |

No 404, no 409, no writes — reports only read.
