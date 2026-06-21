package store

import (
	"context"
	"database/sql"
	"fmt"
	"time"

	_ "github.com/jackc/pgx/v5/stdlib"
	"github.com/pressly/goose/v3"

	"github.com/latoulicious/kanjo/api/migrations"
)

const dbReadyBudget = 30 * time.Second

// Migrate applies all pending goose migrations over a short-lived database/sql
// connection (goose needs one); the server then runs on the pgx pool.
func Migrate(ctx context.Context, dsn string) error {
	db, err := sql.Open("pgx", dsn)
	if err != nil {
		return fmt.Errorf("migrate: open: %w", err)
	}
	defer db.Close()

	if err := waitForDB(ctx, db); err != nil {
		return err
	}

	goose.SetBaseFS(migrations.FS)
	if err := goose.SetDialect("postgres"); err != nil {
		return fmt.Errorf("migrate: dialect: %w", err)
	}
	if err := goose.UpContext(ctx, db, "."); err != nil {
		return fmt.Errorf("migrate: up: %w", err)
	}
	return nil
}

// waitForDB pings until the DB answers or dbReadyBudget elapses, so a briefly
// unavailable DB at boot waits instead of crashing; SIGTERM (ctx) cancels it.
func waitForDB(ctx context.Context, db *sql.DB) error {
	deadline := time.Now().Add(dbReadyBudget)
	for {
		err := db.PingContext(ctx)
		if err == nil {
			return nil
		}
		if ctx.Err() != nil || time.Now().After(deadline) {
			return fmt.Errorf("migrate: db not ready: %w", err)
		}
		select {
		case <-ctx.Done():
		case <-time.After(time.Second):
		}
	}
}
