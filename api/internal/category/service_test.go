package category

import (
	"strings"
	"testing"
)

func TestParseBudget(t *testing.T) {
	ptr := func(s string) *string { return &s }
	// nil and "" mean "no budget" → a NULL (invalid) Numeric, no error.
	for _, in := range []*string{nil, ptr(""), ptr("  ")} {
		n, err := parseBudget(in)
		if err != nil || n.Valid {
			t.Fatalf("no-budget %v: got valid=%v err=%v", in, n.Valid, err)
		}
	}
	for _, ok := range []string{"1000000", "750000.50", "0.01", "9999999999999999.99"} {
		n, err := parseBudget(ptr(ok))
		if err != nil || !n.Valid {
			t.Fatalf("valid %q: got valid=%v err=%v", ok, n.Valid, err)
		}
	}
	// 17 integer digits overflows NUMERIC(18,2) once padded to scale 2.
	for _, bad := range []string{"-5", "0", "abc", "1.234", "12345678901234567.8"} {
		if _, err := parseBudget(ptr(bad)); err != ErrBadBudget {
			t.Fatalf("bad %q: got %v, want ErrBadBudget", bad, err)
		}
	}
}

func TestCleanName(t *testing.T) {
	if _, err := cleanName("   "); err != ErrEmptyName {
		t.Fatalf("blank: got %v, want ErrEmptyName", err)
	}
	if _, err := cleanName(strings.Repeat("x", maxNameLen+1)); err != ErrNameTooLong {
		t.Fatalf("too long: got %v, want ErrNameTooLong", err)
	}
	got, err := cleanName("  Food  ")
	if err != nil || got != "Food" {
		t.Fatalf("trim: got %q, %v", got, err)
	}
}
