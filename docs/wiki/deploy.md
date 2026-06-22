# Deploy

Single-origin edge (nginx) → **2-container** stack on a VPS, behind one
Cloudflare Tunnel hostname. Operator steps — handles **real secrets**; `.env` is
git-ignored, never commit it.

Postgres is the **external shared `shared-postgres`** instance (network
`shared-db`), not a bundled container ([ADR-0001](decisions/0001-postgres-shared-instance.md)).
Migrations run at API boot ([ADR-0002](decisions/0002-migrations-at-boot.md)).

## Topology

```
Cloudflare Tunnel (kanjo.sanctuary.my.id) → 127.0.0.1:8090 (web/nginx)
  /          → SPA (static)
  /api/v1/*  → api:3000   (single origin, no CORS, same-site)
  /health    → api:3000   (ops)
api:3000 → shared-postgres:5432  (over the external `shared-db` network)
```

Host port is **8090** (loopback-only) — 8080 is Dozzle's on the VPS. The API
listens on **3000** inside the container network.

## Artifacts

| File | Role |
|---|---|
| `api/Dockerfile` | multi-stage → static binary on `scratch` (migrations embedded) |
| `web/Dockerfile` | pnpm build → nginx serving `dist` + proxying the API |
| `web/nginx.conf` | SPA fallback + `/api/`,`/health` → `api:3000` |
| `compose.yaml` | `web` + `api`, external `shared-db` network, `.env` |
| `.env.example` | `DATABASE_URL`, `PORT` template |

## 1. Prerequisites (on the VPS, once)

The shared Postgres must already have Kanjo's dedicated db + role (migrations
create the *tables*, not the db/role):

```sql
-- as a superuser on shared-postgres
CREATE ROLE kanjo LOGIN PASSWORD '<strong-pw>';
CREATE DATABASE kanjo OWNER kanjo;
```

Confirm the external network exists (owned by the shared-postgres stack):

```bash
docker network ls | grep shared-db    # create only if truly absent: docker network create shared-db
```

## 2. Bring up the stack

```bash
git clone https://github.com/latoulicious/kanjo /opt/kanjo && cd /opt/kanjo
cp .env.example .env && nano .env      # set DATABASE_URL password to match the role above
docker compose up -d --build
docker compose logs -f                 # api logs "migrations up to date" then "api listening"
```

`web` binds **`127.0.0.1:8090`** only — the tunnel is the sole public path in.

## 3. Cloudflare Tunnel (existing local `vps` tunnel)

The VPS already runs one locally-configured `cloudflared` service for other
projects. **Do not** add a second service or migrate the tunnel — add Kanjo as a
new ingress rule and one DNS route:

```yaml
# /etc/cloudflared/config.yml — add above the catch-all
ingress:
  # ... existing projects ...
  - hostname: kanjo.sanctuary.my.id
    service: http://127.0.0.1:8090
  - service: http_status:404          # keep last
```

```bash
cloudflared tunnel route dns vps kanjo.sanctuary.my.id
sudo cloudflared tunnel ingress validate
sudo systemctl restart cloudflared
```

## 4. Access gate (Cloudflare Zero Trust)

No app-level auth — the hostname is gated at the edge. Zero Trust → **Access →
Applications → Self-hosted**:

- Public hostname `kanjo.sanctuary.my.id` (path blank → covers SPA + `/api/v1` + `/health`)
- Policy `owner`: Action **Allow**, Include → Emails → the owner's email
- Identity: One-time PIN (zero setup) or Google/GitHub SSO

Gates `/health` too; the SPA's HealthBadge still works (same-origin cookie). An
external uptime monitor would need an Access **service token** — add only if needed.

## 5. Acceptance

- [ ] `docker compose ps` → `api` + `web` up; api log shows migrations applied.
- [ ] `curl -sS localhost:8090/health` on the VPS → `{"status":"ok","db":"up"}`.
- [ ] `https://kanjo.sanctuary.my.id` → CF Access login → SPA loads.
- [ ] `…/api/v1/accounts` returns JSON (through Access, in the browser).

## Updating

```bash
cd /opt/kanjo && git pull && docker compose up -d --build
```

Migrations apply automatically at api boot. Single replica, so no migrate-race
concern (see [deferred-notes](deferred-notes.md)).
