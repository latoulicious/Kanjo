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

func TestLiquidOrDefault(t *testing.T) {
	if !liquidOrDefault(nil) {
		t.Fatal("omitted is_liquid must default to true")
	}
	f := false
	if liquidOrDefault(&f) {
		t.Fatal("explicit false must stay false")
	}
}
