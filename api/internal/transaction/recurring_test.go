package transaction

import (
	"testing"
	"time"

	"github.com/jackc/pgx/v5/pgtype"

	"github.com/latoulicious/kanjo/api/internal/store/db"
)

func TestRecurringTxParams(t *testing.T) {
	today := pgtype.Date{Time: mustDate(t, "2026-06-23"), Valid: true}

	income := db.Recurring{
		Description: "Salary",
		Direction:   "income",
		Amount:      mustAmount(t, "5000000"),
		AccountID:   1,
	}
	p := recurringTxParams(income, today)
	if !p.IsInflow {
		t.Fatal("income rule must be an inflow")
	}
	if p.OccurredOn != today {
		t.Fatalf("occurred_on not the passed date: %+v", p.OccurredOn)
	}
	if formatAmount(p.Amount) != formatAmount(income.Amount) {
		t.Fatalf("amount not carried: %s", formatAmount(p.Amount))
	}
	if p.CategoryID.Valid {
		t.Fatalf("income rule had no category: %+v", p.CategoryID)
	}

	expense := db.Recurring{
		Description: "Game pass",
		Direction:   "expense",
		Amount:      mustAmount(t, "150000"),
		AccountID:   2,
		CategoryID:  pgtype.Int8{Int64: 7, Valid: true},
	}
	e := recurringTxParams(expense, today)
	if e.IsInflow {
		t.Fatal("expense rule must be an outflow")
	}
	if !e.CategoryID.Valid || e.CategoryID.Int64 != 7 {
		t.Fatalf("category not carried: %+v", e.CategoryID)
	}
	if e.OccurredOn != today {
		t.Fatalf("occurred_on not the passed date: %+v", e.OccurredOn)
	}
	if formatAmount(e.Amount) != formatAmount(expense.Amount) {
		t.Fatalf("amount not carried: %s", formatAmount(e.Amount))
	}
}

func mustDate(t *testing.T, s string) time.Time {
	t.Helper()
	d, err := parseDate(s)
	if err != nil {
		t.Fatalf("parseDate(%q): %v", s, err)
	}
	return d.Time
}
