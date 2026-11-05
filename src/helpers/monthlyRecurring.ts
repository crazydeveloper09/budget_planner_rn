import { getProfile, updateProfile } from "../db/profile";
import { addTransaction, listTransactions } from "../db/transactions";
import { recurringDate } from "./spendingPlan";
import { toIsoDate } from "./dates";
import { monthKey } from "./dates";
import { Transaction } from "../db/interfaces";

function stamp(entry: Pick<Transaction, "type" | "name" | "category" | "amount" | "memberId">) {
  return `${entry.type}|${entry.name}|${entry.category}|${entry.amount}|${entry.memberId ?? 0}`;
}

export async function applyMonthlyRecurringIfDue(): Promise<boolean> {
  const profile = await getProfile();
  if (!profile) return false;

  const now = new Date();
  const currentMonth = monthKey(now);
  const today = toIsoDate(now);
  const entries = await listTransactions(profile.id);
  const posted = new Set(entries.filter(entry => !entry.regular).map(entry => entry.date + "|" + stamp(entry)));
  let changed = false;
  for (const item of entries.filter(entry => entry.regular)) {
    const applyDate = toIsoDate(recurringDate(item, now));
    // The wallet snapshot already includes transactions on and before its date.
    if (applyDate > today || (profile.walletSetOn && applyDate <= profile.walletSetOn)) continue;
    if (item.date > applyDate) continue;
    const key = applyDate + "|" + stamp(item);
    if (posted.has(key)) continue;
    await addTransaction(profile.id, {
      date: applyDate, type: item.type, name: item.name, category: item.category,
      amount: item.amount, regular: false, memberId: item.memberId,
    });
    posted.add(key);
    changed = true;
  }
  if (profile.walletRecurringMonth !== currentMonth) {
    await updateProfile(profile.id, { walletRecurringMonth: currentMonth });
    changed = true;
  }
  return changed;
}
