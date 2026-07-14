// Self-check for the on-device store: runs local-api against node:sqlite.
// Outside src/ on purpose — tsconfig.app has no node types; run via pnpm test:db.
import { test } from "node:test"
import assert from "node:assert/strict"
import { DatabaseSync } from "node:sqlite"
import { migrate, type Db } from "../src/lib/db/schema.ts"
import { localRequest } from "../src/lib/db/local-api.ts"
import { ApiError } from "../src/lib/api-error.ts"
import type { Account, Category, Transaction, TransferResult, Recurring } from "../src/types.ts"

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

function rejectsWith(status: number, message?: string) {
  return (err: unknown) => {
    assert.ok(err instanceof ApiError, `expected ApiError, got ${String(err)}`)
    assert.equal(err.status, status)
    if (message) assert.equal(err.message, message)
    return true
  }
}

test("crud, balances, ordering", async () => {
  const c = call(await freshDb())
  const cash = await c<Account>("POST", "/accounts", { name: "Cash", icon: "" })
  const food = await c<Category>("POST", "/categories", { name: "Food", icon: "" })
  assert.equal(cash.balance, "0.00")

  await c<Transaction>("POST", "/transactions", {
    occurred_on: "2026-07-01",
    description: "salary",
    direction: "income",
    amount: "100.00",
    account_id: cash.id,
    tags: [],
  })
  await c<Transaction>("POST", "/transactions", {
    occurred_on: "2026-07-02",
    description: "groceries",
    direction: "expense",
    amount: "40.50",
    account_id: cash.id,
    category_id: food.id,
    tags: [" a ", "", "b"],
  })

  const accounts = await c<Account[]>("GET", "/accounts")
  assert.equal(accounts[0].balance, "59.50")

  const txs = await c<Transaction[]>("GET", "/transactions")
  assert.equal(txs.length, 2)
  assert.equal(txs[0].description, "groceries") // occurred_on DESC
  assert.deepEqual(txs[1].tags, [])
  assert.deepEqual(txs[0].tags, ["a", "b"])

  const filtered = await c<Transaction[]>("GET", `/transactions?category_id=${food.id}&from=2026-07-01`)
  assert.equal(filtered.length, 1)
})

test("transfer with fee, group delete restores balances", async () => {
  const c = call(await freshDb())
  const a = await c<Account>("POST", "/accounts", { name: "A", icon: "" })
  const b = await c<Account>("POST", "/accounts", { name: "B", icon: "" })

  const tr = await c<TransferResult>("POST", "/transfers", {
    occurred_on: "2026-07-03",
    description: "move",
    from_account_id: a.id,
    to_account_id: b.id,
    amount: "50.00",
    fee: "2.50",
    tags: [],
  })
  assert.equal(tr.transactions.length, 3)

  const cats = await c<Category[]>("GET", "/categories")
  assert.ok(cats.some((x) => x.name === "Transfer Fee"))

  let accounts = await c<Account[]>("GET", "/accounts")
  assert.equal(accounts.find((x) => x.id === a.id)!.balance, "-52.50")
  assert.equal(accounts.find((x) => x.id === b.id)!.balance, "50.00")

  await c("DELETE", `/transfers/${tr.transfer_group_id}`)
  accounts = await c<Account[]>("GET", "/accounts")
  assert.equal(accounts.find((x) => x.id === a.id)!.balance, "0.00")
  assert.equal((await c<Transaction[]>("GET", "/transactions")).length, 0)
})

test("validation parity", async () => {
  const c = call(await freshDb())
  await c<Account>("POST", "/accounts", { name: "Cash", icon: "" })

  await assert.rejects(c("POST", "/accounts", { name: "Cash", icon: "" }), rejectsWith(409))
  await assert.rejects(
    c("POST", "/transactions", { occurred_on: "2026-07-01", description: "", direction: "income", amount: "1.00", account_id: 999, tags: [] }),
    rejectsWith(400, "account not found"),
  )
  await assert.rejects(
    c("POST", "/transactions", { occurred_on: "2026-02-31", description: "", direction: "income", amount: "1.00", account_id: 1, tags: [] }),
    rejectsWith(400, "occurred_on must be YYYY-MM-DD"),
  )
  await assert.rejects(
    c("POST", "/transactions", { occurred_on: "2026-07-01", description: "", direction: "income", amount: "0", account_id: 1, tags: [] }),
    rejectsWith(400, "amount must be a positive decimal with up to 2 places"),
  )
  await assert.rejects(c("GET", "/reports/summary"), rejectsWith(501))
})

test("account delete RESTRICT, category delete nulls refs", async () => {
  const c = call(await freshDb())
  const acc = await c<Account>("POST", "/accounts", { name: "Cash", icon: "" })
  const cat = await c<Category>("POST", "/categories", { name: "Food", icon: "" })
  const tx = await c<Transaction>("POST", "/transactions", {
    occurred_on: "2026-07-01",
    description: "x",
    direction: "expense",
    amount: "5.00",
    account_id: acc.id,
    category_id: cat.id,
    tags: [],
  })

  await assert.rejects(c("DELETE", `/accounts/${acc.id}`), rejectsWith(409))

  await c("DELETE", `/categories/${cat.id}`)
  assert.equal((await c<Category[]>("GET", "/categories")).length, 0)
  const after = await c<Transaction>("GET", `/transactions/${tx.id}`)
  assert.equal(after.category_id, null)

  await c("DELETE", `/transactions/${tx.id}`)
  await c("DELETE", `/accounts/${acc.id}`) // tombstoned tx no longer blocks
  assert.equal((await c<Account[]>("GET", "/accounts")).length, 0)
  await c<Account>("POST", "/accounts", { name: "Cash", icon: "" }) // name reusable past tombstone
})

test("recurring post stamps last_posted", async () => {
  const c = call(await freshDb())
  const acc = await c<Account>("POST", "/accounts", { name: "Cash", icon: "" })
  const rule = await c<Recurring>("POST", "/recurring", {
    description: "rent",
    direction: "expense",
    amount: "10.00",
    account_id: acc.id,
    day_of_month: 1,
  })
  assert.equal(rule.last_posted, null)

  const tx = await c<Transaction>("POST", `/recurring/${rule.id}/post`)
  assert.equal(tx.description, "rent")
  assert.match(tx.occurred_on, /^\d{4}-\d{2}-\d{2}$/)

  const after = await c<Recurring>("GET", `/recurring/${rule.id}`)
  assert.equal(after.last_posted, tx.occurred_on)
})
