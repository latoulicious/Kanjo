# Deploy

Single-origin edge (nginx) → 3-container stack on a VPS, one Cloudflare Tunnel
hostname. Operator steps — handles **real secrets**; `.env` is git-ignored,
never commit it.

> **Drift — superseded by [ADR-0001](decisions/0001-postgres-shared-instance.md).**
> Postgres is the **external shared `shared-postgres`** instance (network
> `shared-db`), not a bundled container — so the live stack is **2 containers**
> (web + api), and `POSTGRES_PASSWORD` below does not apply. This runbook is
> rewritten when the deploy phase lands.

## Topology

```
Cloudflare Tunnel (kanjo hostname) → 127.0.0.1:8090 (web/nginx)
  /          → SPA
  /api/v1/*  → api:3000   (single origin, no CORS, same-site)
  /health    → api:3000   (ops; unlogged)
```

> Host port is **8090**, not 8080 — 8080 is taken by Dozzle on the VPS. The API
> listens on **3000** inside the container network.

## 1. VPS

```bash
ssh <vps>
apt update && apt install -y docker.io docker-compose-v2
git clone https://github.com/latoulicious/kanjo /opt/kanjo && cd /opt/kanjo
cp .env.example .env && nano .env      # fill real secrets
docker compose up -d --build
docker compose logs -f
```

`.env` must set at least `POSTGRES_PASSWORD` (and a matching `DATABASE_URL`).

## 2. Cloudflare Tunnel

One public hostname → `http://127.0.0.1:8090` (web). Bind the web port to
loopback so only the tunnel reaches it.

## 3. Acceptance

- [ ] `docker compose ps` → all 3 up; postgres healthy.
- [ ] Hostname serves the SPA; `…/health` returns JSON (not SPA HTML).
- [ ] `…/api/v1/...` reaches the API (once real routes exist).

> Placeholder runbook — flesh out (migrations on deploy, backups) as the app
> grows past the skeleton.
