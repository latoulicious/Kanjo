package category

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
	got, err := cleanName("  Food  ")
	if err != nil || got != "Food" {
		t.Fatalf("trim: got %q, %v", got, err)
	}
}
