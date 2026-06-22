# Architecture

Kanjo is a single-user, self-hosted ledger. No async pipeline, no message
broker — a SPA talking to one Go API over Postgres. Deliberately boring.

```txt
            Cloudflare Tunnel (one hostname)
                       │
                  web (nginx)        ← serves the SPA + proxies /api → api:3000
                       │
                  api (Go, net/http) ── REST under /api/v1; /health at root
                       │
                  Postgres            ← system of record
```

## Components

- **web** (React + Vite, served by nginx) — SPA: dashboard, ledger, accounts,
  categories, projects, reports. nginx serves the built assets and proxies `/api`
  to the API (single origin, no CORS). Data fetching via TanStack Query.
- **api** (Go, stdlib `net/http`) — REST API. Thin handlers → services →
  store (sqlc over pgx). Owns DB migrations (goose). Business routes under
  `/api/v1`; `/health` stays at root, unversioned.
- **postgres** — system of record. All money state lives here.

## Stack

| Layer | Tech |
|---|---|
| web | React, TypeScript, Vite, React Router, TanStack Query, Shadcn UI, Lucide, React Hook Form, Zod, Recharts |
| api | Go, `net/http` (stdlib), PostgreSQL, sqlc, goose |
| infra | Docker, nginx, VPS |

## Deliberate exclusions

Redis, Caddy, Chi, workers, OCR/AI — none are present. Routing is stdlib
`http.ServeMux` (Go 1.22+ method+path patterns); the edge is nginx (consistency
with the other Atelier project). Revisit only when a concrete need argues
otherwise — see `principles.md` non-goals and `deferred-notes.md`.
