# Resolutions

How findings were resolved. Paired with [`findings.md`](findings.md) — each entry
resolves a specific finding and must reference it; neither file is orphaned.

Format per resolution:

```md
## R-NNN <short title>  (resolves F-NNN)
- date:
- change: <what was done>
- files:
- verification: <how it was confirmed>
- constraints honored: <Do-Not rules respected>
```

## R-001 PORT range-check declined  (resolves F-001)
- date: 2026-06-21
- change: wontfix — no code change. An out-of-range port already fails fast at bind: `ListenAndServe` surfaces the error via `serveErr` and `run()` exits non-zero. A range-check would duplicate that with no added safety. Matches Atelier image-svc/mail-svc (numeric-only).
- files: —
- verification: existing boot path already errors on an unbindable port.
- constraints honored: smallest safe change; follows codebase convention; no public contract touched.

## R-002 http.Server Read/Write timeouts added  (resolves F-002)
- date: 2026-06-21
- change: set `ReadTimeout=30s` and `WriteTimeout=30s` alongside the existing `ReadHeaderTimeout`/`IdleTimeout`. Forward-cover for `POST /api/v1` routes; `ReadHeaderTimeout` already mitigated slow-header (Slowloris).
- files: api/cmd/api/main.go
- verification: `go build ./...` and `go vet ./...` clean.
- constraints honored: isolated to server wiring; no public contract change; no unrelated cleanup.
