-- +goose Up
-- icon holds a lucide-react icon name (kebab-case, e.g. "utensils"); '' = none.
ALTER TABLE categories ADD COLUMN icon TEXT NOT NULL DEFAULT '';

-- +goose Down
ALTER TABLE categories DROP COLUMN icon;
