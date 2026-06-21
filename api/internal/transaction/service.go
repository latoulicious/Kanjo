package transaction

import (
	"context"
	"errors"
	"fmt"
	"strings"
	"time"
	"unicode/utf8"

	"github.com/jackc/pgx/v5/pgtype"

	"github.com/latoulicious/kanjo/api/internal/store"
	"github.com/latoulicious/kanjo/api/internal/store/db"
)

const (
	maxDescLen = 500
	dateLayout = "2006-01-02"
)

var (
	ErrBadDate         = errors.New("occurred_on must be YYYY-MM-DD")
	ErrBadDirection    = errors.New("direction must be income or expense")
	ErrDescTooLong     = errors.New("description exceeds 500 characters")
	ErrAccountRequired = errors.New("account_id is required")
	// FK pre-validation: a body referencing a missing row is a bad request, not a
	// conflict — this is F-005's real fix (bad insert FK is 400, never 409).
	ErrAccountNotFound  = errors.New("account not found")
	ErrCategoryNotFound = errors.New("category not found")
	ErrProjectNotFound  = errors.New("project not found")
)

// Transaction is the wire shape, decoupled from the generated db row: amount and
// occurred_on are strings (no pgtype/float on the wire), nullable FKs are pointers.
type Transaction struct {
	ID              int64     `json:"id"`
	OccurredOn      string    `json:"occurred_on"`
	Description     string    `json:"description"`
	Direction       string    `json:"direction"`
	IsInflow        bool      `json:"is_inflow"`
	Amount          string    `json:"amount"`
	AccountID       int64     `json:"account_id"`
	CategoryID      *int64    `json:"category_id"`
	ProjectID       *int64    `json:"project_id"`
	TransferGroupID *string   `json:"transfer_group_id"`
	Tags            []string  `json:"tags"`
	CreatedAt       time.Time `json:"created_at"`
}

// Input is the create/update body. direction is income|expense only (a lone
// transfer row would break the out==in invariant); is_inflow is derived, not set.
type Input struct {
	OccurredOn  string   `json:"occurred_on"`
	Description string   `json:"description"`
	Direction   string   `json:"direction"`
	Amount      string   `json:"amount"`
	AccountID   int64    `json:"account_id"`
	CategoryID  *int64   `json:"category_id"`
	ProjectID   *int64   `json:"project_id"`
	Tags        []string `json:"tags"`
}

// Filter holds the optional list predicates; a nil field disables that filter.
type Filter struct {
	From       *string
	To         *string
	AccountID  *int64
	CategoryID *int64
	ProjectID  *int64
}

type Service struct {
	st *store.Store
}

func NewService(st *store.Store) *Service {
	return &Service{st: st}
}

func (s *Service) List(ctx context.Context, f Filter) ([]Transaction, error) {
	var p db.ListTransactionsParams
	var err error
	if p.From, err = optDate(f.From); err != nil {
		return nil, err
	}
	if p.To, err = optDate(f.To); err != nil {
		return nil, err
	}
	p.AccountID = toInt8(f.AccountID)
	p.CategoryID = toInt8(f.CategoryID)
	p.ProjectID = toInt8(f.ProjectID)

	rows, err := s.st.ListTransactions(ctx, p)
	if err != nil {
		return nil, store.Classify(err)
	}
	out := make([]Transaction, len(rows))
	for i, r := range rows {
		out[i] = toTransaction(r)
	}
	return out, nil
}

func (s *Service) Get(ctx context.Context, id int64) (Transaction, error) {
	r, err := s.st.GetTransaction(ctx, id)
	if err != nil {
		return Transaction{}, store.Classify(err)
	}
	return toTransaction(r), nil
}

func (s *Service) Create(ctx context.Context, in Input) (Transaction, error) {
	p, err := s.validate(ctx, in)
	if err != nil {
		return Transaction{}, err
	}
	r, err := s.st.CreateTransaction(ctx, p)
	if err != nil {
		return Transaction{}, store.Classify(err)
	}
	return toTransaction(r), nil
}

func (s *Service) Update(ctx context.Context, id int64, in Input) (Transaction, error) {
	p, err := s.validate(ctx, in)
	if err != nil {
		return Transaction{}, err
	}
	r, err := s.st.UpdateTransaction(ctx, db.UpdateTransactionParams{
		ID:          id,
		OccurredOn:  p.OccurredOn,
		Description: p.Description,
		Direction:   p.Direction,
		IsInflow:    p.IsInflow,
		Amount:      p.Amount,
		AccountID:   p.AccountID,
		CategoryID:  p.CategoryID,
		ProjectID:   p.ProjectID,
		Tags:        p.Tags,
	})
	if err != nil {
		return Transaction{}, store.Classify(err)
	}
	return toTransaction(r), nil
}

func (s *Service) Delete(ctx context.Context, id int64) error {
	n, err := s.st.DeleteTransaction(ctx, id)
	if err != nil {
		return store.Classify(err)
	}
	if n == 0 {
		return store.ErrNotFound
	}
	return nil
}

// validate turns a request body into insert params: parses date/amount, derives
// is_inflow from direction, and pre-validates every FK so a bad reference is a
// 400 instead of a leaked 23503.
func (s *Service) validate(ctx context.Context, in Input) (db.CreateTransactionParams, error) {
	var p db.CreateTransactionParams

	date, err := parseDate(in.OccurredOn)
	if err != nil {
		return p, err
	}
	inflow, err := flowFor(strings.TrimSpace(in.Direction))
	if err != nil {
		return p, err
	}
	amount, err := parseAmount(in.Amount)
	if err != nil {
		return p, err
	}
	desc := strings.TrimSpace(in.Description)
	if utf8.RuneCountInString(desc) > maxDescLen {
		return p, ErrDescTooLong
	}
	if in.AccountID < 1 {
		return p, ErrAccountRequired
	}
	if err := s.requireAccount(ctx, in.AccountID); err != nil {
		return p, err
	}
	if err := requireRef(ctx, in.CategoryID, s.st.GetCategory, ErrCategoryNotFound); err != nil {
		return p, err
	}
	if err := requireRef(ctx, in.ProjectID, s.st.GetProject, ErrProjectNotFound); err != nil {
		return p, err
	}

	return db.CreateTransactionParams{
		OccurredOn:  date,
		Description: desc,
		Direction:   strings.TrimSpace(in.Direction),
		IsInflow:    inflow,
		Amount:      amount,
		AccountID:   in.AccountID,
		CategoryID:  toInt8(in.CategoryID),
		ProjectID:   toInt8(in.ProjectID),
		Tags:        normalizeTags(in.Tags),
	}, nil
}

func (s *Service) requireAccount(ctx context.Context, id int64) error {
	return s.requireAccountErr(ctx, id, ErrAccountNotFound)
}

// requireAccountErr pre-validates an account id, returning the caller's sentinel
// when the row is absent (transfers distinguish from-account vs to-account).
func (s *Service) requireAccountErr(ctx context.Context, id int64, missing error) error {
	if _, err := s.st.GetAccount(ctx, id); err != nil {
		if errors.Is(store.Classify(err), store.ErrNotFound) {
			return missing
		}
		return store.Classify(err)
	}
	return nil
}

// requireRef pre-validates an optional FK (category/project): nil is allowed
// (the column is nullable); a present id must resolve or it is a bad reference.
func requireRef[T any](ctx context.Context, id *int64, get func(context.Context, int64) (T, error), missing error) error {
	if id == nil {
		return nil
	}
	if *id < 1 {
		return missing
	}
	if _, err := get(ctx, *id); err != nil {
		if errors.Is(store.Classify(err), store.ErrNotFound) {
			return missing
		}
		return store.Classify(err)
	}
	return nil
}

func toTransaction(r db.Transaction) Transaction {
	return Transaction{
		ID:              r.ID,
		OccurredOn:      r.OccurredOn.Time.Format(dateLayout),
		Description:     r.Description,
		Direction:       r.Direction,
		IsInflow:        r.IsInflow,
		Amount:          formatAmount(r.Amount),
		AccountID:       r.AccountID,
		CategoryID:      fromInt8(r.CategoryID),
		ProjectID:       fromInt8(r.ProjectID),
		TransferGroupID: fromUUID(r.TransferGroupID),
		Tags:            orEmpty(r.Tags),
		CreatedAt:       r.CreatedAt.Time,
	}
}

func parseDate(s string) (pgtype.Date, error) {
	t, err := time.Parse(dateLayout, strings.TrimSpace(s))
	if err != nil {
		return pgtype.Date{}, ErrBadDate
	}
	return pgtype.Date{Time: t, Valid: true}, nil
}

func optDate(s *string) (pgtype.Date, error) {
	if s == nil {
		return pgtype.Date{}, nil
	}
	return parseDate(*s)
}

// flowFor derives the balance sign from direction. transfer is rejected here:
// single-entry CRUD never writes a lone transfer leg (it breaks out==in).
func flowFor(direction string) (bool, error) {
	switch direction {
	case "income":
		return true, nil
	case "expense":
		return false, nil
	default:
		return false, ErrBadDirection
	}
}

func normalizeTags(tags []string) []string {
	out := make([]string, 0, len(tags))
	for _, t := range tags {
		if t = strings.TrimSpace(t); t != "" {
			out = append(out, t)
		}
	}
	return out
}

func toInt8(p *int64) pgtype.Int8 {
	if p == nil {
		return pgtype.Int8{}
	}
	return pgtype.Int8{Int64: *p, Valid: true}
}

func fromInt8(v pgtype.Int8) *int64 {
	if !v.Valid {
		return nil
	}
	n := v.Int64
	return &n
}

func fromUUID(v pgtype.UUID) *string {
	if !v.Valid {
		return nil
	}
	s := uuidString(v.Bytes)
	return &s
}

func uuidString(b [16]byte) string {
	return fmt.Sprintf("%x-%x-%x-%x-%x", b[0:4], b[4:6], b[6:8], b[8:10], b[10:16])
}

func orEmpty(t []string) []string {
	if t == nil {
		return []string{}
	}
	return t
}
