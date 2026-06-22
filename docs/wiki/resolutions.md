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

## R-012 badge Slot import finding declined  (resolves F-012)
- date: 2026-06-22
- change: wontfix — no code change. Confirmed false positive: shadcn's current
  output imports primitives from the **unified `radix-ui`** package (v1.6.0, in
  `package.json`) and uses `Slot.Root`; the advised `@radix-ui/react-slot` default
  import would not match the `Slot.Root` usage and would break the build. The tree
  builds and types clean as-is. Decided with the user.
- files: —
- verification: `pnpm build` (tsc + vite) green with `import { Slot } from "radix-ui"`.
- constraints honored: don't modify working vendored code; no unrelated churn.

## R-013 form.tsx dead-guard left as vendored  (resolves F-013)
- date: 2026-06-22
- change: wontfix — no code change. `ui/form.tsx` is shadcn copied in verbatim
  (`conventions.md`: primitives are vendored, not a dependency); the ineffective
  `if (!fieldContext)` guard ships this way upstream and only fails to throw on
  misuse (calling `useFormField` outside `<FormField>`) that this codebase never
  does. Patching a vendored file would drift it from any future `shadcn add` regen
  for no functional gain. Decided with the user.
- files: —
- verification: all forms use `FormField`/`useFormField` correctly; the guard path
  is unreachable in our code.
- constraints honored: no patching of vendored upstream cosmetics; sibling
  primitives untouched.

## R-014 remove unused next-themes  (resolves F-014)
- date: 2026-06-22
- change: `pnpm remove next-themes`. The dep was only needed by shadcn's stock
  `sonner.tsx`, which was rewritten to a single light theme (no `useTheme`); the
  package is now unreferenced. Drops it from `package.json` + lockfile.
- files: web/package.json, web/pnpm-lock.yaml
- verification: `grep` shows no `next-themes` import in `src`; `pnpm build` +
  `pnpm lint` green after removal.
- constraints honored: smallest change; removes dead weight only, no behavior
  change.

## R-015 alert-dialog "use client" left as vendored  (resolves F-015)
- date: 2026-06-22
- change: wontfix — no code change. The `"use client"` directive is a harmless
  no-op in a Vite SPA and is present across all vendored shadcn primitives; editing
  one file alone is inconsistent cleanup on copied-in code. Decided with the user.
- files: —
- verification: build/lint green; directive has no runtime effect under Vite.
- constraints honored: no selective churn on vendored primitives.

## R-016 narrow AccountDialog + enable TS strict  (resolves F-016)
- date: 2026-06-22
- change: two parts. (1) `onSubmit` now branches on `if (account)` instead of the
  `editing` boolean alias, so TypeScript soundly narrows the optional prop before
  `account.id`. (2) Enabled `"strict": true` in `tsconfig.app.json` — the Vite-8
  scaffold had omitted it, which is why the unsound access compiled. Strict is the
  real fix; the narrowing is what strict then requires. Decided with the user
  (strict mode was a parallel find, beyond the CodeRabbit report).
- files: web/src/features/accounts/AccountDialog.tsx, web/tsconfig.app.json
- verification: `pnpm build` (tsc -b with strict) green — the whole tree, incl.
  vendored ui and the accounts feature, type-checks under strict with no other
  errors surfaced; `pnpm lint` clean.
- constraints honored: smallest safe change; strict tightens the foundation
  (money-app null safety) without altering runtime behavior; no public contract
  touched.

## R-017 disable delete Cancel while pending  (resolves F-017)
- date: 2026-06-22
- change: added `disabled={remove.isPending}` to `AlertDialogCancel` in
  `NameCrud`, matching the Delete action so the confirm can't be dismissed mid
  mutation. Scoped to the in-scope S2 file only; the identical nit in the committed
  S1 `AccountsPage` was left untouched to avoid mixing a fix into an unrelated
  feature diff (AGENTS no-mixing rule) — flagged for a future sweep. Decided with
  the user.
- files: web/src/features/shared/NameCrud.tsx
- verification: `pnpm build` + `pnpm lint` green.
- constraints honored: smallest change (one prop); no contract change; deliberately
  did not touch committed sibling code.

## R-018 Textarea forwardRef finding declined  (resolves F-018)
- date: 2026-06-22
- change: wontfix — no code change. Under React 19 `ref` is a normal prop; the
  vendored textarea spreads `...props` (incl. `ref`) onto the element, and the
  identical forwardRef-less `ui/input.tsx` powers every form field that passed the
  S1–S3 live smokes. Adding `forwardRef` would diverge the vendored file from
  shadcn's React-19 output (and from `input.tsx`) for no functional gain. Decided
  with the user.
- files: —
- verification: `pnpm build`/`pnpm lint` green; forms submit (description field
  uses this textarea) in the S3 smoke.
- constraints honored: no patching of vendored upstream code; consistent with
  R-013/R-015.

## R-019 textarea field-sizing finding declined  (resolves F-019)
- date: 2026-06-22
- change: wontfix — no code change. `field-sizing-content` is progressive
  enhancement; the `min-h-16` class and form `rows` give a sane fixed fallback
  where unsupported. Vendored shadcn utility; editing it is inconsistent churn on
  copied-in code. Decided with the user.
- files: —
- verification: textarea renders and accepts input regardless of auto-grow support.
- constraints honored: no selective churn on vendored primitives.

## R-020 chart var-syntax finding declined  (resolves F-020)
- date: 2026-06-22
- change: wontfix — no code change. `bg-(--color-bg)` / `border-(--color-border)`
  are Tailwind v4 CSS-variable shorthand (project runs tailwindcss ^4.3), not the
  invalid-in-v3 syntax CodeRabbit assumed. Verified the built CSS emits
  `background-color:var(--color-bg)`, so the rule compiles and applies. The file is
  vendored shadcn v4 output; rewriting to `bg-[var(--…)]` would diverge it for an
  identical result. Decided with the user.
- files: —
- verification: `grep` of `dist/assets/*.css` shows the compiled
  `background-color:var(--color-bg)` rule; `pnpm build` green.
- constraints honored: no patching of valid vendored code; consistent with R-012.

## R-021 add nginx security headers  (resolves F-021)
- date: 2026-06-22
- change: added `X-Frame-Options: SAMEORIGIN`, `X-Content-Type-Options: nosniff`,
  `Referrer-Policy: strict-origin-when-cross-origin` (all `always`) at server level
  in `web/nginx.conf`. Declined CodeRabbit's `X-XSS-Protection` (deprecated; modern
  browsers ignore it, guidance is to omit or send `0`) and its CSP suggestion
  (a strict CSP needs testing against Recharts/Radix inline styles — deferred to a
  dedicated hardening pass, not blind-added here).
- files: web/nginx.conf
- verification: `nginx -t` clean in the built image (re-review below); headers are
  static directives.
- constraints honored: smallest safe change; deferred the CSP rather than risk
  breaking the SPA.

## R-022 add nginx /api proxy timeouts  (resolves F-022)
- date: 2026-06-22
- change: added `proxy_connect_timeout 5s`, `proxy_send_timeout 30s`,
  `proxy_read_timeout 30s` to the `/api/` location in `web/nginx.conf` — matches the
  API's own 30s read/write `http.Server` timeouts so the edge fails fast instead of
  parking workers for 60s.
- files: web/nginx.conf
- verification: clean CodeRabbit re-review (below); validated by `docker compose`
  smoke (web nginx starts, `/api/v1/accounts` proxied 200).
- constraints honored: timeouts aligned to the existing server-side budget, no new
  behavior.

## R-023 sheet.tsx radix-ui import finding declined  (resolves F-023)
- date: 2026-06-22
- change: wontfix — no code change. `from "radix-ui"` is the unified-package
  convention used by every other vendored shadcn primitive in the repo and recorded
  since S1 ("radix-ui unified package is now a dependency — shadcn's current
  convention"). CodeRabbit applied the legacy per-package `@radix-ui/react-*` path,
  which is not a dependency here; switching to it would break the build. Decided
  with the user.
- files: —
- verification: `web/package.json` lists `"radix-ui": "^1.6.0"`; `pnpm build` green
  with the current import; sibling `dialog.tsx:5` uses the identical pattern.
- constraints honored: no patching of valid vendored code; consistent with R-020.
