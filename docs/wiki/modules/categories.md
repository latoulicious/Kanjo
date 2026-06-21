# Module: categories

Same shape as [accounts](accounts.md) — thin handler → service → store (sqlc over
pgx). Read accounts first; this doc only records the deltas.

## Layers

Identical to accounts, with `category` packages:

| File | Role |
|---|---|
| `api/internal/store/queries/categories.sql` | sqlc query source |
| `api/internal/category/service.go` | validation, row→DTO, error translation |
| `api/internal/category/handler.go` | decode/validate, call service, map → HTTP |
| `api/internal/httpx/` | shared `WriteJSON`/`WriteErr`/`PathID`/`Decode[T]` |
| `api/internal/server/router.go` | `category…Mount(mux)` |

## Routes (`/api/v1`)

| Method | Path | Success | Body |
|---|---|---|---|
| GET | `/categories` | 200 `[]Category` (by name) | — |
| POST | `/categories` | 201 `Category` | `Input` |
| GET | `/categories/{id}` | 200 `Category` | — |
| PUT | `/categories/{id}` | 200 `Category` (full replace) | `Input` |
| DELETE | `/categories/{id}` | 204 (no body) | — |

## Shapes

```jsonc
// Category (response)
{ "id": 1, "name": "Food", "created_at": "2026-…T…+07:00" }

// Input (create/update body)
{ "name": "Food" }
```

## Deltas vs accounts

- **No `is_liquid`** — only `name`. No pointer field, no default logic.
- **Delete is `ON DELETE SET NULL`**, not RESTRICT. Deleting a category referenced
  by transactions succeeds (204) and nulls their `category_id`; there is **no
  in-use 409 path**. `store.Classify`'s `23503`→`ErrInUse` mapping (see
  [F-005](../findings.md)) never fires here, so `fail()` carries no `ErrInUse` case.

## Error mapping

Same taxonomy as accounts minus the in-use row:

| Cause | sentinel | HTTP | `{"error"}` message |
|---|---|---|---|
| blank / too-long name | `ErrEmptyName` / `ErrNameTooLong` | 400 | the error text |
| bad JSON / non-numeric id | — | 400 | `invalid JSON body` / `invalid id` |
| row not found / update id absent | `store.ErrNotFound` | 404 | `category not found` |
| duplicate name | `store.ErrConflict` (`23505`) | 409 | `category name already exists` |
| anything else | — | 500 | `internal error` (logged) |
