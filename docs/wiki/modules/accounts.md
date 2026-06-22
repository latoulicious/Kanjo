# Module: accounts

First business module and the reference for the layering: **thin handler →
service → store (sqlc over pgx)**. Replicate this shape for categories /
projects; transactions is its own (more complex) module.

## Layers

| File | Role |
|---|---|
| `api/internal/store/queries/accounts.sql` | sqlc query source |
| `api/internal/store/db/` | sqlc-generated (`DO NOT EDIT`) |
| `api/internal/store/errors.go` | sentinels + `Classify` (pgx/pgconn → sentinel) |
| `api/internal/account/service.go` | validation, row→DTO, error translation |
| `api/internal/account/handler.go` | decode/validate, call service, map → HTTP |
| `api/internal/server/router.go` | `account...Mount(mux)` |

Handlers hold no business logic; the store holds no HTTP. The service is the
boundary that turns raw driver errors into `store` sentinels via `Classify`.

## Routes (`/api/v1`)

| Method | Path | Success | Body |
|---|---|---|---|
| GET | `/accounts` | 200 `[]Account` (by name) | — |
| POST | `/accounts` | 201 `Account` | `Input` |
| GET | `/accounts/{id}` | 200 `Account` | — |
| PUT | `/accounts/{id}` | 200 `Account` (full replace) | `Input` |
| DELETE | `/accounts/{id}` | 204 (no body) | — |

## Shapes

```jsonc
// Account (response)
{ "id": 1, "name": "BCA", "is_liquid": true, "created_at": "2026-…T…+07:00" }

// Input (create/update body)
{ "name": "BCA", "is_liquid": true }   // is_liquid omitted ⇒ defaults true
```

`Account` is a hand DTO, not the generated row — the wire contract is not
hostage to schema/sqlc changes (`created_at` is `time.Time`, never `pgtype`).

## Rules & validation

- `name`: trimmed, required (→ 400), ≤ 100 runes (→ 400), unique (→ 409).
- `is_liquid`: pointer in `Input`; omitted ⇒ `true` (the column default), so an
  absent field never silently means `false`.
- Delete is `ON DELETE RESTRICT`: an account with transactions cannot be deleted.

## Error mapping (sets the project taxonomy)

| Cause | sentinel | HTTP | `{"error"}` message |
|---|---|---|---|
| blank / too-long name | `ErrEmptyName` / `ErrNameTooLong` | 400 | the error text |
| bad JSON / non-numeric id | — | 400 | `invalid JSON body` / `invalid id` |
| row not found / update id absent | `store.ErrNotFound` | 404 | `account not found` |
| duplicate name | `store.ErrConflict` (`23505`) | 409 | `account name already exists` |
| delete with history | `store.ErrInUse` (`23503`) | 409 | `account has transactions and cannot be deleted` |
| anything else | — | 500 | `internal error` (logged) |
