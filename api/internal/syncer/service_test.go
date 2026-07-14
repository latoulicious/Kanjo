package syncer

import (
	"context"
	"os"
	"testing"
	"time"

	"github.com/jackc/pgx/v5"

	"github.com/latoulicious/kanjo/api/internal/store"
)

// Integration test: needs a live Postgres (kanjo-local). Skipped without
// TEST_DATABASE_URL. Truncates synced tables before and after.
func TestApplySync(t *testing.T) {
	dsn := os.Getenv("TEST_DATABASE_URL")
	if dsn == "" {
		t.Skip("TEST_DATABASE_URL not set")
	}
	ctx := context.Background()
	if err := store.Migrate(ctx, dsn); err != nil {
		t.Fatalf("migrate: %v", err)
	}
	st, err := store.Open(ctx, dsn)
	if err != nil {
		t.Fatalf("open: %v", err)
	}
	defer st.Close()
	reset(ctx, t, st)
	defer reset(ctx, t, st)

	svc := NewService(st)
	now := time.Now().UTC().Truncate(time.Microsecond)
	target := "500.00"

	// Push: one of everything.
	resp, err := svc.Apply(ctx, Request{Changes: Changes{
		Accounts: []AccountChange{
			{UUID: "11111111-1111-4111-8111-111111111111", Name: "Cash", IsLiquid: true, TargetAmount: &target, UpdatedAt: now},
		},
		Categories: []CategoryChange{
			{UUID: "22222222-2222-4222-8222-222222222222", Name: "Food", UpdatedAt: now},
		},
		Transactions: []TransactionChange{
			{UUID: "33333333-3333-4333-8333-333333333333", OccurredOn: "2026-07-01", Description: "salary",
				Direction: "income", IsInflow: true, Amount: "100.00",
				AccountUUID: "11111111-1111-4111-8111-111111111111", Tags: []string{"a"}, UpdatedAt: now},
		},
	}})
	if err != nil {
		t.Fatalf("apply: %v", err)
	}
	if len(resp.Snapshot.Accounts) != 1 || resp.Snapshot.Accounts[0].Name != "Cash" {
		t.Fatalf("snapshot accounts = %+v", resp.Snapshot.Accounts)
	}
	if got := resp.Snapshot.Transactions[0].Amount; got != "100.00" {
		t.Fatalf("amount = %q", got)
	}
	if got := resp.Snapshot.Transactions[0].AccountUUID; got != "11111111-1111-4111-8111-111111111111" {
		t.Fatalf("account_uuid = %q", got)
	}

	// LWW: stale update ignored, newer applied.
	stale := now.Add(-time.Hour)
	resp, err = svc.Apply(ctx, Request{Changes: Changes{Accounts: []AccountChange{
		{UUID: "11111111-1111-4111-8111-111111111111", Name: "Stale", IsLiquid: true, UpdatedAt: stale},
	}}})
	if err != nil {
		t.Fatalf("apply stale: %v", err)
	}
	if resp.Snapshot.Accounts[0].Name != "Cash" {
		t.Fatalf("stale write won: %+v", resp.Snapshot.Accounts[0])
	}
	newer := now.Add(time.Hour)
	resp, err = svc.Apply(ctx, Request{Changes: Changes{Accounts: []AccountChange{
		{UUID: "11111111-1111-4111-8111-111111111111", Name: "Wallet", IsLiquid: true, UpdatedAt: newer},
	}}})
	if err != nil {
		t.Fatalf("apply newer: %v", err)
	}
	if resp.Snapshot.Accounts[0].Name != "Wallet" {
		t.Fatalf("newer write lost: %+v", resp.Snapshot.Accounts[0])
	}

	// Adopt-by-name: same name, unseen uuid takes over the row.
	resp, err = svc.Apply(ctx, Request{Changes: Changes{Categories: []CategoryChange{
		{UUID: "44444444-4444-4444-8444-444444444444", Name: "Food", Icon: "utensils", UpdatedAt: newer},
	}}})
	if err != nil {
		t.Fatalf("apply adopt: %v", err)
	}
	if len(resp.Snapshot.Categories) != 1 || resp.Snapshot.Categories[0].UUID != "44444444-4444-4444-8444-444444444444" {
		t.Fatalf("adopt failed: %+v", resp.Snapshot.Categories)
	}

	// Delete: transaction tombstone applies; account then deletable.
	resp, err = svc.Apply(ctx, Request{Changes: Changes{
		Transactions: []TransactionChange{{UUID: "33333333-3333-4333-8333-333333333333", Deleted: true, UpdatedAt: newer}},
	}})
	if err != nil {
		t.Fatalf("apply delete: %v", err)
	}
	if len(resp.Snapshot.Transactions) != 0 {
		t.Fatalf("transaction not deleted: %+v", resp.Snapshot.Transactions)
	}
}

func reset(ctx context.Context, t *testing.T, st *store.Store) {
	t.Helper()
	err := st.WithRawTx(ctx, func(tx pgx.Tx) error {
		_, err := tx.Exec(ctx, `TRUNCATE transactions, recurring, accounts, categories, projects RESTART IDENTITY CASCADE`)
		return err
	})
	if err != nil {
		t.Fatalf("truncate: %v", err)
	}
}
