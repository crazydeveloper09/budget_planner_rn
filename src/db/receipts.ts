import { NewReceipt, Receipt, Transaction } from "./interfaces";
import { getDb } from "./init";
import { deleteReceiptFile, receiptUri } from "../helpers/receiptFiles";

type ReceiptRow = {
  id: string;
  user_id: number;
  entry_id: number | null;
  entry_date: string;
  title: string;
  category: string;
  amount: number;
  owner_name: string | null;
  created_at: string;
  file_name: string;
};

function mapReceipt(row: ReceiptRow): Receipt {
  return {
    id: row.id,
    userId: row.user_id,
    entryId: row.entry_id ? Number(row.entry_id) : null,
    date: row.entry_date,
    name: row.title ?? "",
    category: row.category,
    amount: row.amount,
    ownerName: row.owner_name,
    createdAt: row.created_at,
    fileName: row.file_name,
    uri: receiptUri(row.file_name),
  };
}

export function receiptMatchKey(item: {
  date: string;
  name: string;
  category: string;
  amount: number;
}) {
  return `${item.date}|${item.name}|${item.category}|${item.amount}`;
}

function matchMap(entries: Transaction[]) {
  const unused = new Map<string, number[]>();
  for (const entry of entries) {
    if (entry.type !== "expense" || entry.regular) continue;
    const key = receiptMatchKey(entry);
    unused.set(key, [...(unused.get(key) ?? []), entry.id]);
  }
  return unused;
}

export async function listReceipts(userId: number): Promise<Receipt[]> {
  const database = await getDb();
  const rows = await database.getAllAsync<ReceiptRow>(
    `SELECT id, user_id, entry_id, entry_date, title, category, amount, owner_name, created_at, file_name
     FROM receipts WHERE user_id = ? ORDER BY created_at DESC`,
    [Number(userId)]
  );
  return rows.map(mapReceipt);
}

export async function getReceipt(id: string): Promise<Receipt | null> {
  const database = await getDb();
  const row = await database.getFirstAsync<ReceiptRow>(
    `SELECT id, user_id, entry_id, entry_date, title, category, amount, owner_name, created_at, file_name
     FROM receipts WHERE id = ?`,
    [id]
  );
  return row ? mapReceipt(row) : null;
}

export async function insertReceipt(userId: number, input: NewReceipt): Promise<Receipt> {
  const database = await getDb();
  await database.runAsync(
    `INSERT OR REPLACE INTO receipts (id, user_id, entry_id, entry_date, title, category, amount, owner_name, created_at, file_name)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      input.id,
      Number(userId),
      input.entryId,
      input.date,
      input.name,
      input.category,
      input.amount,
      input.ownerName,
      input.createdAt,
      input.fileName,
    ]
  );
  return { ...input, userId: Number(userId) };
}

export async function rematchReceipts(userId: number, entries: Transaction[]): Promise<void> {
  const unused = matchMap(entries);
  const items = await listReceipts(userId);
  const database = await getDb();
  for (const item of items) {
    const key = receiptMatchKey(item);
    const ids = unused.get(key) ?? [];
    const entryId = ids.shift() ?? null;
    unused.set(key, ids);
    await database.runAsync("UPDATE receipts SET entry_id = ? WHERE id = ?", [entryId, item.id]);
  }
}

export async function listReceiptTombstones(): Promise<string[]> {
  const database = await getDb();
  const rows = await database.getAllAsync<{ id: string }>("SELECT id FROM receipt_tombstones");
  return rows.map((row) => row.id);
}

export async function addReceiptTombstone(id: string): Promise<void> {
  const database = await getDb();
  await database.runAsync("INSERT OR REPLACE INTO receipt_tombstones (id) VALUES (?)", [id]);
}

export async function clearReceiptTombstone(id: string): Promise<void> {
  const database = await getDb();
  await database.runAsync("DELETE FROM receipt_tombstones WHERE id = ?", [id]);
}

export async function removeReceipt(id: string, options?: { tombstone?: boolean }): Promise<void> {
  const database = await getDb();
  const row = await database.getFirstAsync<ReceiptRow>(
    "SELECT id, user_id, entry_id, entry_date, title, category, amount, owner_name, created_at, file_name FROM receipts WHERE id = ?",
    [id]
  );
  await database.runAsync("DELETE FROM receipts WHERE id = ?", [id]);
  if (row) await deleteReceiptFile(receiptUri(row.file_name));
  if (options?.tombstone !== false) await addReceiptTombstone(id);
}

export async function removeReceiptsForEntry(entryId: number): Promise<void> {
  const database = await getDb();
  const rows = await database.getAllAsync<ReceiptRow>(
    "SELECT id, user_id, entry_id, entry_date, title, category, amount, owner_name, created_at, file_name FROM receipts WHERE entry_id = ?",
    [Number(entryId)]
  );
  await database.runAsync("DELETE FROM receipts WHERE entry_id = ?", [Number(entryId)]);
  for (const row of rows) {
    await deleteReceiptFile(receiptUri(row.file_name));
    await addReceiptTombstone(row.id);
  }
}

export async function replaceReceipts(
  userId: number,
  items: NewReceipt[],
  entries: Transaction[]
): Promise<Receipt[]> {
  const unused = matchMap(entries);
  const created: Receipt[] = [];
  for (const item of items) {
    const key = receiptMatchKey(item);
    const ids = unused.get(key) ?? [];
    const entryId = ids.shift() ?? item.entryId ?? null;
    unused.set(key, ids);
    created.push(
      await insertReceipt(userId, {
        ...item,
        entryId,
      })
    );
  }
  return created;
}
