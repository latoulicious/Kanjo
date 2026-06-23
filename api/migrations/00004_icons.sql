-- +goose Up
-- icon is a lucide icon name (kebab-case); '' = no icon. Mirrors categories.icon.
ALTER TABLE projects ADD COLUMN icon TEXT NOT NULL DEFAULT '';
ALTER TABLE accounts ADD COLUMN icon TEXT NOT NULL DEFAULT '';

-- +goose Down
ALTER TABLE projects DROP COLUMN icon;
ALTER TABLE accounts DROP COLUMN icon;
