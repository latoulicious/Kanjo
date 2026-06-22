-- name: ListCategories :many
SELECT id, name, icon, created_at FROM categories ORDER BY name;

-- name: GetCategory :one
SELECT id, name, icon, created_at FROM categories WHERE id = $1;

-- name: CreateCategory :one
INSERT INTO categories (name, icon) VALUES ($1, $2)
RETURNING id, name, icon, created_at;

-- name: UpdateCategory :one
UPDATE categories SET name = $2, icon = $3 WHERE id = $1
RETURNING id, name, icon, created_at;

-- name: DeleteCategory :execrows
DELETE FROM categories WHERE id = $1;
