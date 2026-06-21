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

> Seed real constraints here as they surface (amount/sign conventions, unique
> keys, enum CHECK constraints). Empty sections are fine until then.
