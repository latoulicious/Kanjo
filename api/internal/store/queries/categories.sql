-- name: ListCategories :many
SELECT id, name, icon, monthly_budget::text AS monthly_budget, created_at FROM categories ORDER BY name;

-- name: GetCategory :one
SELECT id, name, icon, monthly_budget::text AS monthly_budget, created_at FROM categories WHERE id = $1;

-- name: CreateCategory :one
INSERT INTO categories (name, icon, monthly_budget) VALUES ($1, $2, $3)
RETURNING id, name, icon, monthly_budget::text AS monthly_budget, created_at;

-- name: UpdateCategory :one
UPDATE categories SET name = $2, icon = $3, monthly_budget = $4 WHERE id = $1
RETURNING id, name, icon, monthly_budget::text AS monthly_budget, created_at;

-- name: DeleteCategory :execrows
DELETE FROM categories WHERE id = $1;

-- name: EnsureCategoryByName :one
-- Get-or-create by unique name; backs the default transfer-fee category so a
-- fee needs no manual category. DO UPDATE (not DO NOTHING) so RETURNING fires on
-- conflict.
-- ponytail: no-op update writes 1 dead tuple/call — negligible single-user.
INSERT INTO categories (name) VALUES ($1)
ON CONFLICT (name) DO UPDATE SET name = EXCLUDED.name
RETURNING id;
