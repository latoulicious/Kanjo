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
