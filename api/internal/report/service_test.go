package report

import (
	"math/big"
	"testing"

	"github.com/jackc/pgx/v5/pgtype"
)

func num(mantissa int64, exp int32) pgtype.Numeric {
	return pgtype.Numeric{Int: big.NewInt(mantissa), Exp: exp, Valid: true}
}

func TestNumToRatMoney(t *testing.T) {
	cases := []struct {
		in   pgtype.Numeric
		want string
	}{
		{num(150000, -2), "1500.00"},
		{num(50, -2), "0.50"},
		{num(0, 0), "0.00"},
		{num(-123450, -2), "-1234.50"},
		{num(1500, 0), "1500.00"},
		{pgtype.Numeric{}, "0.00"}, // invalid ⇒ 0
	}
	for _, c := range cases {
		if got := money(numToRat(c.in)); got != c.want {
			t.Fatalf("money(numToRat(%+v)): got %q, want %q", c.in, got, c.want)
		}
	}
}

func TestRatio(t *testing.T) {
	half := ratio(big.NewRat(1, 1), big.NewRat(2, 1), 4)
	if half == nil || *half != "0.5000" {
		t.Fatalf("1/2 @4: got %v", half)
	}
	third := ratio(big.NewRat(1, 1), big.NewRat(3, 1), 4)
	if third == nil || *third != "0.3333" {
		t.Fatalf("1/3 @4: got %v", third)
	}
	if r := ratio(big.NewRat(5, 1), new(big.Rat), 2); r != nil {
		t.Fatalf("zero denominator must be nil, got %q", *r)
	}
}

func TestMonthSpan(t *testing.T) {
	cases := []struct {
		from, to string
		want     int
	}{
		{"2026-03-01", "2026-03-31", 1},
		{"2026-01-15", "2026-03-20", 3},
		{"2025-12-01", "2026-02-28", 3},
		{"2026-05-01", "2026-01-01", 1}, // reversed ⇒ floored at 1
	}
	for _, c := range cases {
		a, _ := parseDay(c.from)
		b, _ := parseDay(c.to)
		if got := monthSpan(a, b); got != c.want {
			t.Fatalf("monthSpan(%s,%s): got %d, want %d", c.from, c.to, got, c.want)
		}
	}
}

func TestValidBucket(t *testing.T) {
	for in, want := range map[string]string{"": "month", "month": "month", "week": "week", "day": "day"} {
		if got, err := validBucket(in); err != nil || got != want {
			t.Fatalf("validBucket(%q): got (%q,%v), want (%q,nil)", in, got, err, want)
		}
	}
	if _, err := validBucket("year"); err != ErrBadInterval {
		t.Fatalf("validBucket(year): want ErrBadInterval, got %v", err)
	}
}

func TestResolveWindowExplicit(t *testing.T) {
	from, to := "2026-01-15", "2026-03-20"
	_, _, span, fromStr, toStr, err := resolveWindow(&from, &to)
	if err != nil {
		t.Fatalf("resolveWindow: %v", err)
	}
	if span != 3 || fromStr != from || toStr != to {
		t.Fatalf("got span=%d from=%q to=%q", span, fromStr, toStr)
	}
	bad := "nope"
	if _, _, _, _, _, err := resolveWindow(&bad, nil); err != ErrBadDate {
		t.Fatalf("bad from: want ErrBadDate, got %v", err)
	}
}

func TestResolveWindowDefault(t *testing.T) {
	// No from/to ⇒ trailing defaultBurnMonths ending today; from is a month start.
	_, _, span, fromStr, _, err := resolveWindow(nil, nil)
	if err != nil {
		t.Fatalf("resolveWindow: %v", err)
	}
	if span != defaultBurnMonths {
		t.Fatalf("default span: got %d, want %d", span, defaultBurnMonths)
	}
	d, err := parseDay(fromStr)
	if err != nil || d.Day() != 1 {
		t.Fatalf("default from must be a month start, got %q", fromStr)
	}
}

func TestFromInt8(t *testing.T) {
	if fromInt8(pgtype.Int8{}) != nil {
		t.Fatal("invalid Int8 must be nil")
	}
	if p := fromInt8(pgtype.Int8{Int64: 7, Valid: true}); p == nil || *p != 7 {
		t.Fatalf("valid Int8: got %v", p)
	}
}
