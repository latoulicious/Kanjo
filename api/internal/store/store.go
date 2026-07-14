package store

import (
	"context"
	"fmt"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"

	"github.com/latoulicious/kanjo/api/internal/store/db"
)

// Store embeds the sqlc Queries (so modules call generated methods directly)
// and keeps the pool for health checks and future transactions.
type Store struct {
	pool *pgxpool.Pool
	*db.Queries
}

// Open builds the pool without connecting; pgxpool dials on first use. The pool
// needs no live DB, but the API requires one at boot (migrations run first).
func Open(ctx context.Context, dsn string) (*Store, error) {
	pool, err := pgxpool.New(ctx, dsn)
	if err != nil {
		return nil, fmt.Errorf("postgres pool: %w", err)
	}
	return &Store{pool: pool, Queries: db.New(pool)}, nil
}

// Ping verifies DB reachability for /health.
func (s *Store) Ping(ctx context.Context) error {
	return s.pool.Ping(ctx)
}

// WithTx runs fn inside a single transaction, passing a *db.Queries bound to it
// so every call shares the tx. fn returning an error rolls back; nil commits.
func (s *Store) WithTx(ctx context.Context, fn func(q *db.Queries) error) error {
	tx, err := s.pool.Begin(ctx)
	if err != nil {
		return fmt.Errorf("begin tx: %w", err)
	}
	defer tx.Rollback(ctx) // no-op once committed
	if err := fn(s.Queries.WithTx(tx)); err != nil {
		return err
	}
	return tx.Commit(ctx)
}

// WithRawTx is WithTx with raw pgx access, for SQL that lives outside sqlc
// (the generated output is hand-tuned; see sqlc.yaml).
func (s *Store) WithRawTx(ctx context.Context, fn func(tx pgx.Tx) error) error {
	tx, err := s.pool.Begin(ctx)
	if err != nil {
		return fmt.Errorf("begin tx: %w", err)
	}
	defer tx.Rollback(ctx) // no-op once committed
	if err := fn(tx); err != nil {
		return err
	}
	return tx.Commit(ctx)
}

// Close releases the pool.
func (s *Store) Close() {
	s.pool.Close()
}
