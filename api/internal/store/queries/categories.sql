-- name: ListCategories :many
SELECT id, name, created_at FROM categories ORDER BY name;

-- name: GetCategory :one
SELECT id, name, created_at FROM categories WHERE id = $1;

-- name: CreateCategory :one
INSERT INTO categories (name) VALUES ($1)
RETURNING id, name, created_at;

-- name: UpdateCategory :one
UPDATE categories SET name = $2 WHERE id = $1
RETURNING id, name, created_at;

-- name: DeleteCategory :execrows
DELETE FROM categories WHERE id = $1;
