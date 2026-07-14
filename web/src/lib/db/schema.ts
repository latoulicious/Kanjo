// On-device mirror of api/migrations: money as integer cents, plus sync
// columns (uuid/updated_at/dirty/deleted_at) so Phase 4 sync needs no migration.

export interface Db {
  query<T = Record<string, unknown>>(sql: string, params?: unknown[]): Promise<T[]>
  run(sql: string, params?: unknown[]): Promise<{ lastId: number; changes: number }>
  exec(sql: string): Promise<void>
}

export const SCHEMA_VERSION = 1

const SYNC_COLS = `
  uuid        TEXT NOT NULL UNIQUE,
  created_at  TEXT NOT NULL,
  updated_at  TEXT NOT NULL,
  dirty       INTEGER NOT NULL DEFAULT 1,
  deleted_at  TEXT`

export const DDL = `
CREATE TABLE IF NOT EXISTS accounts (
  id                  INTEGER PRIMARY KEY AUTOINCREMENT,
  name                TEXT NOT NULL,
  is_liquid           INTEGER NOT NULL DEFAULT 1,
  icon                TEXT NOT NULL DEFAULT '',
  target_amount_cents INTEGER,${SYNC_COLS}
);
CREATE UNIQUE INDEX IF NOT EXISTS accounts_live_name ON accounts(name) WHERE deleted_at IS NULL;

CREATE TABLE IF NOT EXISTS categories (
  id                   INTEGER PRIMARY KEY AUTOINCREMENT,
  name                 TEXT NOT NULL,
  icon                 TEXT NOT NULL DEFAULT '',
  monthly_budget_cents INTEGER,${SYNC_COLS}
);
CREATE UNIQUE INDEX IF NOT EXISTS categories_live_name ON categories(name) WHERE deleted_at IS NULL;

CREATE TABLE IF NOT EXISTS projects (
  id   INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  icon TEXT NOT NULL DEFAULT '',${SYNC_COLS}
);
CREATE UNIQUE INDEX IF NOT EXISTS projects_live_name ON projects(name) WHERE deleted_at IS NULL;

CREATE TABLE IF NOT EXISTS transactions (
  id                INTEGER PRIMARY KEY AUTOINCREMENT,
  occurred_on       TEXT NOT NULL,
  description       TEXT NOT NULL DEFAULT '',
  direction         TEXT NOT NULL CHECK (direction IN ('income','expense','transfer')),
  is_inflow         INTEGER NOT NULL,
  amount_cents      INTEGER NOT NULL CHECK (amount_cents > 0),
  account_id        INTEGER NOT NULL REFERENCES accounts(id),
  category_id       INTEGER REFERENCES categories(id),
  project_id        INTEGER REFERENCES projects(id),
  transfer_group_id TEXT,
  tags              TEXT NOT NULL DEFAULT '[]',${SYNC_COLS}
);
CREATE INDEX IF NOT EXISTS transactions_occurred ON transactions(occurred_on);
CREATE INDEX IF NOT EXISTS transactions_account ON transactions(account_id);
CREATE INDEX IF NOT EXISTS transactions_group ON transactions(transfer_group_id);

CREATE TABLE IF NOT EXISTS recurring (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  description  TEXT NOT NULL DEFAULT '',
  direction    TEXT NOT NULL CHECK (direction IN ('income','expense')),
  amount_cents INTEGER NOT NULL CHECK (amount_cents > 0),
  account_id   INTEGER NOT NULL REFERENCES accounts(id),
  category_id  INTEGER REFERENCES categories(id),
  day_of_month INTEGER NOT NULL CHECK (day_of_month BETWEEN 1 AND 31),
  last_posted  TEXT,${SYNC_COLS}
);
`

export async function migrate(db: Db): Promise<void> {
  const rows = await db.query<{ user_version: number }>("PRAGMA user_version")
  const version = rows[0]?.user_version ?? 0
  if (version > SCHEMA_VERSION) throw new Error(`unsupported local schema version ${version}`)
  if (version < SCHEMA_VERSION) {
    await db.exec(DDL)
    await db.exec(`PRAGMA user_version = ${SCHEMA_VERSION}`)
  }
}
