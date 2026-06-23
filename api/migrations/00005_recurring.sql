-- +goose Up

-- A saved transaction template (e.g. a monthly game pass). Not auto-posted: the
-- dashboard computes "due" client-side from day_of_month + last_posted, and the
-- post endpoint creates a real transaction and stamps last_posted.
CREATE TABLE IF NOT EXISTS recurring (
    id           BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    description  TEXT          NOT NULL DEFAULT '',
    direction    TEXT          NOT NULL,
    amount       NUMERIC(18,2) NOT NULL,
    account_id   BIGINT        NOT NULL REFERENCES accounts(id)   ON DELETE RESTRICT,
    category_id  BIGINT        REFERENCES categories(id) ON DELETE SET NULL,
    day_of_month INTEGER       NOT NULL,
    last_posted  DATE,
    created_at   TIMESTAMPTZ   NOT NULL DEFAULT now(),
    CONSTRAINT recurring_direction_check
        CHECK (direction IN ('income', 'expense')),
    CONSTRAINT recurring_amount_positive
        CHECK (amount > 0),
    CONSTRAINT recurring_day_of_month_check
        CHECK (day_of_month BETWEEN 1 AND 31)
);

-- +goose Down

DROP TABLE IF EXISTS recurring;
