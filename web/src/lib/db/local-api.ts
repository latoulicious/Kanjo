// Serves the /api/v1 surface from local SQLite on device. Wire shapes, error
// messages, and validation order mirror api/internal/* — parity is the contract.
import { ApiError } from "../api-error.ts"
import type { Db } from "./schema.ts"
import { amountToCents, optionalCents, centsToAmount } from "./money.ts"
import type {
  Account,
  AccountInput,
  Category,
  CategoryInput,
  Project,
  ProjectInput,
  Transaction,
  TransactionInput,
  TransferInput,
  TransferResult,
  Recurring,
  RecurringInput,
} from "../../types"

const bad = (msg: string) => new ApiError(400, msg)
const notFound = () => new ApiError(404, "not found")
const conflict = (msg: string) => new ApiError(409, msg)

const nowIso = () => new Date().toISOString()
const newUuid = () => crypto.randomUUID()

const DATE_RE = /^(\d{4})-(\d{2})-(\d{2})$/

function validDate(s: unknown): s is string {
  if (typeof s !== "string") return false
  const m = DATE_RE.exec(s)
  if (!m) return false
  const [, y, mo, d] = m.map(Number)
  const dt = new Date(Date.UTC(y, mo - 1, d))
  return dt.getUTCMonth() === mo - 1 && dt.getUTCDate() === d
}

function today(): string {
  const d = new Date()
  const p = (n: number) => String(n).padStart(2, "0")
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`
}

function cleanName(name: unknown): string {
  const n = typeof name === "string" ? name.trim() : ""
  if (!n) throw bad("name is required")
  if ([...n].length > 100) throw bad("name exceeds 100 characters")
  return n
}

function cleanIcon(icon: unknown): string {
  const s = typeof icon === "string" ? icon.trim() : ""
  return [...s].slice(0, 50).join("")
}

function cleanDesc(desc: unknown): string {
  const s = typeof desc === "string" ? desc.trim() : ""
  if ([...s].length > 500) throw bad("description exceeds 500 characters")
  return s
}

function cleanTags(tags: unknown): string[] {
  if (!Array.isArray(tags)) return []
  return tags.map((t) => String(t).trim()).filter(Boolean)
}

interface AccountRow {
  id: number
  name: string
  is_liquid: number
  icon: string
  target_amount_cents: number | null
  created_at: string
}
interface NamedRow {
  id: number
  name: string
  icon: string
  monthly_budget_cents: number | null
  created_at: string
}
interface TxRow {
  id: number
  occurred_on: string
  description: string
  direction: "income" | "expense" | "transfer"
  is_inflow: number
  amount_cents: number
  account_id: number
  category_id: number | null
  project_id: number | null
  transfer_group_id: string | null
  tags: string
  created_at: string
}
interface RecurringRow {
  id: number
  description: string
  direction: "income" | "expense"
  amount_cents: number
  account_id: number
  category_id: number | null
  day_of_month: number
  last_posted: string | null
  created_at: string
}

async function liveRow<T>(db: Db, table: string, id: number): Promise<T | undefined> {
  const rows = await db.query<T>(`SELECT * FROM ${table} WHERE id = ? AND deleted_at IS NULL`, [id])
  return rows[0]
}

async function requireLiveRef(db: Db, table: string, id: number | null | undefined, msg: string) {
  if (id == null) return
  if (!(Number.isInteger(id) && id >= 1) || !(await liveRow(db, table, id))) throw bad(msg)
}

async function assertNameFree(db: Db, table: string, name: string, excludeId?: number) {
  const rows = excludeId
    ? await db.query(`SELECT id FROM ${table} WHERE name = ? AND deleted_at IS NULL AND id != ?`, [name, excludeId])
    : await db.query(`SELECT id FROM ${table} WHERE name = ? AND deleted_at IS NULL`, [name])
  if (rows.length) throw conflict("name already in use")
}

function softDeleteStamp() {
  const now = nowIso()
  return { now, set: "deleted_at = ?, dirty = 1, updated_at = ?" }
}

// ---- accounts -------------------------------------------------------------

// Single-row endpoints return balance "0.00" like the server; only List sums it.
function toAccount(r: AccountRow, balanceCents = 0): Account {
  return {
    id: r.id,
    name: r.name,
    is_liquid: !!r.is_liquid,
    icon: r.icon,
    target_amount: r.target_amount_cents == null ? null : centsToAmount(r.target_amount_cents),
    balance: centsToAmount(balanceCents),
    created_at: r.created_at,
  }
}

async function listAccounts(db: Db): Promise<Account[]> {
  const rows = await db.query<AccountRow & { balance_cents: number }>(`
    SELECT a.*, COALESCE(SUM(CASE WHEN t.is_inflow = 1 THEN t.amount_cents ELSE -t.amount_cents END), 0) AS balance_cents
    FROM accounts a
    LEFT JOIN transactions t ON t.account_id = a.id AND t.deleted_at IS NULL
    WHERE a.deleted_at IS NULL
    GROUP BY a.id
    ORDER BY (CASE lower(a.name) WHEN 'cash' THEN 1 WHEN 'investment' THEN 2 ELSE 0 END), a.name`)
  return rows.map((r) => toAccount(r, r.balance_cents))
}

function parseAccountInput(input: AccountInput) {
  return {
    name: cleanName(input.name),
    is_liquid: input.is_liquid ?? true,
    icon: cleanIcon(input.icon),
    target: optionalCents(input.target_amount, "goal target must be a positive amount, up to 2 decimals"),
  }
}

async function createAccount(db: Db, input: AccountInput): Promise<Account> {
  const v = parseAccountInput(input)
  await assertNameFree(db, "accounts", v.name)
  const now = nowIso()
  const r = await db.run(
    `INSERT INTO accounts (name, is_liquid, icon, target_amount_cents, uuid, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [v.name, v.is_liquid ? 1 : 0, v.icon, v.target, newUuid(), now, now],
  )
  return toAccount((await liveRow<AccountRow>(db, "accounts", r.lastId))!)
}

async function updateAccount(db: Db, id: number, input: AccountInput): Promise<Account> {
  const v = parseAccountInput(input)
  if (!(await liveRow(db, "accounts", id))) throw notFound()
  await assertNameFree(db, "accounts", v.name, id)
  await db.run(
    `UPDATE accounts SET name = ?, is_liquid = ?, icon = ?, target_amount_cents = ?, dirty = 1, updated_at = ? WHERE id = ?`,
    [v.name, v.is_liquid ? 1 : 0, v.icon, v.target, nowIso(), id],
  )
  return toAccount((await liveRow<AccountRow>(db, "accounts", id))!)
}

// Server FK is ON DELETE RESTRICT — block while live rows reference the account.
async function deleteAccount(db: Db, id: number): Promise<void> {
  if (!(await liveRow(db, "accounts", id))) throw notFound()
  const [{ n }] = await db.query<{ n: number }>(
    `SELECT (SELECT COUNT(*) FROM transactions WHERE account_id = ?1 AND deleted_at IS NULL)
          + (SELECT COUNT(*) FROM recurring    WHERE account_id = ?1 AND deleted_at IS NULL) AS n`,
    [id],
  )
  if (n > 0) throw conflict("account is referenced by existing transactions")
  const { now, set } = softDeleteStamp()
  await db.run(`UPDATE accounts SET ${set} WHERE id = ?`, [now, now, id])
}

// ---- categories & projects ------------------------------------------------

function toCategory(r: NamedRow): Category {
  return {
    id: r.id,
    name: r.name,
    icon: r.icon,
    monthly_budget: r.monthly_budget_cents == null ? null : centsToAmount(r.monthly_budget_cents),
    created_at: r.created_at,
  }
}

const toProject = (r: NamedRow): Project => ({ id: r.id, name: r.name, icon: r.icon, created_at: r.created_at })

async function writeCategory(db: Db, id: number | null, input: CategoryInput): Promise<Category> {
  const name = cleanName(input.name)
  const icon = cleanIcon(input.icon)
  const budget = optionalCents(input.monthly_budget, "monthly budget must be a positive amount, up to 2 decimals")
  if (id != null && !(await liveRow(db, "categories", id))) throw notFound()
  await assertNameFree(db, "categories", name, id ?? undefined)
  const now = nowIso()
  let rowId = id
  if (id == null) {
    const r = await db.run(
      `INSERT INTO categories (name, icon, monthly_budget_cents, uuid, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)`,
      [name, icon, budget, newUuid(), now, now],
    )
    rowId = r.lastId
  } else {
    await db.run(`UPDATE categories SET name = ?, icon = ?, monthly_budget_cents = ?, dirty = 1, updated_at = ? WHERE id = ?`, [
      name,
      icon,
      budget,
      now,
      id,
    ])
  }
  return toCategory((await liveRow<NamedRow>(db, "categories", rowId!))!)
}

async function writeProject(db: Db, id: number | null, input: ProjectInput): Promise<Project> {
  const name = cleanName(input.name)
  const icon = cleanIcon(input.icon)
  if (id != null && !(await liveRow(db, "projects", id))) throw notFound()
  await assertNameFree(db, "projects", name, id ?? undefined)
  const now = nowIso()
  let rowId = id
  if (id == null) {
    const r = await db.run(`INSERT INTO projects (name, icon, uuid, created_at, updated_at) VALUES (?, ?, ?, ?, ?)`, [
      name,
      icon,
      newUuid(),
      now,
      now,
    ])
    rowId = r.lastId
  } else {
    await db.run(`UPDATE projects SET name = ?, icon = ?, dirty = 1, updated_at = ? WHERE id = ?`, [name, icon, now, id])
  }
  return toProject((await liveRow<NamedRow>(db, "projects", rowId!))!)
}

// Server FK is ON DELETE SET NULL — null out referencing rows, mark them dirty.
async function deleteCategory(db: Db, id: number): Promise<void> {
  if (!(await liveRow(db, "categories", id))) throw notFound()
  const { now, set } = softDeleteStamp()
  await db.run(`UPDATE transactions SET category_id = NULL, dirty = 1, updated_at = ? WHERE category_id = ? AND deleted_at IS NULL`, [now, id])
  await db.run(`UPDATE recurring SET category_id = NULL, dirty = 1, updated_at = ? WHERE category_id = ? AND deleted_at IS NULL`, [now, id])
  await db.run(`UPDATE categories SET ${set} WHERE id = ?`, [now, now, id])
}

async function deleteProject(db: Db, id: number): Promise<void> {
  if (!(await liveRow(db, "projects", id))) throw notFound()
  const { now, set } = softDeleteStamp()
  await db.run(`UPDATE transactions SET project_id = NULL, dirty = 1, updated_at = ? WHERE project_id = ? AND deleted_at IS NULL`, [now, id])
  await db.run(`UPDATE projects SET ${set} WHERE id = ?`, [now, now, id])
}

async function ensureCategory(db: Db, name: string): Promise<number> {
  const rows = await db.query<{ id: number }>(`SELECT id FROM categories WHERE name = ? AND deleted_at IS NULL`, [name])
  if (rows.length) return rows[0].id
  const now = nowIso()
  const r = await db.run(
    `INSERT INTO categories (name, icon, monthly_budget_cents, uuid, created_at, updated_at) VALUES (?, '', NULL, ?, ?, ?)`,
    [name, newUuid(), now, now],
  )
  return r.lastId
}

// ---- transactions ---------------------------------------------------------

function toTransaction(r: TxRow): Transaction {
  return {
    id: r.id,
    occurred_on: r.occurred_on,
    description: r.description,
    direction: r.direction,
    is_inflow: !!r.is_inflow,
    amount: centsToAmount(r.amount_cents),
    account_id: r.account_id,
    category_id: r.category_id,
    project_id: r.project_id,
    transfer_group_id: r.transfer_group_id,
    tags: JSON.parse(r.tags) as string[],
    created_at: r.created_at,
  }
}

interface TxCols {
  occurred_on: string
  description: string
  direction: string
  is_inflow: number
  amount_cents: number
  account_id: number
  category_id: number | null
  project_id: number | null
  transfer_group_id: string | null
  tags: string[]
}

async function insertTx(db: Db, t: TxCols): Promise<Transaction> {
  const now = nowIso()
  const r = await db.run(
    `INSERT INTO transactions (occurred_on, description, direction, is_inflow, amount_cents, account_id,
       category_id, project_id, transfer_group_id, tags, uuid, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      t.occurred_on,
      t.description,
      t.direction,
      t.is_inflow,
      t.amount_cents,
      t.account_id,
      t.category_id,
      t.project_id,
      t.transfer_group_id,
      JSON.stringify(t.tags),
      newUuid(),
      now,
      now,
    ],
  )
  return toTransaction((await liveRow<TxRow>(db, "transactions", r.lastId))!)
}

// Validation order matches transaction.Service.validate: date, direction,
// amount, description, then FK pre-checks (missing refs are 400, never 409).
async function validateTx(db: Db, input: TransactionInput): Promise<TxCols> {
  if (!validDate(input.occurred_on)) throw bad("occurred_on must be YYYY-MM-DD")
  const direction = typeof input.direction === "string" ? input.direction.trim() : ""
  if (direction !== "income" && direction !== "expense") throw bad("direction must be income or expense")
  const amount_cents = amountToCents(input.amount)
  const description = cleanDesc(input.description)
  if (!(Number.isInteger(input.account_id) && input.account_id >= 1)) throw bad("account_id is required")
  await requireLiveRef(db, "accounts", input.account_id, "account not found")
  await requireLiveRef(db, "categories", input.category_id, "category not found")
  await requireLiveRef(db, "projects", input.project_id, "project not found")
  return {
    occurred_on: input.occurred_on,
    description,
    direction,
    is_inflow: direction === "income" ? 1 : 0,
    amount_cents,
    account_id: input.account_id,
    category_id: input.category_id ?? null,
    project_id: input.project_id ?? null,
    transfer_group_id: null,
    tags: cleanTags(input.tags),
  }
}

async function listTransactions(db: Db, q: URLSearchParams): Promise<Transaction[]> {
  const where = ["deleted_at IS NULL"]
  const params: unknown[] = []
  const from = q.get("from")
  const to = q.get("to")
  if (from != null) {
    if (!validDate(from)) throw bad("occurred_on must be YYYY-MM-DD")
    where.push("occurred_on >= ?")
    params.push(from)
  }
  if (to != null) {
    if (!validDate(to)) throw bad("occurred_on must be YYYY-MM-DD")
    where.push("occurred_on <= ?")
    params.push(to)
  }
  for (const col of ["account_id", "category_id", "project_id"] as const) {
    const v = q.get(col)
    if (v != null) {
      const n = Number(v)
      if (!Number.isInteger(n) || n < 1) throw bad(`${col} must be a positive integer`)
      where.push(`${col} = ?`)
      params.push(n)
    }
  }
  const rows = await db.query<TxRow>(
    `SELECT * FROM transactions WHERE ${where.join(" AND ")} ORDER BY occurred_on DESC, id DESC`,
    params,
  )
  return rows.map(toTransaction)
}

async function updateTransaction(db: Db, id: number, input: TransactionInput): Promise<Transaction> {
  const cols = await validateTx(db, input)
  if (!(await liveRow(db, "transactions", id))) throw notFound()
  await db.run(
    `UPDATE transactions SET occurred_on = ?, description = ?, direction = ?, is_inflow = ?, amount_cents = ?,
       account_id = ?, category_id = ?, project_id = ?, tags = ?, dirty = 1, updated_at = ? WHERE id = ?`,
    [
      cols.occurred_on,
      cols.description,
      cols.direction,
      cols.is_inflow,
      cols.amount_cents,
      cols.account_id,
      cols.category_id,
      cols.project_id,
      JSON.stringify(cols.tags),
      nowIso(),
      id,
    ],
  )
  return toTransaction((await liveRow<TxRow>(db, "transactions", id))!)
}

async function deleteTransaction(db: Db, id: number): Promise<void> {
  const { now, set } = softDeleteStamp()
  const r = await db.run(`UPDATE transactions SET ${set} WHERE id = ? AND deleted_at IS NULL`, [now, now, id])
  if (r.changes === 0) throw notFound()
}

// ---- transfers ------------------------------------------------------------

// Expands to out-leg + in-leg (direction "transfer") plus an optional expense
// fee row on the source account, mirroring transferRows in transfer.go.
async function createTransfer(db: Db, input: TransferInput): Promise<TransferResult> {
  if (!validDate(input.occurred_on)) throw bad("occurred_on must be YYYY-MM-DD")
  const amount_cents = amountToCents(input.amount)
  const description = cleanDesc(input.description)
  const { from_account_id: from, to_account_id: to } = input
  if (!(Number.isInteger(from) && from >= 1)) throw bad("from_account_id is required")
  if (!(Number.isInteger(to) && to >= 1)) throw bad("to_account_id is required")
  if (from === to) throw bad("from_account_id and to_account_id must differ")
  await requireLiveRef(db, "accounts", from, "from_account not found")
  await requireLiveRef(db, "accounts", to, "to_account not found")

  let feeCents: number | null = null
  if (typeof input.fee === "string" && input.fee.trim() !== "") feeCents = amountToCents(input.fee)
  let feeCat = input.fee_category_id ?? null
  if (feeCents != null && feeCat == null) feeCat = await ensureCategory(db, "Transfer Fee")
  else await requireLiveRef(db, "categories", feeCat, "category not found")

  const tags = cleanTags(input.tags)
  const group = newUuid()
  const base = { occurred_on: input.occurred_on, description, tags, transfer_group_id: group, category_id: null, project_id: null }
  const legs: TxCols[] = [
    { ...base, direction: "transfer", is_inflow: 0, amount_cents, account_id: from },
    { ...base, direction: "transfer", is_inflow: 1, amount_cents, account_id: to },
  ]
  if (feeCents != null) {
    legs.push({ ...base, direction: "expense", is_inflow: 0, amount_cents: feeCents, account_id: from, category_id: feeCat })
  }
  const transactions: Transaction[] = []
  for (const leg of legs) transactions.push(await insertTx(db, leg))
  return { transfer_group_id: group, transactions }
}

async function getTransfer(db: Db, group: string): Promise<TransferResult> {
  const rows = await db.query<TxRow>(
    `SELECT * FROM transactions WHERE transfer_group_id = ? AND deleted_at IS NULL ORDER BY id`,
    [group],
  )
  if (!rows.length) throw notFound()
  return { transfer_group_id: group, transactions: rows.map(toTransaction) }
}

async function deleteTransfer(db: Db, group: string): Promise<void> {
  const { now, set } = softDeleteStamp()
  const r = await db.run(`UPDATE transactions SET ${set} WHERE transfer_group_id = ? AND deleted_at IS NULL`, [now, now, group])
  if (r.changes === 0) throw notFound()
}

// ---- recurring ------------------------------------------------------------

function toRecurring(r: RecurringRow): Recurring {
  return {
    id: r.id,
    description: r.description,
    direction: r.direction,
    amount: centsToAmount(r.amount_cents),
    account_id: r.account_id,
    category_id: r.category_id,
    day_of_month: r.day_of_month,
    last_posted: r.last_posted,
    created_at: r.created_at,
  }
}

async function validateRecurring(db: Db, input: RecurringInput) {
  const amount_cents = amountToCents(input.amount)
  const direction = typeof input.direction === "string" ? input.direction.trim() : ""
  if (direction !== "income" && direction !== "expense") throw bad("direction must be income or expense")
  const description = cleanDesc(input.description)
  if (!(Number.isInteger(input.account_id) && input.account_id >= 1)) throw bad("account_id is required")
  await requireLiveRef(db, "accounts", input.account_id, "account not found")
  await requireLiveRef(db, "categories", input.category_id, "category not found")
  if (!(Number.isInteger(input.day_of_month) && input.day_of_month >= 1 && input.day_of_month <= 31)) {
    throw bad("day_of_month must be between 1 and 31")
  }
  return { amount_cents, direction, description, account_id: input.account_id, category_id: input.category_id ?? null, day: input.day_of_month }
}

async function writeRecurring(db: Db, id: number | null, input: RecurringInput): Promise<Recurring> {
  const v = await validateRecurring(db, input)
  if (id != null && !(await liveRow(db, "recurring", id))) throw notFound()
  const now = nowIso()
  let rowId = id
  if (id == null) {
    const r = await db.run(
      `INSERT INTO recurring (description, direction, amount_cents, account_id, category_id, day_of_month, uuid, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [v.description, v.direction, v.amount_cents, v.account_id, v.category_id, v.day, newUuid(), now, now],
    )
    rowId = r.lastId
  } else {
    await db.run(
      `UPDATE recurring SET description = ?, direction = ?, amount_cents = ?, account_id = ?, category_id = ?, day_of_month = ?, dirty = 1, updated_at = ? WHERE id = ?`,
      [v.description, v.direction, v.amount_cents, v.account_id, v.category_id, v.day, now, id],
    )
  }
  return toRecurring((await liveRow<RecurringRow>(db, "recurring", rowId!))!)
}

// Posts the rule as a real transaction dated today (device-local) and stamps
// last_posted, mirroring PostRecurring in recurring.go.
async function postRecurring(db: Db, id: number): Promise<Transaction> {
  const rule = await liveRow<RecurringRow>(db, "recurring", id)
  if (!rule) throw notFound()
  const day = today()
  const tx = await insertTx(db, {
    occurred_on: day,
    description: rule.description,
    direction: rule.direction,
    is_inflow: rule.direction === "income" ? 1 : 0,
    amount_cents: rule.amount_cents,
    account_id: rule.account_id,
    category_id: rule.category_id,
    project_id: null,
    transfer_group_id: null,
    tags: [],
  })
  await db.run(`UPDATE recurring SET last_posted = ?, dirty = 1, updated_at = ? WHERE id = ?`, [day, nowIso(), id])
  return tx
}

// ---- router ---------------------------------------------------------------

function idFrom(seg: string): number {
  const n = Number(seg)
  if (!Number.isInteger(n) || n < 1) throw notFound()
  return n
}

async function softDeleteNamed(db: Db, table: "accounts" | "categories" | "projects", id: number): Promise<void> {
  if (table === "accounts") return deleteAccount(db, id)
  if (table === "categories") return deleteCategory(db, id)
  return deleteProject(db, id)
}

export async function localRequest<T>(db: Db, method: string, path: string, body?: unknown): Promise<T> {
  const [pathname, qs = ""] = path.split("?")
  const seg = pathname.split("/").filter(Boolean)
  const q = new URLSearchParams(qs)
  const out = await route(db, method, seg, q, body)
  return out as T
}

async function route(db: Db, method: string, seg: string[], q: URLSearchParams, body: unknown): Promise<unknown> {
  const [resource, idSeg, action] = seg

  switch (resource) {
    case "accounts": {
      if (!idSeg) {
        if (method === "GET") return listAccounts(db)
        if (method === "POST") return createAccount(db, body as AccountInput)
        break
      }
      const id = idFrom(idSeg)
      if (method === "GET") {
        const r = await liveRow<AccountRow>(db, "accounts", id)
        if (!r) throw notFound()
        return toAccount(r)
      }
      if (method === "PUT") return updateAccount(db, id, body as AccountInput)
      if (method === "DELETE") return softDeleteNamed(db, "accounts", id)
      break
    }

    case "categories":
    case "projects": {
      const table = resource
      const write = table === "categories" ? writeCategory : writeProject
      const map = table === "categories" ? toCategory : toProject
      if (!idSeg) {
        if (method === "GET") {
          const rows = await db.query<NamedRow>(`SELECT * FROM ${table} WHERE deleted_at IS NULL ORDER BY name`)
          return rows.map(map)
        }
        if (method === "POST") return write(db, null, body as CategoryInput & ProjectInput)
        break
      }
      const id = idFrom(idSeg)
      if (method === "GET") {
        const r = await liveRow<NamedRow>(db, table, id)
        if (!r) throw notFound()
        return map(r)
      }
      if (method === "PUT") return write(db, id, body as CategoryInput & ProjectInput)
      if (method === "DELETE") return softDeleteNamed(db, table, id)
      break
    }

    case "transactions": {
      if (!idSeg) {
        if (method === "GET") return listTransactions(db, q)
        if (method === "POST") return insertTx(db, await validateTx(db, body as TransactionInput))
        break
      }
      const id = idFrom(idSeg)
      if (method === "GET") {
        const r = await liveRow<TxRow>(db, "transactions", id)
        if (!r) throw notFound()
        return toTransaction(r)
      }
      if (method === "PUT") return updateTransaction(db, id, body as TransactionInput)
      if (method === "DELETE") return deleteTransaction(db, id)
      break
    }

    case "transfers": {
      if (!idSeg && method === "POST") return createTransfer(db, body as TransferInput)
      if (idSeg && method === "GET") return getTransfer(db, idSeg)
      if (idSeg && method === "DELETE") return deleteTransfer(db, idSeg)
      break
    }

    case "recurring": {
      if (!idSeg) {
        if (method === "GET") {
          const rows = await db.query<RecurringRow>(`SELECT * FROM recurring WHERE deleted_at IS NULL ORDER BY description, id`)
          return rows.map(toRecurring)
        }
        if (method === "POST") return writeRecurring(db, null, body as RecurringInput)
        break
      }
      const id = idFrom(idSeg)
      if (action === "post" && method === "POST") return postRecurring(db, id)
      if (method === "GET") {
        const r = await liveRow<RecurringRow>(db, "recurring", id)
        if (!r) throw notFound()
        return toRecurring(r)
      }
      if (method === "PUT") return writeRecurring(db, id, body as RecurringInput)
      if (method === "DELETE") {
        const { now, set } = softDeleteStamp()
        const r = await db.run(`UPDATE recurring SET ${set} WHERE id = ? AND deleted_at IS NULL`, [now, now, id])
        if (r.changes === 0) throw notFound()
        return
      }
      break
    }

    case "reports":
      // ponytail: no offline reports; Phase 3 hides them from native nav
      throw new ApiError(501, "reports are not available offline")
  }
  throw notFound()
}
