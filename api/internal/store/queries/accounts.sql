-- name: ListAccounts :many
-- Cash pins last (false sorts before true), then alphabetical — banks read as a
-- group with cash at the bottom, everywhere accounts list.
-- ponytail: magic name; rename "Cash" and it stops pinning — fine for one user.
SELECT id, name, is_liquid, created_at FROM accounts ORDER BY (lower(name) = 'cash'), name;

-- name: GetAccount :one
SELECT id, name, is_liquid, created_at FROM accounts WHERE id = $1;

-- name: CreateAccount :one
INSERT INTO accounts (name, is_liquid) VALUES ($1, $2)
RETURNING id, name, is_liquid, created_at;

-- name: UpdateAccount :one
UPDATE accounts SET name = $2, is_liquid = $3 WHERE id = $1
RETURNING id, name, is_liquid, created_at;

-- name: DeleteAccount :execrows
DELETE FROM accounts WHERE id = $1;
