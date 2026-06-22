# ADR-0002: Migrations run at API boot

- date: 2026-06-21
- status: accepted

## Context

P1 deliberately booted the API without a live DB (lazy pgxpool; `/health`
reports reachability). `known-constraints.md` and `database.md` say migrations
are owned by the API and run at boot. P2 adds the first schema; the two positions
conflict on whether boot may proceed without a DB.

## Decision

The API applies migrations at boot. Migrations are embedded (`//go:embed` in
`api/migrations`) and run by `store.Migrate` (goose over a short-lived
`database/sql` connection) before the HTTP server listens. `store.Migrate` first
waits up to 30s for the DB to answer (covers a just-restarted shared-postgres),
then migrates. A fresh database self-migrates; a still-unreachable or
un-migratable DB fails boot (exit non-zero).

## Consequences

- **Supersedes P1's boot-without-DB behavior**: the API now requires a reachable
  DB at startup. Deploy/orchestration must order the DB before the API (or accept
  the API crash-looping until the DB is up).
- `/health` is unchanged and still reports runtime DB state — the DB can drop
  after a successful boot.
- goose is a library dependency; its CLI is optional. The single-statement SQL
  needs no `-- +goose StatementBegin` wrappers.
- The pgx pool stays lazy (`store.Open` does not ping); migration is the boot-time
  DB gate, not the pool.
