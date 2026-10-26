import { NewTransaction, Transaction, TransactionType } from "./interfaces";
import { getDb } from "./init";
import { SHARED_OWNER_ID } from "../helpers/owners";

type EntryRow = {
  id: number;
  user_id: number;
  entry_date: string;
  entry_kind: TransactionType;
  title: string;
  category: string;
  amount: number;
  is_regular: number;
  member_id: number;
};

function mapEntry(row: EntryRow): Transaction {
  return {
    id: row.id,
    userId: row.user_id,
    date: row.entry_date,
    type: row.entry_kind,
    name: row.title ?? "",
    category: row.category,
    amount: row.amount,
    regular: Boolean(row.is_regular),
    memberId: row.member_id ? row.member_id : null,
  };
}

export async function listTransactions(userId: number): Promise<Transaction[]> {
  const database = await getDb();
  const rows = await database.getAllAsync<EntryRow>(
    `SELECT id, user_id, entry_date, entry_kind, title, category, amount, is_regular, member_id
     FROM entries WHERE user_id = ? ORDER BY id DESC`,
    [Number(userId)]
  );

  return rows.map(mapEntry);
}

export async function addTransaction(userId: number, input: NewTransaction): Promise<Transaction> {
  const database = await getDb();
  const title = String(input.name ?? "").trim();
  const category = String(input.category ?? "").trim();
  const amount = Number(input.amount);
  const isRegular = input.regular ? 1 : 0;
  const memberId = Number(input.memberId ?? SHARED_OWNER_ID);

  const params = {
    $userId: Number(userId),
    $entryDate: String(input.date),
    $entryKind: String(input.type),
    $title: title,
    $category: category,
    $amount: amount,
    $isRegular: isRegular,
    $memberId: memberId,
  };

  let result: { lastInsertRowId: number };
  try {
    result = await database.runAsync(
      `INSERT INTO entries (user_id, entry_date, entry_kind, title, category, amount, is_regular, member_id)
       VALUES ($userId, $entryDate, $entryKind, $title, $category, $amount, $isRegular, $memberId)`,
      params
    );
  } catch {
    const escaped = (value: string) => value.replace(/'/g, "''");
    await database.execAsync(
      `INSERT INTO entries (user_id, entry_date, entry_kind, title, category, amount, is_regular, member_id)
       VALUES (${params.$userId}, '${escaped(params.$entryDate)}', '${escaped(params.$entryKind)}', '${escaped(params.$title)}', '${escaped(params.$category)}', ${params.$amount}, ${params.$isRegular}, ${params.$memberId})`
    );
    const row = await database.getFirstAsync<{ id: number }>(
      "SELECT id FROM entries ORDER BY id DESC LIMIT 1"
    );
    result = { lastInsertRowId: row?.id ?? 0 };
  }

  return {
    id: Number(result.lastInsertRowId),
    userId: Number(userId),
    date: String(input.date),
    type: input.type,
    name: title,
    category,
    amount,
    regular: Boolean(isRegular),
    memberId: memberId || null,
  };
}

export async function removeTransaction(id: number): Promise<void> {
  const database = await getDb();
  await database.runAsync("DELETE FROM entries WHERE id = $id", { $id: Number(id) });
}

export async function replaceRegularTransactions(
  userId: number,
  items: NewTransaction[]
): Promise<void> {
  const database = await getDb();
  await database.runAsync("DELETE FROM entries WHERE user_id = ? AND is_regular = 1", [Number(userId)]);
  for (const item of items) {
    await addTransaction(userId, item);
  }
}

export async function replaceAllTransactions(userId: number, items: NewTransaction[]): Promise<void> {
  const database = await getDb();
  await database.runAsync("DELETE FROM entries WHERE user_id = ?", [Number(userId)]);
  for (const item of items) {
    await addTransaction(userId, item);
  }
}
