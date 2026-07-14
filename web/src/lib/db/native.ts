// Capacitor SQLite bridge: one app-lifetime connection, migrated on first use.
import { CapacitorSQLite, SQLiteConnection } from "@capacitor-community/sqlite"
import { migrate, type Db } from "./schema"

let ready: Promise<Db> | undefined

export function nativeDb(): Promise<Db> {
  // Failed init must not cache the rejection — clear so the next call retries.
  ready ??= open().catch((err: unknown) => {
    ready = undefined
    throw err
  })
  return ready
}

async function open(): Promise<Db> {
  const sqlite = new SQLiteConnection(CapacitorSQLite)
  const conn = await sqlite
    .createConnection("kanjo", false, "no-encryption", 1, false)
    .catch(() => sqlite.retrieveConnection("kanjo", false))
  await conn.open()
  const db: Db = {
    query: async <T,>(sql: string, params: unknown[] = []) =>
      ((await conn.query(sql, params as never)).values ?? []) as T[],
    run: async (sql, params = []) => {
      const r = await conn.run(sql, params as never, false)
      return { lastId: r.changes?.lastId ?? 0, changes: r.changes?.changes ?? 0 }
    },
    exec: async (sql) => {
      await conn.execute(sql, false)
    },
  }
  await migrate(db)
  return db
}
