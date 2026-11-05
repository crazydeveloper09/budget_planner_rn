import { Transaction, User, WalletAdjustment } from "../db/interfaces";
import { toIsoDate } from "./dates";

export type WalletHistoryDay = {
  date: string;
  transactions: Transaction[];
  adjustments: WalletAdjustment[];
  income: number;
  expense: number;
  correction: number;
};

export function walletHistoryDays(profile: User | null, entries: Transaction[], today = toIsoDate(new Date())): WalletHistoryDay[] {
  if (!profile) return [];
  const days = new Map<string, WalletHistoryDay>();
  const day = (date: string) => {
    if (!days.has(date)) days.set(date, { date, transactions: [], adjustments: [], income: 0, expense: 0, correction: 0 });
    return days.get(date)!;
  };
  for (const entry of entries) {
    if (entry.regular || entry.date > today) continue;
    const group = day(entry.date);
    group.transactions.push(entry);
    if (entry.type === "income") group.income += entry.amount;
    else group.expense += entry.amount;
  }
  const history = profile.walletHistory?.length ? profile.walletHistory : profile.walletBalance == null ? [] : [{
    id: "legacy-baseline", date: profile.walletSetOn ?? today, createdAt: null, before: null, after: profile.walletBalance,
  }];
  for (const adjustment of history) {
    if (adjustment.date > today) continue;
    const group = day(adjustment.date);
    group.adjustments.push(adjustment);
    if (adjustment.before != null) group.correction += adjustment.after - adjustment.before;
  }
  for (const group of days.values()) {
    group.adjustments.sort((a, b) => (b.createdAt ?? "").localeCompare(a.createdAt ?? ""));
    group.transactions.sort((a, b) => b.id - a.id);
    group.correction = Math.round(group.correction * 100) / 100;
  }
  return [...days.values()].sort((a, b) => b.date.localeCompare(a.date));
}
