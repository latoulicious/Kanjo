-- name: ListAccounts :many
-- balance is the signed running total of the account's transactions (::text so it
-- arrives as a decimal string, same wire shape as every other money field).
-- target_amount rides along the same way; NULL when the account isn't a goal.
-- Cash then Investment pin to the bottom (rest alphabetical above them).
-- ponytail: magic names; rename "Cash"/"Investment" and they stop pinning — fine for one user.
SELECT a.id, a.name, a.is_liquid, a.icon, a.target_amount::text AS target_amount, a.created_at,
  COALESCE(SUM(CASE WHEN t.is_inflow THEN t.amount ELSE -t.amount END), 0)::numeric(18,2)::text AS balance
FROM accounts a
LEFT JOIN transactions t ON t.account_id = a.id
GROUP BY a.id
ORDER BY (CASE lower(a.name) WHEN 'cash' THEN 1 WHEN 'investment' THEN 2 ELSE 0 END), a.name;

-- name: GetAccount :one
SELECT id, name, is_liquid, icon, target_amount::text AS target_amount, created_at FROM accounts WHERE id = $1;

-- name: CreateAccount :one
INSERT INTO accounts (name, is_liquid, icon, target_amount) VALUES ($1, $2, $3, $4)
RETURNING id, name, is_liquid, icon, target_amount::text AS target_amount, created_at;

-- name: UpdateAccount :one
UPDATE accounts SET name = $2, is_liquid = $3, icon = $4, target_amount = $5 WHERE id = $1
RETURNING id, name, is_liquid, icon, target_amount::text AS target_amount, created_at;

-- name: DeleteAccount :execrows
DELETE FROM accounts WHERE id = $1;
