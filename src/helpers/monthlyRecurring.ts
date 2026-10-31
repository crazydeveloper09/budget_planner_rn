import { getProfile, updateProfile } from "../db/profile";
import { addTransaction, listTransactions } from "../db/transactions";
import { monthKey } from "./dates";
import { Transaction } from "../db/interfaces";

function stamp(entry: Pick<Transaction, "type" | "name" | "category" | "amount" | "memberId">) {
  return `${entry.type}|${entry.name}|${entry.category}|${entry.amount}|${entry.memberId ?? 0}`;
}

export async function applyMonthlyRecurringIfDue(): Promise<boolean> {
  const profile = await getProfile();
  if (!profile) return false;

  const now = new Date();
  if (now.getDate() < 10) return false;

  const currentMonth = monthKey(now);
  if (profile.walletRecurringMonth === currentMonth) return false;

  if (!profile.walletRecurringMonth) {
    await updateProfile(profile.id, { walletRecurringMonth: currentMonth });
    return true;
  }

  const applyDate = `${currentMonth}-10`;
  const entries = await listTransactions(profile.id);
  const posted = new Set(
    entries.filter((entry) => !entry.regular && entry.date === applyDate).map(stamp)
  );
  const recurring = entries.filter((entry) => entry.regular);

  for (const item of recurring) {
    if (posted.has(stamp(item))) continue;
    await addTransaction(profile.id, {
      date: applyDate,
      type: item.type,
      name: item.name,
      category: item.category,
      amount: item.amount,
      regular: false,
      memberId: item.memberId,
    });
    posted.add(stamp(item));
  }

  await updateProfile(profile.id, { walletRecurringMonth: currentMonth });
  return true;
}
