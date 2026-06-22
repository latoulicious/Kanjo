// A "month" in this app is the pay cycle, payday-to-payday (the 27th) — what you
// actually budget. Helpers compute cycle boundaries as YYYY-MM-DD strings.
// ponytail: PAYDAY hardcoded — single user. Promote to a setting if it varies.
const PAYDAY = 27

export function isoDate(d: Date): string {
  const p = (n: number) => String(n).padStart(2, "0")
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`
}

// Start of the pay cycle on/before `ref`, offset back by `cyclesAgo` cycles.
export function cycleStart(cyclesAgo = 0, ref = new Date()): Date {
  const month = ref.getDate() >= PAYDAY ? ref.getMonth() : ref.getMonth() - 1
  return new Date(ref.getFullYear(), month - cyclesAgo, PAYDAY)
}

// Last day of the cycle before this one (the 26th, today-relative).
export function lastCycleEnd(ref = new Date()): Date {
  const d = cycleStart(0, ref)
  d.setDate(d.getDate() - 1)
  return d
}
