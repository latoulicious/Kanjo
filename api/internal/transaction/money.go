package transaction

import (
	"errors"
	"math/big"
	"strings"

	"github.com/jackc/pgx/v5/pgtype"
)

// NUMERIC(18,2): up to 18 significant digits, 2 of them after the point.
const (
	maxAmountDigits = 18
	amountScale     = 2
)

var (
	ErrAmountRequired = errors.New("amount is required")
	ErrAmountInvalid  = errors.New("amount must be a positive decimal with up to 2 places")
)

// parseAmount validates a decimal string against NUMERIC(18,2) and amount > 0,
// returning it as a pgtype.Numeric. No float: the string is read as a big.Int
// mantissa plus a base-10 exponent, so cents never drift.
func parseAmount(s string) (pgtype.Numeric, error) {
	s = strings.TrimSpace(s)
	if s == "" {
		return pgtype.Numeric{}, ErrAmountRequired
	}
	intPart, fracPart, hasFrac := strings.Cut(s, ".")
	if intPart == "" || (hasFrac && fracPart == "") || len(fracPart) > amountScale {
		return pgtype.Numeric{}, ErrAmountInvalid
	}
	digits := intPart + fracPart
	if !allDigits(digits) || len(digits) > maxAmountDigits {
		return pgtype.Numeric{}, ErrAmountInvalid
	}
	mantissa, ok := new(big.Int).SetString(digits, 10)
	if !ok || mantissa.Sign() <= 0 { // rejects 0 (and any leading-sign string)
		return pgtype.Numeric{}, ErrAmountInvalid
	}
	return pgtype.Numeric{Int: mantissa, Exp: int32(-len(fracPart)), Valid: true}, nil
}

// formatAmount renders a NUMERIC back to a canonical decimal string (value =
// Int * 10^Exp). Postgres returns column scale 2, so reads come back "1500.00".
func formatAmount(n pgtype.Numeric) string {
	if !n.Valid || n.Int == nil {
		return ""
	}
	digits := n.Int.String()
	neg := strings.HasPrefix(digits, "-")
	if neg {
		digits = digits[1:]
	}
	out := digits
	if n.Exp >= 0 {
		out = digits + strings.Repeat("0", int(n.Exp))
	} else {
		scale := int(-n.Exp)
		for len(digits) <= scale {
			digits = "0" + digits
		}
		out = digits[:len(digits)-scale] + "." + digits[len(digits)-scale:]
	}
	if neg {
		return "-" + out
	}
	return out
}

func allDigits(s string) bool {
	for _, r := range s {
		if r < '0' || r > '9' {
			return false
		}
	}
	return len(s) > 0
}
