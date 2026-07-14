// Decimal strings on the wire, integer cents in SQLite — never a float.
// Parity with api/internal/transaction/money.go.
import { ApiError } from "../api-error.ts"

// ponytail: 13 digits keeps cents inside Number.MAX_SAFE_INTEGER; BigInt if ever needed
const MAX_INT_DIGITS = 13

function parseCents(s: string): number | null {
  const m = /^(\d+)(?:\.(\d{1,2}))?$/.exec(s)
  if (!m) return null
  const [, int, frac = ""] = m
  if (int.length > MAX_INT_DIGITS) return null
  return Number(int) * 100 + Number(frac.padEnd(2, "0"))
}

export function amountToCents(s: unknown): number {
  const t = typeof s === "string" ? s.trim() : ""
  if (t === "") throw new ApiError(400, "amount is required")
  const cents = parseCents(t)
  if (cents === null || cents <= 0) {
    throw new ApiError(400, "amount must be a positive decimal with up to 2 places")
  }
  return cents
}

// target_amount / monthly_budget: null or "" clears the value.
export function optionalCents(s: string | null | undefined, msg: string): number | null {
  if (s == null) return null
  const t = s.trim()
  if (t === "") return null
  const cents = parseCents(t)
  if (cents === null || cents <= 0) throw new ApiError(400, msg)
  return cents
}

export function centsToAmount(c: number): string {
  const neg = c < 0
  const s = String(Math.abs(c)).padStart(3, "0")
  return `${neg ? "-" : ""}${s.slice(0, -2)}.${s.slice(-2)}`
}
