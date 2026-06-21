package store

import (
	"errors"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgconn"
)

// Sentinels the service translates raw pgx/pgconn errors into, so handlers map
// outcomes to HTTP without importing the driver.
var (
	ErrNotFound = errors.New("not found")
	ErrConflict = errors.New("conflict") // unique violation
	ErrInUse    = errors.New("in use")   // FK restrict: row still referenced
)

// Classify maps a pgx/pgconn error to a Store sentinel; anything unrecognized
// passes through unchanged for the handler to log and 500.
func Classify(err error) error {
	if errors.Is(err, pgx.ErrNoRows) {
		return ErrNotFound
	}
	var pg *pgconn.PgError
	if errors.As(err, &pg) {
		switch pg.Code {
		case "23505": // unique_violation
			return ErrConflict
		// 23503 means delete-restrict here: the only FK exposure so far is parent
		// delete (accounts/categories/projects). Child inserts (transactions) also
		// raise 23503 for a bad ref — split the sentinel or pre-validate there.
		case "23503": // foreign_key_violation
			return ErrInUse
		}
	}
	return err
}
