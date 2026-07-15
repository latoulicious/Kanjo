// Sync engine against POST /api/v1/sync: push dirty rows (uuid-keyed, FK refs
// as uuids), pull full snapshot, reconcile — absence in snapshot = deleted.
import { ApiError } from "../api-error.ts"
import type { Db } from "./schema.ts"

interface ChangeBase {
  uuid: string
  updated_at: string
  deleted?: boolean
}
interface AccountChange extends ChangeBase {
  name: string
  is_liquid: boolean
  icon: string
  target_amount: string | null
}
interface CategoryChange extends ChangeBase {
  name: string
  icon: string
  monthly_budget: string | null
}
interface ProjectChange extends ChangeBase {
  name: string
  icon: string
}
interface TransactionChange extends ChangeBase {
  occurred_on: string
  description: string
  direction: string
  is_inflow: boolean
  amount: string
  account_uuid: string
  category_uuid: string | null
  project_uuid: string | null
  transfer_group_id: string | null
  tags: string[]
}
interface RecurringChange extends ChangeBase {
  description: string
  direction: string
  amount: string
  account_uuid: string
  category_uuid: string | null
  day_of_month: number
  last_posted: string | null
}

export interface Changes {
  accounts: AccountChange[]
  categories: CategoryChange[]
  projects: ProjectChange[]
  transactions: TransactionChange[]
  recurring: RecurringChange[]
}

const cents = (c: number | null) => {
  if (c == null) return null
  const s = String(Math.abs(c)).padStart(3, "0")
  return `${c < 0 ? "-" : ""}${s.slice(0, -2)}.${s.slice(-2)}`
}
const toCents = (s: string | null) => {
  if (s == null) return null
  const negative = s.startsWith("-")
  const [int, frac = ""] = (negative ? s.slice(1) : s).split(".")
  const value = Number(int) * 100 + Number(frac.padEnd(2, "0") || "0")
  return negative ? -value : value
}
const newer = (a: string, b: string) => Date.parse(a) > Date.parse(b)

export async function collectChanges(db: Db): Promise<Changes> {
  const accounts = await db.query<{
    uuid: string
    name: string
    is_liquid: number
    icon: string
    target_amount_cents: number | null
    updated_at: string
    deleted_at: string | null
  }>(`SELECT * FROM accounts WHERE dirty = 1`)
  const categories = await db.query<{
    uuid: string
    name: string
    icon: string
    monthly_budget_cents: number | null
    updated_at: string
    deleted_at: string | null
  }>(`SELECT * FROM categories WHERE dirty = 1`)
  const projects = await db.query<{
    uuid: string
    name: string
    icon: string
    updated_at: string
    deleted_at: string | null
  }>(`SELECT * FROM projects WHERE dirty = 1`)
  const transactions = await db.query<{
    uuid: string
    occurred_on: string
    description: string
    direction: string
    is_inflow: number
    amount_cents: number
    account_uuid: string
    category_uuid: string | null
    project_uuid: string | null
    transfer_group_id: string | null
    tags: string
    updated_at: string
    deleted_at: string | null
  }>(`
    SELECT t.uuid, t.occurred_on, t.description, t.direction, t.is_inflow, t.amount_cents,
      a.uuid AS account_uuid, c.uuid AS category_uuid, p.uuid AS project_uuid,
      t.transfer_group_id, t.tags, t.updated_at, t.deleted_at
    FROM transactions t
    JOIN accounts a ON a.id = t.account_id
    LEFT JOIN categories c ON c.id = t.category_id
    LEFT JOIN projects p ON p.id = t.project_id
    WHERE t.dirty = 1`)
  const recurring = await db.query<{
    uuid: string
    description: string
    direction: string
    amount_cents: number
    account_uuid: string
    category_uuid: string | null
    day_of_month: number
    last_posted: string | null
    updated_at: string
    deleted_at: string | null
  }>(`
    SELECT r.uuid, r.description, r.direction, r.amount_cents,
      a.uuid AS account_uuid, c.uuid AS category_uuid,
      r.day_of_month, r.last_posted, r.updated_at, r.deleted_at
    FROM recurring r
    JOIN accounts a ON a.id = r.account_id
    LEFT JOIN categories c ON c.id = r.category_id
    WHERE r.dirty = 1`)

  return {
    accounts: accounts.map((r) => ({
      uuid: r.uuid,
      name: r.name,
      is_liquid: !!r.is_liquid,
      icon: r.icon,
      target_amount: cents(r.target_amount_cents),
      updated_at: r.updated_at,
      deleted: r.deleted_at != null || undefined,
    })),
    categories: categories.map((r) => ({
      uuid: r.uuid,
      name: r.name,
      icon: r.icon,
      monthly_budget: cents(r.monthly_budget_cents),
      updated_at: r.updated_at,
      deleted: r.deleted_at != null || undefined,
    })),
    projects: projects.map((r) => ({
      uuid: r.uuid,
      name: r.name,
      icon: r.icon,
      updated_at: r.updated_at,
      deleted: r.deleted_at != null || undefined,
    })),
    transactions: transactions.map((r) => ({
      uuid: r.uuid,
      occurred_on: r.occurred_on,
      description: r.description,
      direction: r.direction,
      is_inflow: !!r.is_inflow,
      amount: cents(r.amount_cents)!,
      account_uuid: r.account_uuid,
      category_uuid: r.category_uuid,
      project_uuid: r.project_uuid,
      transfer_group_id: r.transfer_group_id,
      tags: JSON.parse(r.tags) as string[],
      updated_at: r.updated_at,
      deleted: r.deleted_at != null || undefined,
    })),
    recurring: recurring.map((r) => ({
      uuid: r.uuid,
      description: r.description,
      direction: r.direction,
      amount: cents(r.amount_cents)!,
      account_uuid: r.account_uuid,
      category_uuid: r.category_uuid,
      day_of_month: r.day_of_month,
      last_posted: r.last_posted,
      updated_at: r.updated_at,
      deleted: r.deleted_at != null || undefined,
    })),
  }
}

interface LocalRow {
  id: number
  uuid: string
  updated_at: string
  dirty: number
}

// Upserts one named row by uuid with client-side adopt-by-name (mirrors the
// server: same name, unseen uuid takes the row over so UNIQUE(name) never trips).
async function upsertNamed(
  db: Db,
  table: string,
  row: { uuid: string; name: string; updated_at: string },
  cols: Record<string, unknown>,
): Promise<void> {
  const [local] = await db.query<LocalRow>(`SELECT * FROM ${table} WHERE uuid = ?`, [row.uuid])
  const keys = Object.keys(cols)
  const sets = keys.map((k) => `${k} = ?`).join(", ")
  const vals = keys.map((k) => cols[k])
  if (local) {
    if (local.dirty && newer(local.updated_at, row.updated_at)) return
    await db.run(`UPDATE ${table} SET ${sets}, updated_at = ?, dirty = 0, deleted_at = NULL WHERE id = ?`, [
      ...vals,
      row.updated_at,
      local.id,
    ])
    return
  }
  const [byName] = await db.query<LocalRow>(
    `SELECT * FROM ${table} WHERE name = ? AND deleted_at IS NULL`,
    [row.name],
  )
  if (byName) {
    if (byName.dirty && newer(byName.updated_at, row.updated_at)) return
    await db.run(`UPDATE ${table} SET uuid = ?, ${sets}, updated_at = ?, dirty = 0 WHERE id = ?`, [
      row.uuid,
      ...vals,
      row.updated_at,
      byName.id,
    ])
    return
  }
  await db.run(
    `INSERT INTO ${table} (uuid, ${keys.join(", ")}, created_at, updated_at, dirty) VALUES (?, ${keys
      .map(() => "?")
      .join(", ")}, ?, ?, 0)`,
    [row.uuid, ...vals, row.updated_at, row.updated_at],
  )
}

async function uuidToId(db: Db, table: string): Promise<Map<string, number>> {
  const rows = await db.query<{ uuid: string; id: number }>(`SELECT uuid, id FROM ${table}`)
  return new Map(rows.map((r) => [r.uuid, r.id]))
}

// Deletes local clean rows the snapshot no longer contains (server truth);
// dirty rows survive to push next round.
async function reconcileDeletes(db: Db, table: string, keep: Set<string>): Promise<void> {
  const rows = await db.query<{ id: number; uuid: string }>(
    `SELECT id, uuid FROM ${table} WHERE deleted_at IS NULL AND dirty = 0`,
  )
  for (const r of rows) {
    if (!keep.has(r.uuid)) await db.run(`DELETE FROM ${table} WHERE id = ?`, [r.id])
  }
}

export async function applySnapshot(db: Db, snap: Changes): Promise<void> {
  for (const a of snap.accounts) {
    await upsertNamed(db, "accounts", a, {
      name: a.name,
      is_liquid: a.is_liquid ? 1 : 0,
      icon: a.icon,
      target_amount_cents: toCents(a.target_amount),
    })
  }
  for (const c of snap.categories) {
    await upsertNamed(db, "categories", c, {
      name: c.name,
      icon: c.icon,
      monthly_budget_cents: toCents(c.monthly_budget),
    })
  }
  for (const p of snap.projects) {
    await upsertNamed(db, "projects", p, { name: p.name, icon: p.icon })
  }

  const accountIds = await uuidToId(db, "accounts")
  const categoryIds = await uuidToId(db, "categories")
  const projectIds = await uuidToId(db, "projects")
  const ref = (m: Map<string, number>, uuid: string | null) => (uuid == null ? null : (m.get(uuid) ?? null))

  for (const t of snap.transactions) {
    const accountId = accountIds.get(t.account_uuid)
    if (accountId == null) throw new ApiError(500, `snapshot references unknown account ${t.account_uuid}`)
    const cols = {
      occurred_on: t.occurred_on,
      description: t.description,
      direction: t.direction,
      is_inflow: t.is_inflow ? 1 : 0,
      amount_cents: toCents(t.amount)!,
      account_id: accountId,
      category_id: ref(categoryIds, t.category_uuid),
      project_id: ref(projectIds, t.project_uuid),
      transfer_group_id: t.transfer_group_id,
      tags: JSON.stringify(t.tags),
    }
    await upsertPlain(db, "transactions", t, cols)
  }
  for (const r of snap.recurring) {
    const accountId = accountIds.get(r.account_uuid)
    if (accountId == null) throw new ApiError(500, `snapshot references unknown account ${r.account_uuid}`)
    await upsertPlain(db, "recurring", r, {
      description: r.description,
      direction: r.direction,
      amount_cents: toCents(r.amount)!,
      account_id: accountId,
      category_id: ref(categoryIds, r.category_uuid),
      day_of_month: r.day_of_month,
      last_posted: r.last_posted,
    })
  }

  await reconcileDeletes(db, "transactions", new Set(snap.transactions.map((t) => t.uuid)))
  await reconcileDeletes(db, "recurring", new Set(snap.recurring.map((r) => r.uuid)))
  await reconcileDeletes(db, "projects", new Set(snap.projects.map((p) => p.uuid)))
  await reconcileDeletes(db, "categories", new Set(snap.categories.map((c) => c.uuid)))
  await reconcileDeletes(db, "accounts", new Set(snap.accounts.map((a) => a.uuid)))
}

async function upsertPlain(
  db: Db,
  table: string,
  row: { uuid: string; updated_at: string },
  cols: Record<string, unknown>,
): Promise<void> {
  const [local] = await db.query<LocalRow>(`SELECT * FROM ${table} WHERE uuid = ?`, [row.uuid])
  const keys = Object.keys(cols)
  const vals = keys.map((k) => cols[k])
  if (local) {
    if (local.dirty && newer(local.updated_at, row.updated_at)) return
    await db.run(
      `UPDATE ${table} SET ${keys.map((k) => `${k} = ?`).join(", ")}, updated_at = ?, dirty = 0, deleted_at = NULL WHERE id = ?`,
      [...vals, row.updated_at, local.id],
    )
    return
  }
  await db.run(
    `INSERT INTO ${table} (uuid, ${keys.join(", ")}, created_at, updated_at, dirty) VALUES (?, ${keys
      .map(() => "?")
      .join(", ")}, ?, ?, 0)`,
    [row.uuid, ...vals, row.updated_at, row.updated_at],
  )
}

// Clears dirty on pushed live rows and purges pushed tombstones — the server
// has both applied; anything dirtied mid-sync stays dirty for the next round.
export async function finalizePush(db: Db, pushed: Changes): Promise<void> {
  const tables: [string, ChangeBase[]][] = [
    ["accounts", pushed.accounts],
    ["categories", pushed.categories],
    ["projects", pushed.projects],
    ["transactions", pushed.transactions],
    ["recurring", pushed.recurring],
  ]
  for (const [table, rows] of tables) {
    for (const r of rows) {
      if (r.deleted) {
        await db.run(`DELETE FROM ${table} WHERE uuid = ? AND deleted_at IS NOT NULL`, [r.uuid])
      } else {
        await db.run(`UPDATE ${table} SET dirty = 0 WHERE uuid = ? AND updated_at = ?`, [r.uuid, r.updated_at])
      }
    }
  }
}

export interface SyncResult {
  pushed: number
  syncedAt: string
}

async function postSync(url: string, token: string, changes: Changes) {
  const res = await fetch(`${url.replace(/\/+$/, "")}/api/v1/sync`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify({ changes }),
  })
  const body = (await res.json().catch(() => null)) as { error?: string; snapshot?: Changes; synced_at?: string } | null
  if (!res.ok) throw new ApiError(res.status, body?.error ?? `sync failed (${res.status})`)
  if (!body?.snapshot) throw new ApiError(502, "malformed sync response")
  return body
}

const noChanges = (): Changes => ({ accounts: [], categories: [], projects: [], transactions: [], recurring: [] })

export async function runSync(db: Db, url: string, token: string): Promise<SyncResult> {
  const changes = await collectChanges(db)
  const pushed =
    changes.accounts.length +
    changes.categories.length +
    changes.projects.length +
    changes.transactions.length +
    changes.recurring.length

  const body = await postSync(url, token, changes)
  await finalizePush(db, changes)
  await applySnapshot(db, body.snapshot!)
  return { pushed, syncedAt: body.synced_at ?? new Date().toISOString() }
}

// Server-restore recovery: pull-only pass re-keys local rows to the server's
// regenerated uuids (dirty rows survive), then a normal sync pushes them.
export async function repairSync(db: Db, url: string, token: string): Promise<SyncResult> {
  const body = await postSync(url, token, noChanges())
  await applySnapshot(db, body.snapshot!)
  return runSync(db, url, token)
}
