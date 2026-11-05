import { NewTransaction, Transaction, TransactionType, WalletAdjustment } from "./interfaces";
import { getDb, withDatabaseTransaction } from "./init";
import { SHARED_OWNER_ID } from "../helpers/owners";
import { getRandomBytes } from "expo-crypto";
import { bytesToHex } from "../crypto/bytes";
import { toIsoDate } from "../helpers/dates";
import { walletNet } from "../helpers/wallet";

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

export async function updateTransaction(id: number, input: NewTransaction, userId: number): Promise<Transaction> {
  return withDatabaseTransaction(async (database) => {
    const rows = await database.getAllAsync<EntryRow>("SELECT * FROM entries WHERE user_id = ?", [Number(userId)]);
    const entries = rows.map(mapEntry);
    const original = entries.find(entry => entry.id === id);
    if (!original) throw new Error("Nie znaleziono transakcji do edycji.");
    const updated: Transaction = {
      ...original, date: String(input.date), type: input.type,
      name: String(input.name ?? "").trim(), category: String(input.category ?? "").trim(),
      amount: Number(input.amount), regular: Boolean(input.regular),
      memberId: Number(input.memberId ?? SHARED_OWNER_ID) || null,
    };
    const net = (entry: Transaction) => entry.regular ? 0 : entry.type === "income" ? entry.amount : -entry.amount;
    const delta = Math.round((net(updated) - net(original)) * 100) / 100;
    if (delta !== 0) {
      const profile = await database.getFirstAsync<{
        wallet_balance: number | null; wallet_after_id: number; wallet_set_on: string | null; wallet_history: string;
      }>("SELECT wallet_balance, wallet_after_id, wallet_set_on, wallet_history FROM users WHERE id = ?", [Number(userId)]);
      if (profile?.wallet_balance != null) {
        const before = Math.round((profile.wallet_balance + walletNet(entries, profile.wallet_after_id)) * 100) / 100;
        const now = new Date();
        const history: WalletAdjustment[] = JSON.parse(profile.wallet_history || "[]");
        const newId = () => "wa_" + bytesToHex(getRandomBytes(16));
        if (!history.length) history.push({ id: newId(), date: profile.wallet_set_on ?? toIsoDate(now), createdAt: null, before: null, after: profile.wallet_balance });
        const detail = (entry: Transaction) => ({ date: entry.date, type: entry.type, name: entry.name, category: entry.category, amount: entry.amount, regular: entry.regular });
        history.push({ id: newId(), date: toIsoDate(now), createdAt: now.toISOString(), before,
          after: Math.round((before + delta) * 100) / 100, reason: "transaction_updated",
          editedTransaction: { before: detail(original), after: detail(updated) },
        });
        const baseline = original.id <= profile.wallet_after_id
          ? Math.round((profile.wallet_balance + delta) * 100) / 100 : profile.wallet_balance;
        await database.runAsync("UPDATE users SET wallet_balance = ?, wallet_history = ? WHERE id = ?", [baseline, JSON.stringify(history), Number(userId)]);
      }
    }
    await database.runAsync(
      "UPDATE entries SET entry_date = ?, entry_kind = ?, title = ?, category = ?, amount = ?, is_regular = ?, member_id = ? WHERE id = ? AND user_id = ?",
      [updated.date, updated.type, updated.name, updated.category, updated.amount, updated.regular ? 1 : 0, updated.memberId ?? SHARED_OWNER_ID, Number(id), Number(userId)]
    );
    return updated;
  });
}

export async function removeTransaction(id: number, userId: number): Promise<void> {
  await withDatabaseTransaction(async (database) => {
    const rows = await database.getAllAsync<EntryRow>("SELECT * FROM entries WHERE user_id = ?", [Number(userId)]);
    const entries = rows.map(mapEntry);
    const entry = entries.find(item => item.id === id);
    if (!entry) return; // Repeated deletion must never refund twice.
    const profile = await database.getFirstAsync<{
      wallet_balance: number | null; wallet_after_id: number; wallet_set_on: string | null; wallet_history: string;
    }>("SELECT wallet_balance, wallet_after_id, wallet_set_on, wallet_history FROM users WHERE id = ?", [Number(userId)]);
    if (profile?.wallet_balance != null && !entry.regular) {
      const before = Math.round((profile.wallet_balance + walletNet(entries, profile.wallet_after_id)) * 100) / 100;
      const delta = entry.type === "expense" ? entry.amount : -entry.amount;
      const after = Math.round((before + delta) * 100) / 100;
      const now = new Date();
      const history: WalletAdjustment[] = JSON.parse(profile.wallet_history || "[]");
      if (!history.length) history.push({
        id: `wa_${bytesToHex(getRandomBytes(16))}`, date: profile.wallet_set_on ?? toIsoDate(now),
        createdAt: null, before: null, after: profile.wallet_balance,
      });
      history.push({
        id: `wa_${bytesToHex(getRandomBytes(16))}`, date: toIsoDate(now), createdAt: now.toISOString(),
        before, after, reason: "transaction_deleted",
        deletedTransaction: { date: entry.date, type: entry.type, name: entry.name, category: entry.category, amount: entry.amount },
      });
      // New entries refund themselves when deleted. Entries already absorbed by
      // the wallet baseline need that baseline adjusted instead.
      const baseline = entry.id <= profile.wallet_after_id
        ? Math.round((profile.wallet_balance + delta) * 100) / 100 : profile.wallet_balance;
      await database.runAsync("UPDATE users SET wallet_balance = ?, wallet_history = ? WHERE id = ?", [baseline, JSON.stringify(history), Number(userId)]);
    }
    await database.runAsync("DELETE FROM entries WHERE id = ? AND user_id = ?", [Number(id), Number(userId)]);
  });
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
