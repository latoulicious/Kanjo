package account

import (
	"context"
	"errors"
	"math/big"
	"strings"
	"time"
	"unicode/utf8"

	"github.com/jackc/pgx/v5/pgtype"
	"github.com/latoulicious/kanjo/api/internal/store"
	"github.com/latoulicious/kanjo/api/internal/store/db"
)

const (
	maxNameLen      = 100
	targetScale     = 2
	maxTargetDigits = 18 // matches NUMERIC(18,2)
)

var (
	ErrEmptyName   = errors.New("name is required")
	ErrNameTooLong = errors.New("name exceeds 100 characters")
	ErrBadTarget   = errors.New("goal target must be a positive amount, up to 2 decimals")
)

// Account is the wire shape, decoupled from the generated db row so the public
// contract is not hostage to schema or sqlc changes.
type Account struct {
	ID           int64     `json:"id"`
	Name         string    `json:"name"`
	IsLiquid     bool      `json:"is_liquid"`
	Icon         string    `json:"icon"`          // lucide icon name (kebab-case), "" = none
	TargetAmount *string   `json:"target_amount"` // savings goal target; null = plain account
	Balance      string    `json:"balance"`       // signed decimal string; only List computes it
	CreatedAt    time.Time `json:"created_at"`
}

// Input is the create/update body. IsLiquid is a pointer so an omitted field
// defaults to true (the column default) instead of false. TargetAmount is a
// decimal string; null/"" clears the goal.
type Input struct {
	Name         string  `json:"name"`
	IsLiquid     *bool   `json:"is_liquid"`
	Icon         string  `json:"icon"`
	TargetAmount *string `json:"target_amount"`
}

type Service struct {
	st *store.Store
}

func NewService(st *store.Store) *Service {
	return &Service{st: st}
}

func (s *Service) List(ctx context.Context) ([]Account, error) {
	rows, err := s.st.ListAccounts(ctx)
	if err != nil {
		return nil, store.Classify(err)
	}
	out := make([]Account, len(rows))
	for i, r := range rows {
		out[i] = Account{
			ID:           r.ID,
			Name:         r.Name,
			IsLiquid:     r.IsLiquid,
			Icon:         r.Icon,
			TargetAmount: textPtr(r.TargetAmount),
			Balance:      r.Balance,
			CreatedAt:    r.CreatedAt.Time,
		}
	}
	return out, nil
}

func (s *Service) Get(ctx context.Context, id int64) (Account, error) {
	r, err := s.st.GetAccount(ctx, id)
	if err != nil {
		return Account{}, store.Classify(err)
	}
	return toAccount(r), nil
}

func (s *Service) Create(ctx context.Context, in Input) (Account, error) {
	name, err := cleanName(in.Name)
	if err != nil {
		return Account{}, err
	}
	target, err := parseTarget(in.TargetAmount)
	if err != nil {
		return Account{}, err
	}
	r, err := s.st.CreateAccount(ctx, db.CreateAccountParams{
		Name:         name,
		IsLiquid:     liquidOrDefault(in.IsLiquid),
		Icon:         store.CleanIcon(in.Icon),
		TargetAmount: target,
	})
	if err != nil {
		return Account{}, store.Classify(err)
	}
	return toAccount(r), nil
}

func (s *Service) Update(ctx context.Context, id int64, in Input) (Account, error) {
	name, err := cleanName(in.Name)
	if err != nil {
		return Account{}, err
	}
	target, err := parseTarget(in.TargetAmount)
	if err != nil {
		return Account{}, err
	}
	r, err := s.st.UpdateAccount(ctx, db.UpdateAccountParams{
		ID:           id,
		Name:         name,
		IsLiquid:     liquidOrDefault(in.IsLiquid),
		Icon:         store.CleanIcon(in.Icon),
		TargetAmount: target,
	})
	if err != nil {
		return Account{}, store.Classify(err)
	}
	return toAccount(r), nil
}

func (s *Service) Delete(ctx context.Context, id int64) error {
	n, err := s.st.DeleteAccount(ctx, id)
	if err != nil {
		return store.Classify(err)
	}
	if n == 0 {
		return store.ErrNotFound
	}
	return nil
}

// toAccount maps the single-row endpoints (get/create/update). Balance is "0.00":
// a fresh account has none, and the UI reads live balances from List, then refetches.
func toAccount(r db.AccountRow) Account {
	return Account{
		ID:           r.ID,
		Name:         r.Name,
		IsLiquid:     r.IsLiquid,
		Icon:         r.Icon,
		TargetAmount: textPtr(r.TargetAmount),
		Balance:      "0.00",
		CreatedAt:    r.CreatedAt.Time,
	}
}

func textPtr(t pgtype.Text) *string {
	if !t.Valid {
		return nil
	}
	return &t.String
}

// parseTarget turns the optional input into a NUMERIC; nil/"" ⇒ NULL (no goal).
// Mirrors the category budget parser: a base-10 mantissa + exponent, no float.
func parseTarget(in *string) (pgtype.Numeric, error) {
	if in == nil {
		return pgtype.Numeric{}, nil
	}
	s := strings.TrimSpace(*in)
	if s == "" {
		return pgtype.Numeric{}, nil
	}
	intPart, fracPart, hasFrac := strings.Cut(s, ".")
	if intPart == "" || (hasFrac && fracPart == "") || len(fracPart) > targetScale {
		return pgtype.Numeric{}, ErrBadTarget
	}
	if !allDigits(intPart) || (hasFrac && !allDigits(fracPart)) {
		return pgtype.Numeric{}, ErrBadTarget
	}
	// NUMERIC(18,2) stores scale 2, so the integer part must fit in
	// precision − scale = 16 digits, else Postgres overflows on insert.
	if len(intPart) > maxTargetDigits-targetScale {
		return pgtype.Numeric{}, ErrBadTarget
	}
	mantissa, ok := new(big.Int).SetString(intPart+fracPart, 10)
	if !ok || mantissa.Sign() <= 0 { // rejects 0 and any non-positive
		return pgtype.Numeric{}, ErrBadTarget
	}
	return pgtype.Numeric{Int: mantissa, Exp: int32(-len(fracPart)), Valid: true}, nil
}

func allDigits(s string) bool {
	if s == "" {
		return false
	}
	for _, r := range s {
		if r < '0' || r > '9' {
			return false
		}
	}
	return true
}

func cleanName(name string) (string, error) {
	name = strings.TrimSpace(name)
	if name == "" {
		return "", ErrEmptyName
	}
	if utf8.RuneCountInString(name) > maxNameLen {
		return "", ErrNameTooLong
	}
	return name, nil
}

func liquidOrDefault(p *bool) bool {
	if p == nil {
		return true
	}
	return *p
}
