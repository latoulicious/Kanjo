package transaction

import (
	"context"
	"crypto/rand"
	"errors"
	"strings"
	"unicode/utf8"

	"github.com/jackc/pgx/v5/pgtype"

	"github.com/latoulicious/kanjo/api/internal/store"
	"github.com/latoulicious/kanjo/api/internal/store/db"
)

var (
	ErrFromAccountRequired = errors.New("from_account_id is required")
	ErrToAccountRequired   = errors.New("to_account_id is required")
	ErrSameAccount         = errors.New("from_account_id and to_account_id must differ")
	ErrFromAccountNotFound = errors.New("from_account not found")
	ErrToAccountNotFound   = errors.New("to_account not found")
	// A fee is a real expense that lands in burn/category reports; require it to be
	// categorized so transfer fees don't silently inflate "Uncategorized".
	ErrFeeCategoryRequired = errors.New("fee_category_id is required when a fee is set")
)

// TransferInput is the create body. A transfer becomes two grouped transfer legs
// (out of from, into to) plus an optional expense fee row charged to the source.
type TransferInput struct {
	OccurredOn    string   `json:"occurred_on"`
	Description   string   `json:"description"`
	FromAccountID int64    `json:"from_account_id"`
	ToAccountID   int64    `json:"to_account_id"`
	Amount        string   `json:"amount"`
	Fee           *string  `json:"fee"`
	FeeCategoryID *int64   `json:"fee_category_id"`
	Tags          []string `json:"tags"`
}

// TransferResult is the created/fetched group: its id plus every row in it.
type TransferResult struct {
	TransferGroupID string        `json:"transfer_group_id"`
	Transactions    []Transaction `json:"transactions"`
}

// validTransfer is the parsed/validated form, ready to expand into rows.
type validTransfer struct {
	date   pgtype.Date
	desc   string
	from   int64
	to     int64
	amount pgtype.Numeric
	fee    *pgtype.Numeric // nil ⇒ no fee row
	feeCat pgtype.Int8
	tags   []string
}

func (s *Service) CreateTransfer(ctx context.Context, in TransferInput) (TransferResult, error) {
	v, err := s.validateTransfer(ctx, in)
	if err != nil {
		return TransferResult{}, err
	}
	group, err := newGroupID()
	if err != nil {
		return TransferResult{}, err
	}
	rows := transferRows(v, group)

	var created []Transaction
	err = s.st.WithTx(ctx, func(q *db.Queries) error {
		for _, p := range rows {
			r, err := q.CreateGroupedTransaction(ctx, p)
			if err != nil {
				return err
			}
			created = append(created, toTransaction(r))
		}
		return nil
	})
	if err != nil {
		return TransferResult{}, store.Classify(err)
	}
	return TransferResult{TransferGroupID: uuidString(group.Bytes), Transactions: created}, nil
}

func (s *Service) GetTransfer(ctx context.Context, group pgtype.UUID) (TransferResult, error) {
	rows, err := s.st.GetTransferGroup(ctx, group)
	if err != nil {
		return TransferResult{}, store.Classify(err)
	}
	if len(rows) == 0 {
		return TransferResult{}, store.ErrNotFound
	}
	out := make([]Transaction, len(rows))
	for i, r := range rows {
		out[i] = toTransaction(r)
	}
	return TransferResult{TransferGroupID: uuidString(group.Bytes), Transactions: out}, nil
}

func (s *Service) DeleteTransfer(ctx context.Context, group pgtype.UUID) error {
	n, err := s.st.DeleteTransferGroup(ctx, group)
	if err != nil {
		return store.Classify(err)
	}
	if n == 0 {
		return store.ErrNotFound
	}
	return nil
}

func (s *Service) validateTransfer(ctx context.Context, in TransferInput) (validTransfer, error) {
	var v validTransfer

	date, err := parseDate(in.OccurredOn)
	if err != nil {
		return v, err
	}
	amount, err := parseAmount(in.Amount)
	if err != nil {
		return v, err
	}
	desc := strings.TrimSpace(in.Description)
	if utf8.RuneCountInString(desc) > maxDescLen {
		return v, ErrDescTooLong
	}
	if in.FromAccountID < 1 {
		return v, ErrFromAccountRequired
	}
	if in.ToAccountID < 1 {
		return v, ErrToAccountRequired
	}
	if in.FromAccountID == in.ToAccountID {
		return v, ErrSameAccount
	}
	if err := s.requireAccountErr(ctx, in.FromAccountID, ErrFromAccountNotFound); err != nil {
		return v, err
	}
	if err := s.requireAccountErr(ctx, in.ToAccountID, ErrToAccountNotFound); err != nil {
		return v, err
	}

	var fee *pgtype.Numeric
	if in.Fee != nil && strings.TrimSpace(*in.Fee) != "" {
		f, err := parseAmount(*in.Fee)
		if err != nil {
			return v, err
		}
		fee = &f
		if in.FeeCategoryID == nil {
			return v, ErrFeeCategoryRequired
		}
	}
	if err := requireRef(ctx, in.FeeCategoryID, s.st.GetCategory, ErrCategoryNotFound); err != nil {
		return v, err
	}

	return validTransfer{
		date:   date,
		desc:   desc,
		from:   in.FromAccountID,
		to:     in.ToAccountID,
		amount: amount,
		fee:    fee,
		feeCat: toInt8(in.FeeCategoryID),
		tags:   normalizeTags(in.Tags),
	}, nil
}

// transferRows expands a validated transfer into its rows: an out leg, an in leg
// (equal amount ⇒ out==in holds by construction), and an optional fee row. Pure
// so the row shape is unit-testable without a database.
func transferRows(v validTransfer, group pgtype.UUID) []db.CreateGroupedTransactionParams {
	rows := []db.CreateGroupedTransactionParams{
		{
			OccurredOn:      v.date,
			Description:     v.desc,
			Direction:       "transfer",
			IsInflow:        false,
			Amount:          v.amount,
			AccountID:       v.from,
			TransferGroupID: group,
			Tags:            v.tags,
		},
		{
			OccurredOn:      v.date,
			Description:     v.desc,
			Direction:       "transfer",
			IsInflow:        true,
			Amount:          v.amount,
			AccountID:       v.to,
			TransferGroupID: group,
			Tags:            v.tags,
		},
	}
	if v.fee != nil {
		rows = append(rows, db.CreateGroupedTransactionParams{
			OccurredOn:      v.date,
			Description:     v.desc,
			Direction:       "expense",
			IsInflow:        false,
			Amount:          *v.fee,
			AccountID:       v.from,
			CategoryID:      v.feeCat,
			TransferGroupID: group,
			Tags:            v.tags,
		})
	}
	return rows
}

// newGroupID returns a random v4 UUID for a transfer group (crypto/rand; no dep).
func newGroupID() (pgtype.UUID, error) {
	var b [16]byte
	if _, err := rand.Read(b[:]); err != nil {
		return pgtype.UUID{}, err
	}
	b[6] = (b[6] & 0x0f) | 0x40 // version 4
	b[8] = (b[8] & 0x3f) | 0x80 // variant 10
	return pgtype.UUID{Bytes: b, Valid: true}, nil
}
