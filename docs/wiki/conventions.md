# Conventions

Authoritative agent rules: root [`AGENTS.md`](../../AGENTS.md). This file holds
project-specific conventions; populate as patterns settle.

## Languages

- **api** — Go. Routing is stdlib `net/http` (`http.ServeMux`, Go 1.22+
  method+path patterns) — no Chi. Thin handlers → services → store. Persistence
  via sqlc (generated) over pgx. Logging is stdlib `log/slog`. Keep handlers
  free of business logic; keep the store free of HTTP.
- **web** — React + TypeScript (Vite). Data fetching through TanStack Query;
  forms with React Hook Form + Zod; charts with Recharts; icons with Lucide; UI
  primitives from Shadcn (copied in, not a dependency). Design tokens live in
  `tailwind.config.ts` / `index.css` and mirror `design-system.md`.

## Commits

Subject-only Conventional Commits (`type: summary`). No body unless the "why"
is non-obvious, no `Co-Authored-By`, no phase tokens. (Atelier-wide standard.)

## Docs

- Code is source of truth; note drift rather than trusting stale docs.
- Append session history to `sessions/DD-MM-YYYY.md` — never overwrite.
- Keep notes concise and operational; no speculative documentation.
- Review findings go in `findings.md`; their fixes in `resolutions.md` — paired
  by ID (`F-NNN` ↔ `R-NNN`), never orphaned.
