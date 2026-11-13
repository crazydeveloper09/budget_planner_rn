import { Transaction, User } from "../db/interfaces";
import { toIsoDate } from "./dates";
import { remainingAfterDay } from "./wallet";

export function recurringDate(entry: Transaction, month: Date): Date {
  // Existing templates used the 10th. New templates encode the selected day in January 2000.
  const day = entry.date.startsWith("2000-01-") ? Number(entry.date.slice(8, 10)) : 10;
  return new Date(month.getFullYear(), month.getMonth(), Math.min(day, new Date(month.getFullYear(), month.getMonth() + 1, 0).getDate()));
}

export function recurringPostingKey(entry: Transaction, date = entry.date): string {
  return JSON.stringify([date, entry.type, entry.name, entry.category, entry.amount, entry.memberId ?? 0]);
}

export function recurringExpenseKey(entry: Transaction, month: Date): string {
  const period = toIsoDate(month).slice(0, 7);
  return JSON.stringify([entry.recurringKey ?? recurringPostingKey(entry), period]);
}

export function recurringExpensePaid(entry: Transaction, month: Date, entries: Transaction[]): boolean {
  const key = recurringExpenseKey(entry, month);
  const due = toIsoDate(recurringDate(entry, month));
  const legacyKey = recurringPostingKey(entry, due);
  return entries.some(item => !item.regular && item.type === "expense" &&
    (item.recurringKey === key || (!item.recurringKey && !item.loanPaymentKey && recurringPostingKey(item) === legacyKey)));
}

export function spendingPlan(profile: User | null, entries: Transaction[], now = new Date()) {
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const todayIso = toIsoDate(today);
  const balance = remainingAfterDay(profile, entries, todayIso);
  if (balance == null) return null;
  const spentToday = entries.filter(e => !e.regular && e.type === "expense" && e.date === todayIso && !entries.some(template => template.regular && template.type === "expense" && template.name === e.name && template.category === e.category && template.amount === e.amount && template.memberId === e.memberId && toIsoDate(recurringDate(template, today)) === todayIso)).reduce((sum, e) => sum + e.amount, 0);
  const monthEnd = new Date(today.getFullYear(), today.getMonth() + 1, 0);
  const nextIncome = entries.filter(e => e.regular && e.type === "income").map(e => {
    let date = recurringDate(e, today);
    if (date <= today) date = recurringDate(e, new Date(today.getFullYear(), today.getMonth() + 1, 1));
    return date;
  }).sort((a, b) => a.getTime() - b.getTime())[0];
  const calculate = (end: Date) => {
    const endIso = toIsoDate(end);
    let reserve = 0;
    for (const entry of entries.filter(e => e.regular && e.type === "expense")) {
      for (let month = new Date(today.getFullYear(), today.getMonth(), 1); month <= end; month.setMonth(month.getMonth() + 1)) {
        const due = toIsoDate(recurringDate(entry, month));
        if (due > endIso) continue;
        const posted = recurringExpensePaid(entry, month, entries);
        if (!posted) reserve += entry.amount;
      }
    }
    // Future recorded expenses are commitments; future income is not available yet.
    reserve += entries.filter(e => !e.regular && e.type === "expense" && e.id > (profile?.walletAfterId ?? 0) && e.date > todayIso && e.date <= endIso).reduce((sum, e) => sum + e.amount, 0);
    const days = Math.round((Date.UTC(end.getFullYear(), end.getMonth(), end.getDate()) - Date.UTC(today.getFullYear(), today.getMonth(), today.getDate())) / 86400000) + 1;
    return { daily: Math.floor(Math.max(0, balance - reserve) / days * 100) / 100, days, reserve, available: balance - reserve };
  };
  const beforeIncome = nextIncome ? new Date(nextIncome.getFullYear(), nextIncome.getMonth(), nextIncome.getDate() - 1) : null;
  return { spentToday, month: calculate(monthEnd), next: beforeIncome ? calculate(beforeIncome) : null, nextIncome: nextIncome ? toIsoDate(nextIncome) : null };
}

export function assessDailyGoal(period: { available: number; days: number }, dailyGoal: number, spentToday: number) {
  // Today's recorded spending has already reduced the wallet balance.
  const remainingToday = Math.max(0, dailyGoal - spentToday);
  const plannedSpending = Math.round((dailyGoal * (period.days - 1) + remainingToday) * 100) / 100;
  const savings = Math.round((period.available - plannedSpending) * 100) / 100;
  return { savings, remainingToday };
}
