# Known Constraints

Hidden contracts and constraints that are not obvious from a single file. Code is
the source of truth — note drift here rather than trusting this doc blindly.

## Cross-cutting

- **Migrations are owned by the API.** They run at API boot (or goose CLI); the
  schema is the source for sqlc generation. Don't hand-edit generated store code.
- **Derived, never incremented.** Balances, monthly burn, savings rate, runway,
  and every report are computed from `transactions` rows. Do not cache them as
  mutable counters — recomputing is the correctness guarantee.
- **Business routes are versioned under `/api/v1`.** Ops endpoints (`/health`)
  stay at root, unversioned. nginx proxies the `/api` prefix; adding routes
  needs no nginx change.
- **Single origin, no CORS.** nginx serves the SPA and proxies `/api` to the API
  from the same hostname. The API is not designed to be called cross-origin.

## Ledger schema

- **Amounts are positive `NUMERIC(18,2)`; the sign lives in `is_inflow`.** Never
  read `amount` as signed. `balance(account) = Σ ±amount by is_inflow`.
- **`direction` classifies, `is_inflow` signs.** Reports filter by `direction`
  (burn = `expense`, income = `income`, transfers excluded from both). A CHECK
  ties income⇒inflow and expense⇒outflow; a transfer leg is either.
- **Transfers are grouped rows balanced in the app.** Two `transfer` rows (plus
  an optional `expense` fee row) share `transfer_group_id`; the out==in invariant
  is enforced by the service writing them in one tx, not by the DB.
- **Account deletes are RESTRICTed; category/project deletes SET NULL on
  transactions.** Deleting an account with history fails by design.
- **Single currency (IDR).** No currency column — multi-currency is a non-goal.

## Boot

- **Migrations run at API boot and are mandatory.** `store.Migrate` (embedded
  goose) waits up to 30s for the DB, applies, then serves; a still-unreachable DB
  fails boot.
  Supersedes the P1 "boots without a live DB" note — see
  [ADR-0002](decisions/0002-migrations-at-boot.md). `/health` still reports
  runtime DB state (it can drop after boot).
