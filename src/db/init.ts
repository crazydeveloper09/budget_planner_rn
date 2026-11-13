import * as SQLite from "expo-sqlite";

const DB_NAME = "budget_planner.db";

export type Database = SQLite.SQLiteDatabase;

let db: Database | null = null;
let opening: Promise<Database> | null = null;
let nativeDb: Database | null = null;

// Expo's convenience methods keep a native statement alive until finalizeAsync
// finishes. Queue the entire call, including reads, so another query cannot
// start while that statement is still being finalized on the same connection.
export function serializeDatabase<T extends object>(database: T): T {
  let tail: Promise<unknown> = Promise.resolve();
  const methods = new Set(["execAsync", "runAsync", "getFirstAsync", "getAllAsync", "withTransactionAsync"]);
  return new Proxy(database, {
    get(target, property) {
      const value = Reflect.get(target, property, target);
      if (typeof value !== "function") return value;
      if (!methods.has(String(property))) return value.bind(target);
      return (...args: unknown[]) => {
        const result = tail.then(() => value.apply(target, args));
        // A failed statement must not stop subsequent operations. Do not retry
        // a write: a finalize error can happen after the change was committed.
        tail = result.catch(() => undefined);
        return result;
      };
    },
  });
}

export async function getDb(): Promise<Database> {
  if (db) return db;
  if (!opening) {
    opening = (async () => {
      try {
        nativeDb = await SQLite.openDatabaseAsync(DB_NAME);
        const database = serializeDatabase(nativeDb);
        await database.execAsync("PRAGMA busy_timeout = 5000;");
        await database.execAsync("PRAGMA journal_mode = WAL;");
        await migrate(database);
        db = database;
        return database;
      } catch (error) {
        opening = null;
        db = null;
        throw error;
      }
    })();
  }
  return opening;
}

// The callback must use its supplied connection, never getDb(), to avoid
// queueing queries behind its own transaction. Network/file work stays outside.
export async function withDatabaseTransaction<T>(task: (database: Database) => Promise<T>): Promise<T> {
  const database = await getDb();
  let result!: T;
  await database.withTransactionAsync(async () => {
    result = await task(nativeDb!);
  });
  return result;
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
  if (!userColumns.some((column) => column.name === "wallet_balance")) {
    await database.execAsync("ALTER TABLE users ADD COLUMN wallet_balance REAL");
  }
  if (!userColumns.some((column) => column.name === "wallet_set_on")) {
    await database.execAsync("ALTER TABLE users ADD COLUMN wallet_set_on TEXT");
  }
  if (!userColumns.some((column) => column.name === "wallet_after_id")) {
    await database.execAsync("ALTER TABLE users ADD COLUMN wallet_after_id INTEGER NOT NULL DEFAULT 0");
  }
  if (!userColumns.some((column) => column.name === "wallet_recurring_month")) {
    await database.execAsync("ALTER TABLE users ADD COLUMN wallet_recurring_month TEXT");
  }

  if (!userColumns.some(column => column.name === "wallet_history")) {
    await database.execAsync("ALTER TABLE users ADD COLUMN wallet_history TEXT NOT NULL DEFAULT '[]'");
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

    CREATE TABLE IF NOT EXISTS loans (
      user_id INTEGER NOT NULL,
      id TEXT NOT NULL,
      data TEXT NOT NULL,
      PRIMARY KEY (user_id, id)
    );

    CREATE TABLE IF NOT EXISTS goals (
      id TEXT PRIMARY KEY,
      user_id INTEGER NOT NULL,
      title TEXT NOT NULL,
      target_amount REAL NOT NULL,
      saved_amount REAL NOT NULL DEFAULT 0,
      deadline TEXT,
      created_at TEXT NOT NULL
    );
  `);
  const goalColumns = await database.getAllAsync<{ name: string }>("PRAGMA table_info(goals)");
  if (!goalColumns.some(column => column.name === "category")) {
    await database.execAsync("ALTER TABLE goals ADD COLUMN category TEXT NOT NULL DEFAULT 'Inne'");
  }
  if (!goalColumns.some(column => column.name === "priority")) {
    await database.execAsync("ALTER TABLE goals ADD COLUMN priority INTEGER NOT NULL DEFAULT 2");
  }
  const receiptColumns = await database.getAllAsync<{ name: string }>("PRAGMA table_info(receipts)");
  if (!receiptColumns.some((column) => column.name === "standalone")) {
    await database.execAsync("ALTER TABLE receipts ADD COLUMN standalone INTEGER NOT NULL DEFAULT 0");
  }
  if (!receiptColumns.some((column) => column.name === "sync_version")) {
    await database.execAsync("ALTER TABLE receipts ADD COLUMN sync_version TEXT");
  }
  if (!entryColumns.some((column) => column.name === "recurring_key")) {
    await database.execAsync("ALTER TABLE entries ADD COLUMN recurring_key TEXT");
  }
  if (!entryColumns.some((column) => column.name === "loan_payment_key")) {
    await database.execAsync("ALTER TABLE entries ADD COLUMN loan_payment_key TEXT");
  }
  await database.execAsync("CREATE UNIQUE INDEX IF NOT EXISTS loan_payment_entry ON entries (user_id, loan_payment_key)");
}

export async function initDb() {
  await getDb();
}
