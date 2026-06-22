import { z } from "zod"

// "none" sentinel for optional FK selects (Radix Select forbids an empty value).
export const NONE = "none"

export const dateField = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Date is required")

// Mirrors the API's NUMERIC(18,2), amount > 0 (transaction/money.go).
export const amountField = z
  .string()
  .regex(/^\d+(\.\d{1,2})?$/, "Positive amount, up to 2 decimals")
  .refine((v) => Number(v) > 0, "Must be greater than 0")

export function splitTags(raw: string): string[] {
  return raw
    .split(",")
    .map((t) => t.trim())
    .filter(Boolean)
}

export function todayStr(): string {
  const d = new Date()
  const m = String(d.getMonth() + 1).padStart(2, "0")
  const day = String(d.getDate()).padStart(2, "0")
  return `${d.getFullYear()}-${m}-${day}`
}
