-- name: ListRecurring :many
SELECT id, description, direction, amount, account_id, category_id, day_of_month,
       last_posted, created_at
FROM recurring
ORDER BY description, id;

-- name: GetRecurring :one
SELECT id, description, direction, amount, account_id, category_id, day_of_month,
       last_posted, created_at
FROM recurring WHERE id = $1;

-- name: CreateRecurring :one
-- last_posted defaults NULL (never posted) — set only via SetRecurringPosted.
INSERT INTO recurring (description, direction, amount, account_id, category_id, day_of_month)
VALUES ($1, $2, $3, $4, $5, $6)
RETURNING id, description, direction, amount, account_id, category_id, day_of_month,
          last_posted, created_at;

-- name: UpdateRecurring :one
-- last_posted is intentionally untouched: editing a rule never re-arms its cycle.
UPDATE recurring
SET description = $2, direction = $3, amount = $4, account_id = $5,
    category_id = $6, day_of_month = $7
WHERE id = $1
RETURNING id, description, direction, amount, account_id, category_id, day_of_month,
          last_posted, created_at;

-- name: DeleteRecurring :execrows
DELETE FROM recurring WHERE id = $1;

-- name: SetRecurringPosted :exec
UPDATE recurring SET last_posted = $2 WHERE id = $1;
