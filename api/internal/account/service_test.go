package account

import (
	"strings"
	"testing"
)

func TestCleanName(t *testing.T) {
	if _, err := cleanName("   "); err != ErrEmptyName {
		t.Fatalf("blank: got %v, want ErrEmptyName", err)
	}
	if _, err := cleanName(strings.Repeat("x", maxNameLen+1)); err != ErrNameTooLong {
		t.Fatalf("too long: got %v, want ErrNameTooLong", err)
	}
	got, err := cleanName("  BCA  ")
	if err != nil || got != "BCA" {
		t.Fatalf("trim: got %q, %v", got, err)
	}
}

func TestParseTarget(t *testing.T) {
	ptr := func(s string) *string { return &s }
	// nil and "" mean "no goal" → a NULL (invalid) Numeric, no error.
	for _, in := range []*string{nil, ptr(""), ptr("  ")} {
		n, err := parseTarget(in)
		if err != nil || n.Valid {
			t.Fatalf("no-target %v: got valid=%v err=%v", in, n.Valid, err)
		}
	}
	for _, ok := range []string{"100000000", "750000.50", "0.01", "9999999999999999.99"} {
		n, err := parseTarget(ptr(ok))
		if err != nil || !n.Valid {
			t.Fatalf("valid %q: got valid=%v err=%v", ok, n.Valid, err)
		}
	}
	// 17 integer digits overflows NUMERIC(18,2) once padded to scale 2.
	for _, bad := range []string{"-5", "0", "abc", "1.234", "12345678901234567.8"} {
		if _, err := parseTarget(ptr(bad)); err != ErrBadTarget {
			t.Fatalf("bad %q: got %v, want ErrBadTarget", bad, err)
		}
	}
}

func TestLiquidOrDefault(t *testing.T) {
	if !liquidOrDefault(nil) {
		t.Fatal("omitted is_liquid must default to true")
	}
	f := false
	if liquidOrDefault(&f) {
		t.Fatal("explicit false must stay false")
	}
}
