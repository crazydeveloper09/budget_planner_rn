import * as SQLite from "expo-sqlite";

const DB_NAME = "budget_planner.db";

type Database = SQLite.SQLiteDatabase;

let db: Database | null = null;

async function ping(database: Database) {
  await database.getFirstAsync("SELECT 1 AS ok");
}

export async function getDb(): Promise<Database> {
  if (db) {
    try {
      await ping(db);
      return db;
    } catch {
      try {
        await db.closeAsync();
      } catch {
        // native handle may already be gone after reload
      }
      db = null;
    }
  }

  db = await SQLite.openDatabaseAsync(DB_NAME, { useNewConnection: true });
  await migrate(db);
  return db;
}

async function migrate(database: Database) {
  await database.execAsync(`
    PRAGMA foreign_keys = OFF;

    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      account_type TEXT NOT NULL DEFAULT 'personal',
      dailySaldo INTEGER NOT NULL,
      currency TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS members (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      name TEXT NOT NULL,
      role TEXT NOT NULL,
      monthly_income REAL,
      daily_saldo REAL,
      salary REAL
    );

    CREATE TABLE IF NOT EXISTS entries (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      entry_date TEXT NOT NULL,
      entry_kind TEXT NOT NULL,
      title TEXT NOT NULL DEFAULT '',
      category TEXT NOT NULL,
      amount REAL NOT NULL,
      is_regular INTEGER NOT NULL DEFAULT 0,
      member_id INTEGER NOT NULL DEFAULT 0
    );
  `);

  const userColumns = await database.getAllAsync<{ name: string }>("PRAGMA table_info(users)");
  if (!userColumns.some((column) => column.name === "account_type")) {
    await database.execAsync(
      "ALTER TABLE users ADD COLUMN account_type TEXT NOT NULL DEFAULT 'personal'"
    );
  }

  const tables = await database.getAllAsync<{ name: string }>(
    "SELECT name FROM sqlite_master WHERE type = 'table'"
  );
  if (tables.some((table) => table.name === "transactions")) {
    try {
      await database.execAsync(`
        INSERT INTO entries (user_id, entry_date, entry_kind, title, category, amount, is_regular)
        SELECT user_id, "date", "type", COALESCE(title, ''), category, amount, regular
        FROM transactions;
      `);
    } catch {
      // old schema may not copy cleanly; keep using entries going forward
    }
    await database.execAsync("DROP TABLE IF EXISTS transactions");
  }

  const entryColumns = await database.getAllAsync<{ name: string }>("PRAGMA table_info(entries)");
  if (!entryColumns.some((column) => column.name === "member_id")) {
    await database.execAsync("ALTER TABLE entries ADD COLUMN member_id INTEGER NOT NULL DEFAULT 0");
  }

  await database.execAsync(`
    CREATE TABLE IF NOT EXISTS chat_topics (
      id TEXT PRIMARY KEY,
      user_id INTEGER NOT NULL,
      title TEXT NOT NULL,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS chat_messages (
      id TEXT PRIMARY KEY,
      user_id INTEGER NOT NULL,
      topic_id TEXT NOT NULL,
      author_name TEXT NOT NULL,
      body TEXT NOT NULL DEFAULT '',
      created_at TEXT NOT NULL,
      plan_json TEXT
    );

    CREATE TABLE IF NOT EXISTS receipts (
      id TEXT PRIMARY KEY,
      user_id INTEGER NOT NULL,
      entry_id INTEGER,
      entry_date TEXT NOT NULL,
      title TEXT NOT NULL DEFAULT '',
      category TEXT NOT NULL,
      amount REAL NOT NULL,
      owner_name TEXT,
      created_at TEXT NOT NULL,
      file_name TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS receipt_tombstones (
      id TEXT PRIMARY KEY
    );
  `);
}

export async function initDb() {
  await getDb();
}
