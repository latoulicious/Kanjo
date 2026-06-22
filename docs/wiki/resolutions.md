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

## R-003 "Previous Behavior" backfill declined  (resolves F-003)
- date: 2026-06-21
- change: wontfix — no edit. The flagged entry is a docs-only scaffold where "Previous Behavior" is genuinely N/A (no code existed), and session logs are append-only (`AGENTS.md`: never overwrite) — backfilling a past entry rewrites history. Decided with the user. The P2 entry itself carries every required section.
- files: —
- verification: P2 session entry reviewed against the AGENTS template — complete.
- constraints honored: respects the append-only session rule; no history rewritten.

## R-004 pgx v5.10.0 downgrade declined  (resolves F-004)
- date: 2026-06-21
- change: wontfix — no code change. Confirmed false positive: `go list -m -versions github.com/jackc/pgx/v5` lists v5.10.0 as the newest tag and `go list -m` resolves it; build/vet/test clean and the binary ran live against `kanjo-local`. Downgrading a working, already-committed dependency with no functional cause would be an unrequested change. Decided with the user.
- files: —
- verification: `go list -m github.com/jackc/pgx/v5` → v5.10.0; `go build`/`go vet`/`go test` clean; live CRUD smoke green.
- constraints honored: don't modify unless required; no unrelated dependency churn.

## R-005 document 23503 delete-restrict contract  (resolves F-005)
- date: 2026-06-21
- change: comment-only, no behavior change. Documented in `store.Classify` that the `23503`→`ErrInUse` mapping is correct only while the sole FK exposure is parent delete (accounts/categories/projects), and that child inserts (transactions) must either pre-validate FKs in the service or split the sentinel. Deferred the real distinction to the transactions module (YAGNI: no current caller hits the INSERT/UPDATE path). Decided with the user.
- files: api/internal/store/errors.go
- verification: `go build`/`go vet`/`go test` clean; accounts CRUD smoke unchanged (no write path raises 23503 except delete-restrict, still → 409 in-use).
- constraints honored: smallest safe change; no public contract change; no speculative code; deferral recorded so it isn't orphaned.
- follow-up (2026-06-21, transactions 2a): the deferred real fix landed. The
  transactions service **pre-validates** `account_id`/`category_id`/`project_id`
  (reusing the generated `Get*` queries) before insert, so a bad reference is a
  **400**, never the parent-delete `ErrInUse` 409. `store.Classify`'s
  23503→`ErrInUse` mapping is left untouched (still correct for delete-restrict);
  the chosen branch keeps the blast radius inside the new module. Live-verified:
  bad account/category/project FK on POST → 400. See `modules/transactions.md`.

## R-008 require fee_category_id when a fee is set  (resolves F-008)
- date: 2026-06-22
- change: `validateTransfer` now rejects a transfer that carries a `fee` without a
  `fee_category_id` (new sentinel `ErrFeeCategoryRequired` → 400; mapped in the
  handler's 400 case). No fee ⇒ still not required. Reverses the initial wontfix
  after the user flagged that an uncategorized fee silently inflates the
  "Uncategorized" bucket in burn/Category Breakdown (the fee is the only
  report-visible row of a transfer — the legs are `transfer`, excluded from both
  reports). The lone, deliberate divergence from single-entry expenses, which
  still allow a null category.
- files: api/internal/transaction/transfer.go, handler.go;
  docs/wiki/modules/transactions.md
- verification: `go build`/`go vet`/`go test ./...` clean; live smoke — transfer
  with `fee` and no `fee_category_id` → 400 `fee_category_id is required when a fee
  is set`; with a valid `fee_category_id` → 201 and the fee row carries the
  category; no-fee transfer unaffected.
- constraints honored: smallest change (one guard + sentinel); contract change is
  the explicit fix, decided with the user; `store.Classify` + sibling modules
  untouched.

## R-009 router missing-module finding declined  (resolves F-009)
- date: 2026-06-22
- change: wontfix — no code change. Confirmed false positive: the `transaction`
  module is committed and the tree builds. The flag came from CodeRabbit's
  uncommitted-only scope not seeing the committed package; a `--base main` re-run
  (which includes it) produced the finding no more. Deleting the mount line as
  advised would break a working, live-tested route group. Decided with the user.
- files: —
- verification: `go build ./...` and `go test ./...` clean this session; reports
  live smoke green; `coderabbit review --agent --base main` — F-009 absent.
- constraints honored: don't modify unless required; no public contract change; no
  unrelated churn.

## R-010 transfer-test error check declined  (resolves F-010)
- date: 2026-06-22
- change: wontfix — no code change. The ignored `newGroupID()` error is a test-only
  consistency nit in already-committed transactions 2b code, outside the reports
  diff. AGENTS forbids mixing unrelated cleanup into a feature diff, so it is not
  fixed here; left wontfix rather than deferred-open because the risk is negligible
  (`newGroupID` reads `crypto/rand`, effectively never fails in test). Decided with
  the user. May be tidied in a future scoped transactions-test pass.
- files: —
- verification: `go test ./...` clean (test passes today regardless); finding is
  test-quality only, no runtime impact.
- constraints honored: no unrelated cleanup in the feature diff; smallest safe
  action; sibling modules untouched.

## R-011 guard the SPA root element  (resolves F-011)
- date: 2026-06-22
- change: replaced the non-null assertion with a checked lookup — `main.tsx` now
  reads `getElementById("root")` into a const and throws
  `root element #root not found in index.html` when absent, before `createRoot`.
  Swaps React's cryptic null deref for a descriptive boot error. Decided with the
  user (fix over wontfix — trivial and clearer).
- files: web/src/main.tsx
- verification: `pnpm build` (tsc + vite) green; `pnpm lint` clean; dev server
  still mounts the SPA.
- constraints honored: smallest change (2 lines, no behavior change on the happy
  path); no public contract touched; no unrelated cleanup.
