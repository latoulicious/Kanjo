# Domain

Single-user personal ledger. Money is modeled as resources flowing between
accounts, classified by category, and optionally attributed to a project.

## Aggregates

- **Account** — a place money sits (BCA, Jago, Cash, Emergency Fund,
  Investments). Has a running balance derived from its transactions.
- **Category** — an operational bucket spending is classified into (Housing,
  Food, Transportation, Infrastructure, Projects, Hobbies, Healthcare).
- **Transaction** — one ledger entry: `date, description, amount, account,
  category, project?, tags[]`. The atomic unit; everything (balance, burn,
  reports) is derived from transactions.
- **Project** — an initiative that can own transactions, so its total cost is
  visible (e.g. *LazyScan Lite*: VPS + Domain + SMTP, Rp 185,000/mo).

## Derived views (not stored)

Computed from transactions; never incremented in place:

- **Current Balance** — sum across accounts.
- **Monthly Burn** — expense outflow per month.
- **Savings Rate** — (income − expense) / income.
- **Runway** — liquid balance / monthly burn.
- **Reports** — Cash Flow, Burn Rate, Category Breakdown, Balance Trend, Project
  Cost Breakdown.

## Amounts & sign

Amounts are `NUMERIC(18,2)`, single currency (IDR), always positive. A
transaction's `direction` (`income`/`expense`/`transfer`) classifies it for
reports; `is_inflow` carries the balance sign. Transfers are two grouped
`transfer` rows plus an optional fee row. Full conventions: `database.md`.
