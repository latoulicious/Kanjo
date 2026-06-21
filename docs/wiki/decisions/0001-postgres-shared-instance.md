# ADR-0001: Postgres on the shared instance

- date: 2026-06-21
- status: accepted

## Context

Kanjo deploys to a VPS that already runs a shared Postgres (`shared-postgres`),
owned by another Atelier stack (the discord-bot instance) and reachable over an
external Docker network `shared-db`. The Lazyscan stack already targets it this
way (its `.env.example` and `docker-compose.yml`).

## Decision

Kanjo uses the shared `shared-postgres` instance — it does **not** ship its own
postgres container. Isolation is by a dedicated database + role:
`postgres://kanjo:<pw>@shared-postgres:5432/kanjo`. Migrations (goose, owned by
the API) create Kanjo's tables inside that database; no schema / `search_path`
tricks. The compose stack joins the external `shared-db` network and
`DATABASE_URL` is fully env-driven (per env points at its own db+role).

## Consequences

- Deploy is **2 containers** (web + api), not 3 — `deploy.md`'s 3-container
  stack and its `POSTGRES_PASSWORD` step are superseded; reconcile when the
  deploy phase lands.
- API code is unchanged: `store.Open` already takes an env DSN, so the P1
  skeleton is shared-server-ready. Per-env isolation is a deploy concern
  (separate db+role), not app code.
- Backups and retention belong to the shared instance's owner, coordinated
  out-of-band — not Kanjo's compose.
