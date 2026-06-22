# Module: projects

Same shape as [accounts](accounts.md) — thin handler → service → store (sqlc over
pgx). Read accounts first; this doc only records the deltas. Identical to
[categories](categories.md) except the resource name.

## Layers

| File | Role |
|---|---|
| `api/internal/store/queries/projects.sql` | sqlc query source |
| `api/internal/project/service.go` | validation, row→DTO, error translation |
| `api/internal/project/handler.go` | decode/validate, call service, map → HTTP |
| `api/internal/httpx/` | shared `WriteJSON`/`WriteErr`/`PathID`/`Decode[T]` |
| `api/internal/server/router.go` | `project…Mount(mux)` |

## Routes (`/api/v1`)

| Method | Path | Success | Body |
|---|---|---|---|
| GET | `/projects` | 200 `[]Project` (by name) | — |
| POST | `/projects` | 201 `Project` | `Input` |
| GET | `/projects/{id}` | 200 `Project` | — |
| PUT | `/projects/{id}` | 200 `Project` (full replace) | `Input` |
| DELETE | `/projects/{id}` | 204 (no body) | — |

## Shapes

```jsonc
// Project (response)
{ "id": 1, "name": "LazyScan Lite", "created_at": "2026-…T…+07:00" }

// Input (create/update body)
{ "name": "LazyScan Lite" }
```

## Deltas vs accounts

- **No `is_liquid`** — only `name`.
- **Delete is `ON DELETE SET NULL`**, not RESTRICT. Deleting a project referenced
  by transactions succeeds (204) and nulls their `project_id`; **no in-use 409
  path** ([F-005](../findings.md)'s `23503` never fires), so `fail()` carries no
  `ErrInUse` case.

## Error mapping

| Cause | sentinel | HTTP | `{"error"}` message |
|---|---|---|---|
| blank / too-long name | `ErrEmptyName` / `ErrNameTooLong` | 400 | the error text |
| bad JSON / non-numeric id | — | 400 | `invalid JSON body` / `invalid id` |
| row not found / update id absent | `store.ErrNotFound` | 404 | `project not found` |
| duplicate name | `store.ErrConflict` (`23505`) | 409 | `project name already exists` |
| anything else | — | 500 | `internal error` (logged) |
