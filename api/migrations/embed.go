package migrations

import "embed"

// FS is the embedded goose migration set, applied at API boot.
//
//go:embed *.sql
var FS embed.FS
