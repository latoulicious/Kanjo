-- +goose Up
-- monthly_budget is a category's per-pay-cycle spend limit; NULL = no budget set.
ALTER TABLE categories ADD COLUMN monthly_budget NUMERIC(18,2);

-- +goose Down
ALTER TABLE categories DROP COLUMN monthly_budget;
