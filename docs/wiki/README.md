# Kanjo Wiki

Centralized project wiki. Single source for principles, design, architecture,
conventions, and operational caveats.

Kanjo (勘定) is a personal financial ledger for builders, self-hosters, and
engineers — money as a resource system, not a pile of expenses.

## Structure

| Path | Purpose |
|---|---|
| `principles.md` | product philosophy, guiding principle, non-goals (from the plan) |
| `design-system.md` | palette, typography, components, information architecture |
| `architecture.md` | system overview — SPA → nginx → Go API → Postgres |
| `domain.md` | domain model (accounts / categories / transactions / projects / reports) |
| `conventions.md` | coding + commit conventions, per-language notes |
| `database.md` | schema ownership, migrations (goose), sqlc |
| `known-constraints.md` | hidden contracts + constraints (seed as they appear) |
| `troubleshooting.md` | debugging findings, operational caveats |
| `findings.md` | code-review findings log (paired with `resolutions.md`) |
| `resolutions.md` | how findings were resolved (paired with `findings.md`) |
| `nice-to-have.md` | backlog candidates |
| `approved-to-implement.md` | backlog approved in principle |
| `deferred-notes.md` | rationale for things consciously not done |
| `deploy.md` | nginx + compose + VPS runbook |
| `modules/` | per-module contracts (filled as modules settle) |
| `sessions/` | append-only session history (`DD-MM-YYYY.md`) |
| `decisions/` | architecture decision records |

## Scope (MVP)

In: dashboard, ledger, accounts, categories, projects, reports.
Out: bank sync, OCR, receipt scanning, AI, investment tracking, budgeting
systems, multi-user, PWA, mobile app. See `principles.md` for non-goals.

> Doc rule (from root `AGENTS.md`): code is source of truth; note drift, keep
> notes concise, append session history — never overwrite it.
