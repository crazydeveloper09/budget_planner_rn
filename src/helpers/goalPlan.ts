import { Goal, Member, Transaction, User } from "../db/interfaces";
import { dailyLimitAmount } from "./dailyLeftover";
import { allocateGoalSavings, orderedGoals } from "./goalAllocation";
import { toIsoDate } from "./dates";
import { recurringDate } from "./spendingPlan";
import { remainingAfterDay } from "./wallet";

const round = (value: number) => Math.round(value * 100) / 100;
const dateOf = (iso: string) => { const [y, m, d] = iso.split("-").map(Number); return new Date(y, m - 1, d); };
export function daysBetween(a: string, b: string) {
  const utc = (value: string) => { const [y, m, d] = value.split("-").map(Number); return Date.UTC(y, m - 1, d); };
  return Math.round((utc(b) - utc(a)) / 86400000);
}
export function dateAfterDays(today: string, days: number): string | null {
  if (!Number.isFinite(days) || days > 3650 || days < 0) return null;
  const date = dateOf(today); date.setDate(date.getDate() + days); return toIsoDate(date);
}
function matches(a: Transaction, b: Transaction) {
  return a.type === b.type && a.name === b.name && a.category === b.category && a.amount === b.amount && a.memberId === b.memberId;
}

export function expenseOutlook(profile: User | null, members: Member[], entries: Transaction[], amount: number, today = toIsoDate(new Date()), earliestDate = today) {
  let balance = remainingAfterDay(profile, entries, today);
  const empty = { date: null, days: null, cashDate: null, riskDate: null, shortfall: 0, checkedThrough: null, dailyLimit: dailyLimitAmount(profile, members) };
  if (balance == null) return empty;
  const dailyLimit = dailyLimitAmount(profile, members);
  const todaySpent = entries.filter(e => !e.regular && e.type === "expense" && e.date === today).reduce((sum, e) => sum + e.amount, 0);
  const cursor = dateOf(today);
  const forecast: { date: string; balance: number }[] = [];
  // Every candidate gets a full year of follow-up, including candidates near the search boundary.
  for (let days = 0; days <= 730; days++) {
    const date = toIsoDate(cursor);
    if (days > 0) {
      const posted = entries.filter(e => !e.regular && e.date === date && e.id > (profile?.walletAfterId ?? 0));
      for (const item of posted) balance += item.type === "income" ? item.amount : -item.amount;
      for (const item of entries.filter(e => e.regular)) {
        if (toIsoDate(recurringDate(item, cursor)) !== date || item.date > date || posted.some(e => matches(e, item))) continue;
        balance += item.type === "income" ? item.amount : -item.amount;
      }
    }
    // Recorded future expenses are reserved separately from the everyday spending goal.
    balance -= days === 0 ? Math.max(0, dailyLimit - todaySpent) : dailyLimit;
    balance = round(balance);
    forecast.push({ date, balance });
    cursor.setDate(cursor.getDate() + 1);
  }
  let cashDate: string | null = null;
  let riskDate: string | null = null;
  let shortfall = 0;
  let checkedThrough: string | null = null;
  for (let days = 0; days <= 365; days++) {
    const candidate = forecast[days];
    if (candidate.date < earliestDate || candidate.balance < amount) continue;
    const followUp = forecast.slice(days, days + 366);
    const risk = followUp.find(day => round(day.balance - amount) < 0);
    if (!cashDate) {
      cashDate = candidate.date;
      riskDate = risk?.date ?? null;
      shortfall = Math.max(0, round(amount - Math.min(...followUp.map(day => day.balance))));
      checkedThrough = followUp[365].date;
    }
    if (!risk) return { date: candidate.date, days, dailyLimit, cashDate, riskDate, shortfall, checkedThrough: followUp[365].date };
  }
  return { ...empty, dailyLimit, cashDate, riskDate, shortfall, checkedThrough };
}

export function goalPlan(goal: Goal, profile: User | null, members: Member[], entries: Transaction[], today = toIsoDate(new Date()), allGoals: Goal[] = [goal]) {
  const limit = dailyLimitAmount(profile, members);
  const queue = orderedGoals(allGoals.some(item => item.id === goal.id) ? allGoals : [...allGoals, goal]);
  const allocations = allocateGoalSavings(queue, entries, limit, today);
  const autoSaved = allocations.get(goal.id) ?? 0;
  const saved = round(goal.savedAmount + autoSaved);
  const remaining = Math.max(0, round(goal.targetAmount - saved));
  const ahead = queue.slice(0, queue.findIndex(item => item.id === goal.id)).filter(item => item.targetAmount > item.savedAmount + (allocations.get(item.id) ?? 0));
  const aheadAmount = round(ahead.reduce((sum, item) => sum + Math.max(0, item.targetAmount - item.savedAmount - (allocations.get(item.id) ?? 0)), 0));
  const fundingNeeded = remaining === 0 ? 0 : round(aheadAmount + remaining);
  const start = dateAfterDays(today, 0)!;
  const fromDate = dateOf(start); fromDate.setDate(fromDate.getDate() - 29);
  let from = toIsoDate(fromDate);
  const actual = entries.filter(e => !e.regular && e.date >= from && e.date <= today);
  // Days without records count once the observed period begins.
  const first = actual.map(e => e.date).sort()[0];
  if (first) from = first;
  const observedDays = Math.max(1, daysBetween(from, today) + 1);
  const expenses = actual.filter(e => e.type === "expense");
  const spent = expenses.reduce((sum, e) => sum + e.amount, 0);
  const dailySaving = expenses.length ? Math.max(0, round(limit - spent / observedDays)) : null;
  const categories = new Map<string, number>();
  for (const entry of expenses) categories.set(entry.category, (categories.get(entry.category) ?? 0) + entry.amount);
  const flexible = ["Rozrywka", "Zakupy", "Ubrania", "Jedzenie", "Transport", "Inne"];
  const suggestions = [...categories].filter(([category]) => flexible.includes(category)).sort((a, b) => b[1] - a[1]).slice(0, 3).map(([category, amount]) => ({ category, amount: round(amount), dailyCut: round(amount * 0.2 / observedDays), potential: round(amount * 0.2) }));
  const days = dailySaving != null && dailySaving > 0 ? Math.ceil(fundingNeeded / dailySaving) : null;
  const deadlineDays = goal.deadline ? Math.max(0, daysBetween(today, goal.deadline) + 1) : null;
  return { aheadAmount, aheadCount: ahead.length, fundingNeeded, queuePosition: queue.findIndex(item => item.id === goal.id) + 1, limit, averageDailySpent: expenses.length ? round(spent / observedDays) : null, saved, autoSaved, remaining, dailySaving, observedDays, from, suggestions, days: remaining === 0 ? 0 : days, estimatedDate: remaining === 0 ? today : days == null ? null : dateAfterDays(today, days), requiredDaily: deadlineDays != null && deadlineDays > 0 ? Math.ceil(fundingNeeded / deadlineDays * 100) / 100 : null, overdue: goal.deadline != null && goal.deadline < today };
}

export function goalLimitScenario(limit: number, averageDailySpent: number | null, remaining: number, proposedLimit: number, requiredDaily: number | null, today = toIsoDate(new Date())) {
  // Keep the original budget as the funding envelope. Lowering a cap only helps if spending falls.
  const plannedSpending = Math.min(averageDailySpent ?? limit, proposedLimit);
  const dailySaving = Math.max(0, round(limit - plannedSpending));
  const days = remaining <= 0 ? 0 : dailySaving > 0 ? Math.ceil(remaining / dailySaving) : null;
  const suggestedLimit = requiredDaily != null ? Math.max(0, Math.floor((limit - requiredDaily) * 100) / 100) : Math.max(0, Math.floor((averageDailySpent ?? limit) * 0.8 * 100) / 100);
  return { dailySaving, days, date: days == null ? null : dateAfterDays(today, days), suggestedLimit: Math.min(limit, suggestedLimit), impossible: requiredDaily != null && requiredDaily > limit, shortfall: requiredDaily == null ? 0 : Math.max(0, round(requiredDaily - limit)), meetsDeadline: requiredDaily == null ? null : dailySaving >= requiredDaily };
}
