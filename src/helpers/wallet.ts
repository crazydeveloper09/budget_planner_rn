import { Transaction, User } from "../db/interfaces";

export function walletNet(
  entries: Transaction[],
  afterId: number,
  throughDate?: string
) {
  return entries.reduce((sum, entry) => {
    if (entry.regular || entry.id <= afterId) return sum;
    if (throughDate && entry.date > throughDate) return sum;
    if (entry.type === "income") return sum + entry.amount;
    if (entry.type === "expense") return sum - entry.amount;
    return sum;
  }, 0);
}

export function currentWallet(profile: User | null, entries: Transaction[]) {
  if (!profile || profile.walletBalance == null) return null;
  return Math.round((profile.walletBalance + walletNet(entries, profile.walletAfterId ?? 0)) * 100) / 100;
}

export function remainingAfterDay(profile: User | null, entries: Transaction[], date: string) {
  if (!profile || profile.walletBalance == null) return null;
  return (
    Math.round((profile.walletBalance + walletNet(entries, profile.walletAfterId ?? 0, date)) * 100) / 100
  );
}

export function canAffordExpense(
  profile: User | null,
  entries: Transaction[],
  date: string,
  amount: number
) {
  const remaining = remainingAfterDay(profile, entries, date);
  if (remaining == null) return true;
  return amount <= remaining + 0.001;
}

