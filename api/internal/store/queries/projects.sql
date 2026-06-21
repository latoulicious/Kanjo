-- name: ListProjects :many
SELECT id, name, created_at FROM projects ORDER BY name;

-- name: GetProject :one
SELECT id, name, created_at FROM projects WHERE id = $1;

-- name: CreateProject :one
INSERT INTO projects (name) VALUES ($1)
RETURNING id, name, created_at;

-- name: UpdateProject :one
UPDATE projects SET name = $2 WHERE id = $1
RETURNING id, name, created_at;

-- name: DeleteProject :execrows
DELETE FROM projects WHERE id = $1;
