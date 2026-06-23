package transaction

import (
	"context"
	"errors"
	"strings"
	"time"
	"unicode/utf8"

	"github.com/jackc/pgx/v5/pgtype"

	"github.com/latoulicious/kanjo/api/internal/store"
	"github.com/latoulicious/kanjo/api/internal/store/db"
)

var ErrBadDay = errors.New("day_of_month must be between 1 and 31")

// Recurring is the wire shape of a saved template: amount is a decimal string,
// last_posted is a "YYYY-MM-DD" date or null (never posted).
type Recurring struct {
	ID          int64     `json:"id"`
	Description string    `json:"description"`
	Direction   string    `json:"direction"`
	Amount      string    `json:"amount"`
	AccountID   int64     `json:"account_id"`
	CategoryID  *int64    `json:"category_id"`
	DayOfMonth  int       `json:"day_of_month"`
	LastPosted  *string   `json:"last_posted"`
	CreatedAt   time.Time `json:"created_at"`
}

// RecurringInput is the create/update body; last_posted is server-managed.
type RecurringInput struct {
	Description string `json:"description"`
	Direction   string `json:"direction"`
	Amount      string `json:"amount"`
	AccountID   int64  `json:"account_id"`
	CategoryID  *int64 `json:"category_id"`
	DayOfMonth  int    `json:"day_of_month"`
}

func (s *Service) ListRecurring(ctx context.Context) ([]Recurring, error) {
	rows, err := s.st.ListRecurring(ctx)
	if err != nil {
		return nil, store.Classify(err)
	}
	out := make([]Recurring, len(rows))
	for i, r := range rows {
		out[i] = toRecurring(r)
	}
	return out, nil
}

func (s *Service) GetRecurringRule(ctx context.Context, id int64) (Recurring, error) {
	r, err := s.st.GetRecurring(ctx, id)
	if err != nil {
		return Recurring{}, store.Classify(err)
	}
	return toRecurring(r), nil
}

func (s *Service) CreateRecurring(ctx context.Context, in RecurringInput) (Recurring, error) {
	p, err := s.validateRecurring(ctx, in)
	if err != nil {
		return Recurring{}, err
	}
	r, err := s.st.CreateRecurring(ctx, p)
	if err != nil {
		return Recurring{}, store.Classify(err)
	}
	return toRecurring(r), nil
}

func (s *Service) UpdateRecurring(ctx context.Context, id int64, in RecurringInput) (Recurring, error) {
	p, err := s.validateRecurring(ctx, in)
	if err != nil {
		return Recurring{}, err
	}
	r, err := s.st.UpdateRecurring(ctx, db.UpdateRecurringParams{
		ID:          id,
		Description: p.Description,
		Direction:   p.Direction,
		Amount:      p.Amount,
		AccountID:   p.AccountID,
		CategoryID:  p.CategoryID,
		DayOfMonth:  p.DayOfMonth,
	})
	if err != nil {
		return Recurring{}, store.Classify(err)
	}
	return toRecurring(r), nil
}

func (s *Service) DeleteRecurring(ctx context.Context, id int64) error {
	n, err := s.st.DeleteRecurring(ctx, id)
	if err != nil {
		return store.Classify(err)
	}
	if n == 0 {
		return store.ErrNotFound
	}
	return nil
}

// PostRecurring posts the rule as a real transaction dated today and stamps
// last_posted, atomically, so the dashboard stops surfacing it until next cycle.
func (s *Service) PostRecurring(ctx context.Context, id int64) (Transaction, error) {
	rule, err := s.st.GetRecurring(ctx, id)
	if err != nil {
		return Transaction{}, store.Classify(err)
	}
	// ponytail: server-local date; set container TZ if the VPS clock differs from the user
	today := pgtype.Date{Time: time.Now(), Valid: true}
	params := recurringTxParams(rule, today)

	// ponytail: no double-post guard — manual action; last_posted=today hides it next render.
	var created db.Transaction
	err = s.st.WithTx(ctx, func(q *db.Queries) error {
		created, err = q.CreateTransaction(ctx, params)
		if err != nil {
			return err
		}
		return q.SetRecurringPosted(ctx, db.SetRecurringPostedParams{ID: id, LastPosted: today})
	})
	if err != nil {
		return Transaction{}, store.Classify(err)
	}
	return toTransaction(created), nil
}

// validateRecurring parses/validates a body into insert params: reuses the money
// parser, direction validation (via flowFor), and FK pre-validation.
func (s *Service) validateRecurring(ctx context.Context, in RecurringInput) (db.CreateRecurringParams, error) {
	var p db.CreateRecurringParams

	amount, err := parseAmount(in.Amount)
	if err != nil {
		return p, err
	}
	if _, err := flowFor(strings.TrimSpace(in.Direction)); err != nil {
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
	if in.DayOfMonth < 1 || in.DayOfMonth > 31 {
		return p, ErrBadDay
	}

	return db.CreateRecurringParams{
		Description: desc,
		Direction:   strings.TrimSpace(in.Direction),
		Amount:      amount,
		AccountID:   in.AccountID,
		CategoryID:  toInt8(in.CategoryID),
		DayOfMonth:  int32(in.DayOfMonth),
	}, nil
}

// recurringTxParams maps a rule to transaction insert params for a given date.
// Pure, so the mapping is unit-testable without a database (like transferRows).
func recurringTxParams(rule db.Recurring, today pgtype.Date) db.CreateTransactionParams {
	return db.CreateTransactionParams{
		OccurredOn:  today,
		Description: rule.Description,
		Direction:   rule.Direction,
		IsInflow:    rule.Direction == "income",
		Amount:      rule.Amount,
		AccountID:   rule.AccountID,
		CategoryID:  rule.CategoryID,
		ProjectID:   pgtype.Int8{},
		Tags:        []string{},
	}
}

func toRecurring(r db.Recurring) Recurring {
	return Recurring{
		ID:          r.ID,
		Description: r.Description,
		Direction:   r.Direction,
		Amount:      formatAmount(r.Amount),
		AccountID:   r.AccountID,
		CategoryID:  fromInt8(r.CategoryID),
		DayOfMonth:  int(r.DayOfMonth),
		LastPosted:  datePtr(r.LastPosted),
		CreatedAt:   r.CreatedAt.Time,
	}
}

// datePtr renders a nullable DATE as a *"YYYY-MM-DD"; nil when never set.
func datePtr(d pgtype.Date) *string {
	if !d.Valid {
		return nil
	}
	s := d.Time.Format(dateLayout)
	return &s
}
