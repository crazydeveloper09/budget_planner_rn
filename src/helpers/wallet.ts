import { Alert } from "react-native";
import { Transaction, User } from "../db/interfaces";
import { formatPln } from "./money";

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

export function confirmIfOverBudget(input: {
  remaining: number | null;
  amount: number;
  isExpense: boolean;
}): Promise<boolean> {
  if (!input.isExpense || input.remaining == null || input.amount <= input.remaining + 0.001) {
    return Promise.resolve(true);
  }
  return new Promise((resolve) => {
    Alert.alert(
      "Może zabraknąć",
      `Po tym dniu zostaje ${formatPln(input.remaining)}. Ten wydatek to ${formatPln(input.amount)}. Zapisać mimo to?`,
      [
        { text: "Anuluj", style: "cancel", onPress: () => resolve(false) },
        { text: "Zapisz", onPress: () => resolve(true) },
      ]
    );
  });
}
