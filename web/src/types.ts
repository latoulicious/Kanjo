// Mirrors the API wire contract (api/internal/*/service.go). Code is the source
// of truth; keep these in sync. Money is a decimal string ("185000.00") — never
// parse to float for arithmetic.

export interface Account {
  id: number
  name: string
  is_liquid: boolean
  icon: string // lucide icon name (kebab-case), "" = none
  target_amount: string | null // savings goal target, null = plain account
  balance: string // signed decimal string, from the list endpoint
  created_at: string
}
export interface AccountInput {
  name: string
  is_liquid?: boolean
  icon: string
  target_amount?: string | null
}

export interface Category {
  id: number
  name: string
  icon: string // lucide icon name (kebab-case), "" = none
  monthly_budget: string | null // per-cycle limit, null = no budget
  created_at: string
}
export interface CategoryInput {
  name: string
  icon: string
  monthly_budget?: string | null
}

export interface Project {
  id: number
  name: string
  icon: string // lucide icon name (kebab-case), "" = none
  created_at: string
}
export interface ProjectInput {
  name: string
  icon: string
}

export type Direction = "income" | "expense" | "transfer"

export interface Transaction {
  id: number
  occurred_on: string
  description: string
  direction: Direction
  is_inflow: boolean
  amount: string
  account_id: number
  category_id: number | null
  project_id: number | null
  transfer_group_id: string | null
  tags: string[]
  created_at: string
}
// Input omits derived fields; direction is income|expense only (a lone transfer
// leg is never written via single-entry CRUD).
export interface TransactionInput {
  occurred_on: string
  description: string
  direction: "income" | "expense"
  amount: string
  account_id: number
  category_id?: number | null
  project_id?: number | null
  tags: string[]
}
export interface TransactionFilter {
  from?: string
  to?: string
  account_id?: number
  category_id?: number
  project_id?: number
}

export interface TransferInput {
  occurred_on: string
  description: string
  from_account_id: number
  to_account_id: number
  amount: string
  fee?: string | null
  fee_category_id?: number | null
  tags: string[]
}
export interface TransferResult {
  transfer_group_id: string
  transactions: Transaction[]
}

// A saved transaction template surfaced on the dashboard when due. last_posted
// is the YYYY-MM-DD it was last logged, null = never (always due once past day).
export interface Recurring {
  id: number
  description: string
  direction: "income" | "expense"
  amount: string
  account_id: number
  category_id: number | null
  day_of_month: number
  last_posted: string | null
  created_at: string
}
export interface RecurringInput {
  description: string
  direction: "income" | "expense"
  amount: string
  account_id: number
  category_id?: number | null
  day_of_month: number
}

export interface ReportSummary {
  from: string
  to: string
  current_balance: string
  liquid_balance: string
  income: string
  expense: string
  net: string
  savings_rate: string | null
  monthly_burn: string
  runway_months: string | null
}
export interface CashFlowPoint {
  period: string
  income: string
  expense: string
  net: string
}
export interface CategoryTotal {
  category_id: number | null
  name: string
  total: string
}
export interface ProjectTotal {
  project_id: number
  name: string
  total: string
}
export interface BalancePoint {
  period: string
  balance: string
}
export type ReportInterval = "day" | "week" | "month"
