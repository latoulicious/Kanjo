-- Read-only aggregations. Everything is derived from transactions on each call;
-- nothing here is stored. Sums use COALESCE(...)::numeric so an empty set is 0
-- (not NULL) and sqlc types the column as pgtype.Numeric, not interface{}.

-- name: BalanceTotals :one
-- Stock, point-in-time: every row signed by is_inflow (transfers included, they
-- move money between accounts). liquid_balance restricts to is_liquid accounts.
SELECT
    COALESCE(SUM(CASE WHEN t.is_inflow THEN t.amount ELSE -t.amount END), 0)::numeric AS current_balance,
    COALESCE(SUM(CASE WHEN a.is_liquid THEN (CASE WHEN t.is_inflow THEN t.amount ELSE -t.amount END) ELSE 0 END), 0)::numeric AS liquid_balance
FROM transactions t
JOIN accounts a ON a.id = t.account_id;

-- name: WindowTotals :one
-- Flow over an optional [from, to] window. transfers excluded from both sides;
-- the transfer fee is an expense row, so it counts in expense (and burn).
SELECT
    COALESCE(SUM(CASE WHEN direction = 'income'  THEN amount END), 0)::numeric AS income,
    COALESCE(SUM(CASE WHEN direction = 'expense' THEN amount END), 0)::numeric AS expense
FROM transactions
WHERE direction IN ('income', 'expense')
  AND (sqlc.narg('from')::date IS NULL OR occurred_on >= sqlc.narg('from'))
  AND (sqlc.narg('to')::date   IS NULL OR occurred_on <= sqlc.narg('to'));

-- name: CashFlowByPeriod :many
-- Income/expense bucketed by date_trunc(bucket, occurred_on). bucket is validated
-- against an allowlist in Go before it reaches here. transfers excluded.
SELECT
    date_trunc(sqlc.arg('bucket')::text, occurred_on)::date AS period,
    COALESCE(SUM(CASE WHEN direction = 'income'  THEN amount END), 0)::numeric AS income,
    COALESCE(SUM(CASE WHEN direction = 'expense' THEN amount END), 0)::numeric AS expense
FROM transactions
WHERE direction IN ('income', 'expense')
  AND (sqlc.narg('from')::date IS NULL OR occurred_on >= sqlc.narg('from'))
  AND (sqlc.narg('to')::date   IS NULL OR occurred_on <= sqlc.narg('to'))
GROUP BY period
ORDER BY period;

-- name: CategoryTotals :many
-- Expense by category over an optional window; NULL category folds into one
-- "Uncategorized" bucket (LEFT JOIN). Highest spend first.
SELECT
    t.category_id,
    COALESCE(c.name, 'Uncategorized')::text AS name,
    COALESCE(SUM(t.amount), 0)::numeric AS total
FROM transactions t
LEFT JOIN categories c ON c.id = t.category_id
WHERE t.direction = 'expense'
  AND (sqlc.narg('from')::date IS NULL OR t.occurred_on >= sqlc.narg('from'))
  AND (sqlc.narg('to')::date   IS NULL OR t.occurred_on <= sqlc.narg('to'))
GROUP BY t.category_id, c.name
ORDER BY total DESC;

-- name: ProjectTotals :many
-- Expense attributed to a project (rows with project_id set) over an optional
-- window. Inner join: rows with no project are not a project cost.
SELECT
    p.id   AS project_id,
    p.name AS name,
    COALESCE(SUM(t.amount), 0)::numeric AS total
FROM transactions t
JOIN projects p ON p.id = t.project_id
WHERE t.direction = 'expense'
  AND (sqlc.narg('from')::date IS NULL OR t.occurred_on >= sqlc.narg('from'))
  AND (sqlc.narg('to')::date   IS NULL OR t.occurred_on <= sqlc.narg('to'))
GROUP BY p.id, p.name
ORDER BY total DESC;

-- name: BalanceByPeriod :many
-- Signed net per period for the cumulative balance trend. No 'from' filter: the
-- running total is summed from the earliest row, so prior periods must be present.
SELECT
    date_trunc(sqlc.arg('bucket')::text, occurred_on)::date AS period,
    COALESCE(SUM(CASE WHEN is_inflow THEN amount ELSE -amount END), 0)::numeric AS net
FROM transactions
WHERE (sqlc.narg('to')::date IS NULL OR occurred_on <= sqlc.narg('to'))
GROUP BY period
ORDER BY period;
