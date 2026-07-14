// Self-check for the sync engine: collect/apply/finalize against node:sqlite.
import { test } from "node:test"
import assert from "node:assert/strict"
import { DatabaseSync } from "node:sqlite"
import { migrate, type Db } from "../src/lib/db/schema.ts"
import { localRequest } from "../src/lib/db/local-api.ts"
import { collectChanges, applySnapshot, finalizePush, type Changes } from "../src/lib/db/sync.ts"
import type { Account, Category, Transaction } from "../src/types.ts"

async function freshDb(): Promise<Db> {
  const d = new DatabaseSync(":memory:")
  const db: Db = {
    query: async <T,>(sql: string, params: unknown[] = []) => d.prepare(sql).all(...(params as [])) as T[],
    run: async (sql, params = []) => {
      const r = d.prepare(sql).run(...(params as []))
      return { lastId: Number(r.lastInsertRowid), changes: Number(r.changes) }
    },
    exec: async (sql) => {
      d.exec(sql)
    },
  }
  await migrate(db)
  return db
}

const call =
  (db: Db) =>
  <T,>(method: string, path: string, body?: unknown) =>
    localRequest<T>(db, method, path, body)

const empty = (): Changes => ({ accounts: [], categories: [], projects: [], transactions: [], recurring: [] })

test("collect gathers dirty rows with uuid refs and tombstones", async () => {
  const db = await freshDb()
  const c = call(db)
  const acc = await c<Account>("POST", "/accounts", { name: "Cash", icon: "" })
  const cat = await c<Category>("POST", "/categories", { name: "Food", icon: "" })
  const tx = await c<Transaction>("POST", "/transactions", {
    occurred_on: "2026-07-01",
    description: "x",
    direction: "expense",
    amount: "12.34",
    account_id: acc.id,
    category_id: cat.id,
    tags: ["t"],
  })
  await c("DELETE", `/transactions/${tx.id}`)

  const changes = await collectChanges(db)
  assert.equal(changes.accounts.length, 1)
  assert.equal(changes.accounts[0].name, "Cash")
  assert.equal(changes.transactions.length, 1)
  assert.equal(changes.transactions[0].deleted, true)
  assert.equal(changes.transactions[0].amount, "12.34")
  assert.equal(changes.transactions[0].account_uuid, changes.accounts[0].uuid)
  assert.equal(changes.transactions[0].category_uuid, changes.categories[0].uuid)
})

test("finalize clears dirty and purges pushed tombstones", async () => {
  const db = await freshDb()
  const c = call(db)
  const acc = await c<Account>("POST", "/accounts", { name: "Cash", icon: "" })
  const tx = await c<Transaction>("POST", "/transactions", {
    occurred_on: "2026-07-01",
    description: "x",
    direction: "income",
    amount: "1.00",
    account_id: acc.id,
    tags: [],
  })
  await c("DELETE", `/transactions/${tx.id}`)

  const pushed = await collectChanges(db)
  await finalizePush(db, pushed)

  assert.equal((await collectChanges(db)).accounts.length, 0)
  const ghosts = await db.query(`SELECT id FROM transactions`)
  assert.equal(ghosts.length, 0) // tombstone purged
})

test("apply inserts server rows, maps refs, reconciles deletes, adopts by name", async () => {
  const db = await freshDb()
  const c = call(db)

  // Local live state: one clean account (simulate previously synced) + one with a name the server also has.
  const acc = await c<Account>("POST", "/accounts", { name: "Cash", icon: "" })
  const stale = await c<Account>("POST", "/accounts", { name: "Old", icon: "" })
  await finalizePush(db, await collectChanges(db)) // mark both clean

  const [{ uuid: cashUuid }] = await db.query<{ uuid: string }>(`SELECT uuid FROM accounts WHERE id = ?`, [acc.id])

  const snap = empty()
  const serverCashUuid = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa"
  snap.accounts = [
    // same name, different uuid → local adopts server uuid
    { uuid: serverCashUuid, name: "Cash", is_liquid: true, icon: "wallet", target_amount: null, updated_at: "2099-01-01T00:00:00Z" },
    // brand new from server
    { uuid: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb", name: "Bank", is_liquid: true, icon: "", target_amount: "9000.00", updated_at: "2099-01-01T00:00:00Z" },
    // "Old" absent → local copy must die
  ]
  snap.transactions = [
    {
      uuid: "cccccccc-cccc-4ccc-8ccc-cccccccccccc",
      occurred_on: "2026-07-02",
      description: "from web",
      direction: "income",
      is_inflow: true,
      amount: "55.00",
      account_uuid: serverCashUuid,
      category_uuid: null,
      project_uuid: null,
      transfer_group_id: null,
      tags: ["web"],
      updated_at: "2099-01-01T00:00:00Z",
    },
  ]
  await applySnapshot(db, snap)

  const accounts = await c<Account[]>("GET", "/accounts")
  assert.deepEqual(accounts.map((a) => a.name).sort(), ["Bank", "Cash"])
  assert.equal(accounts.find((a) => a.name === "Bank")!.target_amount, "9000.00")
  const [{ uuid: adopted }] = await db.query<{ uuid: string }>(`SELECT uuid FROM accounts WHERE name = 'Cash'`)
  assert.equal(adopted, serverCashUuid)
  assert.notEqual(adopted, cashUuid)
  assert.equal((await db.query(`SELECT id FROM accounts WHERE id = ?`, [stale.id])).length, 0)

  const txs = await c<Transaction[]>("GET", "/transactions")
  assert.equal(txs.length, 1)
  assert.equal(txs[0].description, "from web")
  assert.equal(txs[0].account_id, accounts.find((a) => a.name === "Cash")!.id)
  assert.equal((await collectChanges(db)).transactions.length, 0) // server rows arrive clean

  // Dirty local row survives an empty snapshot (pushes next round).
  await c<Transaction>("POST", "/transactions", {
    occurred_on: "2026-07-03",
    description: "unsynced",
    direction: "expense",
    amount: "2.00",
    account_id: accounts.find((a) => a.name === "Cash")!.id,
    tags: [],
  })
  await applySnapshot(db, { ...empty(), accounts: snap.accounts })
  const after = await c<Transaction[]>("GET", "/transactions")
  assert.deepEqual(after.map((t) => t.description), ["unsynced"])
})
