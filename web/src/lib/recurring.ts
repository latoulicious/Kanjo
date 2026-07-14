import { isoDate } from "@/lib/cycle"
import type { Recurring } from "@/types"

// Most recent occurrence on-or-before ref, clamping day to the month's length
// (a day-31 rule lands on Feb 28). Returns a YYYY-MM-DD string.
export function occurrenceISO(day: number, ref: Date): string {
  const y = ref.getFullYear()
  const m = ref.getMonth()
  const clamp = (year: number, month: number) =>
    Math.min(day, new Date(year, month + 1, 0).getDate())

  const thisMonth = new Date(y, m, clamp(y, m))
  if (ref >= thisMonth) return isoDate(thisMonth)

  // Not reached yet this month → last occurrence is the previous month.
  const py = m === 0 ? y - 1 : y
  const pm = m === 0 ? 11 : m - 1
  return isoDate(new Date(py, pm, clamp(py, pm)))
}

// Due when the latest occurrence has passed and it hasn't been posted for that
// occurrence. last_posted is compared as a string (YYYY-MM-DD sorts
// chronologically) to avoid timezone drift from new Date().
export function isDue(rule: Recurring, ref = new Date()): boolean {
  const occ = occurrenceISO(rule.day_of_month, ref)
  return !rule.last_posted || rule.last_posted < occ
}
