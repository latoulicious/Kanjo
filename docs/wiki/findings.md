# Findings

Code-review findings log. Paired with [`resolutions.md`](resolutions.md) — every
finding that gets fixed must have a matching resolution entry; the two are
interconnected and must not be orphaned.

Format per finding:

```md
## F-NNN <short title>
- date:
- source: <review tool / PR / manual>
- severity: low | medium | high
- location: path:line
- problem:
- status: open | resolved (→ R-NNN)
```

## F-001 PORT not range-checked
- date: 2026-06-21
- source: CodeRabbit (`review --agent --base main`)
- severity: low
- location: api/internal/config/config.go:21
- problem: PORT validated numeric only, not 1..65535. A value like `99999` passes config validation though it is not a bindable port.
- status: resolved (→ R-001, wontfix)

## F-002 http.Server missing Read/Write timeouts
- date: 2026-06-21
- source: CodeRabbit (`review --agent --base main`)
- severity: low
- location: api/cmd/api/main.go:46
- problem: ReadTimeout and WriteTimeout unset; a slow client could hold a connection. ReadHeaderTimeout + IdleTimeout are set (matches Atelier image-svc/mail-svc).
- status: resolved (→ R-002)

## F-003 session entry missing "Previous Behavior"
- date: 2026-06-21
- source: CodeRabbit (`review --agent --base main`, P2)
- severity: low (minor)
- location: docs/wiki/sessions/21-06-2026.md:1-61
- problem: the historical 04:37 PM entry (docs-only scaffold) omits the "Previous Behavior" section the AGENTS template lists. Pre-existing, outside the P2 diff.
- status: resolved (→ R-003, wontfix)

## F-004 go.mod pgx version flagged unresolvable
- date: 2026-06-21
- source: CodeRabbit (`review --agent --base main`, accounts module) — reported "critical"
- severity: low (false positive)
- location: api/go.mod:3 (require github.com/jackc/pgx/v5 v5.10.0)
- problem: review claimed v5.10.0 cannot be resolved and advised downgrading to v5.9.1. v5.10.0 is in fact the latest published version (`go list -m -versions` → … v5.9.2 v5.10.0), resolves from the proxy, builds clean, and was live-tested this session. go.mod is unchanged by this pass (committed in the prior P2). Stale model knowledge, not a real defect.
- status: resolved (→ R-004, wontfix)

## F-005 store.Classify maps every 23503 to ErrInUse
- date: 2026-06-21
- source: CodeRabbit (`review --agent --base main`, accounts module)
- severity: medium (latent; not triggered by accounts)
- location: api/internal/store/errors.go:29-30
- problem: `Classify` maps Postgres `23503` (foreign_key_violation) unconditionally to `ErrInUse` → 409 "in use". Correct for parent delete-restrict, but a child INSERT/UPDATE with a bad FK also raises `23503` and would surface the wrong "in use" message instead of a 400/404-style "bad reference". The accounts module has no outbound FK on write, so the wrong path is unreachable today; it becomes reachable with the transactions module (`account_id`/`category_id`/`project_id`).
- status: resolved (→ R-005)
