package account

import (
	"context"
	"errors"
	"strings"
	"time"
	"unicode/utf8"

	"github.com/latoulicious/kanjo/api/internal/store"
	"github.com/latoulicious/kanjo/api/internal/store/db"
)

const maxNameLen = 100

var (
	ErrEmptyName   = errors.New("name is required")
	ErrNameTooLong = errors.New("name exceeds 100 characters")
)

// Account is the wire shape, decoupled from the generated db row so the public
// contract is not hostage to schema or sqlc changes.
type Account struct {
	ID        int64     `json:"id"`
	Name      string    `json:"name"`
	IsLiquid  bool      `json:"is_liquid"`
	Balance   string    `json:"balance"` // signed decimal string; only List computes it
	CreatedAt time.Time `json:"created_at"`
}

// Input is the create/update body. IsLiquid is a pointer so an omitted field
// defaults to true (the column default) instead of false.
type Input struct {
	Name     string `json:"name"`
	IsLiquid *bool  `json:"is_liquid"`
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
			ID:        r.ID,
			Name:      r.Name,
			IsLiquid:  r.IsLiquid,
			Balance:   r.Balance,
			CreatedAt: r.CreatedAt.Time,
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
	r, err := s.st.CreateAccount(ctx, db.CreateAccountParams{
		Name:     name,
		IsLiquid: liquidOrDefault(in.IsLiquid),
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
	r, err := s.st.UpdateAccount(ctx, db.UpdateAccountParams{
		ID:       id,
		Name:     name,
		IsLiquid: liquidOrDefault(in.IsLiquid),
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
func toAccount(r db.Account) Account {
	return Account{
		ID:        r.ID,
		Name:      r.Name,
		IsLiquid:  r.IsLiquid,
		Balance:   "0.00",
		CreatedAt: r.CreatedAt.Time,
	}
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
