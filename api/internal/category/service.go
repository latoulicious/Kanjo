package category

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
	maxIconLen      = 50 // lucide names are short kebab-case; 50 is generous headroom
	budgetScale     = 2
	maxBudgetDigits = 18 // matches NUMERIC(18,2)
)

var (
	ErrEmptyName   = errors.New("name is required")
	ErrNameTooLong = errors.New("name exceeds 100 characters")
	ErrBadBudget   = errors.New("budget must be a positive amount, up to 2 decimals")
)

// Category is the wire shape, decoupled from the generated db row so the public
// contract is not hostage to schema or sqlc changes.
type Category struct {
	ID            int64     `json:"id"`
	Name          string    `json:"name"`
	Icon          string    `json:"icon"`
	MonthlyBudget *string   `json:"monthly_budget"` // decimal string, null when unset
	CreatedAt     time.Time `json:"created_at"`
}

// Input is the create/update body. Icon is a lucide icon name (kebab-case),
// MonthlyBudget a decimal string; both optional (null/"" clears them).
type Input struct {
	Name          string  `json:"name"`
	Icon          string  `json:"icon"`
	MonthlyBudget *string `json:"monthly_budget"`
}

type Service struct {
	st *store.Store
}

func NewService(st *store.Store) *Service {
	return &Service{st: st}
}

func (s *Service) List(ctx context.Context) ([]Category, error) {
	rows, err := s.st.ListCategories(ctx)
	if err != nil {
		return nil, store.Classify(err)
	}
	out := make([]Category, len(rows))
	for i, r := range rows {
		out[i] = toCategory(r)
	}
	return out, nil
}

func (s *Service) Get(ctx context.Context, id int64) (Category, error) {
	r, err := s.st.GetCategory(ctx, id)
	if err != nil {
		return Category{}, store.Classify(err)
	}
	return toCategory(r), nil
}

func (s *Service) Create(ctx context.Context, in Input) (Category, error) {
	name, err := cleanName(in.Name)
	if err != nil {
		return Category{}, err
	}
	budget, err := parseBudget(in.MonthlyBudget)
	if err != nil {
		return Category{}, err
	}
	r, err := s.st.CreateCategory(ctx, db.CreateCategoryParams{
		Name:          name,
		Icon:          cleanIcon(in.Icon),
		MonthlyBudget: budget,
	})
	if err != nil {
		return Category{}, store.Classify(err)
	}
	return toCategory(r), nil
}

func (s *Service) Update(ctx context.Context, id int64, in Input) (Category, error) {
	name, err := cleanName(in.Name)
	if err != nil {
		return Category{}, err
	}
	budget, err := parseBudget(in.MonthlyBudget)
	if err != nil {
		return Category{}, err
	}
	r, err := s.st.UpdateCategory(ctx, db.UpdateCategoryParams{
		ID:            id,
		Name:          name,
		Icon:          cleanIcon(in.Icon),
		MonthlyBudget: budget,
	})
	if err != nil {
		return Category{}, store.Classify(err)
	}
	return toCategory(r), nil
}

func (s *Service) Delete(ctx context.Context, id int64) error {
	n, err := s.st.DeleteCategory(ctx, id)
	if err != nil {
		return store.Classify(err)
	}
	if n == 0 {
		return store.ErrNotFound
	}
	return nil
}

func toCategory(r db.CategoryRow) Category {
	return Category{
		ID:            r.ID,
		Name:          r.Name,
		Icon:          r.Icon,
		MonthlyBudget: textPtr(r.MonthlyBudget),
		CreatedAt:     r.CreatedAt.Time,
	}
}

func textPtr(t pgtype.Text) *string {
	if !t.Valid {
		return nil
	}
	return &t.String
}

// parseBudget turns the optional input into a NUMERIC; nil/"" ⇒ NULL (no budget).
// Mirrors the transaction amount parser: a base-10 mantissa + exponent, no float.
func parseBudget(in *string) (pgtype.Numeric, error) {
	if in == nil {
		return pgtype.Numeric{}, nil
	}
	s := strings.TrimSpace(*in)
	if s == "" {
		return pgtype.Numeric{}, nil
	}
	intPart, fracPart, hasFrac := strings.Cut(s, ".")
	if intPart == "" || (hasFrac && fracPart == "") || len(fracPart) > budgetScale {
		return pgtype.Numeric{}, ErrBadBudget
	}
	if !allDigits(intPart) || (hasFrac && !allDigits(fracPart)) {
		return pgtype.Numeric{}, ErrBadBudget
	}
	// NUMERIC(18,2) always stores scale 2, so the integer part must fit in
	// precision − scale = 16 digits, else Postgres overflows on insert.
	if len(intPart) > maxBudgetDigits-budgetScale {
		return pgtype.Numeric{}, ErrBadBudget
	}
	mantissa, ok := new(big.Int).SetString(intPart+fracPart, 10)
	if !ok || mantissa.Sign() <= 0 { // rejects 0 and any non-positive
		return pgtype.Numeric{}, ErrBadBudget
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

// Stored as-is: the picker only sends valid lucide names, so no server-side
// validation against the icon set.
// ponytail: length cap only; add a name allowlist if untrusted clients appear.
func cleanIcon(icon string) string {
	icon = strings.TrimSpace(icon)
	if utf8.RuneCountInString(icon) > maxIconLen {
		return string([]rune(icon)[:maxIconLen])
	}
	return icon
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
