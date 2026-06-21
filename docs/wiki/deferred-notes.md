# Deferred Notes

Things consciously **not** done, with the rationale — so they are not
re-litigated every session.

## Scaffold (21-06-2026)

- **Redis** — not added. Kanjo has no cache/queue/session need at MVP; balances
  are derived on read. Add only if a real hot path measurably needs it.
- **Chi (and any router lib)** — dropped. Go 1.22+ `http.ServeMux` does
  method+path routing; stdlib covers the routing need.
- **Caddy** — dropped in favor of nginx, matching the other Atelier project
  (one edge to reason about across repos).
- **Shadcn as a dependency** — Shadcn components are copied into the repo on
  demand (`npx shadcn add …`), not installed as a package. Only the primitives
  it needs (`clsx`, `tailwind-merge`, `class-variance-authority`) are deps.
- **Code skeleton (api/ + web/)** — deferred. This scaffold pass is **docs only**
  (`docs/wiki/`); implementation starts in a later session. No `api/`, `web/`,
  compose, or migrations exist yet — the schema is designed against a real use,
  not guessed.
- **Ports** — host web bind is **8090** and the API listens on **3000**. 8080 is
  avoided: Dozzle already owns it on the VPS.
