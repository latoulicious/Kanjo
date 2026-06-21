# Module: transactions

The ledger's atomic unit. More complex than accounts/categories/projects:
money parse/validate, optional list filters, and FK pre-validation. Same
layering (**thin handler → service → store, sqlc over pgx**).

Split into two passes:

- **2a — single-entry CRUD** (this module): one `income`/`expense` row.
- **2b — transfers** (later): two grouped `transfer` legs + optional fee row in
  one tx, out==in invariant. Introduces `Store.WithTx`.

## Layers

| File | Role |
|---|---|
| `api/internal/store/queries/transactions.sql` | sqlc query source (5 queries) |
| `api/internal/store/db/transactions.sql.go` | sqlc-generated (`DO NOT EDIT`) |
| `api/internal/transaction/money.go` | `parseAmount`/`formatAmount` for NUMERIC(18,2) |
| `api/internal/transaction/service.go` | validate, FK pre-validate, row→DTO, error xlate |
| `api/internal/transaction/handler.go` | decode/query-params, call service, map → HTTP |
| `api/internal/server/router.go` | `transaction…Mount(mux)` |

## Routes (`/api/v1`)

| Method | Path | Success | Body |
|---|---|---|---|
| GET | `/transactions` | 200 `[]Transaction` | — (filters via query) |
| POST | `/transactions` | 201 `Transaction` | `Input` |
| GET | `/transactions/{id}` | 200 `Transaction` | — |
| PUT | `/transactions/{id}` | 200 `Transaction` (full replace) | `Input` |
| DELETE | `/transactions/{id}` | 204 (no body) | — |

### List filters (all optional, AND-combined)

`?from=YYYY-MM-DD&to=YYYY-MM-DD&account_id=&category_id=&project_id=` — `from`/`to`
bound `occurred_on` inclusively. Order is fixed **`occurred_on DESC, id DESC`**
(newest first). No pagination yet (single-user MVP; matches the other list
endpoints). A NULL filter disables its predicate (`sqlc.narg`).

## Shapes

```jsonc
// Transaction (response)
{
  "id": 2, "occurred_on": "2026-06-10", "description": "vps",
  "direction": "expense", "is_inflow": false, "amount": "185000.50",
  "account_id": 1, "category_id": 1, "project_id": 1,
  "transfer_group_id": null, "tags": ["vps","domain"],
  "created_at": "2026-…T…+07:00"
}

// Input (create/update body) — is_inflow is derived, never sent
{
  "occurred_on": "2026-06-10", "description": "vps", "direction": "expense",
  "amount": "185000.50", "account_id": 1,
  "category_id": 1, "project_id": 1, "tags": ["vps","domain"]
}
```

`amount` is a **decimal string** on the wire (no float; cents never drift) and
comes back canonicalized to the column scale (`"500000.00"`). `occurred_on` is
`YYYY-MM-DD`. Nullable FKs (`category_id`/`project_id`/`transfer_group_id`) are
`null` when unset.

## Rules & validation

- `occurred_on`: required, `YYYY-MM-DD` (→ 400).
- `direction`: `income` | `expense` only. **`transfer` is rejected** (→ 400) — a
  lone transfer row breaks the out==in invariant and the `transfer_grouped` CHECK.
- `is_inflow`: **derived** — `income`→`true`, `expense`→`false` (mirrors the
  `flow_matches_direction` CHECK). Ignored on input, read-only in the response.
- `amount`: positive decimal, ≤ 2 places, ≤ 18 digits (NUMERIC(18,2)) (→ 400).
- `account_id`: required, must exist (→ 400). `category_id`/`project_id`: optional;
  if present, must exist (→ 400). **FKs are pre-validated** before insert.
- `description`: trimmed, ≤ 500 runes (→ 400). `tags`: trimmed, blanks dropped,
  defaults `[]`.

### Transfer legs are immutable here

`Update`/`Delete` are scoped to `transfer_group_id IS NULL`, so a transfer leg id
matches no row and returns **404**. Reads (`GET`/list) still show legs. Legs are
managed as a group by 2b.

## Error mapping (extends the accounts taxonomy)

| Cause | HTTP | `{"error"}` message |
|---|---|---|
| bad date / direction / amount / description | 400 | the validation text |
| missing / unknown `account_id` | 400 | `account_id is required` / `account not found` |
| unknown `category_id` / `project_id` | 400 | `category not found` / `project not found` |
| bad JSON / non-numeric id / bad filter id | 400 | `invalid JSON body` / `invalid id` / `invalid id filter` |
| transaction id not found (incl. transfer leg) | 404 | `transaction not found` |
| anything else | 500 | `internal error` (logged) |

**No 409 path.** A single ledger row has no unique constraint and no in-use
relationship. This is **F-005's real fix**: a bad insert FK pre-validates to a
**400**, never the parent-delete `ErrInUse` 409. `store.Classify` is untouched —
the blast radius stays inside this module (see `resolutions.md` R-005).
