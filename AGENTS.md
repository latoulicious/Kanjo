# Project Agent Instructions

You are working inside **Kanjo** (勘定) — a personal financial ledger for builders
and self-hosters. Money is modeled as a resource system, not a pile of expenses.
Product spine: [`docs/wiki/principles.md`](docs/wiki/principles.md).

Your primary role:

- understand the existing codebase before changing it
- implement features safely, in small reviewable diffs
- debug issues
- perform targeted refactors
- keep architecture and docs consistent

Do not generate code from prompt context alone. Always inspect existing
implementation first.

Prioritize **correctness, maintainability, readability, operational safety, small
reviewable diffs** over theoretical purity, unnecessary abstractions, or broad
rewrites.

---

# Repository Layout (planned)

The repo is **docs-first**: only `docs/wiki/` exists today. Code is scaffolded in
a later session.

| Path | Service | Stack | Notes |
|---|---|---|---|
| `web/` (planned) | Web | React + Vite (TS) → nginx | SPA; serves built assets, proxies `/api` to the API |
| `api/` (planned) | API | Go, stdlib `net/http` | REST under `/api/v1`; owns goose migrations; sqlc over pgx |
| `docs/wiki/` | Docs | Markdown | principles, design system, architecture, conventions |

Stack detail: [`docs/wiki/architecture.md`](docs/wiki/architecture.md). Ports: web
host bind **8090**, API **3000** (8080 is Dozzle's on the VPS).

---

# Project Wiki

Documentation lives in `docs/wiki`. Read relevant docs before significant work.

```txt
docs/wiki/
  README.md              index
  principles.md          philosophy, guiding principle, non-goals
  design-system.md       palette, typography, components, IA
  architecture.md        SPA → nginx → Go API → Postgres
  conventions.md         coding + commit conventions
  database.md            schema ownership, goose migrations, sqlc
  domain.md              accounts / categories / transactions / projects / reports
  known-constraints.md   hidden contracts + constraints
  troubleshooting.md     debugging findings, operational caveats
  findings.md            code-review findings (paired with resolutions.md)
  resolutions.md         fixes for findings (same IDs, never orphaned)
  modules/               per-module contracts
  sessions/              append-only session history (DD-MM-YYYY.md)
  decisions/             architecture decision records
```

If documentation conflicts with implementation: **treat code as source of truth**
and note the drift.

---

# Session Logging

After meaningful changes, append (never overwrite) an entry to
`docs/wiki/sessions/DD-MM-YYYY.md`:

```md
---
time: 08:42 PM
type: feature|fix|refactor|investigation
breaking_change: false
modules:
  - example-module
---

# Summary
# Files Touched
# Previous Behavior
# New Behavior
# Reason For Change
# Risks
# Notes
```

---

# Before Writing Code

1. inspect surrounding code
2. identify existing patterns
3. identify affected modules
4. identify hidden contracts
5. identify rollback risk
6. prefer the smallest safe implementation

Do not assume current behavior is accidental — "ugly" code may exist for
operational reasons. Confirm before changing it.

---

# Change Safety Rules

Do NOT modify unless explicitly required: response/DTO formats, auth behavior,
migration history, public API contracts. Do not mix cleanup, formatting,
refactors, and behavior changes in one diff. If a breaking change seems
necessary: explain why, explain the risks, and wait for approval.

Review findings are logged in `docs/wiki/findings.md` and their fixes in
`docs/wiki/resolutions.md`, paired by ID (`F-NNN` ↔ `R-NNN`) — never orphaned.

---

# Commits

Subject-only Conventional Commits (`type: summary`). No body unless the "why" is
non-obvious. No `Co-Authored-By`, no phase tokens. (Atelier-wide standard.)
