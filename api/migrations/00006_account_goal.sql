-- +goose Up
-- target_amount turns an account into a savings goal; NULL = plain account.
-- Progress is balance / target, both already derived — no new bookkeeping.
ALTER TABLE accounts ADD COLUMN target_amount NUMERIC(18,2);

-- +goose Down
ALTER TABLE accounts DROP COLUMN target_amount;
