-- +goose Up

CREATE TABLE IF NOT EXISTS accounts (
    id         BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    name       TEXT        NOT NULL UNIQUE,
    is_liquid  BOOLEAN     NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS categories (
    id         BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    name       TEXT        NOT NULL UNIQUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS projects (
    id         BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    name       TEXT        NOT NULL UNIQUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- One ledger entry. direction classifies it for reports (income/expense excluded
-- from each other; transfer excluded from both); is_inflow gives the per-row
-- balance sign so transfers and fees compute uniformly.
CREATE TABLE IF NOT EXISTS transactions (
    id                BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    occurred_on       DATE          NOT NULL,
    description       TEXT          NOT NULL DEFAULT '',
    direction         TEXT          NOT NULL,
    is_inflow         BOOLEAN       NOT NULL,
    amount            NUMERIC(18,2) NOT NULL,
    account_id        BIGINT        NOT NULL REFERENCES accounts(id)   ON DELETE RESTRICT,
    category_id       BIGINT        REFERENCES categories(id) ON DELETE SET NULL,
    project_id        BIGINT        REFERENCES projects(id)   ON DELETE SET NULL,
    transfer_group_id UUID,
    tags              TEXT[]        NOT NULL DEFAULT '{}',
    created_at        TIMESTAMPTZ   NOT NULL DEFAULT now(),
    CONSTRAINT transactions_direction_check
        CHECK (direction IN ('income', 'expense', 'transfer')),
    CONSTRAINT transactions_amount_positive
        CHECK (amount > 0),
    -- income is always an inflow, expense always an outflow; a transfer leg is
    -- either (out of the source, into the destination).
    CONSTRAINT transactions_flow_matches_direction CHECK (
        (direction = 'income'  AND is_inflow)
        OR (direction = 'expense' AND NOT is_inflow)
        OR direction = 'transfer'
    ),
    -- transfer legs are grouped (out + in, plus any fee row share one group);
    -- income/expense rows stand alone unless they are a transfer's fee.
    CONSTRAINT transactions_transfer_grouped CHECK (
        direction <> 'transfer' OR transfer_group_id IS NOT NULL
    )
);

CREATE INDEX IF NOT EXISTS idx_transactions_account        ON transactions (account_id);
CREATE INDEX IF NOT EXISTS idx_transactions_category       ON transactions (category_id);
CREATE INDEX IF NOT EXISTS idx_transactions_project        ON transactions (project_id);
CREATE INDEX IF NOT EXISTS idx_transactions_occurred_on    ON transactions (occurred_on);
CREATE INDEX IF NOT EXISTS idx_transactions_transfer_group ON transactions (transfer_group_id);
-- ponytail: no GIN(tags) yet; add when tag filtering ships (not in MVP reports).

-- +goose Down

DROP TABLE IF EXISTS transactions;
DROP TABLE IF EXISTS projects;
DROP TABLE IF EXISTS categories;
DROP TABLE IF EXISTS accounts;
