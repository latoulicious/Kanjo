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
- status: resolved (→ R-005; real fix landed in transactions 2a — bad insert FK pre-validated to 400)

## F-006 WriteJSON commits status before encoding
- date: 2026-06-22
- source: CodeRabbit (`review --agent --base main`, transactions 2a pass) — reported "critical"
- severity: low (latent; pre-existing, out of scope for the transactions diff)
- location: api/internal/httpx/httpx.go:10-14
- problem: `WriteJSON` calls `w.WriteHeader(code)` before `json.NewEncoder(w).Encode(body)`, and discards the encode error with `_`. If encoding fails mid-stream the status line is already sent, so the client gets a committed status with a truncated body and no error signal. Low practical risk here — every response body is a plain DTO/struct/slice/map that does not fail to marshal — but the shape is fragile. Shared by all modules; not introduced by the transactions module (lifted in the categories/projects pass).
- status: open (deferred to a scoped httpx PR; decided with the user — out of scope for this feature)

## F-007 shutdownTimeout shorter than WriteTimeout
- date: 2026-06-22
- source: CodeRabbit (`review --agent --base main`, transactions 2a pass) — reported "minor"
- severity: low
- location: api/cmd/api/main.go:19
- problem: `shutdownTimeout` is 10s while `WriteTimeout` is 30s, so a graceful shutdown can cut off an in-flight response that the write deadline would still permit. Cosmetic for this API (responses are tiny JSON that drain well within 10s); pre-existing (set in P1, alongside R-002). Not in the transactions diff.
- status: open (deferred; decided with the user — out of scope for this feature)

## F-008 transfer fee row allows NULL category
- date: 2026-06-22
- source: CodeRabbit (`review --agent --base-commit <2a>`, transactions 2b pass)
- severity: low (design opinion, not a defect)
- location: api/internal/transaction/transfer.go:validateTransfer
- problem: review suggested `fee_category_id` should be required whenever a `fee` is provided, else the fee `expense` row is written with `category_id = NULL`. Initially declined (a null category is schema-valid and matches single-entry expenses). On review with the user: the fee is an `expense` that **does** count in monthly burn and Category Breakdown, so a null category makes every uncategorized fee silently inflate the "Uncategorized" bucket. The transfer legs themselves are `transfer` (excluded from both reports), so the fee is the only report-visible row. Re-decided as a real fix. (Secondary claim — verify `requireRef`/`toInt8` exist — was moot; both exist.)
- status: resolved (→ R-008)

## F-009 router transaction mount flagged as missing module
- date: 2026-06-22
- source: CodeRabbit (`review --agent -t uncommitted`, reports phase) — reported "critical"
- severity: low (false positive)
- location: api/internal/server/router.go:24
- problem: review claimed `transaction.NewHandler(...).Mount(mux)` references a non-existent module and would fail to compile, advising the line be deleted. Artifact of the uncommitted-only scope: the `transaction` package is committed (2a `9632cac`, 2b `f9efaa8`, fee-fix `4305a5a`) but absent from the uncommitted diff CodeRabbit saw, so it assumed the nearby line I edited was dangling. The module exists and the tree compiles. Re-running `--base main` (which includes the committed module) the finding disappears.
- status: resolved (→ R-009, wontfix)

## F-010 transfer test ignores newGroupID error
- date: 2026-06-22
- source: CodeRabbit (`review --agent --base main`, reports phase) — reported "minor"
- severity: low
- location: api/internal/transaction/transfer_test.go:53
- problem: `TestTransferRowsWithFee` does `group, _ := newGroupID()`, discarding the error, while `TestTransferRowsNoFee` checks it. A consistency nit: if `newGroupID` ever failed, the with-fee test would proceed on a zero UUID and fail confusingly downstream. Pre-existing (transactions 2b, committed `f9efaa8`); not part of the reports diff. Surfaced only because `--base main` widened scope to the whole branch.
- status: resolved (→ R-010, wontfix)

## F-011 SPA root mount uses unchecked non-null assertion
- date: 2026-06-22
- source: CodeRabbit (`review --agent -t uncommitted`, web S0 scaffold) — reported "minor"
- severity: low
- location: web/src/main.tsx:9
- problem: `createRoot(document.getElementById("root")!)` asserts the root element is non-null without checking. If `index.html` ever ships without `#root`, React throws a cryptic `Cannot read properties of null` instead of a clear message. The `#root` div is in our own `index.html` so the case is unreachable today, but the assertion hides the failure mode.
- status: resolved (→ R-011)

## F-012 badge.tsx imports Slot from "radix-ui"
- date: 2026-06-22
- source: CodeRabbit (`review --agent -t uncommitted`, web S1) — reported "critical"
- severity: low (false positive)
- location: web/src/components/ui/badge.tsx:3
- problem: review claimed `import { Slot } from "radix-ui"` is wrong and should be `@radix-ui/react-slot`, else the build fails. False positive: current shadcn uses the **unified `radix-ui` package** (v1.6.0, present in package.json), which re-exports primitives as namespaces — badge/form use `Slot.Root`, not the legacy default `Slot` from `@radix-ui/react-slot`. The advised swap would break the call. `pnpm build` resolves and compiles clean.
- status: resolved (→ R-012, wontfix)

## F-013 form.tsx useFormField guard is dead
- date: 2026-06-22
- source: CodeRabbit (`review --agent -t uncommitted`, web S1) — reported "major"
- severity: low (vendored; unreachable in our usage)
- location: web/src/components/ui/form.tsx:50
- problem: `FormFieldContext` is created with `{} as FormFieldContextValue`, an always-truthy default, so `if (!fieldContext)` never fires (and runs after `fieldContext.name` was already read on line 47). The "used outside <FormField>" error can't throw. This is upstream shadcn code copied verbatim; it only mis-degrades on developer misuse (calling `useFormField` outside a `FormField`), which the codebase never does.
- status: resolved (→ R-013, wontfix)

## F-014 unused next-themes dependency
- date: 2026-06-22
- source: CodeRabbit (`review --agent -t uncommitted`, web S1) — reported "minor"
- severity: low
- location: web/package.json:18
- problem: `next-themes` was pulled in transitively by shadcn's `sonner` component, but `sonner.tsx` was rewritten to drop it (single light theme, no next-themes). The dependency is now unused dead weight in `package.json`.
- status: resolved (→ R-014)

## F-015 alert-dialog.tsx has a "use client" directive
- date: 2026-06-22
- source: CodeRabbit (`review --agent -t uncommitted`, web S1) — reported "minor"
- severity: low (vendored; cosmetic)
- location: web/src/components/ui/alert-dialog.tsx:1
- problem: the `"use client"` directive is a Next.js App Router marker, a no-op in a Vite SPA. Cosmetic only. Shared by the other vendored shadcn primitives (dialog, table, etc.); removing it from one file alone is inconsistent churn on copied-in code.
- status: resolved (→ R-015, wontfix)

## F-016 AccountDialog edit branch not narrowed (TS strict gap)
- date: 2026-06-22
- source: CodeRabbit (`review --agent -t uncommitted`, web S1) — reported "minor"
- severity: low
- location: web/src/features/accounts/AccountDialog.tsx:65
- problem: `onSubmit` reads `account.id` inside `if (editing)`, but `editing` is a separate boolean alias so TypeScript cannot narrow the optional `account` prop through it. It compiled only because the Vite-8 scaffold left `strict` **off** in `tsconfig.app.json` (so `strictNullChecks` wasn't enforcing the access). Two defects: the unsound narrowing, and the missing strict mode that hid it.
- status: resolved (→ R-016)

## F-017 delete Cancel button enabled during pending delete
- date: 2026-06-22
- source: CodeRabbit (`review --agent -t uncommitted`, web S2) — reported "minor"
- severity: low
- location: web/src/features/shared/NameCrud.tsx:248
- problem: in the delete confirm, `AlertDialogAction` (Delete) is `disabled` while the mutation is pending but `AlertDialogCancel` is not, so a user can dismiss the dialog mid-delete — minor UX inconsistency. The same harmless pattern exists in the committed S1 `AccountsPage`.
- status: resolved (→ R-017)

## F-018 Textarea lacks React.forwardRef
- date: 2026-06-22
- source: CodeRabbit (`review --agent -t uncommitted`, web S3) — reported "major"
- severity: low (false positive under React 19)
- location: web/src/components/ui/textarea.tsx:5
- problem: review claimed the textarea must use `React.forwardRef` for form libs to attach refs. Stale for React 19: function components receive `ref` as an ordinary prop, and the component spreads `...props` (which carries `ref`) onto the `<textarea>`. The sibling `ui/input.tsx` is the identical forwardRef-less pattern and drives every form field across S1–S3 — all creates/edits passed live smokes. Vendored shadcn React-19 output.
- status: resolved (→ R-018, wontfix)

## F-019 textarea field-sizing-content lacks Firefox support
- date: 2026-06-22
- source: CodeRabbit (`review --agent -t uncommitted`, web S3) — reported "minor"
- severity: low (vendored; cosmetic)
- location: web/src/components/ui/textarea.tsx:10
- problem: the `field-sizing-content` utility (auto-grow) isn't supported in older Firefox; those users get fixed sizing. Pure progressive enhancement — `min-h-16` gives a sane fallback, and forms set `rows`. Vendored shadcn class; not worth diverging the copied-in file.
- status: resolved (→ R-019, wontfix)

## F-020 chart.tsx uses invalid Tailwind var syntax
- date: 2026-06-22
- source: CodeRabbit (`review --agent -t uncommitted`, web S4) — reported "critical"
- severity: low (false positive)
- location: web/src/components/ui/chart.tsx:223
- problem: review claimed `border-(--color-border)` / `bg-(--color-bg)` are invalid Tailwind and styles won't apply. False positive: `(--var)` is **Tailwind v4's CSS-variable shorthand** (we run tailwindcss ^4.3); v3 rules don't apply. Proven — the built CSS contains `background-color:var(--color-bg)`. Vendored shadcn-for-v4 tooltip indicator.
- status: resolved (→ R-020, wontfix)

## F-021 nginx serves no security response headers
- date: 2026-06-22
- source: CodeRabbit (`review --plain -t uncommitted`, deploy phase) — reported "major"
- severity: low (defense-in-depth; app is also edge-gated by Cloudflare Access)
- location: web/nginx.conf:1-11
- problem: the SPA edge sets no `X-Frame-Options` / `X-Content-Type-Options` / `Referrer-Policy`, leaving it open to clickjacking and MIME-sniffing on the client side.
- status: resolved (→ R-021, fixed)

## F-022 nginx /api proxy has no timeouts
- date: 2026-06-22
- source: CodeRabbit (`review --plain -t uncommitted`, deploy phase) — reported "major"
- severity: medium (availability)
- location: web/nginx.conf:15-21
- problem: the `/api/` proxy uses nginx defaults (~60s). A slow or hung API would block nginx workers, risking worker exhaustion under load.
- status: resolved (→ R-022, fixed)
