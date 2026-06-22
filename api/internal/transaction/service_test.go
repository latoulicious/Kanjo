package transaction

import "testing"

func TestParseAmount(t *testing.T) {
	ok := []struct {
		in   string
		want string // canonical formatAmount round-trip
	}{
		{"150000", "150000"},
		{"493500.00", "493500.00"},
		{"0.50", "0.50"},
		{"1234567890123456.78", "1234567890123456.78"}, // 18 digits, the max
		{"  1500  ", "1500"},
	}
	for _, c := range ok {
		n, err := parseAmount(c.in)
		if err != nil {
			t.Fatalf("parseAmount(%q): unexpected err %v", c.in, err)
		}
		if got := formatAmount(n); got != c.want {
			t.Fatalf("round-trip(%q): got %q, want %q", c.in, got, c.want)
		}
	}

	bad := []string{"", "0", "00", "-5", "1.234", "abc", "1.", ".5", "1e3",
		"12345678901234567.89"} // 19 digits, over NUMERIC(18,2)
	for _, in := range bad {
		if _, err := parseAmount(in); err == nil {
			t.Fatalf("parseAmount(%q): want error, got nil", in)
		}
	}
}

func TestFlowFor(t *testing.T) {
	if v, err := flowFor("income"); err != nil || !v {
		t.Fatalf("income: got (%v,%v), want (true,nil)", v, err)
	}
	if v, err := flowFor("expense"); err != nil || v {
		t.Fatalf("expense: got (%v,%v), want (false,nil)", v, err)
	}
	if _, err := flowFor("transfer"); err != ErrBadDirection {
		t.Fatalf("transfer: got %v, want ErrBadDirection", err)
	}
}

func TestParseDate(t *testing.T) {
	if _, err := parseDate("2026-06-21"); err != nil {
		t.Fatalf("valid date: %v", err)
	}
	for _, bad := range []string{"", "21-06-2026", "2026/06/21", "nope"} {
		if _, err := parseDate(bad); err != ErrBadDate {
			t.Fatalf("parseDate(%q): want ErrBadDate, got %v", bad, err)
		}
	}
}

func TestNormalizeTags(t *testing.T) {
	got := normalizeTags([]string{" vps ", "", "  ", "domain"})
	if len(got) != 2 || got[0] != "vps" || got[1] != "domain" {
		t.Fatalf("normalizeTags: got %#v", got)
	}
	if got := normalizeTags(nil); got == nil || len(got) != 0 {
		t.Fatalf("nil tags must normalize to empty non-nil slice, got %#v", got)
	}
}
