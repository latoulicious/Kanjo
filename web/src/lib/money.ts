// Wire money is a decimal string ("185000.00"); this is display only — never
// parse to float for arithmetic (the server owns the math).
// ponytail: Number() is exact for IDR amounts well under 2^53; reach for a
// decimal lib only if amounts ever exceed that.
const idr = new Intl.NumberFormat("id-ID", { maximumFractionDigits: 0 })

export function formatAmount(amount: string): string {
  const n = Number(amount)
  return Number.isFinite(n) ? `Rp ${idr.format(n)}` : amount
}
