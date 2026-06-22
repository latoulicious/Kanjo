package report

import (
	"context"
	"errors"
	"math/big"
	"strings"
	"time"

	"github.com/jackc/pgx/v5/pgtype"

	"github.com/latoulicious/kanjo/api/internal/store"
	"github.com/latoulicious/kanjo/api/internal/store/db"
)

// defaultBurnMonths is the trailing window for monthly burn / runway when the
// caller gives no from/to (the last N calendar months, inclusive of the to month).
const (
	dateLayout        = "2006-01-02"
	defaultBurnMonths = 3
)

var (
	ErrBadDate     = errors.New("date must be YYYY-MM-DD")
	ErrBadInterval = errors.New("interval must be day, week, or month")
)

// Summary is the operational snapshot. Money fields are decimal strings;
// savings_rate/runway_months are null when their denominator is 0 (income 0,
// burn 0 ⇒ undefined / "infinite").
type Summary struct {
	From           string  `json:"from"`
	To             string  `json:"to"`
	CurrentBalance string  `json:"current_balance"`
	LiquidBalance  string  `json:"liquid_balance"`
	Income         string  `json:"income"`
	Expense        string  `json:"expense"`
	Net            string  `json:"net"`
	SavingsRate    *string `json:"savings_rate"`
	MonthlyBurn    string  `json:"monthly_burn"`
	RunwayMonths   *string `json:"runway_months"`
}

type CashFlowPoint struct {
	Period  string `json:"period"`
	Income  string `json:"income"`
	Expense string `json:"expense"`
	Net     string `json:"net"`
}

type CategoryTotal struct {
	CategoryID *int64 `json:"category_id"`
	Name       string `json:"name"`
	Total      string `json:"total"`
}

type ProjectTotal struct {
	ProjectID int64  `json:"project_id"`
	Name      string `json:"name"`
	Total     string `json:"total"`
}

type BalancePoint struct {
	Period  string `json:"period"`
	Balance string `json:"balance"`
}

type Service struct {
	st *store.Store
}

func NewService(st *store.Store) *Service {
	return &Service{st: st}
}

// Summary derives current/liquid balance (all-time stock) plus windowed flow
// (income/expense/savings/burn) and runway. The window defaults to the trailing
// defaultBurnMonths so burn and runway have a defined basis.
func (s *Service) Summary(ctx context.Context, from, to *string) (Summary, error) {
	fromD, toD, span, fromStr, toStr, err := resolveWindow(from, to)
	if err != nil {
		return Summary{}, err
	}
	bt, err := s.st.BalanceTotals(ctx)
	if err != nil {
		return Summary{}, store.Classify(err)
	}
	wt, err := s.st.WindowTotals(ctx, db.WindowTotalsParams{From: fromD, To: toD})
	if err != nil {
		return Summary{}, store.Classify(err)
	}

	liq := numToRat(bt.LiquidBalance)
	inc := numToRat(wt.Income)
	exp := numToRat(wt.Expense)
	net := new(big.Rat).Sub(inc, exp)
	burn := new(big.Rat).Quo(exp, new(big.Rat).SetInt64(int64(span)))

	return Summary{
		From:           fromStr,
		To:             toStr,
		CurrentBalance: money(numToRat(bt.CurrentBalance)),
		LiquidBalance:  money(liq),
		Income:         money(inc),
		Expense:        money(exp),
		Net:            money(net),
		SavingsRate:    ratio(net, inc, 4),
		MonthlyBurn:    money(burn),
		RunwayMonths:   ratio(liq, burn, 2),
	}, nil
}

func (s *Service) CashFlow(ctx context.Context, from, to *string, interval string) ([]CashFlowPoint, error) {
	bucket, err := validBucket(interval)
	if err != nil {
		return nil, err
	}
	fromD, toD, err := optRange(from, to)
	if err != nil {
		return nil, err
	}
	rows, err := s.st.CashFlowByPeriod(ctx, db.CashFlowByPeriodParams{Bucket: bucket, From: fromD, To: toD})
	if err != nil {
		return nil, store.Classify(err)
	}
	out := make([]CashFlowPoint, len(rows))
	for i, r := range rows {
		inc := numToRat(r.Income)
		exp := numToRat(r.Expense)
		out[i] = CashFlowPoint{
			Period:  r.Period.Time.Format(dateLayout),
			Income:  money(inc),
			Expense: money(exp),
			Net:     money(new(big.Rat).Sub(inc, exp)),
		}
	}
	return out, nil
}

func (s *Service) Categories(ctx context.Context, from, to *string) ([]CategoryTotal, error) {
	fromD, toD, err := optRange(from, to)
	if err != nil {
		return nil, err
	}
	rows, err := s.st.CategoryTotals(ctx, db.CategoryTotalsParams{From: fromD, To: toD})
	if err != nil {
		return nil, store.Classify(err)
	}
	out := make([]CategoryTotal, len(rows))
	for i, r := range rows {
		out[i] = CategoryTotal{
			CategoryID: fromInt8(r.CategoryID),
			Name:       r.Name,
			Total:      money(numToRat(r.Total)),
		}
	}
	return out, nil
}

func (s *Service) Projects(ctx context.Context, from, to *string) ([]ProjectTotal, error) {
	fromD, toD, err := optRange(from, to)
	if err != nil {
		return nil, err
	}
	rows, err := s.st.ProjectTotals(ctx, db.ProjectTotalsParams{From: fromD, To: toD})
	if err != nil {
		return nil, store.Classify(err)
	}
	out := make([]ProjectTotal, len(rows))
	for i, r := range rows {
		out[i] = ProjectTotal{
			ProjectID: r.ProjectID,
			Name:      r.Name,
			Total:     money(numToRat(r.Total)),
		}
	}
	return out, nil
}

// BalanceTrend is the cumulative signed balance per period. It takes no from:
// the running total is summed from the earliest row, so callers slice client-side.
func (s *Service) BalanceTrend(ctx context.Context, to *string, interval string) ([]BalancePoint, error) {
	bucket, err := validBucket(interval)
	if err != nil {
		return nil, err
	}
	toD, err := optDate(to)
	if err != nil {
		return nil, err
	}
	rows, err := s.st.BalanceByPeriod(ctx, db.BalanceByPeriodParams{Bucket: bucket, To: toD})
	if err != nil {
		return nil, store.Classify(err)
	}
	running := new(big.Rat)
	out := make([]BalancePoint, len(rows))
	for i, r := range rows {
		running.Add(running, numToRat(r.Net))
		out[i] = BalancePoint{
			Period:  r.Period.Time.Format(dateLayout),
			Balance: money(new(big.Rat).Set(running)),
		}
	}
	return out, nil
}

// resolveWindow returns the [from, to] dates, the inclusive month span, and the
// echoed date strings. Missing to ⇒ today; missing from ⇒ trailing defaultBurnMonths.
func resolveWindow(from, to *string) (pgtype.Date, pgtype.Date, int, string, string, error) {
	toT := time.Now()
	if to != nil {
		t, err := parseDay(*to)
		if err != nil {
			return pgtype.Date{}, pgtype.Date{}, 0, "", "", err
		}
		toT = t
	}
	var fromT time.Time
	if from != nil {
		t, err := parseDay(*from)
		if err != nil {
			return pgtype.Date{}, pgtype.Date{}, 0, "", "", err
		}
		fromT = t
	} else {
		fromT = firstOfMonth(toT).AddDate(0, -(defaultBurnMonths - 1), 0)
	}
	return dateOf(fromT), dateOf(toT), monthSpan(fromT, toT), fromT.Format(dateLayout), toT.Format(dateLayout), nil
}

// monthSpan counts calendar months in [a, b] inclusive, floored at 1 so burn
// never divides by zero.
func monthSpan(a, b time.Time) int {
	n := (b.Year()*12 + int(b.Month())) - (a.Year()*12 + int(a.Month())) + 1
	if n < 1 {
		return 1
	}
	return n
}

func firstOfMonth(t time.Time) time.Time {
	return time.Date(t.Year(), t.Month(), 1, 0, 0, 0, 0, t.Location())
}

func validBucket(interval string) (string, error) {
	switch strings.TrimSpace(interval) {
	case "", "month":
		return "month", nil
	case "week", "day":
		return strings.TrimSpace(interval), nil
	default:
		return "", ErrBadInterval
	}
}

func optRange(from, to *string) (pgtype.Date, pgtype.Date, error) {
	fromD, err := optDate(from)
	if err != nil {
		return pgtype.Date{}, pgtype.Date{}, err
	}
	toD, err := optDate(to)
	if err != nil {
		return pgtype.Date{}, pgtype.Date{}, err
	}
	return fromD, toD, nil
}

func optDate(s *string) (pgtype.Date, error) {
	if s == nil {
		return pgtype.Date{}, nil
	}
	t, err := parseDay(*s)
	if err != nil {
		return pgtype.Date{}, err
	}
	return dateOf(t), nil
}

func parseDay(s string) (time.Time, error) {
	t, err := time.Parse(dateLayout, strings.TrimSpace(s))
	if err != nil {
		return time.Time{}, ErrBadDate
	}
	return t, nil
}

func dateOf(t time.Time) pgtype.Date {
	return pgtype.Date{Time: t, Valid: true}
}

// numToRat converts a NUMERIC (mantissa Int × 10^Exp) to an exact big.Rat; an
// invalid/empty value is 0. Exact decimal keeps sums and ratios off float.
func numToRat(n pgtype.Numeric) *big.Rat {
	r := new(big.Rat)
	if !n.Valid || n.Int == nil {
		return r
	}
	r.SetInt(n.Int)
	if n.Exp == 0 {
		return r
	}
	exp := int64(n.Exp)
	if exp < 0 {
		exp = -exp
	}
	pow := new(big.Int).Exp(big.NewInt(10), big.NewInt(exp), nil)
	if n.Exp < 0 {
		return r.Quo(r, new(big.Rat).SetInt(pow))
	}
	return r.Mul(r, new(big.Rat).SetInt(pow))
}

// money renders a rat as a fixed 2-place decimal string (the wire money format).
func money(r *big.Rat) string {
	return r.FloatString(2)
}

// ratio is num/den to places decimals, or nil when den is 0 (undefined ratio).
func ratio(num, den *big.Rat, places int) *string {
	if den.Sign() == 0 {
		return nil
	}
	s := new(big.Rat).Quo(num, den).FloatString(places)
	return &s
}

func fromInt8(v pgtype.Int8) *int64 {
	if !v.Valid {
		return nil
	}
	n := v.Int64
	return &n
}
