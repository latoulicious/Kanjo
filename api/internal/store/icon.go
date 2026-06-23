package store

import (
	"strings"
	"unicode/utf8"
)

const maxIconLen = 50 // lucide names are short kebab-case; 50 is generous headroom

// CleanIcon trims and length-caps a lucide icon name. Stored as-is: the picker
// only sends valid lucide names, so no server-side validation against the set.
// Rune-safe truncation keeps multibyte input from splitting mid-character.
// ponytail: length cap only; add a name allowlist if untrusted clients appear.
func CleanIcon(icon string) string {
	icon = strings.TrimSpace(icon)
	if utf8.RuneCountInString(icon) > maxIconLen {
		return string([]rune(icon)[:maxIconLen])
	}
	return icon
}
