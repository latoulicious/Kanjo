-- name: ListTransactions :many
-- All filters are optional; a NULL narg disables that predicate. Newest first.
SELECT id, occurred_on, description, direction, is_inflow, amount, account_id,
       category_id, project_id, transfer_group_id, tags, created_at
FROM transactions
WHERE (sqlc.narg('from')::date IS NULL OR occurred_on >= sqlc.narg('from'))
  AND (sqlc.narg('to')::date IS NULL OR occurred_on <= sqlc.narg('to'))
  AND (sqlc.narg('account_id')::bigint IS NULL OR account_id = sqlc.narg('account_id'))
  AND (sqlc.narg('category_id')::bigint IS NULL OR category_id = sqlc.narg('category_id'))
  AND (sqlc.narg('project_id')::bigint IS NULL OR project_id = sqlc.narg('project_id'))
ORDER BY occurred_on DESC, id DESC;

-- name: GetTransaction :one
SELECT id, occurred_on, description, direction, is_inflow, amount, account_id,
       category_id, project_id, transfer_group_id, tags, created_at
FROM transactions WHERE id = $1;

-- name: CreateTransaction :one
INSERT INTO transactions (occurred_on, description, direction, is_inflow, amount,
                          account_id, category_id, project_id, tags)
VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
RETURNING id, occurred_on, description, direction, is_inflow, amount, account_id,
          category_id, project_id, transfer_group_id, tags, created_at;

-- name: UpdateTransaction :one
-- Scoped to transfer_group_id IS NULL: transfer legs are immutable via this API
-- (managed as a group), so a leg id matches no row and surfaces as not-found.
UPDATE transactions
SET occurred_on = $2, description = $3, direction = $4, is_inflow = $5, amount = $6,
    account_id = $7, category_id = $8, project_id = $9, tags = $10
WHERE id = $1 AND transfer_group_id IS NULL
RETURNING id, occurred_on, description, direction, is_inflow, amount, account_id,
          category_id, project_id, transfer_group_id, tags, created_at;

-- name: DeleteTransaction :execrows
DELETE FROM transactions WHERE id = $1 AND transfer_group_id IS NULL;

-- name: CreateGroupedTransaction :one
-- Insert a transfer leg or fee row carrying a transfer_group_id (the grouped
-- counterpart of CreateTransaction, which always leaves the group NULL).
INSERT INTO transactions (occurred_on, description, direction, is_inflow, amount,
                          account_id, category_id, project_id, transfer_group_id, tags)
VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
RETURNING id, occurred_on, description, direction, is_inflow, amount, account_id,
          category_id, project_id, transfer_group_id, tags, created_at;

-- name: GetTransferGroup :many
SELECT id, occurred_on, description, direction, is_inflow, amount, account_id,
       category_id, project_id, transfer_group_id, tags, created_at
FROM transactions WHERE transfer_group_id = $1 ORDER BY id;

-- name: DeleteTransferGroup :execrows
DELETE FROM transactions WHERE transfer_group_id = $1;
