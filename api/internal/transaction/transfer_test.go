package transaction

import (
	"testing"

	"github.com/jackc/pgx/v5/pgtype"
)

func mustAmount(t *testing.T, s string) pgtype.Numeric {
	t.Helper()
	n, err := parseAmount(s)
	if err != nil {
		t.Fatalf("parseAmount(%q): %v", s, err)
	}
	return n
}

func TestTransferRowsNoFee(t *testing.T) {
	group, err := newGroupID()
	if err != nil {
		t.Fatal(err)
	}
	v := validTransfer{
		date:   pgtype.Date{Valid: true},
		from:   1,
		to:     2,
		amount: mustAmount(t, "500000"),
		tags:   []string{},
	}
	rows := transferRows(v, group)
	if len(rows) != 2 {
		t.Fatalf("no fee: want 2 rows, got %d", len(rows))
	}
	out, in := rows[0], rows[1]
	if out.Direction != "transfer" || out.IsInflow || out.AccountID != 1 {
		t.Fatalf("out leg wrong: %+v", out)
	}
	if in.Direction != "transfer" || !in.IsInflow || in.AccountID != 2 {
		t.Fatalf("in leg wrong: %+v", in)
	}
	// out==in by construction: both legs carry the same amount.
	if formatAmount(out.Amount) != formatAmount(in.Amount) {
		t.Fatalf("out!=in: %s vs %s", formatAmount(out.Amount), formatAmount(in.Amount))
	}
	for _, r := range rows {
		if !r.TransferGroupID.Valid || r.TransferGroupID != group {
			t.Fatalf("row not in group: %+v", r)
		}
	}
}

func TestTransferRowsWithFee(t *testing.T) {
	group, _ := newGroupID()
	fee := mustAmount(t, "2500")
	v := validTransfer{
		date:   pgtype.Date{Valid: true},
		desc:   "to emergency",
		from:   1,
		to:     2,
		amount: mustAmount(t, "500000"),
		fee:    &fee,
		feeCat: pgtype.Int8{Int64: 7, Valid: true},
		tags:   []string{},
	}
	rows := transferRows(v, group)
	if len(rows) != 3 {
		t.Fatalf("with fee: want 3 rows, got %d", len(rows))
	}
	feeRow := rows[2]
	if feeRow.Direction != "expense" || feeRow.IsInflow {
		t.Fatalf("fee must be an expense outflow: %+v", feeRow)
	}
	if feeRow.AccountID != 1 {
		t.Fatalf("fee must be charged to source: got account %d", feeRow.AccountID)
	}
	if !feeRow.CategoryID.Valid || feeRow.CategoryID.Int64 != 7 {
		t.Fatalf("fee category not carried: %+v", feeRow.CategoryID)
	}
	// fee row reads distinctly from the legs, not a copy of the transfer desc.
	if feeRow.Description == v.desc || feeRow.Description != "to emergency (fee)" {
		t.Fatalf("fee desc not distinct: %q", feeRow.Description)
	}
}

func TestFeeDescBlank(t *testing.T) {
	if got := feeDesc(""); got != "Transfer fee" {
		t.Fatalf("blank desc: want %q, got %q", "Transfer fee", got)
	}
}

func TestNewGroupIDIsV4(t *testing.T) {
	u, err := newGroupID()
	if err != nil {
		t.Fatal(err)
	}
	if !u.Valid {
		t.Fatal("group id not valid")
	}
	if v := u.Bytes[6] >> 4; v != 0x4 {
		t.Fatalf("version nibble: got %x, want 4", v)
	}
	if variant := u.Bytes[8] >> 6; variant != 0b10 {
		t.Fatalf("variant bits: got %b, want 10", variant)
	}
	// distinct from a second draw
	u2, _ := newGroupID()
	if u.Bytes == u2.Bytes {
		t.Fatal("two group ids collided")
	}
}
