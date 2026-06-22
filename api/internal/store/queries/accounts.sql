-- name: ListAccounts :many
-- balance is the signed running total of the account's transactions (::text so it
-- arrives as a decimal string, same wire shape as every other money field).
-- Cash pins last (false sorts before true), then alphabetical.
-- ponytail: magic name; rename "Cash" and it stops pinning — fine for one user.
SELECT a.id, a.name, a.is_liquid, a.created_at,
  COALESCE(SUM(CASE WHEN t.is_inflow THEN t.amount ELSE -t.amount END), 0)::numeric(18,2)::text AS balance
FROM accounts a
LEFT JOIN transactions t ON t.account_id = a.id
GROUP BY a.id
ORDER BY (lower(a.name) = 'cash'), a.name;

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
